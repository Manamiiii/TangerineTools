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

const navigationInterrupted = error => /Execution context was destroyed|Cannot find context with specified id/.test(error.message)
const assertAccess = text => {
  if (/验证码|访问受限|访问过于频繁|安全验证|Access Denied|Verify you are human|Just a moment/i.test(text)) throw new Error('Access verification/restriction shown; stop without retry')
}

export async function waitForCatalog(page, creatures, { assertHealthy = () => {}, readSourceHtml, timeoutMs = 60000, quietMs = 2000 } = {}) {
  const normalize = rows => JSON.stringify([...rows].sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
  const expected = normalize(creatures)
  const deadline = Date.now() + timeoutMs
  let previous = null
  let stableSince = Date.now()
  let pendingReason = 'Catalog address or cards are not ready'
  while (Date.now() < deadline) {
    assertHealthy()
    try {
      const state = await page.evaluate(() => {
        const grids = document.querySelectorAll('.npc-grid')
        return { url: location.href, count: grids.length, html: grids[0]?.outerHTML, text: document.body?.innerText ?? '' }
      })
      assertHealthy()
      assertAccess(state.text)
      if (state.url !== new URL(NRC_PAGES.creatures).href || state.count !== 1 || !state.html.includes('npc-card')) {
        previous = null
        stableSince = Date.now()
      } else {
        let current = null
        let matches = false
        try {
          const rows = parseNrcCreatures(state.html)
          current = normalize(rows)
          matches = current === expected
          if (!matches && readSourceHtml) {
            const sourceHtml = await readSourceHtml()
            assertHealthy()
            if (sourceHtml && normalize(parseNrcCreatures(sourceHtml)) === expected) {
              // Virtualized cards retain identity but omit off-screen artwork/stage.
              // The complete fields must first match in the actual browser response.
              const byId = new Map(creatures.map(row => [row.sourceId, row]))
              const ids = new Set(rows.map(row => row.sourceId))
              matches = rows.length === creatures.length && ids.size === rows.length && rows.every(row => {
                const old = byId.get(row.sourceId)
                return old && Object.keys(old).every(key =>
                  JSON.stringify(row[key]) === JSON.stringify(old[key]) ||
                  (['stageLabel', 'image', 'shinyImage'].includes(key) && row[key] === ''))
              })
            }
          }
        } catch (error) { pendingReason = error.message }
        assertHealthy()
        if (!matches) {
          if (current !== null) pendingReason = 'Live catalog differs from this batch; review the source before changing versions'
          previous = null
          stableSince = Date.now()
        } else if (current !== previous) { previous = current; stableSince = Date.now() }
        else if (Date.now() - stableSince >= quietMs) return
      }
    } catch (error) {
      if (!navigationInterrupted(error)) throw error
      previous = null
      stableSince = Date.now()
    }
    await delay(Math.min(500, Math.max(10, quietMs / 4)))
  }
  throw new Error(`Browser catalog did not become ready; stop collection: ${pendingReason}`)
}

export async function navigateToCatalog(page, navigate, creatures, options = {}) {
  try { await navigate() } catch (error) {
    options.assertHealthy?.()
    if (error.name !== 'TimeoutError') throw error
    options.log?.('Browser navigation wait timed out; checking existing catalog without another request')
  }
  await waitForCatalog(page, creatures, options)
}

// Keep the wait in Node: a page-owned Promise is destroyed by a normal reload.
// Only re-read the existing page; this loop never clicks, reloads or requests a URL.
export async function waitForDetailToSettle(page, { quietMs = 10000, timeoutMs = 60000, expected, assertHealthy = () => {} } = {}) {
  const deadline = Date.now() + timeoutMs
  let previous = null
  let stableSince = Date.now()
  const reset = frame => {
    if (frame === page.mainFrame()) { previous = null; stableSince = Date.now() }
  }
  page.on('framenavigated', reset)
  try {
    while (Date.now() < deadline) {
      assertHealthy()
      try {
        const state = await page.evaluate(() => {
          const roots = document.querySelectorAll('.roco-dex')
          return { url: location.href, ready: document.readyState !== 'loading', count: roots.length,
            sourceId: roots[0]?.getAttribute('data-pet-id'), html: roots[0]?.outerHTML,
            text: document.body?.innerText ?? '' }
        })
        assertHealthy()
        assertAccess(state.text)
        const ready = state.ready && state.count === 1 && (!expected || (state.sourceId === expected.sourceId && state.url === expected.sourceUrl))
        if (!ready || state.html !== previous) {
          previous = ready ? state.html : null
          stableSince = Date.now()
        } else if (Date.now() - stableSince >= quietMs) return
      } catch (error) {
        if (!navigationInterrupted(error)) throw error
        previous = null
        stableSince = Date.now()
      }
      await delay(Math.min(500, Math.max(10, quietMs / 4)))
    }
    throw new Error('Browser detail did not settle; stop capture')
  } finally { page.off('framenavigated', reset) }
}

export async function captureSettledDetail(page, expected, { assertHealthy = () => {}, log = console.log, quietMs = 10000, timeoutMs = 120000, pause = delay } = {}) {
  const deadline = Date.now() + timeoutMs
  let generation = 0
  const navigated = frame => { if (frame === page.mainFrame()) generation++ }
  page.on('framenavigated', navigated)
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await waitForDetailToSettle(page, { expected, assertHealthy, quietMs, timeoutMs: Math.max(1, deadline - Date.now()) })
      const documentGeneration = generation
      const check = () => {
        assertHealthy()
        if (generation !== documentGeneration) throw new Error('Browser DOM changed due to navigation')
      }
      try {
        const record = await captureBrowserDetail({
          expected,
          readMetadata: async () => {
            check()
            const meta = await page.evaluate(() => {
              const roots = document.querySelectorAll('.roco-dex')
              return { sourceUrl: location.href, sourceId: roots[0]?.getAttribute('data-pet-id'), rootCount: roots.length,
                characters: roots[0]?.outerHTML.length, ready: document.readyState !== 'loading' }
            })
            check()
            return meta
          },
          readChunk: async (start, end) => {
            check()
            const chunk = await page.locator('.roco-dex').evaluate((e, range) => e.outerHTML.slice(range.start, range.end), { start, end })
            check()
            return chunk
          },
          pause,
        })
        check()
        return record
      } catch (error) {
        assertHealthy()
        if ((!navigationInterrupted(error) && !/Browser DOM changed/.test(error.message)) || attempt === 3 || Date.now() >= deadline) throw error
        log(`Browser discarded unstable read; waiting on the same page (${attempt}/3): ${expected.sourceId}`)
      }
    }
  } finally { page.off('framenavigated', navigated) }
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
  let catalogSource = null
  let catalogResponse = null
  const watch = page => {
    page.on('response', response => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) {
        if (response.status() >= 400) fault = new Error(`HTTP ${response.status()}: stop browser collection`)
        if (response.url() === new URL(NRC_PAGES.creatures).href) {
          // Read an already received browser response, never issue another request.
          catalogSource = null
          catalogResponse = response
          response.text().then(html => {
            if (catalogResponse === response) catalogSource = html
          }).catch(() => { /* No complete source means virtualization cannot pass. */ })
        }
      }
    })
    page.on('requestfailed', request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) fault = new Error(`Navigation failed: ${request.failure()?.errorText}`)
    })
  }
  context.on('page', watch)
  const assertPage = async page => {
    if (fault) throw fault
    const text = await page.locator('body').innerText()
    assertAccess(text)
  }
  try {
    const catalog = await context.newPage()
    await status('opening-catalog')
    log(`Browser: open catalog; ${pending.length} details missing`)
    const catalogOptions = { assertHealthy: () => { if (fault) throw fault }, readSourceHtml: () => catalogSource, log }
    await navigateToCatalog(catalog, () => catalog.goto(NRC_PAGES.creatures, { waitUntil: 'commit', timeout: 30000 }), creatures, catalogOptions)
    for (const creature of pending.slice(0, limit)) {
      target = creature.detailUrl
      await status('waiting', { next: creature.name, sourceUrl: target })
      log(`Browser waiting ${interval}s before clicking ${creature.name}`)
      await pause(interval * 1000)
      await assertPage(catalog)
      // Acknowledge only the site's known copyright notice through its UI.
      const welcome = catalog.locator('.nrc-site-welcome')
      if (await welcome.isVisible()) {
        await welcome.getByRole('button', { name: '我知道了', exact: true }).click({ timeout: 20000, noWaitAfter: true })
        await welcome.waitFor({ state: 'hidden', timeout: 10000 })
        await waitForCatalog(catalog, creatures, catalogOptions)
      }
      const link = catalog.locator(`.npc-card[data-id="${creature.sourceId}"] a`)
      const links = await link.evaluateAll(elements => elements.map(e => e.href))
      if (links.length !== 1 || links[0] !== target) throw new Error(`Catalog link mismatch: ${creature.name}`)
      const detail = catalog
      // The host-side capture gate owns navigation and readiness checks.
      await link.click({ timeout: 20000, noWaitAfter: true })
      await status('reading', { next: creature.name, sourceUrl: target })
      const record = await captureSettledDetail(detail, { version, sourceId: creature.sourceId, sourceUrl: target }, {
        assertHealthy: () => { if (fault) throw fault }, log, pause,
      })
      let parsed
      try { parsed = parseNrcDetail(record.html, creature) } catch (error) {
        await writeJsonAtomic(resolve(directory, 'browser-rejected-capture.json'), { ...record, error: error.message })
        throw error
      }
      const missingSkills = parsed.skills.filter(s => !names.has(s.name)).map(s => s.name)
      if (missingSkills.length) throw new Error(`Detail has skills absent from this batch: ${missingSkills.join(', ')}`)
      if (fault) throw fault
      await persistCapture(directory, creature, record)
      saved++
      await status('captured', { last: creature.name })
      log(`Browser saved ${creature.sourceId} ${creature.name}; total ${creatures.length - pending.length + saved}/${creatures.length}`)
      if (saved < Math.min(pending.length, limit)) {
        target = NRC_PAGES.creatures
        await status('returning', { sourceUrl: target, last: creature.name })
        log(`Browser waiting ${interval}s before returning to catalog`)
        await pause(interval * 1000)
        await navigateToCatalog(catalog, () => catalog.goBack({ waitUntil: 'commit', timeout: 30000 }), creatures, catalogOptions)
      }
    }
    await status(saved === pending.length ? 'complete' : 'batch-complete')
    return { saved, remaining: pending.length - saved }
  } catch (caught) {
    const error = fault ?? caught
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
