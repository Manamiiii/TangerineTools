import { app, BrowserWindow, Menu, protocol, net, session, shell, dialog } from 'electron'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createAssetHandler, navigationAllowed, externalUrl, downloadAllowed, permissionAllowed, WINDOW_PREFERENCES } from './security.mjs'
import { initializeStorage } from './storage.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(path.join(directory, 'config.json'), 'utf8'))
const root = path.join(directory, '../dist')
const entry = `app://${config.host}/index.html`
app.setName(config.productName)
let ownsStorage = false
try { ownsStorage = initializeStorage(app, config) }
catch (error) { dialog.showErrorBox('数据目录需要确认', error.message); app.exit(1) }
app.commandLine.appendSwitch('disable-http-cache')
if (process.platform === 'win32') app.setAppUserModelId(config.appId)
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: false } }])
let window
if (!ownsStorage) app.exit(0)
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus() } })
  app.whenReady().then(async () => {
    protocol.handle('app', createAssetHandler(root, config.host, (target, method) => net.fetch(pathToFileURL(target).href, { method })))
    const trusted = contents => contents && contents === window?.webContents && navigationAllowed(contents.getURL(), config.host)
    let loopbackConsent = false
    session.defaultSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
      if (trusted(contents) && permission === 'loopback-network' && permissionAllowed(permission, contents.getURL(), details.requestingUrl, config.host, details.isMainFrame, true)) {
        try {
          const result = await dialog.showMessageBox(window, { type: 'question', message: '允许本次运行连接本机模型服务？', detail: '仅在你配置并使用 localhost 模型时需要。仍须遵守服务端的 CORS 限制。', buttons: ['拒绝', '允许本次运行'], defaultId: 0, cancelId: 0 })
          loopbackConsent = result.response === 1
        } catch { loopbackConsent = false }
      }
      callback(Boolean(trusted(contents) && permissionAllowed(permission, contents.getURL(), details.requestingUrl, config.host, details.isMainFrame, loopbackConsent)))
    })
    session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) => Boolean(trusted(contents)
      && permissionAllowed(permission, contents.getURL(), origin, config.host, details.isMainFrame, loopbackConsent)))
    session.defaultSession.on('will-download', (event, item, contents) => {
      if (!trusted(contents) || !downloadAllowed(item.getURL(), item.getFilename(), config.host)) { event.preventDefault(); return }
      let defaultPath = item.getFilename()
      try { defaultPath = path.join(app.getPath('downloads'), defaultPath) } catch { /* A redirected Windows profile may have no Downloads known folder. */ }
      item.setSaveDialogOptions({ title: '保存 JSON 备份', defaultPath })
    })
    async function openExternal(input, confirm = true) {
      const url = externalUrl(input)
      if (!url) return
      if (confirm) {
        const result = await dialog.showMessageBox(window, { type: 'question', message: '在系统浏览器中打开链接？', detail: url, buttons: ['取消', '打开浏览器'], defaultId: 0, cancelId: 0 })
        if (result.response !== 1) return
      }
      await shell.openExternal(url).catch(() => dialog.showMessageBox(window, { type: 'error', message: '无法打开外部链接，请检查默认浏览器。' }))
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '文件', submenu: [
        { label: '备份与迁移说明', click: () => dialog.showMessageBox(window, { message: '安装版与网页版各自保存数据，不会自动同步。请通过应用内 JSON 导出／导入迁移。升级和卸载保留本机数据；仍建议定期备份。' }) },
        { type: 'separator' }, { role: 'quit', label: '退出' },
      ] },
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '查看', submenu: [{ role: 'resetZoom', label: '实际大小' }, { role: 'zoomIn', label: '放大' }, { role: 'zoomOut', label: '缩小' }, { role: 'togglefullscreen', label: '全屏' }] },
      { label: '帮助', submenu: [
        { label: '版本与下载', click: () => openExternal(config.releases, false) },
        { label: '关于与许可证', click: () => dialog.showMessageBox(window, { message: `${config.productName} ${app.getVersion()}`, detail: '本地优先 · GPL-3.0-only\n数据由本应用独立保存。更新需手动下载并退出后安装。\n许可证和第三方声明随安装包提供。' }) },
      ] },
    ]))
    async function createWindow() {
      window = new BrowserWindow({ width: 1280, height: 900, minWidth: 800, minHeight: 600, title: config.productName, icon: path.join(root, 'icons/tangerine-tools-192.png'), show: false, webPreferences: { ...WINDOW_PREFERENCES } })
      window.webContents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' } })
      const protectNavigation = (event, url) => { if (!navigationAllowed(url, config.host)) { event.preventDefault(); void openExternal(url) } }
      window.webContents.on('will-navigate', protectNavigation)
      window.webContents.on('will-redirect', protectNavigation)
      window.webContents.on('will-frame-navigate', event => { if (!event.isMainFrame) event.preventDefault() })
      window.webContents.on('will-attach-webview', event => event.preventDefault())
      window.on('closed', () => { window = undefined })
      await window.loadURL(entry)
      window.show()
    }
    await createWindow()
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) void createWindow() })
  }).catch(() => { dialog.showErrorBox('启动失败', '无法加载应用。请确认安装完整、用户数据目录可写，或重新安装。无需先删除个人数据。'); app.quit() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
