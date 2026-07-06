# TangerineTools · 后续 Session 启动提示

如果你是接手继续开发 TangerineTools 的新 session，请先读完这份文档，再开始动手。目的是让你快速了解现状、约定和"坑"，避免重复踩坑或推翻已有设计。

## 项目是什么

本地优先的个人资料管理 Web App（Vite + React 19 + Dexie.js），面向个人（非多用户）使用，纯静态站点，无后端。当前场景工作台的四个工具（资料库 `catalog`、单项清单 `owned`、属性库存 `stock`、性格推荐 `nature`）均已实现并通过构建/lint/浏览器走查验证。详见 `docs/system-capabilities.md`（能力范围）和 `docs/data-sync.md`（数据模型与导出/导入语义）。

## 先读这三份文档

1. `docs/system-capabilities.md` —— 现在能做什么、明确不能做什么。
2. `docs/data-sync.md` —— Dexie schema、导出 JSON 结构、导入合并策略（同 id 覆盖、缺失保留）。
3. 本文件。

## 环境要求

- Node 版本必须满足 `>=20.19.0`（见 `package.json` 的 `engines.node`，仓库根目录也提供了 `.nvmrc`）。开始开发前先执行 `node -v` 确认当前版本，如果安装了 nvm，建议直接 `nvm use` 让它读取 `.nvmrc`。
- 确认 Node 版本符合要求后，再执行 `npm ci`、`npm run build`、`npm run lint`。
- 如果在低于要求的版本（例如 Node 16）下执行 `npm run build` 遇到 Vite 报错或语法不兼容问题，这是环境版本问题，不代表代码本身有 bug——请先切换到符合要求的 Node 版本重试，而不是去改代码兼容旧版本。


## 新 session 标准工作流

每次新开 session，建议按下面流程启动，避免遗漏项目约束或重复踩坑：

1. 先读 `docs/session-start-prompt.md`、`docs/system-capabilities.md`、`docs/data-sync.md`。
2. 查看 `git status --short`、最近 commit、当前 PR 描述和 review comments。
3. 如果任务涉及上一轮未完成的洛克王国官方资料生成，请额外读取 `docs/pending-rock-kingdom-official-data-prompt.md`。
4. 先复述本轮目标、已知风险和不应触碰的边界，再开始改代码。
5. 改动前确认是否会影响 Dexie schema、owned / stock 稳定 id、导入/导出合并语义、预置资料迁移。
6. 改完至少运行 `npm run build` 和 `npm run lint`；涉及数据同步时运行 `npm run sync:rock`；涉及页面体验时用 dev server 或 GitHub Pages 验证。
7. 提交前检查 `git diff` 和 `git status --short`，确认没有临时文件、下载源文件或调试输出误入提交。
8. 完成后提交 commit，并在 PR / 最终回复里写清楚变更、验证命令、未完成事项和下一步建议。

### 可复制的新 session 开场 Prompt

```text
请继续开发 GitHub 仓库 Manamiiii/TangerineTools 当前 PR / 功能分支。

开始前请先阅读并遵守：

1. docs/session-start-prompt.md
2. docs/system-capabilities.md
3. docs/data-sync.md
4. 当前 PR 描述、最近 commit、review comments

通用约束：

- 不要直接改 main，请基于当前功能分支继续。
- 不要引入 Dexie schema 版本变更，除非我明确要求。
- 不要删除用户 owned / stock 数据。
- owned / stock 的稳定 id 幂等与旧随机 id 兼容逻辑不能破坏。
- 导入仍是“同 id 覆盖，文件中缺失的本地数据保留”，不要擅自改成清空替换。
- 洛克王国预置资料必须来自官方公开 d.json；如果当前环境无法访问原始数据源且没有用户提供的真实 d.json 文件，不要生成 mock / 占位 / 程序化假数据。
- 修改后请运行 npm run build 和 npm run lint。
- 如果涉及可运行页面变化，优先通过 dev server 或 GitHub Pages 验证。
- 完成后提交 commit，并创建 PR / 更新 PR 说明。
```

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
    owned.js           # 单项清单工具的固定字段定义、选项、搜索/统计纯函数
    nature.js          # 性格推荐工具的六维计算、性格评分、推荐理由纯函数
    rockKingdom.js      # 同编号形态识别、对比表格构建（含适合方向/主要差异）纯函数（资料库详情弹窗使用）
  components/
    common.jsx         # 通用 UI：Modal / ConfirmDialog / IconButton / Popover / Pagination / DragHandle / StatsRadarChart 等
    scenes.jsx          # 首页场景列表 + 新建/编辑场景弹窗
    catalog.jsx         # 字段管理、列头菜单、数据表格（DataGrid）、筛选面板、单元格渲染/编辑（CellView/FieldInput）
    dataTables.jsx      # 资料库工具顶层：资料表管理 + TableView（搜索/筛选/排序/分页）+ 行的新增/编辑/详情弹窗（含同编号形态对比 + 适合方向 + 主要差异）
    owned.jsx           # 单项清单工具：固定 9 字段实例的增删改 + 搜索 + 状态/血脉/异色统计
    stock.jsx           # 属性库存工具：固定字段实例的增删改 + 分类/状态/等级阈值统计
    nature.jsx          # 性格推荐工具：手动录入或从资料库带入六维，展示推荐性格 + 候选清单（top-N 可选切换）
