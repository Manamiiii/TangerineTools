# TangerineTools · 游戏收藏与培养助手

给《洛克王国世界》玩家的本地收藏工具：查精灵与技能、记录自己的个体，再判断培养、保留和孵蛋方向。

无需注册，也不需要 API Key。收藏保存在你自己的浏览器中，通过 JSON 手动备份和迁移。项目处于早期使用阶段，推荐是辅助判断，不是实战最优解或必须集齐的清单。

![TangerineTools 首页与使用步骤](docs/assets/product/getting-started.png)

## 适合谁，用来做什么

- **精灵越来越多，记不清已经有什么**：按图鉴名、性格、外观、性别等记录和筛选自己的个体。
- **想判断培养和保留方向**：查看性格适用性与规则原因；结合已有异色／炫彩，查看哪些同方向普通个体可以作为备选。
- **想整理繁育目标**：根据已记录的稀有亲本、蛋组、性别和目标，查看最多五对候选组合。普通亲本可能需要按条件现抓。
- **想记录其他游戏**：可以新建场景和资料表，配置字段、收集记录与统计；其他游戏没有内置图鉴或专项推荐。

内置资料来自版本化 Wiki 快照，不是实时游戏接口。资料批次与逐条来源可在页面底部「数据来源与版权」及资料详情中查看。

## 从零开始

需要安装 Node.js：建议使用 `.nvmrc` 指定的 22.12.0 或更新的受支持 22.x 版本，最低满足 `package.json` 的 `>=20.19.0`。使用命令行方式克隆需要 Git，也可以在 GitHub 的 **Code → Download ZIP** 下载并解压源码。

```bash
git clone --depth 1 https://github.com/Manamiiii/TangerineTools.git
cd TangerineTools
npm ci
npm run dev
```

打开终端显示的 **http://localhost:5188**。无需配置环境变量、数据库服务或模型供应商。首次进入会读取仓库内的预置资料，等待初始化完成。

Windows 安装依赖后，也可以双击项目根目录的 `TangerineTools.vbs`。启动窗口会显示阶段和耗时，就绪后打开浏览器；失败原因留在窗口中。首次运行可能受系统脚本策略限制，此时直接使用上面的终端命令即可，不需要管理员权限。日志在 `artifacts/launcher/`。源码下载不附带作者电脑上的桌面快捷方式。

### 完成第一条记录

1. 点击首页「洛克王国」，先在「资料库」搜索你熟悉的精灵。
2. 切换「收集记录」→「新增记录」，选择图鉴名，按游戏中的实际个体填写性格、外观等信息并保存。
3. 打开「性格推荐」，搜索同一精灵。性格分档只判断适用性，「我的保留建议」结合你的收藏判断；两者不是同一件事。
4. 有异色／炫彩亲本后再尝试「孵蛋推荐」。没有可推进目标的组合时，会显示空状态，不能凭空生成稀有亲本。
5. 点击顶部 TangerineTools 返回首页，使用「导出数据」，在下载列表确认 JSON 文件已保存。

**请先备份，再做批量修改或删除。** 数据按浏览器和网址隔离：`localhost`、`127.0.0.1`、不同端口以及线上站点不是同一份收藏。换网址或设备前先导出，再到目标页面导入。导入按记录 ID 合并：同 ID 整条覆盖，文件未包含的本地记录保留。导入确认窗口可先导出当前数据。

## 限制与常见问题

- **扫描录入是实验功能**：目前按 3200×1440 横屏游戏画面标定，不能保证适配其他设备或布局；HEVC 视频解码还依赖浏览器和系统。新用户优先手动录入，扫描后仍须逐条复核。参见[扫描说明](docs/rock-kingdom/scanner.md)。
- **加速、减速和培养建议不是对战模拟**：规则读取六维、技能和特性，不计算完整配招、阵容、克制及全部能量循环。可保留分支按需选择；工具不替你在游戏中放生精灵。
- **没有自动云同步**：清除浏览器站点数据、无痕窗口结束或浏览器存储被回收都可能丢失本地记录。请把备份文件保存到浏览器外。
- **核心功能不依赖 AI**：可选的模型解释、扫描文字纠错需要自行配置可信供应商，浏览器直连，可能因 CORS 或费用限制而不可用。详见[模型配置与隐私边界](docs/model-provider-setup.md)。
- **图片不显示**：部分游戏图片引用外部 Wiki 图床；本地优先不等于所有资源都离线可用。网络或来源站点不可用时，文字记录仍可使用。首次初始化和未缓存功能也不承诺离线可用。
- **页面启动失败**：确认网络能读取本站静态文件、浏览器允许站点存储，然后点击「重新尝试」。不要为排错先清除站点数据；已有收藏请先备份。
- **5188 端口被占用**：停止冲突服务后重试。不要随意换端口寻找收藏；新端口使用独立浏览器数据。
- **其他游戏如何配置**：新建场景时启用需要的工具，在「资料库」建立资料表和字段；收集表可添加引用字段关联该表，再录入个人记录。

