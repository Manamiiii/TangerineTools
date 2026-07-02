# TangerineTools · 后续 Session 启动提示

如果你是接手继续开发 TangerineTools 的新 session，请先读完这份文档，再开始动手。目的是让你快速了解现状、约定和"坑"，避免重复踩坑或推翻已有设计。

## 项目是什么

本地优先的个人资料管理 Web App（Vite + React 19 + Dexie.js），面向个人（非多用户）使用，纯静态站点，无后端。当前场景工作台的三个工具（资料库 `catalog`、属性库存 `stock`、性格推荐 `nature`）均已实现并通过构建/lint/浏览器走查验证。详见 `docs/system-capabilities.md`（能力范围）和 `docs/data-sync.md`（数据模型与导出/导入语义）。

## 先读这三份文档

1. `docs/system-capabilities.md` —— 现在能做什么、明确不能做什么。
2. `docs/data-sync.md` —— Dexie schema、导出 JSON 结构、导入合并策略（同 id 覆盖、缺失保留）。
3. 本文件。

## 环境要求

- Node 版本必须满足 `>=20.19.0`（见 `package.json` 的 `engines.node`，仓库根目录也提供了 `.nvmrc`）。开始开发前先执行 `node -v` 确认当前版本，如果安装了 nvm，建议直接 `nvm use` 让它读取 `.nvmrc`。
- 确认 Node 版本符合要求后，再执行 `npm ci`、`npm run build`、`npm run lint`。
- 如果在低于要求的版本（例如 Node 16）下执行 `npm run build` 遇到 Vite 报错或语法不兼容问题，这是环境版本问题，不代表代码本身有 bug——请先切换到符合要求的 Node 版本重试，而不是去改代码兼容旧版本。

## 代码地图

```
src/
  main.jsx           # 入口，挂载 <App />，引入 styles.css
  App.jsx            # hash 路由（首页 ↔ 场景工作台）、全局导出/导入
  db.js              # Dexie schema + 所有 CRUD + 导出/导入 + 预置资料播种
  constants.js        # 场景类型/工具、字段类型、六维定义、配色板、分页选项等纯常量 + 几个纯函数（label/判断）
  utils.js            # id 生成、字段归一化、排序/筛选/分页等通用逻辑函数
  presets/
    rockKingdom.js     # 洛克王国场景/资料表/字段定义（结构化数据，随 bundle 打包）
  domain/
    stock.js           # 属性库存工具的固定字段定义、状态选项、统计纯函数
    nature.js          # 性格推荐工具的六维计算、性格评分、推荐理由纯函数
    rockKingdom.js      # 同编号形态识别、对比表格构建纯函数（资料库详情弹窗使用）
  components/
    common.jsx         # 通用 UI：Modal / ConfirmDialog / IconButton / Popover / Pagination / DragHandle / StatsRadarChart 等
    scenes.jsx          # 首页场景列表 + 新建/编辑场景弹窗
    catalog.jsx         # 字段管理、列头菜单、数据表格（DataGrid）、筛选面板、单元格渲染/编辑（CellView/FieldInput）
    dataTables.jsx      # 资料库工具顶层：资料表管理 + TableView（搜索/筛选/排序/分页）+ 行的新增/编辑/详情弹窗（含同编号形态对比）
    stock.jsx           # 属性库存工具：固定字段实例的增删改 + 分类/状态/等级阈值统计
    nature.jsx          # 性格推荐工具：手动录入或从资料库带入六维，计算并展示推荐性格
public/
  presets/rockKingdomRows.json  # 洛克王国示例行数据（10 条，含 4 组同编号形态），运行时 fetch 加载
docs/
  system-capabilities.md / data-sync.md / session-start-prompt.md
```

> 属性库存工具的数据复用资料库的 `catalogTables`/`catalogFields`/`catalogRows` 存储，通过在 `catalogTables` 上打 `kind: 'stock'` 标记与普通资料表区分（由 `db.js` 的 `ensureStockTable` 幂等创建）。这是一个非索引属性，只在查询后用 JS `.filter()` 区分，没有引入 Dexie schema 版本变更。任何新增的"资料表选择器"（如资料库的表切换、性格推荐的带入面板）都要记得排除 `kind === 'stock'` 的表，避免库存表混入。

## 关键约定 / 容易踩的坑