public/
  presets/rockKingdomRows.json  # 洛克王国官方图鉴行数据（d.json 的 l + forms 展开为 496 条），运行时 fetch 加载
scripts/
  sync-rock-kingdom-preset.mjs  # 从公开 d.json 采集并生成 rockKingdomRows.json
docs/
  system-capabilities.md / data-sync.md / session-start-prompt.md
```

> 属性库存工具与单项清单工具均复用资料库的 `catalogTables`/`catalogFields`/`catalogRows` 存储，通过在 `catalogTables` 上打 `kind: 'stock'` 或 `kind: 'owned'` 标记与普通资料表区分。`db.js` 的 `ensureStockTable` / `ensureOwnedTable` 使用按场景 id 派生的**稳定 id**（`table-stock-${sceneId}` / `table-owned-${sceneId}`，字段 id 形如 `field-stock-${sceneId}-${key}` / `field-owned-${sceneId}-${key}`）而非随机 id 创建表和字段：表已存在时直接 `get` 返回并按需补齐缺失字段（不覆盖已有字段）；按稳定 id 找不到时会回退按 `sceneId`+`kind` 查找旧版本（随机 id）建的表并直接复用（不改其 id），都找不到才用固定 id 新建。因此 React StrictMode 下 effect 被执行两次、或从旧版本升级，都不会创建出重复的表。`kind` 是一个非索引属性，只在查询后用 JS `.filter()` 区分，没有引入 Dexie schema 版本变更。任何新增的"资料表选择器"（如资料库的表切换、性格推荐的带入面板）都要记得只保留 `!table.kind` 的普通资料表，避免库存表/单项清单表混入。

## 关键约定 / 容易踩的坑

- **函数归属**：`isEditableFieldType` / `isOptionFieldType` / `fieldTypeLabel` / `sceneTypeLabel` 等"判断/取标签"类函数都在 `constants.js`，不在 `utils.js`。`utils.js` 放的是更通用的算法型函数（id 生成、排序比较、筛选匹配、分页、字段归一化等）。之前的实现中出现过误从 `utils.js` 导入这些函数导致构建失败的问题，修复后已确认 `npm run build` / `npm run lint` 均通过。
- **字段 `key` vs `id`**：`catalogFields` 有 `id`（数据库主键，`field-xxx`）和 `key`（用于 `catalogRows.values` 取值的属性名，由字段名派生并保证同表内唯一）。写涉及行数据读取的代码时要用 `key`，不要和 `id` 混淆。
- **`stats` 字段类型是派生视图，没有自己的值**：它通过 `statsMap`（六个维度 key → 目标数值字段 key 的映射）从其它数值字段读取六维数值来画雷达图/迷你统计，本身不出现在"新增/编辑行"表单里（`isEditableFieldType('stats') === false`）。`STATS_SCALE_MAX = 150` 是雷达图统一缩放的满值刻度。
- **隐藏字段仍需在详情页展示**：字段的 `hidden` 只影响是否出现在表格列里，`RowDetailModal` 会展示**全部**字段（含隐藏的），并加"隐藏列"徽章标注，不能因为字段隐藏就在详情页也过滤掉。
- **默认排序**：`NUMBER_FIELD_NAMES = ['编号']` / `NUMBER_FIELD_KEYS = ['no', 'number']` 用于自动识别"编号"字段并套用默认自然升序；没有编号字段的资料表不做特殊排序。用户可以通过点击列头手动切换排序。
- **导入是合并不是替换**：见 `docs/data-sync.md`，同 id 覆盖、文件中缺失的本地数据会保留，不会被删除。不要在没有明确需求的情况下改成"清空后导入"的语义。
- **预置结构播种只跑一次，资料行迁移每次启动安全补齐**：通过 `meta.seededRockKingdom` 防止重复写入场景/表/字段骨架；`migrateRockKingdomRows()` 会在默认资料表存在时补齐官方预置行，并删除明确可识别的旧 `row-rock-*` / `data:image/svg+xml` 占位行，但不会删除用户新增的非占位行、owned 个体清单或 stock 库存记录。
- **洛克王国场景默认启用四个工具**：`ROCK_KINGDOM_PRESET.scene.tools` 现在是 `['catalog', 'owned', 'stock', 'nature']`，新安装首次打开即可看到四工具切换器。老用户（场景 `tools` 仍恰好等于任一旧默认值 `['catalog']` 或 `['catalog', 'stock', 'nature']`）会被 `db.js` 的 `migrateRockKingdomSceneTools()`（每次启动都执行，不受 `seededRockKingdom` 一次性标记限制）自动补齐为四项；只要用户自定义过 `tools`（关闭过资料库、只手动开过库存等任何不同于两个已知旧默认值的组合），迁移会跳过、不覆盖。
- **图标/图片素材**：洛克王国预置资料来源为公开静态图鉴 `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json`；精灵图、18 系图标、特性图标均使用同源公开静态资源前缀 `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/`，同步脚本逐段编码中文路径。不要再引入本地 SVG 或 `data:image/svg+xml` 作为精灵图。
- **CSS**：`src/styles.css` 是唯一样式来源，无 CSS 模块/框架。新增组件前建议先搜索该文件确认是否已有可复用的类（按钮、表单、Modal、Popover、表格等都已有一套通用类名）。

## 已验证的质量基线

- `npm install` 已成功执行，`node_modules` 存在。
- `npm run build` 通过（Vite 生产构建成功）。
- `npm run lint`（oxlint）通过，无警告。
- 通过 Playwright 手动走查确认以下链路在真实浏览器中可用且控制台无报错：
  - 首页场景列表渲染、洛克王国预置数据播种（496 条）、hash 路由跳转进入场景工作台。
  - 场景工作台多工具切换器（资料库 / 单项清单 / 属性库存 / 性格推荐 四个分段按钮）新安装默认即可见（无需手动编辑场景勾选启用），可自由切换且互不影响数据。
  - 洛克王国默认工具与迁移路径：清空 IndexedDB 模拟全新安装并刷新，首页工具列显示"资料库 · 单项清单 · 属性库存 · 性格推荐"，进入场景后默认停留在资料库、四工具切换器可见；手动把 `scene-rock-kingdom.tools` 写回旧默认值 `['catalog']` 或 `['catalog', 'stock', 'nature']` 后刷新，`migrateRockKingdomSceneTools()` 自动补齐为四项且 `updatedAt` 被刷新为当前时间；手动写入自定义组合（如仅 `['stock']`）后刷新，`tools` 与 `updatedAt` 均保持不变，未被覆盖。
  - 资料库工具栏（搜索→表选择器→筛选→字段管理→新增行）渲染顺序正确；数据表格渲染全部 **496** 条预置行且按编号升序排列；六维迷你统计渲染正确。表选择器只列出普通资料表（`!table.kind`），不含单项清单表 / 库存表。
  - 搜索框文本匹配过滤正确（如输入"烈焰"可正确缩小到烈焰虎/烈焰霸王等匹配行）。
  - 列头点击排序：升序/降序两个方向均验证结果顺序正确。
  - 筛选面板：按字段类型渲染对应控件（单选/多选勾选列表、数字范围、布尔二态、六维图不可筛选等）；`element` 作为 `multiselect` 字段渲染带图标的选项，勾选后可正确将结果缩小；"清空"按钮可正确恢复全部预置行并重置控件状态。
  - 分页页大小切换控件（10/20/50/100）在 496 条数据下正常翻页；页码导航正确。
  - 单项清单工具：新增实例（引用精灵、填昵称/等级/性格方向/血脉/状态/异色/日期/备注）→ 编辑 → 删除；搜索框对昵称/备注/等级/被引用精灵名字面量过滤；「统计」按钮切换后显示状态/血脉分组计数与异色累计。
  - 属性库存工具：实例增删改、统计视图（分类分组计数、状态计数、等级阈值计数）渲染正确。
  - 性格推荐工具：手动录入六维、从资料库"带入"一行（`!table.kind` 表 + 行选择器）自动填充六维与特性标签、推荐结果与理由文案渲染正确；候选清单默认展示 top-6，点击可切换查看每个候选的加成对比。
  - 行详情弹窗展示全部字段（含隐藏字段徽章）及关闭/编辑/删除操作；同编号形态对比区块正确列出同编号、不同形态的行并标注各维度最高/最低/相同值，并展示每一行的**适合方向**（如「物攻输出/魔攻输出/双攻输出/高速先手/耐久坦克/能量循环/辅助续航/异常控制」）与**主要差异**（相对同组均值的强/弱维度概括）。

尚未做穷尽式走查的部分（非阻塞，供参考）：字段管理弹窗内的增删改查交互、行的新增/编辑表单提交、导出文件下载触发、导入确认弹窗与实际合并结果、场景的新建/编辑/删除表单提交。这些功能均已实现并通过 `npm run build`/`lint`，但建议在做相关改动前自行走查一遍确认现状。

## 明确排除在范围外的工作

1. 技能、进化链、属性克制等对局向资料同步（当前预置资料只接入公开图鉴 `d.json` 中的基础资料、六维、特性、图片、系别、形态；不要把技能、进化链、克制关系塞进当前资料库字段）。
2. PWA 已具备 Android Chrome 基础安装能力（manifest、theme-color、图标、极简 service worker），但离线优先缓存、安装提示 UI、应用内更新提示等增强体验尚未实现。

开始这些工作前，建议先用 `AskUserQuestion` 或直接和用户确认范围与优先级，而不要一次性全部展开。
