# TangerineTools

TangerineTools 是一个本地优先（local-first）的个人资料管理 Web App，用来按“场景”组织资料库、收集记录、统计视图和性格推荐等小工具。当前默认演示场景为洛克王国，也可以新建通用/游戏/资料类场景并按需启用工具。

## 特性概览

- **本地优先，无后端依赖**：数据保存在浏览器 IndexedDB 中，通过 Dexie.js 读写；应用可作为静态站点部署。
- **场景化工具箱**：首页管理多个场景，每个场景可单独启用资料库、收集记录、统计视图、性格推荐工具。
- **可配置资料库**：支持多资料表、字段管理、搜索、排序、筛选、分页、详情弹窗、同编号形态对比等能力。
- **引用与多引用字段**：支持单条资料引用和一对多资料引用；洛克王国精灵通过 `skillRefs` 关联技能资料，技能通过 `learnerRefs` 反向关联可学精灵。
- **收集记录**：记录“我具体拥有哪一只 / 哪一份”，支持一对一和一对多模式。
- **统计视图**：从资料库或收集记录选择数据源，按字段分组并叠加数值阈值条件统计。
- **性格推荐**：手动录入或从洛克王国精灵资料带入六维，读取特性标签和技能引用，展示全部合法性格候选及解释。
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
| `npm run check:bwiki:preset` | dry-run 校验 BWiki preview 的正式发布范围并在 `artifacts/` 生成报告，不修改正式预置 |
| `npm run apply:bwiki:preset` | 显式发布 BWiki preview；还必须提供报告约定的确认环境变量 |
| `npm test` | 验证领域规则、预置三方迁移和 IndexedDB 播种/重试行为 |

## 项目结构

```text
.
├── docs/                         # 能力说明、数据同步说明、交接提示、性格推荐设计草案
├── public/
│   └── presets/
│       ├── rockKingdomRows.json            # 精灵 / 形态预置资料
│       ├── rockKingdomSkillRows.json       # 技能预置资料
│       └── rockKingdomPresetMigration.json # 已有浏览器三方迁移指纹
├── scripts/
│   ├── data/bwiki/                    # 当前 BWiki staging 与 preview
│   └── *.mjs                          # BWiki 同步、转换、校验与发布脚本
├── src/
│   ├── components/               # UI 组件与工具组件
│   ├── domain/                   # 收集记录、统计、性格推荐、洛克王国领域逻辑
│   ├── presets/                  # 预置场景/字段/选项结构
│   ├── App.jsx                   # 应用入口、hash 路由、全局导入导出
│   ├── constants.js              # 全局常量、字段类型、工具定义
│   ├── db/                       # Dexie schema、导入导出与数据模块
│   ├── db.js                     # 数据访问兼容入口
│   ├── main.jsx                  # React 挂载入口
│   ├── styles.css                # 全局样式
│   └── utils.js                  # 通用工具函数
├── index.html
├── package.json
└── vite.config.js
```

## 洛克王国预置资料

首次启动时会自动创建洛克王国场景：

- 默认启用资料库、收集记录、统计视图、性格推荐、孵蛋推荐五个工具。
- 包含「精灵基础资料」和「技能资料」普通资料表。
- `rockKingdomRows.json` 包含 592 条精灵 / 形态资料。
- `rockKingdomSkillRows.json` 包含 553 条技能资料。
- 精灵通过 `skillRefs` 多引用关联技能；技能通过 `learnerRefs` 多引用反向关联可学精灵。
- 精灵与技能图片以 BWiki / patchwiki 审计快照为主；仍受支持的旧资源和 UI 图标继续使用可信静态资源。

预置资料通过版本化旧官方值指纹做三方合并：仅更新空值、无效值或仍匹配旧官方值的字段，保留用户自定义非空值、用户新增资料、收集记录和统计视图记录。

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
- [`docs/README.md`](docs/README.md)：`docs/` 文件用途索引，说明哪些是长期维护文档、哪些是生成报告。
- [`docs/system-capabilities.md`](docs/system-capabilities.md)：当前已实现能力与明确排除范围。
- [`docs/data-sync.md`](docs/data-sync.md)：数据模型、导入/导出、预置资料同步与迁移语义。
- [`docs/session-start-prompt.md`](docs/session-start-prompt.md)：下一轮 session 启动提示、代码地图和阶段重点。
- [`docs/nature-recommendation-redesign.md`](docs/nature-recommendation-redesign.md)：性格推荐规则设计草案，下一轮规则调参从这里继续。
- [`docs/rocom-position-audit-plan.md`](docs/rocom-position-audit-plan.md)：洛克王国世界外部定位核对计划和批次台账。
- [`docs/nature-calibration-report.md`](docs/nature-calibration-report.md)：由 `npm run check:nature` 生成的性格推荐校准报告。

## 部署

本项目不依赖后端服务，执行 `npm run build` 后可将 `dist/` 部署到任意静态托管平台。仓库已提供 `.github/workflows/pages.yml` 用于 GitHub Pages 部署。
