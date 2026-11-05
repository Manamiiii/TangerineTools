import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'

export async function openPackaged(executable, env, identity, legacy = false) {
  const application = await electron.launch({ executablePath: executable, args: [], env, timeout: 45000 })
  try {
    const runtime = await application.evaluate(({ app, BrowserWindow }) => ({
      version: app.getVersion(), packaged: app.isPackaged, userData: app.getPath('userData'),
      appData: app.getPath('appData'), sessionData: app.getPath('sessionData'), preferences: BrowserWindow.getAllWindows()[0]?.webContents.getLastWebPreferences(),
    }))
    assert.ok(runtime.packaged)
    assert.equal(path.resolve(runtime.appData).toLowerCase(), path.resolve(env.APPDATA).toLowerCase())
    const profile = legacy ? path.join(env.APPDATA, identity.dataDirectory) : path.join(env.LOCALAPPDATA, 'Tangerine/Data', identity.dataDirectory, 'Storage')
    assert.equal(path.resolve(runtime.userData).toLowerCase(), profile.toLowerCase())
    assert.equal(path.resolve(runtime.sessionData).toLowerCase(), profile.toLowerCase())
    const page = await application.firstWindow()
    await page.getByRole('button', { name: '洛克王国', exact: true }).waitFor({ timeout: 45000 })
    assert.equal(new URL(page.url()).host, identity.host)
    return { application, page, runtime }
  } catch (error) { await application.close(); throw error }
}

export async function addCreature(page, nature = 'adamant', appearance = 'none') {
  await page.getByRole('button', { name: 'TangerineTools', exact: true }).click()
  await page.getByRole('button', { name: '洛克王国', exact: true }).click()
  await page.getByRole('button', { name: '收集记录', exact: true }).click()
  await page.getByRole('button', { name: '新增记录', exact: true }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox', { name: '图鉴名', exact: true }).fill('火神')
  await dialog.getByRole('option').filter({ hasText: '火神' }).first().click()
  await dialog.locator('.form-row').filter({ has: page.locator('.form-row-label', { hasText: /^性格$/ }) }).locator('select').selectOption(nature)
  await dialog.locator('.form-row').filter({ has: page.locator('.form-row-label', { hasText: /^性别$/ }) }).getByRole('button', { name: '母', exact: true }).click()
  await dialog.locator('.form-row').filter({ has: page.locator('.form-row-label', { hasText: /^外观细分$/ }) }).locator('select').selectOption(appearance)
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
}

export async function exportJson(application, page, target) {
  await page.getByRole('button', { name: 'TangerineTools', exact: true }).click()
  await application.evaluate(({ session }, target) => {
    globalThis.testDownload = new Promise(resolve => {
      session.defaultSession.once('will-download', (_event, item) => {
        item.setSavePath(target)
        item.once('done', (_event, state) => resolve(state))
      })
    })
  }, target)
  await page.getByRole('button', { name: '导出数据', exact: true }).click()
  assert.equal(await application.evaluate(() => Promise.race([
    globalThis.testDownload,
    new Promise((_, reject) => setTimeout(() => reject(new Error('JSON download did not finish within 20 seconds')), 20000)),
  ])), 'completed')
  return JSON.parse(await fs.readFile(target, 'utf8'))
}

export async function importJson(page, payload, confirm = true) {
  await page.getByRole('button', { name: 'TangerineTools', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'test-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })
  const dialog = page.getByRole('dialog', { name: '确认导入备份' })
  await dialog.waitFor()
  await dialog.getByRole('button', { name: confirm ? '按 id 合并导入' : '取消', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
}

export function ownedRows(backup) { return backup.data.catalogRows.filter(row => row.tableId.startsWith('table-owned-')) }
