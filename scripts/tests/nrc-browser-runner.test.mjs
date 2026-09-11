import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { browserOptions, collectBrowserDetails } from '../bwiki/collect-nrc-browser.mjs'
import { saveSnapshot, readSnapshot } from '../bwiki/lib/snapshots.mjs'
import { NRC_PAGES, parseNrcCreatures } from '../bwiki/lib/nrc-parser.mjs'

test('Browser command defaults to slow clicks and rejects invalid arguments', () => {
  assert.equal(browserOptions(['--version=S4']).interval, 60)
  assert.equal(browserOptions(['--version=S4', '--limit=all']).limit, Infinity)
  for (const arg of ['--offline', '--interval=1', '--version=../other']) assert.throws(() => browserOptions(['--version=S4', arg]))
})

test('Real browser clicks links, stops on 567 and resumes without revisiting cached details', async t => {
  let browser
  try { browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true }) } catch (error) {
    if (/not found|doesn't exist/i.test(error.message)) { t.skip('Local Chrome is not installed'); return }
    throw error
  }
  const directory = await mkdtemp(join(tmpdir(), 'nrc-browser-runner-'))
  try {
    const fixture = name => readFile(new URL(`./fixtures/nrc/${name}.html`, import.meta.url), 'utf8')
    const catalogHtml = `<div class="npc-grid">${await fixture('creatures')}</div>`
    const detailHtml = await fixture('detail')
    const creatures = parseNrcCreatures(catalogHtml)
    const version = 'test-browser-click'
    await saveSnapshot(directory, 'creatures', { version, sourceUrl: NRC_PAGES.creatures, html: catalogHtml })
    await saveSnapshot(directory, 'skills', { version, sourceUrl: NRC_PAGES.skills, html: (await fixture('skills')).replaceAll('抓挠', '折射').replaceAll('猛烈撞击', '闪光') })
    const visited = []
    let blocked = true
    const newContext = async () => {
      const context = await browser.newContext()
      // All traffic is fulfilled locally; the test never accesses the source website.
      await context.route('**/*', async route => {
        const url = decodeURI(route.request().url())
        if (url === NRC_PAGES.creatures) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: catalogHtml })
        const index = creatures.findIndex(c => decodeURI(c.detailUrl) === url)
        if (index >= 0) {
          visited.push(index)
          if (index === 1 && blocked) return route.fulfill({ status: 567, contentType: 'text/html; charset=utf-8', body: 'Access Denied' })
          return route.fulfill({ contentType: 'text/html; charset=utf-8', body: detailHtml.replaceAll(creatures[0].sourceId, creatures[index].sourceId) })
        }
        return route.fulfill({ status: 200, body: '' })
      })
      return context
    }
    let context = await newContext()
    const run = () => collectBrowserDetails({ context, directory, version, limit: Infinity, interval: 60, pause: async () => {}, log: () => {} })
    await assert.rejects(run(), /567|verification/)
    assert.deepEqual(visited, [0, 1])
    const cached = await readSnapshot(directory, creatures[0].sourceId, creatures[0].detailUrl, version)
    assert.equal(cached.method, 'browser-dom-verified')
    assert.equal(JSON.parse(await readFile(join(directory, 'browser-status.json'))).state, 'stopped')
    await context.close()
    blocked = false
    context = await newContext()
    assert.deepEqual(await run(), { saved: 1, remaining: 0 })
    assert.deepEqual(visited, [0, 1, 1])
    assert.equal((await readSnapshot(directory, creatures[0].sourceId, creatures[0].detailUrl, version)).sha256, cached.sha256)
    await context.close()
  } finally { await browser.close(); await rm(directory, { recursive: true, force: true }) }
})
