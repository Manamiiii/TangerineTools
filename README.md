# TangerineTools

TangerineTools 是一个本地优先（local-first）的个人资料管理 Web App。它以“场景”为工作空间，把可配置资料库、个人收集记录、统计视图和领域工具组织在一起；无需后端或账号，数据默认保存在当前浏览器中。

项目内置“洛克王国”作为完整示例，首次启动即可浏览精灵与技能资料、记录个人收藏，并基于六维、特性和技能线索生成可解释的性格推荐。你也可以创建通用整理、游戏资料、镜头素材或资料档案场景，按需组合工具和字段。

## 适合做什么

- 整理角色、装备、宠物、素材、镜头或其他长期维护的个人资料。
- 为同一类资料建立多张关联表，并用引用字段连接记录。
- 记录“我拥有的具体实例”，例如同一种精灵的多个个体或一项只需完成一次的收藏。
- 按字段分组、筛选和统计资料或收集记录。
- 在桌面或 Android Chrome 中作为可安装 Web App 使用。

## 核心特性

### 本地优先

- 使用 Dexie.js 读写浏览器 IndexedDB，应用本身可以部署为纯静态站点。
- 不需要后端、登录或云账号。
- 支持全量 JSON 导出和合并导入，便于手动备份与迁移。

### 场景化工具箱

每个场景可以独立启用以下工具：

| 工具 | 用途 |
|---|---|
| 资料库 | 管理对象的静态资料和关联数据 |
| 收集记录 | 记录个人实际拥有或完成的实例，支持一对一和一对多模式 |
| 统计视图 | 从资料库或收集记录选择数据源，按字段分组并叠加数值阈值条件 |
| 性格推荐 | 根据六维、特性标签和技能线索评价洛克王国的 30 个合法性格候选 |

### 可配置资料库

- 一个场景可包含多张资料表，并支持表的创建、重命名、切换和删除。
- 支持短文本、长文本、数字、图片、单选、多选、布尔、URL、日期、单引用、多引用和指标视图等 12 种字段类型。
- 支持字段排序、隐藏、插入、筛选和选项配置。
- 表格提供搜索、自然排序、组合筛选、分页和详情弹窗。
- 指标视图可以把任意数值字段映射为条形列表或雷达图。
- 同编号资料可在详情中进行形态对比，并展示主要差异与适合方向。

### 引用与多引用

- `reference` 字段关联一条其他资料表记录。
- `references` 字段关联多条记录，并可从标签打开被引用资料的详情。
- 洛克王国精灵通过 `skillRefs` 关联技能，技能通过 `learnerRefs` 反向关联可学习该技能的精灵。

### 洛克王国预置

- 首次启动自动创建“洛克王国”场景，并启用全部四个工具。
- 内置“精灵基础资料”和“技能资料”两张普通资料表。
- `rockKingdomRows.json` 包含 496 条精灵/形态资料；技能资料单独保存在 `rockKingdomSkillRows.json`。
- 精灵图、系别图标、特性图标、技能图标和技能类型图标使用腾讯游戏公开图鉴静态资源。
- 性格推荐可自动带入精灵六维、特性标签和真实技能引用，按“推荐 / 可保留 / 不推荐”展示全部候选及解释。

预置迁移采用保守策略：只安全补齐预置结构、字段和官方资料，或删除明确可识别的旧占位内容；不会删除用户新增资料、收集记录或统计数据。

## 技术栈