更多说明：[数据存储与备份](docs/data-sync.md) · [隐私与第三方内容](docs/privacy-and-sources.md)。

## 构建与自行部署

```bash
npm ci
npm run build
npm run preview -- --host localhost --port 5188 --strictPort
```

本地预览前先停止同端口开发服务。部署时上传 **`dist/` 的全部内容**，包括预置、OCR 语言包和运行资源，不能直接双击 `dist/index.html`。支持静态 HTTPS 托管，使用相对资源路径和 hash 路由，无需后端或服务端路由重写。`vite preview` 仅用于本地验收，不作为公网服务器。

仓库包含 `.github/workflows/pages.yml` 的 GitHub Pages 流程：检查、测试、构建通过后部署。Fork 用户需在仓库 Settings → Pages 中选择 GitHub Actions，并自行启用工作流；推送 `main` 或手动触发可能发布站点。仅想本地使用时，不必配置 Pages，也不必运行任何 BWiki 采集或预置发布命令。

开发容器通过 `npm ci` 准备依赖并启动 5188 端口；普通用户不需要 AI 开发工具。作者使用的 Codex 凭据配置只在显式设置 `TANGERINE_ENABLE_CODEX_SETUP=1` 后执行。不要将开发端口设为公开共享。容器启动路径尚需在实际 Codespaces 环境单独验收。

## 开发与维护

前端使用 React 19、Vite 与 Dexie，数据保存在浏览器 IndexedDB。维护者常用：

```bash
npm run lint
npm test
npm run build
```

完整测试包含本机 Chrome 无界面回归，需要已安装 Chrome；Windows 启动器测试只在 Windows 执行。首次安装和依赖审计需要联网。`npm audit` 检查已知依赖通告，不等同于完整安全审计。

<details>
<summary>全部维护命令（普通用户无需执行采集或发布）</summary>

| 命令 | 用途 |
|---|---|
| `npm run lint` | 静态检查 |
| `npm test` | 领域与回归测试 |
| `npm run build` | 生产构建 |
| `npm run build:icons` | 从 `public/favicon.svg` 导出 PNG、PWA 遮罩图标和 Windows ICO |
| `npm run check:nature` | 生成并检查性格推荐校准报告 |
| `npm run check:scanner:templates` | 检查扫描模板 |
| `npm run apply:scanner:templates` | 显式写入扫描模板 |
| `npm run sync:breeding` | 同步繁育资料 staging |
| `npm run check:official-announcements` | 检查官方版本 / 平衡公告并生成人工复核报告 |
| `npm run sync:bwiki:staging` | 同步 BWiki 基础 staging |
| `npm run sync:bwiki:details` | 同步 BWiki 详情 staging |
| `npm run sync:bwiki:nrc -- --version=S4-2026-09-10` | 同步新版 NRC 候选；默认最多请求 24 个缺失详情，每次等待 30 秒；可用 `--interval=60` 放慢 |
| `npm run import:bwiki:nrc -- --version=版本 --key=页面键 --file=快照.html` | 校验并导入 NRC HTML 快照 |
| `npm run collect:bwiki:browser -- --version=版本 --limit=all` | 本地 Chrome 点击图鉴卡片并双遍读取详情；默认间隔 60 秒，只补同批次缓存缺口 |
| `npm run import:bwiki:nrc -- --version=版本 --key=精灵sourceId --capture=采集记录.json` | 导入经过身份校验与双遍分段比对的浏览器详情记录；保留采集时间 |
| `npm run preview:bwiki:nrc` | 生成 NRC 候选预览与发布阻塞清单 |
| `npm run audit:bwiki:nrc` | 离线比较 NRC 源字段与正式资料，列出身份冲突、技能影响和详情缺口 |
| `npm run review:bwiki:nrc` | 离线验证最终 NRC 候选的完整性、旧 ID、家族、异色及技能引用，生成发布审阅清单；不批准发布 |
| `npm run check:bwiki:nrc` | 检查 NRC 发布条件及绑定具体候选的用户批准 |
| `npm run apply:bwiki:preset -- --source=nrc` | 用户确认并设置覆盖口令后发布 NRC 预置；同步运行时迁移版本，详见 NRC 来源文档 |
| `npm run check:bwiki:sources` | 核对 NRC 正式资料与逐行来源清单 |
| `npm run preview:bwiki` | 构建 BWiki 发布预览 |
| `npm run check:bwiki:preset` | dry-run 检查 NRC 正式预置差异 |
| `npm run apply:bwiki:preset -- --source=rocom` | 显式检查来源的 rocom 发布入口；遗漏正式稳定 ID 时拒绝写入 |

