# TangerineTools

TangerineTools 是一个本地优先（local-first）的个人资料管理 Web App，用来按“场景”组织资料库、拥有清单、属性库存和性格推荐等小工具。当前项目以洛克王国资料整理为默认演示场景，也可以新建通用/游戏/资料类场景，按需启用不同工具。

## 特性概览

- **本地优先，无后端依赖**：数据保存在浏览器 IndexedDB 中，通过 Dexie.js 读写；应用可作为静态站点部署。
- **场景化工具箱**：首页管理多个场景，每个场景可单独启用资料库、单项清单、属性库存、性格推荐工具。
- **可配置资料库**：支持多资料表、字段管理、搜索、排序、筛选、分页、详情弹窗、同编号形态对比等能力。
- **单项清单**：记录“我具体拥有哪一只”，包含引用对象、昵称、等级、性格方向、血脉、状态、异色、获取日期和备注，并提供统计视图。
- **属性库存**：登记一批实例并按分类、状态、等级阈值做快速统计。
- **性格推荐**：手动录入或从资料库带入六维数据，根据数值与特性标签生成可解释的性格推荐候选。
- **全量导入/导出**：在首页通过 JSON 文件手动备份或迁移全部本地数据。
- **洛克王国预置资料**：首次启动会自动创建“洛克王国”场景，包含精灵基础资料表；预置行数据目标来源为洛克王国公开图鉴静态 JSON，并由同步脚本生成。

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

启动后按终端提示访问本地地址。应用数据会保存在当前浏览器的 IndexedDB 中。

### 生产构建

```bash
npm run build
```

构建产物会输出到 `dist/`。

### 预览生产构建

```bash
npm run preview
```

### 静态检查

```bash
npm run lint
```

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生成生产构建 |
| `npm run preview` | 本地预览生产构建产物 |
| `npm run lint` | 使用 oxlint 做静态检查 |
| `npm run sync:rock` | 从洛克王国公开图鉴 `d.json` 生成预置资料行（当前执行环境需能访问源站） |

## 功能模块

### 1. 场景管理

首页展示全部场景，支持新建、编辑、删除场景。场景包含名称、类型、主题色和启用工具列表。点击场景后会进入该场景工作台；如果启用了多个工具，顶部会显示分段式工具切换器。

当前支持的工具：

- 资料库（`catalog`）
- 单项清单（`owned`）
- 属性库存（`stock`）
- 性格推荐（`nature`）

### 2. 资料库

资料库适合维护结构化资料。每个场景可以包含多张资料表，资料表内可配置字段和行数据。

支持的字段类型包括：

- 文本、长文本、数字、图片
- 单选、多选、布尔、URL、日期、引用
- 六维图（从底层数值字段派生的可视化视图）

主要能力：

- 新建/重命名/删除资料表
- 新增/编辑/删除字段与行
- 字段显示/隐藏、字段排序、列操作菜单
- 搜索、筛选、排序、分页
- 行详情弹窗展示完整字段
- 对同编号的不同形态进行横向对比

### 3. 单项清单

单项清单用于记录具体拥有的对象，例如“我已经拥有哪只精灵、当前培养状态如何”。它复用资料库的数据表存储，但通过内部 `kind: 'owned'` 与普通资料表隔离。

固定字段包括：精灵引用、昵称/标记、等级、性格方向、血脉、状态、异色、获取日期、备注。

### 4. 属性库存

属性库存用于登记一批实例并快速统计数量，例如按分类、培养状态或等级阈值统计。它同样复用资料库底层存储，并通过 `kind: 'stock'` 与普通资料表隔离。

固定字段包括：名称、等级、分类、状态、备注。

### 5. 性格推荐

性格推荐工具支持手动输入六维，也可以从当前场景中的普通资料表带入一行数据。工具会基于六维和特性标签计算推荐方案，展示推荐理由、加成/弱化维度，以及多个候选性格方案。

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

## 洛克王国预置资料

首次启动时会自动创建洛克王国场景：

- 默认启用资料库、单项清单、属性库存、性格推荐四个工具。
- 包含“精灵基础资料”资料表。
- 行数据位于 `public/presets/rockKingdomRows.json`。目标生成方式是运行 `npm run sync:rock`，从 `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json` 读取 `l` 基础条目并展开详情里的 `forms`，生成 496 条预置资料。
- 精灵图、系别图标、特性图标使用同源公开静态资源前缀 `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/`。

预置资料只会安全补齐；迁移官方行时只删除明确可识别的旧 `row-rock-*` / `data:image/svg+xml` 占位行，不会删除用户新增的非占位行、单项清单或属性库存记录。

## 项目结构

```text
.
├── docs/                         # 设计说明、数据同步说明、交接文档
├── public/
│   └── presets/rockKingdomRows.json
├── src/
│   ├── components/               # UI 组件与工具组件
│   ├── domain/                   # 单项清单、库存、性格推荐等领域逻辑
│   ├── presets/                  # 预置场景/字段结构
│   ├── App.jsx                   # 应用入口、hash 路由、全局导入导出
│   ├── constants.js              # 全局常量、字段类型、工具定义
│   ├── db.js                     # Dexie schema、CRUD、预置播种、导入导出
│   ├── main.jsx                  # React 挂载入口
│   ├── styles.css                # 全局样式
│   └── utils.js                  # 通用工具函数
├── index.html
├── package.json
└── vite.config.js
```

## 部署 / 远程测试

本项目不依赖后端服务，执行 `npm run build` 后可将 `dist/` 部署到任意静态托管平台，例如 GitHub Pages、Cloudflare Pages、Netlify 或静态文件服务器。

仓库已提供 `.github/workflows/pages.yml`：

1. 在 GitHub 仓库设置中进入 **Settings → Pages**。
2. 将 **Build and deployment / Source** 设置为 **GitHub Actions**。
3. 合并到 `main` 后会自动构建并部署。
4. 如果想在当前功能分支远程测试，不需要把代码拉到本地：进入 **Actions → Deploy GitHub Pages → Run workflow**，选择要测试的分支手动运行；部署完成后，workflow 的 `github-pages` 环境会显示 Pages URL。

GitHub Pages 部署后的站点包含 Web App Manifest、主题色、192/512 SVG 图标和一个极简 service worker；在 Android Chrome 中可通过浏览器菜单添加到主屏幕，并以 `standalone` 显示模式打开。PWA 配置中的 `start_url`、`scope`、图标和 service worker 注册路径均使用相对路径，以兼容 GitHub Pages 的仓库子路径部署。

当前 service worker 仅用于满足安装能力：安装后立即接管页面，但不预缓存、不拦截返回自定义缓存响应，也不写入或迁移 IndexedDB。这样可以避免用户数据被触碰，并尽量避免旧静态资源因运行时缓存而长期不更新。

请注意：应用数据保存在用户浏览器本地 IndexedDB 中；更换浏览器、设备或域名时，需要通过首页的导出/导入功能手动迁移数据。

## 维护文档

- [`docs/system-capabilities.md`](docs/system-capabilities.md)：当前系统已实现能力和明确不在范围内的能力。
- [`docs/data-sync.md`](docs/data-sync.md)：数据模型、预置资料加载、导出/导入合并策略。
- [`docs/session-start-prompt.md`](docs/session-start-prompt.md)：后续开发 session 的交接说明与注意事项。
