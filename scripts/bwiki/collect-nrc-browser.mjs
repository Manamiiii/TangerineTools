import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'
import { parseSyncOptions } from './sync-nrc.mjs'
import { NRC_PAGES, parseNrcCreatures, parseNrcSkills, parseNrcDetail } from './lib/nrc-parser.mjs'
import { readSnapshot, sha256, writeJsonAtomic } from './lib/snapshots.mjs'
import { captureBrowserDetail, validateBrowserCapture } from './lib/browser-capture.mjs'

export function browserOptions(args) {
  if (args.includes('--offline')) throw new Error('Browser collection is online; use sync:bwiki:nrc --offline for staging')
  return parseSyncOptions(args.some(a => a.startsWith('--interval=')) ? args : [...args, '--interval=60'])
}

export async function waitForDetailToSettle(page, { quietMs = 3000, timeoutMs = 30000 } = {}) {
  await page.locator('.roco-dex').evaluate((root, { quietMs, timeoutMs }) => new Promise((resolve, reject) => {
    let quietTimer
    const finish = error => {
      clearTimeout(quietTimer)
      clearTimeout(deadline)
      observer.disconnect()
      if (error) reject(error)
      else resolve()
    }
    const restart = () => {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(() => finish(), quietMs)
    }
    const observer = new MutationObserver(restart)
    const deadline = setTimeout(() => finish(new Error('Browser detail did not settle; stop capture')), timeoutMs)
    observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
    restart()
  }), { quietMs, timeoutMs })
}

export async function persistCapture(directory, creature, record) {
  validateBrowserCapture(record, { version: record.version, sourceId: creature.sourceId, sourceUrl: creature.detailUrl })
  const captureFile = resolve(directory, 'browser-captures', `${creature.sourceId}.capture.json`)
  await mkdir(resolve(directory, 'browser-captures'), { recursive: true })
  try { await writeFile(captureFile, JSON.stringify(record), { flag: 'wx' }) } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const previous = JSON.parse(await readFile(captureFile, 'utf8'))
    validateBrowserCapture(previous, { version: record.version, sourceId: creature.sourceId, sourceUrl: creature.detailUrl })
    if (previous.html !== record.html) throw new Error('Capture already exists with different content; investigate before resuming')
    record = previous
  }
  const snapshot = { sourceUrl: record.sourceUrl, version: record.version, capturedAt: record.capturedAt, method: 'browser-dom-verified', sha256: sha256(record.html), html: record.html }
  // Exclusive creation prevents a concurrent collector from replacing a successful cache.
  await writeFile(resolve(directory, `${creature.sourceId}.json`), JSON.stringify(snapshot), { flag: 'wx' })
}

