# Windows 安装版

## 使用范围

橘子洛克王国工具提供独立 Windows x64 NSIS Setup，复用 TangerineTools 前端、正式预置和 JSON 备份流程。运行安装版不需要源码、Node、npm、Python 或 Rust。GitHub Pages 网页版和源码启动方式继续可用，各入口不会自动共享数据。

安装包以本仓库 Releases 中实际提供的附件为准；没有附件时，维护者可按本文构建。构建和 CI 不创建 Release，也不上传安装包。项目不采购或内置代码签名证书；未签名包可能出现 Windows 发布者未知提示，不能把这类包宣称为已签名或已通过 SmartScreen 信誉验证。

仅 Windows x64 是打包与测试目标。桌面代码与平台构建配置分别维护，macOS、Linux 和 Windows ARM64 均未验证，不提供这些平台的安装包。项目没有 Portable 产品；`win-unpacked` 只用于维护者测试，不作为用户下载入口。

## 安装、更新与卸载

- Setup 使用当前用户安装模式，不申请管理员权限；默认安装到用户程序目录，创建开始菜单和 Windows 卸载入口，不自动创建桌面图标。
- 安装向导展示 GPL v3。项目、前端依赖和 OCR 声明位于包内；Electron 与 Chromium 声明随程序目录提供。
- 更新由用户手动下载对应 Setup，核对版本和 SHA-256，主动退出程序后确认安装。没有后台更新服务。
- 程序运行时安装、覆盖安装和卸载均拒绝继续；进程枚举异常也会拒绝，不强制关闭应用。静默模式以退出码 2 返回。
- 升级和卸载均不清除配置与数据库。重装使用同一数据身份，保留的数据可继续读取。卸载不是清除个人数据的操作。
- 请定期从应用内导出 JSON。安装版通过系统保存对话框选择文件位置；点击取消不产生备份。导入仍有预览、覆盖计数与确认，并按 id 合并。

## 稳定身份与数据边界

| 项目 | 固定值 |
|---|---|
| 应用 ID | `org.tangerine.rockkingdom` |
| 安装 GUID | `a18b37d2-68f6-4be7-9565-2f81c640d274` |
| 程序文件名 | `TangerineTools.exe` |
| 用户数据 | `%APPDATA%/TangerineTools`，由系统解析实际位置 |
| 浏览器存储来源 | `app://rock-kingdom` |
| 数据库 | `tangerine-tools`，Dexie schema v1 |

身份写在 `desktop/config.json`，不能随版本号、安装路径或显示名称变化而重建。测试身份位于 `desktop/fixture.mjs`，有独立的应用 ID、GUID、程序名称、数据目录与来源。

网页版、源码版和安装版之间通过已有 JSON 导出／导入迁移：先备份目标入口已有数据，再从源入口导出，在目标入口预览并确认合并。同 ID 覆盖，文件未包含的记录保留，没有自动新旧比较或双向同步。模型配置与 API Key 不在备份中，需要按需重新配置。详细语义见 [数据存储与迁移](data-sync.md)。

## 桌面安全与兼容

- 前端只从包内 `dist/` 加载。`app:` 协议检查固定主机、路径、编码、方法、请求来源、真实路径边界与 MIME，不暴露任意文件读取或 HTTP 转发接口。
- renderer 开启 sandbox、contextIsolation、webSecurity，关闭 Node、webview 和混合不安全内容；没有 preload/IPC 文件或 shell 接口。
- CSP 限制脚本为包内资源，允许本地 OCR 所需的 worker/WASM。安装版不注册网页 Service Worker，也不通过它替换已安装代码；网页版保留自身的离线缓存行为。
- 新窗口和跨页面导航被拦截。HTTPS 外部链接需确认后交给系统浏览器；文件、脚本和系统协议不会交给 shell 执行。帮助菜单的下载入口固定指向本仓库。
- 下载仅允许当前应用生成的 JSON blob，用户通过系统保存对话框选路径。文件导入使用现有 `<input type="file">`；剪贴板读取、摄像头、屏幕捕获、定位等权限默认拒绝，常规编辑菜单保留。
- 本机模型使用 localhost HTTP 时，若运行时请求回环网络权限，需用户同意本次运行。CORS 保持启用；供应商仍须允许安装版来源，不能通过关闭安全检查解决接口兼容。
- 浏览器 HTTP 磁盘缓存禁用；原始截图、视频、OCR 文本和模型内容仅按现有页面内存流程处理，不增加落盘。API Key 保留 sessionStorage 语义，不写入备份；正常退出并重开不恢复 Key。
- 核心预置与 OCR 资源随包提供；外部 Wiki 图片和模型服务仍依赖网络。视频编解码支持受 Electron/系统限制，HEVC 实际录屏需要用户验收。本项目没有地图功能。

