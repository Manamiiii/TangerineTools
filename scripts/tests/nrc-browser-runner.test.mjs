import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { browserOptions, collectBrowserDetails, waitForDetailToSettle, captureSettledDetail } from '../bwiki/collect-nrc-browser.mjs'
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
    const settlingPage = await browser.newPage()
    await settlingPage.setContent('<div class="roco-dex">initial</div>')
    await settlingPage.evaluate(() => {
      window.detailAnimation = setInterval(() => {
        document.querySelector('.roco-dex').textContent += '.'
      }, 10)
    })
    await assert.rejects(waitForDetailToSettle(settlingPage, { quietMs: 50, timeoutMs: 200 }), /did not settle/)
    await settlingPage.evaluate(() => {
      clearInterval(window.detailAnimation)
      setTimeout(() => { document.querySelector('.roco-dex').textContent = 'settled' }, 20)
    })
    await waitForDetailToSettle(settlingPage, { quietMs: 50, timeoutMs: 1000 })
    assert.equal(await settlingPage.locator('.roco-dex').innerText(), 'settled')
    await settlingPage.close()
    const reloadPage = await browser.newPage()
    const identity = { version: 'reload-test', sourceId: 'pet_000004', sourceUrl: 'https://wiki.biligame.com/nrc/test' }
    let loads = 0
    await reloadPage.route('**/*', route => {
      loads++
      return route.fulfill({ contentType: 'text/html', body: `<div class="roco-dex" data-pet-id="pet_000004">document ${loads}</div>` })
    })
    await reloadPage.goto(identity.sourceUrl)
    // The document is replaced while the quiet-period wait is active.
    await reloadPage.evaluate(() => setTimeout(() => location.reload(), 100))
    await waitForDetailToSettle(reloadPage, { expected: identity, quietMs: 300, timeoutMs: 3000 })
    assert.equal(loads, 2)
    let pauses = 0
    const recovered = await captureSettledDetail(reloadPage, identity, {
      quietMs: 50, timeoutMs: 3000, log: () => {},
      pause: async () => { if (++pauses === 1) await reloadPage.reload() },
    })
    assert.equal(loads, 3)
    assert.match(recovered.html, /document 3/)
    assert.equal(recovered.verifiedPasses, 2)
    // Repeated mutations are bounded and never returned as a successful capture.
    let mutations = 0
    await assert.rejects(captureSettledDetail(reloadPage, identity, {
      quietMs: 20, timeoutMs: 3000, log: () => {},
      pause: async () => { mutations++; await reloadPage.locator('.roco-dex').evaluate(e => { e.textContent += '.' }) },
    }), /Browser DOM changed/)
    assert.equal(mutations, 3)
    await reloadPage.setContent('<p>安全验证</p>')
    await assert.rejects(captureSettledDetail(reloadPage, identity, { quietMs: 20, timeoutMs: 1000 }), /verification/)
    assert.equal(loads, 3)
    await reloadPage.close()
    const fixture = name => readFile(new URL(`./fixtures/nrc/${name}.html`, import.meta.url), 'utf8')
    const catalogHtml = `<div class="npc-grid">${await fixture('creatures')}</div>
      <div class="nrc-site-welcome" style="position:fixed;inset:0;z-index:999;background:white">
        游戏素材版权说明
        <div role="button" tabindex="0" onclick="this.parentElement.remove()">我知道了</div>
      </div>
      <div class="roco-dex" data-pet-id="pet_999999">Previous page retained during navigation</div>
      <script>
        document.querySelectorAll('.npc-card a').forEach(link => link.addEventListener('click', event => {
          event.preventDefault()
          history.pushState({}, '', link.href)
          setTimeout(() => {
            history.replaceState({}, '', ${JSON.stringify(NRC_PAGES.creatures)})
            location.assign(link.href)
          }, 4000)
        }))
      </script>`
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
