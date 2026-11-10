# Windows 安装版

## 使用范围

橘子洛克王国工具提供独立 Windows x64 NSIS Setup，复用 TangerineTools 前端、正式预置和 JSON 备份流程。运行安装版不需要源码、Node、npm、Python 或 Rust。GitHub Pages 网页版和源码启动方式继续可用，各入口不会自动共享数据。

Windows 安装版目前是本地验收候选，尚无公开下载附件；用户验收通过并确认发布后才上传。维护者可按本文构建。构建和 CI 不创建 Release，也不上传安装包。项目不采购或内置代码签名证书；未签名包可能出现 Windows 发布者未知提示，不能把这类包宣称为已签名或已通过 SmartScreen 信誉验证。

仅 Windows x64 是打包与测试目标。桌面代码与平台构建配置分别维护，macOS、Linux 和 Windows ARM64 均未验证，不提供这些平台的安装包。项目没有 Portable 产品；`win-unpacked` 只用于维护者测试，不作为用户下载入口。

## 安装、更新与卸载

- Setup 使用当前用户安装模式，不申请管理员权限；新装默认安装到 `%LOCALAPPDATA%\Tangerine\Apps\TangerineTools`，升级复用该应用 GUID 登记的目录，包括 `%LOCALAPPDATA%\Programs\Tangerine\TangerineTools` 和 `%LOCALAPPDATA%\Programs\TangerineTools`，不自动搬动已登记的程序。显式 `/D` 只用于首次安装的独立产品目录；登记路径与显式路径冲突会拒绝。创建开始菜单和 Windows 卸载入口，不自动创建桌面图标。
- 安装向导展示 GPL v3。项目、前端依赖和 OCR 声明位于包内；Electron 与 Chromium 声明随程序目录提供。
- 更新由用户手动下载对应 Setup，核对版本和 SHA-256，主动退出程序后确认安装。没有后台更新服务。
- 程序运行时安装、覆盖安装和卸载均拒绝继续；进程枚举异常也会拒绝，不强制关闭应用。静默模式以退出码 2 返回。
- 升级和卸载均不清除配置与数据库。重装使用同一数据身份，保留的数据可继续读取。卸载仅处理本产品安装目录与入口。安装或卸载目标为共享的 Programs、Tangerine、Apps 或 Data 父目录时拒绝继续。
- 请定期从应用内导出 JSON。安装版通过系统保存对话框选择文件位置；点击取消不产生备份。导入仍有预览、覆盖计数与确认，并按 id 合并。

## 稳定身份与数据边界

| 项目 | 固定值 |
|---|---|
| 应用 ID | `org.tangerine.rockkingdom` |
| 安装 GUID | `a18b37d2-68f6-4be7-9565-2f81c640d274` |
| 程序文件名 | `TangerineTools.exe` |
| 用户数据 | `%LOCALAPPDATA%/Tangerine/Data/TangerineTools`，由系统解析实际位置 |
| 浏览器存储来源 | `app://rock-kingdom` |
| 数据库 | `tangerine-tools`，Dexie schema v1 |

身份写在 `desktop/config.json`，不能随版本号、安装路径或显示名称变化而重建。测试身份位于 `desktop/fixture.mjs`，有独立的应用 ID、GUID、程序名称、数据目录与来源。

## 目录与迁移

默认数据根以下只使用本工具的子目录，不扫描或改写其他项目的数据。`desktop/storage.mjs` 在 Electron `ready` 之前显式设置 `userData` 和 `sessionData`，两者均为 `Storage`，不会另外生成以中文显示名称命名的默认 profile。