## 可复现构建

维护者使用 Windows x64、`.nvmrc` 指定的 Node 22.12.0 或满足 `package.json` engines 的版本：

```powershell
npm ci
npm run lint
npm run check:privacy
npm test
npm run dist:windows
npm run test:desktop
npm run build:installer-fixtures
npm run test:installer
npm run test:installer:production
git diff --check
```

Electron 45.1.0 和 electron-builder 26.18.0 由锁文件固定。构建器使用项目依赖和用户缓存，不需要全局工具链。打包时应关闭本仓库正在测试的 unpacked 程序；不要在程序运行时重写同一输出目录。

`desktop/build.mjs` 先建立白名单暂存包，再顺序打包。只包含前端产物、`desktop/main.mjs`、`security.mjs`、身份配置、许可证及构建清单；排除 node_modules、测试 profile、源码、截图基线、本机配置和网页 Service Worker。`build-info.json` 记录版本、源码提交、工作区是否干净及每个包内文件的 SHA-256。重现构建流程与内容清单不意味着未签名 EXE 的时间戳和二进制字节在不同构建中完全一致。

产物位于 `artifacts/desktop/release/`：

- `TangerineTools-<version>-win-x64-Setup.exe`：安装包。
- `SHA256SUMS.txt`、`artifacts.json`：当前版本安装包的校验值和字节数。
- `win-unpacked/`：同一构建的可执行目录，供自动验收。

`npm run pack:desktop` 只生成 unpacked；`npm run checksums:desktop` 为已存在的当前版本 Setup 生成校验值。发布者须同时提供与构建对应的源码、锁文件和构建脚本；本项目的 CI 只保存验证报告，不保存公开安装包。网页发布仍由 `.github/workflows/pages.yml` 负责，Windows 检查由 `.github/workflows/desktop.yml` 负责。

## 验证口径

`npm test` 包含桌面协议与安全策略单测。`test:desktop` 启动正式身份的打包程序，先用同一 Electron 运行时验证隔离环境，再测试界面操作、本地 OCR、权限边界、备份、部分合并、重开恢复和新 profile 恢复。所有记录和图像均为虚构测试输入，不读取真实收藏。

`test:installer` 只安装独立测试身份，检查低版本号 fixture → 当前版本、运行中保护、卸载保留数据和重装恢复。两个 fixture 都使用当前业务代码，因此不能据此认定历史业务迁移已验证。

`test:installer:production` 检查正式应用标识的静默安装、同版本覆盖、运行中保护、卸载与重装；它使用临时安装目录和隔离数据。测试前若发现该 GUID 的既有安装或同名开始菜单项会拒绝执行，不能覆盖或关闭用户的安装实例。系统注册表和快捷方式在测试结束时由卸载器清理，临时测试数据保留供排错。

这些自动检查不等于正式交互向导或干净 Windows 普通账号验收。发布前的必要人工验收：

1. 在干净 Windows x64 普通账号中运行 Setup：无需管理员密码，显示正确应用名称和 GPL 条款；完成后出现开始菜单和卸载入口。
2. 从开始菜单打开，手动记录一只虚构精灵、导出 JSON 并退出重开：记录保留，保存对话框可正常选择目录。
3. 保持应用运行，再执行 Setup 或卸载：提示先退出，窗口和未完成操作不被终止。
4. 退出后卸载、再安装：程序入口恢复，测试收藏仍在；此步骤仅使用虚构记录。

可选验收：用不含隐私的实际设备录屏验证 HEVC 解码与扫描复核；测试高 DPI、系统缩放及外部图片/模型服务。未执行的环境或操作均须标为“未验证”。
