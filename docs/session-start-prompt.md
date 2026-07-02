# TangerineTools · 后续 Session 启动提示

如果你是接手继续开发 TangerineTools 的新 session，请先读完这份文档，再开始动手。目的是让你快速了解现状、约定和"坑"，避免重复踩坑或推翻已有设计。

## 项目是什么

本地优先的个人资料管理 Web App（Vite + React 19 + Dexie.js），面向个人（非多用户）使用，纯静态站点，无后端。当前处于**第一轮（round 1）**之后的状态——骨架 + 核心循环（场景管理 + 资料库工具）已经实现并通过构建/lint/浏览器走查验证。详见 `docs/system-capabilities.md`（能力范围）和 `docs/data-sync.md`（数据模型与导出/导入语义）。

## 先读这三份文档

1. `docs/system-capabilities.md` —— 现在能做什么、明确不能做什么。
2. `docs/data-sync.md` —— Dexie schema、导出 JSON 结构、导入合并策略（同 id 覆盖、缺失保留）。
3. 本文件。

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
  components/
    common.jsx         # 通用 UI：Modal / ConfirmDialog / IconButton / Popover / Pagination / DragHandle / StatsRadarChart 等
    scenes.jsx          # 首页场景列表 + 新建/编辑场景弹窗
    catalog.jsx         # 字段管理、列头菜单、数据表格（DataGrid）、筛选面板、单元格渲染/编辑（CellView/FieldInput）
    dataTables.jsx      # 资料库工具顶层：资料表管理 + TableView（搜索/筛选/排序/分页）+ 行的新增/编辑/详情弹窗
    stock.jsx           # 尚未实现（占位，对应 SCENE_TOOLS 里 ready:false 的 "属性库存"）
    nature.jsx          # 尚未实现（占位，对应 SCENE_TOOLS 里 ready:false 的 "性格推荐"）
public/
  presets/rockKingdomRows.json  # 洛克王国示例行数据（7 条），运行时 fetch 加载
docs/
  system-capabilities.md / data-sync.md / session-start-prompt.md
```

> 注意：`stock.jsx` / `nature.jsx` 目前**并未**作为文件创建——第一轮的 `SCENE_TOOLS` 里这两个工具值仅用于 UI 占位（禁用勾选框 + "即将推出"徽章），`SceneWorkbench`（`App.jsx`）目前只处理 `tools.includes('catalog')` 的情况，其余场景会显示一个空态提示文案。若要实现这两个工具，需要新建对应组件文件，并在 `SceneWorkbench` 里按 `scene.tools` 分派渲染。

## 关键约定 / 容易踩的坑

- **函数归属**：`isEditableFieldType` / `isOptionFieldType` / `fieldTypeLabel` / `sceneTypeLabel` 等"判断/取标签"类函数都在 `constants.js`，不在 `utils.js`。`utils.js` 放的是更通用的算法型函数（id 生成、排序比较、筛选匹配、分页、字段归一化等）。之前的实现中出现过误从 `utils.js` 导入这些函数导致构建失败的问题，修复后已确认 `npm run build` / `npm run lint` 均通过。
- **字段 `key` vs `id`**：`catalogFields` 有 `id`（数据库主键，`field-xxx`）和 `key`（用于 `catalogRows.values` 取值的属性名，由字段名派生并保证同表内唯一）。写涉及行数据读取的代码时要用 `key`，不要和 `id` 混淆。
- **`stats` 字段类型是派生视图，没有自己的值**：它通过 `statsMap`（六个维度 key → 目标数值字段 key 的映射）从其它数值字段读取六维数值来画雷达图/迷你统计，本身不出现在"新增/编辑行"表单里（`isEditableFieldType('stats') === false`）。`STATS_SCALE_MAX = 150` 是雷达图统一缩放的满值刻度。
- **隐藏字段仍需在详情页展示**：字段的 `hidden` 只影响是否出现在表格列里，`RowDetailModal` 会展示**全部**字段（含隐藏的），并加"隐藏列"徽章标注，不能因为字段隐藏就在详情页也过滤掉。
- **默认排序**：`NUMBER_FIELD_NAMES = ['编号']` / `NUMBER_FIELD_KEYS = ['no', 'number']` 用于自动识别"编号"字段并套用默认自然升序；没有编号字段的资料表不做特殊排序。用户可以通过点击列头手动切换排序。
- **导入是合并不是替换**：见 `docs/data-sync.md`，同 id 覆盖、文件中缺失的本地数据会保留，不会被删除。不要在没有明确需求的情况下改成"清空后导入"的语义。
- **预置资料播种只跑一次**：通过 `meta` 表的 `seededRockKingdom` 标记防止重复播种；不要假设每次启动都会重新填充洛克王国数据（用户删除后不会自动恢复）。
- **图标/图片素材**：第一轮的洛克王国预置资料完全使用本地内联 SVG data URI 占位（`placeholderIcon`，见 `src/presets/rockKingdom.js`），没有引用任何外部图片资源。若后续要换成真实素材，需要用户自行提供合法来源的图片，不要臆造或抓取未经授权的外部图片链接。
- **CSS**：`src/styles.css` 是唯一样式来源，无 CSS 模块/框架。新增组件前建议先搜索该文件确认是否已有可复用的类（按钮、表单、Modal、Popover、表格等都已有一套通用类名）。

## 已验证的质量基线

- `npm install` 已成功执行，`node_modules` 存在。
- `npm run build` 通过（Vite 生产构建成功）。
- `npm run lint`（oxlint）通过，无警告。
- 通过 Playwright 手动走查确认以下链路在真实浏览器中可用且控制台无报错：首页场景列表渲染、洛克王国预置数据播种、hash 路由跳转进入场景工作台、资料库工具栏（搜索→表选择器→筛选→字段管理→新增行）渲染顺序正确、数据表格渲染全部 7 条预置行且按编号升序排列、六维迷你统计渲染正确、行详情弹窗展示全部字段（含隐藏字段徽章）及关闭/编辑/删除操作。

尚未做穷尽式走查的部分（非阻塞，供参考）：字段管理弹窗内的增删改查交互、筛选面板实际交互、列头排序点击、分页页大小切换、行的新增/编辑表单提交、导出文件下载触发、导入确认弹窗与实际合并结果、场景的新建/编辑/删除表单提交。这些功能均已实现并通过 `npm run build`/`lint`，但建议在做相关改动前自行走查一遍确认现状。

## 明确排期在后续 session 的工作（第一轮范围外）

1. `stock.jsx`——属性库存矩阵统计工具。
2. `nature.jsx`——性格推荐工具。
3. 洛克王国全量 496 条数据同步（当前仅 7 条演示数据）。
4. 同编号多形态对比视图。
5. PWA 安装配置（manifest、离线缓存、安装到主屏幕）。

开始这些工作前，建议先用 `AskUserQuestion` 或直接和用户确认这一轮要做哪几项、优先级如何，而不要一次性全部展开。