| 内容 | 位置与行为 |
|---|---|
| 目录归属、迁移清单 | `Config/layout.json`，只在本机保存原目录与文件校验值 |
| 收藏、设置及 Chromium profile | `Storage/`，含 IndexedDB、Local Storage、Preferences 和运行时管理的 profile 元数据、GPU shader 等文件；不把整个目录视为可清理缓存 |
| HTTP 缓存路径 | `Cache/`；HTTP 磁盘缓存保持禁用 |
| 应用日志、崩溃转储路径 | `Logs/`、`Logs/CrashDumps/`；不启用崩溃上报或遥测 |
| 源码启动日志 | `Logs/Source/`；源码程序、node_modules、dist 和开发检查留在工程中 |
| 应用临时文件、迁移暂存 | `Temp/`；失败暂存保留用于恢复，不自动删原件 |
| 手动 JSON 备份 | 用户通过保存对话框选择的外部路径；没有自动备份目录或自动备份服务 |
| 历史 profile 原件 | `%APPDATA%/TangerineTools`，迁移后保留；兼容单实例锁 `lockfile` 仍位于此目录，新装也只在这里生成这个锁 |

兼容锁必须沿用历史二进制认识的路径。新程序先取得该锁，完成复制后将实际 profile 指向统一数据目录，再初始化浏览器；历史程序与新程序同时启动时只有一个写入者。不要在使用期间删除该锁或历史目录。该锁是集中目录的兼容例外，并非第二份运行中的 profile。

首次启用时，只有目标不存在且原目录明确可识别，才复制历史 profile 的 `IndexedDB`、`Local Storage`、`Preferences`、`Local State`。临时 `Session Storage`、HTTP 缓存和其他文件不复制，所有原件保持不变。逐文件 SHA-256 校验及原件复核通过后，将暂存原子改名为 `Storage` 并记录完成状态。中断后只续接与清单完全匹配的暂存；校验失败、未知内容、链接重定向、损坏清单、已登记但丢失的存储或目标已有未登记内容均明确失败，不新建替代库。

每次启动核对迁移源的持久文件。若回退使用历史程序并修改原库，再启用新程序会拒绝加载，以免两份收藏被静默选取或覆盖。历史程序不会理解新目录：回退不能自动带回新程序中的修改。需要回退或合并时，先在能够打开的当前程序导出 JSON，并在全部程序退出后备份整个统一数据根及历史 profile；由维护者核对迁移清单和两份备份，再按既有 JSON 流程确认目标数据。不要删除 `layout.json`、清空目录、复制部分 LevelDB 文件或反复启动两代程序来排错。未知的其他目录不自动搜索或合并；本应用没有自定义 profile 配置接口，既有安装 `/D`、浏览器存储及用户主动选择的导入导出位置保持各自语义。

源码网页入口固定使用 `http://localhost:5188`，收藏仍属于用户浏览器，不迁移浏览器 profile。系统安装登记、开始菜单、安装器临时文件、系统自身缓存与用户主动导出的位置属于系统或用户管理范围；不承诺操作系统零痕迹。安装器只移除自身程序和登记，不递归清理 Tangerine、Apps、Data 或兄弟工具。

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

`desktop/build.mjs` 先建立白名单暂存包，再顺序打包。只包含前端产物、`desktop/main.mjs`、`security.mjs`、`storage.mjs`、身份配置、许可证及构建清单；排除 node_modules、测试 profile、源码、截图基线、本机配置和网页 Service Worker。`build-info.json` 记录版本、源码提交、工作区是否干净及每个包内文件的 SHA-256。重现构建流程与内容清单不意味着未签名 EXE 的时间戳和二进制字节在不同构建中完全一致。

产物位于 `artifacts/desktop/release/`：

- `TangerineTools-<version>-win-x64-Setup.exe`：安装包。
- `SHA256SUMS.txt`、`artifacts.json`：实际 Setup 的校验值和字节数。生成校验文件前会从 Setup 和主程序的 Windows PE 资源中逐帧核对项目 ICO。
- `win-unpacked/`：同一构建的可执行目录，供自动验收。

`npm run pack:desktop` 只生成 unpacked；`npm run checksums:desktop` 为已存在的当前版本 Setup 生成校验值。发布者须同时提供与构建对应的源码、锁文件和构建脚本；本项目的 CI 只保存验证报告，不保存公开安装包。网页发布仍由 `.github/workflows/pages.yml` 负责，Windows 检查由 `.github/workflows/desktop.yml` 负责。

## 源码桌面验收

