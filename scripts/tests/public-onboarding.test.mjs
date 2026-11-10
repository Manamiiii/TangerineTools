import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

async function downloadJson(page, button) {
  const event = page.waitForEvent('download')
  await button.click()
  const download = await event
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString())
}
async function importFile(page, payload) {
  await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })
  await page.getByRole('dialog', { name: '确认导入备份' }).waitFor()
}

test('new user can record creatures, understand recommendations and restore a backup without a model', { timeout: 90000 }, async () => {
  const server = await createServer({ cacheDir: 'node_modules/.vite-public-onboarding', server: { host: '127.0.0.1', port: 0, strictPort: false, open: false, watch: { ignored: ['**/artifacts/**'] } } })
  let browser
  try {
    await server.listen()
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await page.getByRole('heading', { name: '整理游戏收藏，决定下一只怎么培养' }).waitFor()
    assert.match(await page.locator('.local-data-note').innerText(), /不会自动同步到 GitHub/)
    if (process.env.CAPTURE_PRODUCT_SCREENSHOT === '1') {
      await mkdir('artifacts/quality/product', { recursive: true })
      await page.screenshot({ path: 'artifacts/quality/product/getting-started.png', fullPage: true })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole('button', { name: '洛克王国', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: '收集记录', exact: true }).click()
    await page.getByRole('button', { name: '新增记录', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await dialog.getByRole('alert').waitFor()
    assert.match(await dialog.getByRole('alert').innerText(), /请选择图鉴名/)
    for (const [nature, appearance] of [['固执', '无'], ['大胆', '炫彩']]) {
      if (nature === '大胆') await page.getByRole('button', { name: '新增记录', exact: true }).first().click()
      await dialog.getByRole('combobox', { name: '图鉴名', exact: true }).fill('火神')
      await dialog.getByRole('option').filter({ hasText: '火神' }).first().click()
      await dialog.locator('.form-row').filter({ has: page.locator('.form-row-label', { hasText: /^性格$/ }) }).locator('select').selectOption(nature === '固执' ? 'adamant' : 'bold')
      await dialog.locator('.form-row').filter({ has: page.locator('.form-row-label', { hasText: /^性别$/ }) }).getByRole('button', { name: '母', exact: true }).click()
      await dialog.locator('.form-row').filter({ has: page.locator('.form-row-label', { hasText: /^外观细分$/ }) }).locator('select').selectOption(appearance === '无' ? 'none' : 'colorful')
      await dialog.getByRole('button', { name: '保存', exact: true }).click()
      await dialog.waitFor({ state: 'detached' })
    }
    await page.waitForFunction(() => document.querySelectorAll('.data-grid tbody tr').length === 2)
    assert.match(await page.locator('.data-grid').innerText(), /银镜可修/)
    assert.match(await page.locator('.data-grid').innerText(), /普通个体仅作备选/)
    await page.getByRole('button', { name: '孵蛋推荐', exact: true }).click()
    await page.locator('.breeding-pair-card').first().waitFor()
    assert.ok(await page.locator('.breeding-pair-card').count() <= 5)
    await page.getByRole('button', { name: '收集记录', exact: true }).click()
    await page.getByRole('button', { name: '扫描录入', exact: true }).click()
    assert.match(await dialog.locator('.scanner-compatibility-note').innerText(), /3200×1440/)
    await dialog.getByRole('button', { name: '关闭', exact: true }).last().click()
    await page.getByRole('button', { name: '性格推荐', exact: true }).click()
    await page.getByRole('combobox').fill('火神')
    await page.getByRole('option').filter({ hasText: '火神' }).first().click()
    await page.locator('.nature-candidate').filter({ hasText: '固执' }).click()
    assert.match(await page.locator('.nature-retention-card').innerText(), /已有异色／炫彩，银镜可修/)
    if (process.env.CAPTURE_PRODUCT_SCREENSHOT === '1') {
      await page.locator('.nature-result').screenshot({ path: 'artifacts/quality/product/nature-retention.png' })
    }
    await page.getByRole('button', { name: '模型设置' }).click()
    await dialog.getByLabel('模型供应商').selectOption('custom')
    await dialog.getByLabel('Chat Completions 兼容地址').fill('http://insecure.example/api')
    await dialog.getByLabel('模型 ID', { exact: true }).fill('test-model')
    await dialog.getByRole('button', { name: '保存配置' }).click()
    assert.match(await dialog.getByRole('alert').innerText(), /HTTPS/)
    await dialog.getByLabel('Chat Completions 兼容地址').fill('https://example.test/chat/completions')
    await dialog.getByLabel('API Key', { exact: true }).fill('test-only-key')
    await page.evaluate(() => {
      window.originalStorageSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('rockKingdomModel')) throw new Error('测试：浏览器拒绝保存配置')
        return window.originalStorageSetItem.call(this, key, value)
      }
    })
    await dialog.getByRole('button', { name: '保存配置' }).click()
    assert.match(await dialog.getByRole('alert').innerText(), /浏览器拒绝保存配置/)
    await page.evaluate(() => { Storage.prototype.setItem = window.originalStorageSetItem; delete window.originalStorageSetItem })
    await dialog.getByRole('button', { name: '保存配置' }).click()
    assert.equal(await page.evaluate(() => sessionStorage.getItem('rockKingdomModelApiKey:custom')), 'test-only-key')
    await dialog.getByRole('button', { name: '清空 Key 输入' }).click()
    assert.match(await dialog.getByRole('status').innerText(), /保存配置.*生效/)
    await dialog.getByRole('button', { name: '保存配置' }).click()
    assert.equal(await page.evaluate(() => sessionStorage.getItem('rockKingdomModelApiKey:custom')), null)
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: 'TangerineTools', exact: true }).click()
    const backup = await downloadJson(page, page.getByRole('button', { name: '导出数据', exact: true }))
    const owned = backup.data.catalogRows.filter(row => row.tableId.startsWith('table-owned-'))
    assert.equal(owned.length, 2)
    assert.ok(!JSON.stringify(backup).includes('test-only-key'))
    await importFile(page, backup)
    const beforeMerge = await downloadJson(page, dialog.getByRole('button', { name: '先导出当前数据' }))
    assert.equal(beforeMerge.data.catalogRows.length, backup.data.catalogRows.length)
    await dialog.getByRole('button', { name: '取消', exact: true }).click()
    const recovered = await browser.newContext()
    await recovered.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort())
    const restorePage = await recovered.newPage()
    await restorePage.goto(origin)
    await restorePage.getByRole('button', { name: '导出数据', exact: true }).waitFor()
    await importFile(restorePage, backup)
    await restorePage.getByRole('button', { name: '按 id 合并导入', exact: true }).click()
    await restorePage.getByRole('dialog').waitFor({ state: 'detached' })
    await restorePage.reload()
    const restored = await downloadJson(restorePage, restorePage.getByRole('button', { name: '导出数据', exact: true }))
    assert.deepEqual(restored.data.catalogRows.filter(row => row.tableId.startsWith('table-owned-')), owned)
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await server.close() }
})