- **函数归属**：`isEditableFieldType` / `isOptionFieldType` / `fieldTypeLabel` / `sceneTypeLabel` 等"判断/取标签"类函数都在 `constants.js`，不在 `utils.js`。`utils.js` 放的是更通用的算法型函数（id 生成、排序比较、筛选匹配、分页、字段归一化等）。之前的实现中出现过误从 `utils.js` 导入这些函数导致构建失败的问题，修复后已确认 `npm run build` / `npm run lint` 均通过。
- **字段 `key` vs `id`**：`catalogFields` 有 `id`（数据库主键，`field-xxx`）和 `key`（用于 `catalogRows.values` 取值的属性名，由字段名派生并保证同表内唯一）。写涉及行数据读取的代码时要用 `key`，不要和 `id` 混淆。
- **`stats` 字段类型是派生视图，没有自己的值**：它通过 `statsMap`（六个维度 key → 目标数值字段 key 的映射）从其它数值字段读取六维数值来画雷达图/迷你统计，本身不出现在"新增/编辑行"表单里（`isEditableFieldType('stats') === false`）。`STATS_SCALE_MAX = 150` 是雷达图统一缩放的满值刻度。
- **隐藏字段仍需在详情页展示**：字段的 `hidden` 只影响是否出现在表格列里，`RowDetailModal` 会展示**全部**字段（含隐藏的），并加"隐藏列"徽章标注，不能因为字段隐藏就在详情页也过滤掉。
- **默认排序**：`NUMBER_FIELD_NAMES = ['编号']` / `NUMBER_FIELD_KEYS = ['no', 'number']` 用于自动识别"编号"字段并套用默认自然升序；没有编号字段的资料表不做特殊排序。用户可以通过点击列头手动切换排序。
- **导入是合并不是替换**：见 `docs/data-sync.md`，同 id 覆盖、文件中缺失的本地数据会保留，不会被删除。不要在没有明确需求的情况下改成"清空后导入"的语义。
- **预置资料播种只跑一次**：通过 `meta` 表的 `seededRockKingdom` 标记防止重复播种；不要假设每次启动都会重新填充洛克王国数据（用户删除后不会自动恢复）。
- **洛克王国场景默认启用三个工具**：`ROCK_KINGDOM_PRESET.scene.tools` 现在是 `['catalog', 'stock', 'nature']`，新安装首次打开即可看到三工具切换器。老用户（场景 `tools` 仍恰好等于第一轮的旧默认值 `['catalog']`）会被 `db.js` 的 `migrateRockKingdomSceneTools()`（每次启动都执行，不受 `seededRockKingdom` 一次性标记限制）自动补齐为三项；只要用户自定义过 `tools`（关闭过资料库、只手动开过库存等任何不同于旧默认值的组合），迁移会跳过、不覆盖。
- **图标/图片素材**：第一轮的洛克王国预置资料完全使用本地内联 SVG data URI 占位（`placeholderIcon`，见 `src/presets/rockKingdom.js`），没有引用任何外部图片资源。若后续要换成真实素材，需要用户自行提供合法来源的图片，不要臆造或抓取未经授权的外部图片链接。
- **CSS**：`src/styles.css` 是唯一样式来源，无 CSS 模块/框架。新增组件前建议先搜索该文件确认是否已有可复用的类（按钮、表单、Modal、Popover、表格等都已有一套通用类名）。

## 已验证的质量基线

- `npm install` 已成功执行，`node_modules` 存在。
- `npm run build` 通过（Vite 生产构建成功）。
- `npm run lint`（oxlint）通过，无警告。
- 通过 Playwright 手动走查确认以下链路在真实浏览器中可用且控制台无报错：
  - 首页场景列表渲染、洛克王国预置数据播种、hash 路由跳转进入场景工作台。
  - 场景工作台多工具切换器（资料库 / 属性库存 / 性格推荐三个分段按钮）新安装默认即可见（无需手动编辑场景勾选启用），可自由切换且互不影响数据。
  - 洛克王国默认工具与迁移路径：清空 IndexedDB 模拟全新安装并刷新，首页工具列显示"资料库 · 属性库存 · 性格推荐"，进入场景后默认停留在资料库、三工具切换器可见；手动把 `scene-rock-kingdom.tools` 写回旧默认值 `['catalog']` 后刷新，`migrateRockKingdomSceneTools()` 自动补齐为三项且 `updatedAt` 被刷新为当前时间；手动写入自定义组合（如仅 `['stock']`）后刷新，`tools` 与 `updatedAt` 均保持不变，未被覆盖。
  - 资料库工具栏（搜索→表选择器→筛选→字段管理→新增行）渲染顺序正确；数据表格渲染全部 **10** 条预置行（含 4 组同编号进化形态对）且按编号升序排列；六维迷你统计渲染正确。
  - 搜索框文本匹配过滤正确（如输入"烈焰"可从 10 条正确缩小到 2 条）。
  - 列头点击排序：升序/降序两个方向均验证结果顺序正确。
  - 筛选面板：按字段类型渲染对应控件（单选/多选勾选列表、数字范围、布尔二态、六维图不可筛选等）；实际勾选筛选值（如系别=火系）可正确将结果从 10 条缩小到 2 条；"清空"按钮可正确恢复全部 10 条并重置控件状态；点击面板外部（如搜索框）可正确关闭面板。
  - 分页页大小切换控件（10/20/50/100）可正常切换且不报错（当前预置数据仅 10 条，切到"10 条/页"时仍为 1/1 页，未触发真正的多页翻页，属于数据规模限制，不是缺陷）。
  - 属性库存工具：实例增删改、统计视图（分类分组计数、状态计数、等级阈值计数）渲染正确。
  - 性格推荐工具：手动录入六维、从资料库"带入"一行自动填充六维与特性标签、推荐结果与理由文案渲染正确。
  - 行详情弹窗展示全部字段（含隐藏字段徽章）及关闭/编辑/删除操作；同编号形态对比区块正确列出同编号、不同形态的行并标注各维度最高/最低/相同值。

尚未做穷尽式走查的部分（非阻塞，供参考）：字段管理弹窗内的增删改查交互、行的新增/编辑表单提交、导出文件下载触发、导入确认弹窗与实际合并结果、场景的新建/编辑/删除表单提交。这些功能均已实现并通过 `npm run build`/`lint`，但建议在做相关改动前自行走查一遍确认现状。

已知的、与本轮任务无关的预置缺陷（未修复，超出范围）：筛选面板的"筛选"切换按钮在面板已展开时再次点击无法通过该按钮关闭面板（`Popover` 的外部点击关闭逻辑与切换按钮自身的 onClick 顺序冲突，导致状态被重新打开）；点击面板外的其它元素可以正常关闭面板，不影响实际使用。

## 明确排除在范围外的工作

1. 洛克王国全量数据同步（当前仅 10 条示例/演示数据，远少于完整图鉴规模）。
2. PWA 安装配置（manifest、离线缓存、安装到主屏幕）——这是主动排除的范围决策，不是缺陷。

开始这些工作前，建议先用 `AskUserQuestion` 或直接和用户确认范围与优先级，而不要一次性全部展开。