源码日常入口的链路为本项目桌面 `.lnk` → Windows `wscript.exe` → 仓库根 `TangerineTools.vbs` → `scripts/windows/start.ps1` → 项目 Node/Vite → `http://localhost:5188`。快捷方式参数引用本仓库 VBS，工作目录为仓库根，图标为 `public/icons/tangerine-tools.ico`；私有绝对路径只保存在本机快捷方式和忽略的检查记录中。这个入口不读取 `dist/` 或某个固定 Setup，也不启动 Electron，收藏保持原浏览器来源。

`scripts/vite/source-identity.mjs` 只在 Vite 源码服务启用。只读检查端点 `/__tangerine_source` 返回项目标识、目录摘要、启动与当前运行文件 SHA-256、版本、提交和 PID，不返回原始机器路径、用户数据或凭据；禁用缓存并拒绝非回环和跨来源请求。HTML 携带启动指纹。检查脚本同时核对该 HTML 和实际入口模块，不把标题或端口响应作为版本证据。该端点不进入 Pages 或安装版构建。

本机 `.local/source-entry.json` 是维护者明确记录的验收指纹，Git 忽略且不打包。运行输入包括前端、public、Vite 配置与插件、源码启动链、依赖清单和许可文件；文档与检查日志不改变运行指纹。记录存在时，源码启动器拒绝未验收的运行输入。缺少记录的普通源码克隆可直接运行；`npm run dev` 是开发命令，不代表桌面验收完成。服务开启期间修改工作区仍可能触发 HMR，因此不能在用户活动状态不明时修改其监视的运行文件；验收记录不是冻结正在运行的开发服务。

维护者交付步骤：

1. 读取快捷方式的目标、参数、工作目录、图标；检查 5188 监听 PID、进程命令行和本项目任务。不要读取真实浏览器库。旧服务、未保存页面、运行或暂停任务状态不明时保留实例，不修改在用文件、不重启或强杀。
2. 完成 lint、隐私检查、测试、构建及差异检查。需要隔离构建时，用 `npm run build -- --outDir artifacts/quality/source-entry/dist`，不要覆盖在用 `dist` 或候选。测试使用独立端口、临时浏览器上下文和虚构记录。只涉及源码检查链且生产载荷一致时，无需重打安装包；注明沿用候选的构建提交与散列。
3. 核对并提交本批修改，工作区干净后运行 `npm run record:source-entry`。此命令只记录当前内容，不代替测试，不启动服务。已有本机记录损坏或归属不明时保留现场处理，不静默覆盖。源码提交同步仍遵守项目 main 工作流。
4. 无服务时可用 `powershell -NoProfile -File scripts/windows/start.ps1 -NoOpenBrowser` 启动同一链路而不打开个人浏览器。已匹配服务复用；不匹配服务保留并报错。只有确认任务结束、页面已保存且有正常退出方式时，才由维护者正常退出后再启动；没有退出方式时保留为待安全切换，不强杀进程。
5. 运行 `npm run check:source-entry`，并在隔离浏览器中核对页面指纹、实际加载模块和必要流程。启动器将成功核对结果写入统一数据目录 `Logs/Source/source-version.json`。检查成功说明服务可提供该版本，不说明用户已经打开的页面或懒加载模块全部更新。
6. 交接源码提交、工作区状态、快捷入口、运行文件指纹、服务 PID/启动时间、产物版本与适用散列，分别说明源码、入口、当前用户页面状态。未完成安全切换时明确列出原因；不能用“下次点击会更新”代替核验。

原网址的 Service Worker 在 HTTP 下不缓存运行响应；HTTPS 网页版保留既有缓存行为。不要清除浏览器存储来解决版本问题。用户已经打开的标签页应先完成或保存操作，再刷新同一个 `http://localhost:5188` 页面；确认现有收藏仍在。不擅自刷新用户页面，不把隔离浏览器通过当作个人页面已刷新。

## 开发工具链风险

锁定的 electron-builder 26.18.0 依赖链受 [minimatch 模式放大拒绝服务通告 GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) 影响。通告的受影响范围是 minimatch `>=7.0.0 <11.0.1`：攻击者控制 glob 模式且启用 `optimizationLevel >= 2` 时，预处理可能过度消耗 CPU 和内存。审计中的 6 项中等级结果包含该风险沿构建依赖链的传播，不代表 6 个独立漏洞；`npm audit --omit=dev` 没有已知通告也不等于全部依赖无漏洞。通告范围会更新，每次准备发布时应重新运行两种审计。

