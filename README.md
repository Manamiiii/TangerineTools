# TangerineTools

TangerineTools 是一个本地优先（local-first）的个人资料管理 Web App，用来按“场景”组织资料库、收集记录和辅助分析工具。当前默认场景为「洛克王国世界」，也可以新建通用、游戏或资料类场景并按需启用工具。

## 特性概览

- **本地优先，无后端依赖**：数据保存在浏览器 IndexedDB 中，通过 Dexie.js 读写；应用可作为静态站点部署。
- **场景化工具箱**：首页管理多个场景，每个场景可单独启用资料库、收集记录、统计视图、性格推荐和孵蛋推荐五种工具。
- **可配置资料库**：支持多资料表、字段管理、搜索、排序、筛选、分页、详情弹窗、同编号形态对比等能力。
- **引用与多引用字段**：支持单条资料引用和一对多资料引用；洛克王国精灵通过 `skillRefs` 关联技能资料，技能通过 `learnerRefs` 反向关联可学精灵。
- **收集记录**：记录“我具体拥有哪一只 / 哪一份”，支持一对一和一对多模式。
- **统计视图**：从资料库或收集记录选择数据源，按字段分组并叠加数值阈值条件统计。
- **性格推荐**：手动录入或从洛克王国精灵资料带入六维，读取特性标签和技能引用，展示全部合法性格候选及解释。
- **孵蛋推荐**：结合收集记录、性别、异色/炫彩、性格、蛋组和繁育谱系，对可用父母组合进行排序。
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
│   │   └── bwiki-field-mapping.md        # 字段血缘、稳定 id 与验收门槛
│   ├── nature/
│   │   ├── rules.md                      # 性格推荐当前规则
│   │   ├── single-creature-template.md   # 单只精灵核对模板
│   │   ├── confirmed-results.md          # 用户确认的回归基线
│   │   └── open-issues.md                # 尚待确认的通用规则问题
│   ├── data-sync.md                      # IndexedDB、导入和预置迁移语义
│   └── system-capabilities.md            # 已实现能力和明确非目标
├── public/presets/
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
│   ├── data/natureCalibrationSamples.json # 性格校准样例
│   ├── tests/                            # node:test 纯逻辑与 fake-indexeddb 集成测试
│   └── check-nature-recommendations.mjs  # 本地性格校准报告生成器
├── src/
│   ├── components/
│   │   ├── dataTables.jsx                # 资料库工具编排
│   │   ├── catalog.jsx                   # 通用表格、字段、批量引用解析
│   │   ├── owned.jsx / stock.jsx         # 收集记录 / 统计视图
│   │   ├── nature.jsx / breeding.jsx     # 性格推荐 / 孵蛋推荐 UI
│   │   └── common.jsx / ErrorBoundary.jsx # 通用控件与工具级错误恢复
│   ├── db/
│   │   ├── core.js                       # Dexie v1 schema 与数据库实例
│   │   ├── importExport.js               # JSON 校验、导出与 merge-by-id 导入
│   │   ├── repository.js                 # 场景、表、字段和行的 CRUD
│   │   └── rockKingdomSeed.js            # 预置播种与三方迁移
│   ├── domain/
│   │   ├── nature.js / naturePve.js      # 性格规则引擎 / PVE 展示判定
│   │   ├── natureRowAdapter.js            # 资料行到推荐输入的适配
│   │   ├── rockKingdom*.js               # 形态、展示和共享标签规则
│   │   └── owned.js / stock.js / breeding*.js # 各工具纯领域逻辑
│   ├── presets/rockKingdom.js             # 场景、字段和选项定义
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
- 涉及工具入口、懒加载或 Hook 时，启动 `npm run dev` 后依次切换资料库、收集记录、统计视图、性格推荐和孵蛋推荐，确认均完成渲染且没有进入错误恢复页。
- 上述验证不会清空浏览器中的收集记录或统计配置；导入仍按 id 合并。

## 洛克王国预置资料

首次启动时会自动创建洛克王国场景：

- 默认启用资料库、收集记录、统计视图、性格推荐、孵蛋推荐五个工具。
- 包含「精灵基础资料」和「技能资料」普通资料表。
- `rockKingdomRows.json` 包含 592 条精灵 / 形态资料。
- `rockKingdomSkillRows.json` 包含 553 条技能资料。
- 精灵通过 `skillRefs` 多引用关联技能；技能通过 `learnerRefs` 多引用反向关联可学精灵。
- 精灵与技能图片使用经审计的 BWiki / patchwiki URL，UI 图标使用可信静态资源。

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
- [`docs/nature/rules.md`](docs/nature/rules.md)：性格推荐规则、输入输出和校准约束。
- [`docs/nature/single-creature-template.md`](docs/nature/single-creature-template.md)：单只精灵定位与性格核对格式。
- [`docs/nature/confirmed-results.md`](docs/nature/confirmed-results.md)：用户确认过的单只结果，用作规则回归基线。
- [`docs/nature/open-issues.md`](docs/nature/open-issues.md)：尚未形成稳定规则的通用问题。

根 README 是项目结构、命令和维护文档的统一入口；专题文档只保存各自领域内不可由代码结构直接表达的规则与约束。

## 部署

本项目不依赖后端服务，执行 `npm run build` 后可将 `dist/` 部署到任意静态托管平台。仓库已提供 `.github/workflows/pages.yml` 用于 GitHub Pages 部署。
