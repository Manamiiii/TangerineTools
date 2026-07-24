# TangerineTools

TangerineTools 是一个本地优先（local-first）的个人资料管理 Web App，用来按“场景”组织资料库、收集记录和辅助分析工具。当前默认场景为「洛克王国世界」，也可以新建通用、游戏或资料类场景并按需启用工具。

## 特性概览

- **本地优先，无后端依赖**：数据保存在浏览器 IndexedDB 中，通过 Dexie.js 读写；应用可作为静态站点部署。
- **场景化工具箱**：首页管理多个场景，每个场景可单独启用资料库、收集记录、统计视图、性格推荐、孵蛋推荐和阅读伴侣六种工具。
- **可配置资料库**：支持多资料表、字段管理、搜索、排序、筛选、分页、详情弹窗，以及由字段配置控制的紧凑列宽、多行标签、摘要单元格、引用头像和图标化选项。
- **引用与多引用字段**：支持单条资料引用和一对多资料引用；洛克王国精灵通过 `skillRefs` 关联技能资料，技能通过 `learnerRefs` 反向关联可学精灵。
- **收集记录**：记录“我具体拥有哪一只 / 哪一份”，支持一对一和一对多模式；可搜索引用字段在同一个组合框中完成输入筛选和选择。
- **统计视图**：从资料库或收集记录选择数据源，按字段分组并叠加数值阈值条件统计。
- **性格推荐**：每个编号从普通形态进入，展示统一绝对刻度的六维、动态分位、完整特性和同编号全部形态差异；候选按强化维度与推荐档位展示，按进化链匹配已获得性格，并为推荐/可保留性格提供预填快速新增收集记录。
- **孵蛋推荐**：结合收集记录、性别、异色/炫彩、性格、蛋组和繁育谱系，对可用父母组合进行排序。
- **阅读伴侣**：内置「经典文学阅读」场景，按指定译本保存阅读章节，接收粘贴段落或页面截图，并以确定性规则约束资料的可揭示进度和剧透确认级别。
- **全量导入/导出**：在首页通过 JSON 文件手动备份或迁移全部本地数据。
- **洛克王国预置资料**：首次启动会自动创建“洛克王国”场景，包含精灵基础资料和技能资料；当前正式预置只由版本化 BWiki staging / preview 审计产物显式发布。

## 技术栈