影响范围是开发与打包环境，受影响的 minimatch 位于 app-builder-lib 和 @electron/universal 的依赖链，不随应用包中的 node_modules 分发。本项目使用仓库内固定的文件白名单和暂存目录，不把导入 JSON、OCR 输入或模型内容作为构建模式；app-builder-lib 的文件匹配调用未启用上述高优化等级。CI 只读权限、任务超时和包内文件检查进一步限制影响，但不替代上游修复。不得在带有发布凭据的环境中构建未经审查的外部代码或构建配置。

通告修复版本为 minimatch 11.0.1，超出受影响消费者要求的 9/10 主版本范围。没有经过兼容验证的直接替换路径，不使用全局 overrides 强行替换，也不按 audit 建议将 electron-builder 降至 25.1.0。后续条件是上游构建器提供兼容修复，或相应主版本获得安全回补；届时更新锁文件并重跑打包程序、两种身份安装生命周期及 Windows CI，通过后重新生成候选包与 SHA-256。

## 验证口径

`npm test` 包含桌面协议、安全策略和虚构目录迁移单测，覆盖复制校验、中断续接、损坏与链接拒绝、目标冲突、原库后续变化及丢失存储保护。`test:desktop` 启动正式身份的打包程序，先用同一 Electron 运行时验证隔离环境，再测试界面操作、本地 OCR、权限边界、备份、部分合并、重开恢复和新 profile 恢复，核对实际 userData/sessionData 和兼容锁例外。所有记录和图像均为虚构测试输入，不读取真实收藏。

`test:installer` 只安装独立测试身份，检查两种历史默认程序目录原位升级、新装 Apps 路径、低版本号 fixture → 当前版本、运行中保护、卸载保留数据和重装恢复。低版本 fixture 使用 `desktop/tests/legacy-storage.mjs` 复现历史 profile 和进程锁；检查两代程序双向互斥、真实 IndexedDB 与设置复制后恢复。两个 fixture 都使用当前业务代码，因此不能据此认定真实历史业务迁移已验证。生产包不会包含这个替身模块。

`test:installer:production` 检查正式应用标识的静默安装、同版本覆盖、运行中保护、卸载与重装；它在隔离的用户目录下采用实际默认路径，只应在专用验收机或 Windows CI 执行。执行安装验收前须核对目标身份的运行进程，不得关闭既有实例。脚本发现该 GUID 的既有安装或同名开始菜单项会拒绝执行；安装器还会拒绝对运行中的应用操作，不能覆盖或关闭用户的安装实例。系统注册表和快捷方式在测试结束时由卸载器清理，临时测试数据保留供排错。

验收须绑定具体文件：核对 `test-results/production-installer.json` 的 `candidateSha256`、`release/artifacts.json` 和实际 Setup 的 SHA-256，并核对 `test-results/packaged.json` 的构建提交及包内文件校验。测试 fixture 的散列不能充当正式候选证据，CI 上另行构建的包也不能替代本地候选的散列。仅文档修改不要求覆盖已验收候选，报告须同时注明候选构建提交与最新文档提交；程序、依赖或打包配置改变时必须重新构建并验收。

这些自动检查不等于正式交互向导或干净 Windows 普通账号验收。发布前的必要人工验收：

1. 在干净 Windows x64 普通账号中运行 Setup：无需管理员密码，显示正确应用名称和 GPL 条款；完成后出现开始菜单和卸载入口。
2. 从开始菜单打开，手动记录一只虚构精灵、导出 JSON 并退出重开：记录保留，保存对话框可正常选择目录。
3. 保持应用运行，再执行 Setup 或卸载：提示先退出，窗口和未完成操作不被终止。
4. 退出后卸载、再安装：程序入口恢复，测试收藏仍在；此步骤仅使用虚构记录。

可选验收：用不含隐私的实际设备录屏验证 HEVC 解码与扫描复核；测试高 DPI、系统缩放及外部图片/模型服务。未执行的环境或操作均须标为“未验证”。