export async function collectBrowserDetails({ context, directory, version, limit, interval, pause = delay, log = console.log }) {
  const cachedCatalog = await readSnapshot(directory, 'creatures', NRC_PAGES.creatures, version)
  const creatures = parseNrcCreatures(cachedCatalog.html)
  const skills = parseNrcSkills((await readSnapshot(directory, 'skills', NRC_PAGES.skills, version)).html)
  const names = new Set(skills.map(s => s.name))
  const pending = []
  for (const creature of creatures) {
    try {
      const cache = await readSnapshot(directory, creature.sourceId, creature.detailUrl, version)
      parseNrcDetail(cache.html, creature)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      pending.push(creature)
    }
  }
  let saved = 0
  const status = async (state, extra = {}) => writeJsonAtomic(resolve(directory, 'browser-status.json'), {
    version, pid: process.pid, state, updatedAt: new Date().toISOString(), total: creatures.length,
    cached: creatures.length - pending.length + saved, savedThisRun: saved, ...extra,
  })
  if (!pending.length || !limit) { await status('complete'); return { saved, remaining: pending.length } }
  let target = NRC_PAGES.creatures
  let fault = null
  const watch = page => {
    page.on('response', response => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame() && response.status() >= 400) fault = new Error(`HTTP ${response.status()}: stop browser collection`)
    })
    page.on('requestfailed', request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) fault = new Error(`Navigation failed: ${request.failure()?.errorText}`)
    })
  }
  context.on('page', watch)
  const assertPage = async page => {
    if (fault) throw fault
    const text = await page.locator('body').innerText()
    if (/验证码|访问受限|访问过于频繁|安全验证|Access Denied|Verify you are human|Just a moment/i.test(text.slice(0, 2000))) throw new Error('Access verification/restriction shown; stop without retry')
  }
  try {
    const catalog = await context.newPage()
    await status('opening-catalog')
    log(`Browser: open catalog; ${pending.length} details missing`)
    await catalog.goto(NRC_PAGES.creatures, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await assertPage(catalog)
    await catalog.locator('.npc-grid').waitFor({ state: 'visible', timeout: 20000 })
    const live = parseNrcCreatures(await catalog.locator('.npc-grid').evaluate(e => e.outerHTML))
    const normalize = rows => JSON.stringify([...rows].sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
    if (normalize(live) !== normalize(creatures)) throw new Error('Live catalog differs from this batch; use a new version after review')
    for (const creature of pending.slice(0, limit)) {
      target = creature.detailUrl
      await status('waiting', { next: creature.name, sourceUrl: target })
      log(`Browser waiting ${interval}s before clicking ${creature.name}`)
      await pause(interval * 1000)
      await assertPage(catalog)
      // Acknowledge only the site's known copyright notice through its UI.
      const welcome = catalog.locator('.nrc-site-welcome')
      if (await welcome.isVisible()) {
        await welcome.getByRole('button', { name: '我知道了', exact: true }).click({ timeout: 20000 })
        await welcome.waitFor({ state: 'hidden', timeout: 10000 })
        await catalog.waitForLoadState('domcontentloaded', { timeout: 20000 })
        await catalog.locator('.npc-grid').waitFor({ state: 'visible', timeout: 20000 })
        await assertPage(catalog)
      }
      const link = catalog.locator(`.npc-card[data-id="${creature.sourceId}"] a`)
      const links = await link.evaluateAll(elements => elements.map(e => e.href))
      if (links.length !== 1 || links[0] !== target) throw new Error(`Catalog link mismatch: ${creature.name}`)
      const detail = catalog
      await Promise.all([
        detail.waitForURL(target, { waitUntil: 'domcontentloaded', timeout: 30000 }),
        link.click({ timeout: 20000 }),
      ])
      await assertPage(detail)
      await detail.locator('.roco-dex').waitFor({ state: 'attached', timeout: 20000 })
      // Wait for a quiet DOM before starting the independent strict two-pass check.
      await waitForDetailToSettle(detail)
      const record = await captureBrowserDetail({
        expected: { version, sourceId: creature.sourceId, sourceUrl: target },
        readMetadata: () => detail.evaluate(() => {
          const roots = document.querySelectorAll('.roco-dex')
          return { sourceUrl: location.href, sourceId: roots[0]?.getAttribute('data-pet-id'), rootCount: roots.length, characters: roots[0]?.outerHTML.length, ready: document.readyState !== 'loading' }
        }),
        readChunk: (start, end) => detail.locator('.roco-dex').evaluate((e, range) => e.outerHTML.slice(range.start, range.end), { start, end }),
        pause,
      })
      const parsed = parseNrcDetail(record.html, creature)
      const missingSkills = parsed.skills.filter(s => !names.has(s.name)).map(s => s.name)
      if (missingSkills.length) throw new Error(`Detail has skills absent from this batch: ${missingSkills.join(', ')}`)
      if (fault) throw fault
      await persistCapture(directory, creature, record)
      saved++
      await status('captured', { last: creature.name })
      log(`Browser saved ${creature.sourceId} ${creature.name}; total ${creatures.length - pending.length + saved}/${creatures.length}`)
      if (saved < Math.min(pending.length, limit)) {
        log(`Browser waiting ${interval}s before returning to catalog`)
        await pause(interval * 1000)
        await catalog.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 })
        await assertPage(catalog)
        await catalog.locator('.npc-grid').waitFor({ state: 'visible', timeout: 20000 })
      }
    }
    await status(saved === pending.length ? 'complete' : 'batch-complete')
    return { saved, remaining: pending.length - saved }
  } catch (error) {
    const page = context.pages().at(-1)
    if (page && !page.isClosed()) {
      try {
        await writeJsonAtomic(resolve(directory, 'browser-error-page.json'), { url: page.url(), title: await page.title(), text: (await page.locator('body').innerText({ timeout: 2000 })).slice(0, 3000) })
        await page.screenshot({ path: resolve(directory, 'browser-error-page.png'), timeout: 3000 })
      } catch { /* Diagnostics must not replace the original collection failure. */ }
    }
    await status('stopped', { sourceUrl: target, error: error.message })
    await writeJsonAtomic(resolve(directory, 'browser-last-failure.json'), { version, sourceUrl: target, attemptedAt: new Date().toISOString(), error: error.message })
    throw error
  } finally { context.off('page', watch) }
}

async function main() {
  const options = browserOptions(process.argv.slice(2))
  await mkdir(options.directory, { recursive: true })
  const lockFile = resolve(options.directory, 'browser-collector.lock')
  const lock = await open(lockFile, 'wx')
  let browser
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
    browser = await chromium.launch({ channel: 'chrome', headless: false, chromiumSandbox: true })
    const context = await browser.newContext({ acceptDownloads: false })
    const result = await collectBrowserDetails({ ...options, context })
    console.log(JSON.stringify(result))
  } finally {
    try { await browser?.close() } finally { await lock.close(); await unlink(lockFile) }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1 })