正式预置写入需要明确来源、针对具体候选的批准及 `BWIKI_PRESET_OVERWRITE` 确认值，见 [BWiki 发布流程](docs/data-sources/bwiki-pipeline.md)。不要把普通运行或升级与重新采集、发布资料混淆。

</details>

## 目录

```text
docs/                         当前能力、数据源与专项规则
public/presets/               洛克王国运行时正式预置
scripts/bwiki/                官方公告审计与 BWiki staging / preview / apply
scripts/nature/               性格推荐校准
scripts/rock-kingdom-scanner/ 扫描模板维护
scripts/vite/                 本地 OCR 运行资源打包与静态缓存版本
scripts/tests/                自动化回归测试
src/components/               场景和通用工具界面
src/features/                 OCR、模型与洛克王国专项能力
src/hooks/                    异步操作状态与收集表初始化
src/db/                       Dexie、播种、导入导出与迁移
src/presets/                  场景结构定义与版本化来源清单
```

## 维护文档

- [`docs/system-capabilities.md`](docs/system-capabilities.md)：产品范围和已实现能力。
- [`docs/privacy-and-sources.md`](docs/privacy-and-sources.md)：隐私、第三方请求与素材许可边界。
- [`docs/data-sync.md`](docs/data-sync.md)：Dexie、备份、导入与阅读迁移兼容。
- [`docs/data-sources/bwiki-pipeline.md`](docs/data-sources/bwiki-pipeline.md)：正式资料发布流程。
- [`docs/data-sources/bwiki-field-mapping.md`](docs/data-sources/bwiki-field-mapping.md)：字段转换、稳定 id 与校验门槛。
- [`docs/data-sources/nrc-source.md`](docs/data-sources/nrc-source.md)：新版 NRC 快照采集、候选边界与署名许可。
- [`docs/data-sources/research-sources.md`](docs/data-sources/research-sources.md)：玩家资料研究边界。
- [`docs/wuhui-huaxia/catalog.md`](docs/wuhui-huaxia/catalog.md)：无悔华夏名臣资料、个人收集模型与来源约束。
- [`docs/nature/rules.md`](docs/nature/rules.md)：性格推荐规则。
- [`docs/nature/single-creature-template.md`](docs/nature/single-creature-template.md)：单精灵审计模板。
- [`docs/nature/open-issues.md`](docs/nature/open-issues.md)：待确认规则问题。
- [`docs/nature/confirmed-results.md`](docs/nature/confirmed-results.md)：确认结论与回归基线。
- [`docs/rock-kingdom/scanner.md`](docs/rock-kingdom/scanner.md)：扫描器契约。
- [`docs/rock-kingdom/scanner-baseline.md`](docs/rock-kingdom/scanner-baseline.md)：扫描回归基线。
- [`docs/model-provider-setup.md`](docs/model-provider-setup.md)：洛克王国模型服务配置。

应用图标源文件为 `public/favicon.svg`；运行 `npm run build:icons` 导出 `public/icons/tangerine-tools-*` 与 Windows ICO。启动入口为 `TangerineTools.vbs`，实现位于 `scripts/windows/`。

## 问题反馈

通过 [GitHub Issues](https://github.com/Manamiiii/TangerineTools/issues) 提供使用入口、浏览器／系统、操作步骤、预期和实际结果。截图请去掉昵称等个人信息；不要公开 API Key、整份个人备份或原始录屏。资料纠错请附对应的游戏版本与来源页面。

## License 与素材说明

**项目代码尚未指定开源许可证。** 仓库公开可见不等于已经给予通用的使用、修改和再分发许可；许可证须由作者明确选择，本文件不代替授权。

Wiki 文字、游戏图片、扫描样本、OCR 语言包与软件依赖各有其来源和许可范围，不能一并声明为项目代码许可证。页面底部提供来源与版权说明；详细边界见[隐私与第三方内容](docs/privacy-and-sources.md)。TangerineTools 与游戏官方及 Wiki 站点无隶属或授权关系。