- [Vite](https://vite.dev/) + React 19
- [Dexie.js](https://dexie.org/) / dexie-react-hooks
- [lucide-react](https://lucide.dev/) 图标
- oxlint 静态检查
- 纯 CSS，无 CSS 框架或 CSS Modules
- 基于 `window.location.hash` 的轻量路由，无路由库

## 快速开始

### 环境要求

- Node.js `>=20.19.0`；仓库 `.nvmrc` 当前使用 `22.12.0`
- npm

### 安装与启动

```bash
npm install
npm run dev
```

### 构建与检查

```bash
npm run build
npm run lint
npm run preview
```

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生成生产构建到 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm run lint` | 使用 oxlint 做静态检查 |
| `npm run sync:rock` | 从官方源或本地可信 `d.json` 生成洛克王国精灵与技能预置资料 |
| `npm run check:nature` | 使用预置资料和校准样例生成性格推荐校准报告 |

当前环境无法访问官方源时，可以使用仓库内可信源复现预置资料：

```bash
npm run sync:rock scripts/data/rockKingdom.d.json
```

调整性格推荐规则后，建议运行：

```bash
npm run check:nature
npm run build
npm run lint
```

## 项目结构

```text
.
├── .github/workflows/pages.yml       # GitHub Pages 构建与部署
├── docs/                             # 能力、数据同步、交接与规则设计文档
├── public/
│   ├── icons/                        # PWA 图标
│   ├── presets/
│   │   ├── rockKingdomRows.json      # 精灵/形态预置资料
│   │   └── rockKingdomSkillRows.json # 技能预置资料
│   ├── manifest.webmanifest          # Web App Manifest
│   └── sw.js                         # 最小 service worker，不缓存业务资源
├── scripts/
│   ├── data/                         # 可信源与性格推荐校准样例
│   ├── check-nature-recommendations.mjs
│   └── sync-rock-kingdom-preset.mjs
├── src/
│   ├── components/                   # 页面、弹窗、表格和工具组件
│   ├── domain/                       # 收集、统计、性格推荐等领域逻辑
│   ├── presets/                      # 预置场景、表、字段与选项
│   ├── App.jsx                       # 应用入口、hash 路由、全局导入导出
│   ├── constants.js                  # 场景、工具和字段类型等常量
│   ├── db.js                         # Dexie schema、CRUD、播种、迁移和导入导出
│   ├── main.jsx                      # React 挂载入口
│   ├── styles.css                    # 全局样式
│   └── utils.js                      # 通用工具函数
├── index.html
├── package.json
└── vite.config.js
```

## 数据存储与备份

IndexedDB 数据库名为 `tangerine-tools`，核心表包括：

| 表 | 内容 |
|---|---|
| `scenes` | 场景 |
| `catalogTables` | 普通资料表和收集记录表 |
| `catalogFields` | 字段定义 |
| `catalogRows` | 行数据 |
| `meta` | 播种版本等内部标记 |

首页提供全量 JSON 导出与导入：

- 导出文件名形如 `tangerine-tools-YYYY-MM-DD.json`。
- 导入采用“相同 id 覆盖、文件未包含的数据保留”的合并策略，不会先清空本地数据库。

> [!IMPORTANT]
> 数据属于当前浏览器和当前站点来源。清除网站数据、切换浏览器或更换部署域名后，原数据不会自动跟随。请定期导出 JSON 备份；导入不可撤销，操作前建议先导出当前数据。

详细结构和迁移语义见 [`docs/data-sync.md`](docs/data-sync.md)。

## PWA 与离线行为

项目提供 Web App Manifest、可安装图标和最小 service worker，可满足 Android Chrome 的基础安装条件。service worker 不预缓存资源，也不提供自定义离线响应，以避免旧版本资源长期滞留；因此“可安装”不等于“完整离线可用”。IndexedDB 中的用户数据不会被 service worker 读写。

## 部署

项目不依赖后端。执行 `npm run build` 后，可以把 `dist/` 部署到 GitHub Pages、Cloudflare Pages 或其他静态托管平台。

`vite.config.js` 使用相对资源路径，因此同一份构建产物可以部署在域名根路径或 GitHub Pages 的仓库子路径。仓库内的 [`.github/workflows/pages.yml`](.github/workflows/pages.yml) 会在 PR 中验证构建，并在 `main` 更新后发布 GitHub Pages。

## 当前边界

- 面向个人使用，不提供账号、后端、云同步、多用户协作或权限系统。
- 不包含 AI 自动打标签。
- 洛克王国能力聚焦资料整理、个人收集和轻量推荐，不做完整对战模拟、属性克制、进化链、PVP 环境分析或配队求解。
- 性格推荐是可解释的启发式规则；最终面板公式和具体样例权重仍可继续校准。

## 维护文档

- [`docs/system-capabilities.md`](docs/system-capabilities.md)：已实现能力与明确排除范围。
- [`docs/data-sync.md`](docs/data-sync.md)：数据模型、导入导出、预置同步与迁移语义。
- [`docs/session-start-prompt.md`](docs/session-start-prompt.md)：后续开发约束和质量基线。
- [`docs/nature-recommendation-redesign.md`](docs/nature-recommendation-redesign.md)：性格推荐规则与界面设计。