- [Vite](https://vite.dev/) + React 19
- Dexie.js / dexie-react-hooks（IndexedDB 本地存储与响应式读取）
- lucide-react 图标
- oxlint 静态检查
- 纯 CSS（无 CSS 框架、无 CSS Modules）
- 基于 `window.location.hash` 的轻量路由（无路由库）

## 快速开始

### 环境要求

- Node.js `>=20.19.0`
- npm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 生产构建 / 预览 / 静态检查

```bash
npm run build
npm run preview
npm run lint
```

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生成生产构建 |
| `npm run preview` | 本地预览生产构建产物 |
| `npm run lint` | 使用 oxlint 做静态检查 |
| `npm run check:reader:packages` | 校验阅读资料目录、版本信息、稳定章节和事实引用 |
| `npm run preview:reader` | 从阅读资料 staging 生成版本化发布预览 |
| `npm run check:reader:preset` | dry-run 检查阅读资料 preview 与正式资料包差异并生成本地报告 |
| `npm run apply:reader:preset` | 显式发布阅读资料 preview；还必须提供确认环境变量 |
| `npm run check:nature` | 在 `artifacts/nature/` 生成本地性格推荐校准报告 |
| `npm run sync:bwiki:staging` | 刷新 BWiki 精灵、技能、蛋和果实 staging |
| `npm run sync:bwiki:details` | 刷新 BWiki 精灵详情 staging |
| `npm run sync:breeding` | 刷新蛋组和繁育谱系 staging |
| `npm run preview:bwiki` | 从 staging 构建版本化发布候选 |
| `npm run check:bwiki:preset` | dry-run 校验 BWiki preview 的正式发布范围并在 `artifacts/` 生成报告，不修改正式预置 |
| `npm run apply:bwiki:preset` | 显式发布 BWiki preview；还必须提供报告约定的确认环境变量 |
| `npm test` | 验证领域规则、数据兼容、BWiki 管线和文档当前态约束 |

## 项目结构

```text
.
├── .github/workflows/pages.yml           # GitHub Pages 构建与部署
├── docs/
│   ├── data-sources/
│   │   ├── bwiki-pipeline.md             # BWiki 来源、快照与显式发布流程
│   │   ├── bwiki-field-mapping.md        # 字段血缘、稳定 id 与验收门槛
│   │   └── research-sources.md            # B站、小红书等外部研究证据口径
│   ├── nature/
│   │   ├── rules.md                      # 性格推荐当前规则
│   │   ├── single-creature-template.md   # 单只精灵核对模板
│   │   ├── confirmed-results.md          # 用户确认的回归基线
│   │   └── open-issues.md                # 尚待确认的通用规则问题
│   ├── reading-companion/
│   │   └── product-and-architecture.md    # 经典文学阅读伴侣规划与剧透安全契约
│   ├── data-sync.md                      # IndexedDB、导入和预置迁移语义
│   └── system-capabilities.md            # 已实现能力和明确非目标
├── public/presets/
│   ├── reading-companion/                # 版本化书籍资料目录与运行时资料包
│   ├── rockKingdomRows.json              # 运行时精灵 / 形态预置
│   ├── rockKingdomSkillRows.json         # 运行时技能预置
│   └── rockKingdomPresetMigration.json   # 已有浏览器安全升级所需的官方值指纹
├── scripts/
│   ├── bwiki/
│   │   ├── sync-*.mjs                    # BWiki 页面到 staging 快照
│   │   ├── build-preview.mjs             # staging 到发布候选
│   │   ├── apply-preset.mjs              # dry-run 校验与显式发布
│   │   ├── lib/                          # 路径和标签规则共享模块
│   │   └── data/                         # 版本化 staging 与 preview
│   ├── reading/
│   │   ├── data/                         # 阅读资料 staging 与 preview
│   │   ├── lib/                          # 阅读资料发布共享逻辑
│   │   ├── build-preview.mjs             # staging 到发布候选
│   │   ├── apply-preview.mjs             # dry-run 检查与显式发布
│   │   └── validate-packages.mjs          # 正式阅读资料包结构校验
│   ├── data/natureCalibrationSamples.json # 性格校准样例
│   ├── tests/                            # node:test 纯逻辑与 fake-indexeddb 集成测试
│   └── check-nature-recommendations.mjs  # 本地性格校准报告生成器
├── src/
│   ├── components/
│   │   ├── dataTables.jsx                # 资料库工具编排
│   │   ├── catalog.jsx                   # 通用表格、字段、批量引用解析
│   │   ├── owned.jsx / stock.jsx         # 收集记录 / 统计视图
│   │   ├── nature.jsx / breeding.jsx     # 性格推荐 / 孵蛋推荐 UI
│   │   ├── reader.jsx                    # 阅读进度、文本和截图输入
│   │   └── common.jsx / ErrorBoundary.jsx # 通用控件与工具级错误恢复
│   ├── db/
│   │   ├── core.js                       # Dexie v1 schema 与数据库实例
│   │   ├── importExport.js               # JSON 校验、导出与 merge-by-id 导入
│   │   ├── repository.js                 # 场景、表、字段和行的 CRUD
│   │   ├── readingState.js               # meta 中的阅读进度存取
│   │   ├── readingCompanionSeed.js        # 经典文学阅读场景播种
│   │   ├── seed.js                       # 应用预置初始化编排
│   │   └── rockKingdomSeed.js            # 预置播种与三方迁移
│   ├── domain/
│   │   ├── nature.js / naturePve.js      # 性格规则引擎 / PVE 展示判定
│   │   ├── natureRowAdapter.js            # 资料行到推荐输入的适配
│   │   ├── rockKingdom*.js               # 形态、展示和共享标签规则
│   │   ├── readingCompanion.js            # 资料包校验与剧透门禁
│   │   └── owned.js / stock.js / breeding*.js # 其他工具纯领域逻辑
│   ├── presets/
│   │   ├── rockKingdom.js                # 洛克王国场景、字段和选项
│   │   └── readingCompanion.js            # 经典文学阅读场景定义
│   ├── App.jsx                            # hash 路由、工具懒加载、全局导入导出
│   ├── db.js                              # 稳定的数据访问兼容门面
│   ├── constants.js / utils.js            # 全局约定与通用工具
│   ├── main.jsx                           # React 挂载入口
│   └── styles.css                         # 全局样式唯一入口
├── AGENTS.md                              # 长期开发边界和必读约束
├── index.html
├── package.json
└── vite.config.js
```

核心依赖方向保持为 `components → domain / db → Dexie`：组件负责交互和展示，`domain/` 保持可直接测试的纯逻辑，`db/` 统一承担持久化。同步脚本只产出版本化预置，不作为浏览器运行时依赖。

## 验证清单

日常代码修改建议按下面顺序验证：

```bash
npm run lint
npm test
npm run build
git diff --check
```

- `npm test` 覆盖领域规则、PVE 判定、预置三方迁移、导入校验、仓储级联、IndexedDB 播种/失败重试、BWiki staging 结构和文档当前态约束。
- 涉及性格规则时额外运行 `npm run check:nature`，并检查已确认样例是否出现非预期漂移。
- 涉及 BWiki 预置时先运行 `npm run check:bwiki:preset`；该命令只生成 `artifacts/` 审计报告，不会写入正式预置。
- 涉及工具入口、懒加载或 Hook 时，启动 `npm run dev` 后依次切换资料库、收集记录、统计视图、性格推荐、孵蛋推荐和阅读伴侣，确认均完成渲染且没有进入错误恢复页。
- 涉及阅读资料包时运行 `npm run check:reader:packages`，确认目录、版本、章节和事实引用全部有效。
- 涉及阅读资料发布时依次运行 `npm run preview:reader` 和 `npm run check:reader:preset`；正式写入必须显式设置 `READING_PACKAGE_OVERWRITE=CONFIRM_READING_PACKAGE` 后运行 `npm run apply:reader:preset`。
- 上述验证不会清空浏览器中的收集记录或统计配置；导入仍按 id 合并。

## 经典文学阅读预置

应用首次初始化会创建「经典文学阅读」场景，只启用阅读伴侣。用户删除该场景后不会自动重建；用户修改名称或工具组合时，初始化流程不会覆盖这些设置。

运行时资料目录位于 `public/presets/reading-companion/`。《飘》资料包对应长江文艺出版社 2018 年 5 月版、ISBN `9787570202188`，章节稳定标识覆盖 1–63 章。正式实体、事实和来源只通过 `scripts/reading/data/` 下的 staging / preview / apply 流程发布；候选来源不会进入运行时资料包。

阅读伴侣按当前章节过滤正式资料包中的实体，并可在不依赖模型或外部地图服务的空间概览中展示已审计地点。正式地点必须引用已批准来源和指定版本的章节边界；开发时研究候选与测试夹具不属于运行时正式资料。

新增书籍只需要增加一份 staging JSON。新书 staging 携带完整 `package`，已有书更新可以通过 `basePackagePath` 复用正式包；管线自动发现全部 staging、生成逐书 preview 和统一 catalog，不需要修改发布脚本。

## 洛克王国预置资料

首次启动时会自动创建洛克王国场景：

- 默认启用资料库、收集记录、统计视图、性格推荐、孵蛋推荐五个工具。
- 包含「精灵基础资料」和「技能资料」普通资料表。
- `rockKingdomRows.json` 包含 592 条精灵 / 形态资料。
- `rockKingdomSkillRows.json` 包含 553 条技能资料。
- 精灵通过 `skillRefs` 多引用关联技能；技能通过 `learnerRefs` 多引用反向关联可学精灵。
- 精灵与技能图片使用经审计的 BWiki / patchwiki URL，UI 图标使用可信静态资源。
- B站和小红书作为玩法、定位、机制演示与养成经验的外部研究源；研究结论必须保留链接和版本信息，不直接覆盖正式预置字段。

预置资料通过版本化基线正式值指纹做三方合并：仅更新空值、无效值或匹配基线正式值的字段，保留用户自定义非空值、用户新增资料、收集记录和统计视图记录。

## 数据存储、备份与导入

项目使用 IndexedDB 作为唯一数据源，数据库名为 `tangerine-tools`。核心表包括：

- `scenes`：场景
- `catalogTables`：资料表
- `catalogFields`：字段
- `catalogRows`：行数据
- `meta`：内部标记（例如预置资料是否已播种）

首页提供全量 JSON 导出/导入：

- **导出**：导出全部 Dexie 表数据，文件名形如 `tangerine-tools-YYYY-MM-DD.json`。
- **导入**：采用“同 id 覆盖，文件中未包含的本地数据保留”的合并策略，不会清空本地已有但导入文件中缺失的数据。

更详细的数据结构与同步说明见 [`docs/data-sync.md`](docs/data-sync.md)。

## 维护文档

- [`AGENTS.md`](AGENTS.md)：长期有效的 Codex/agent 开发边界、必读文件与测试命令。
- [`docs/system-capabilities.md`](docs/system-capabilities.md)：当前已实现能力与明确排除范围。
- [`docs/data-sync.md`](docs/data-sync.md)：数据模型、导入/导出、预置资料同步与迁移语义。
- [`docs/data-sources/bwiki-pipeline.md`](docs/data-sources/bwiki-pipeline.md)：BWiki 页面、版本化快照、刷新顺序和发布边界。
- [`docs/data-sources/bwiki-field-mapping.md`](docs/data-sources/bwiki-field-mapping.md)：staging 到正式预置的字段血缘、稳定 id 和验收门槛。
- [`docs/data-sources/research-sources.md`](docs/data-sources/research-sources.md)：B站、小红书等玩家资料的用途、证据记录方式和采用边界。
- [`docs/nature/rules.md`](docs/nature/rules.md)：性格推荐规则、输入输出和校准约束。
- [`docs/nature/single-creature-template.md`](docs/nature/single-creature-template.md)：单只精灵定位与性格核对格式。
- [`docs/nature/confirmed-results.md`](docs/nature/confirmed-results.md)：用户确认过的单只结果，用作规则回归基线。
- [`docs/nature/open-issues.md`](docs/nature/open-issues.md)：尚未形成稳定规则的通用问题。
- [`docs/reading-companion/product-and-architecture.md`](docs/reading-companion/product-and-architecture.md)：经典文学阅读伴侣的已实现范围、按书建库、跨端入口和剧透安全契约。

根 README 是项目结构、命令和维护文档的统一入口；专题文档只保存各自领域内不可由代码结构直接表达的规则与约束。

## 部署

本项目不依赖后端服务，执行 `npm run build` 后可将 `dist/` 部署到任意静态托管平台。仓库已提供 `.github/workflows/pages.yml` 用于 GitHub Pages 部署。
