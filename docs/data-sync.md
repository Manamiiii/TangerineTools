# TangerineTools · 数据模型与同步说明

本文档描述数据是如何存储、导出、导入的，以及预置资料的加载机制。供后续维护和"全量数据同步"相关的开发工作参考。

## 存储引擎

使用 [Dexie.js](https://dexie.org/)（IndexedDB 的封装）作为唯一的数据存储，数据库名为 `tangerine-tools`。Schema 定义在 `src/db.js`：

```js
db.version(1).stores({
  scenes: 'id, order',
  catalogTables: 'id, sceneId, order',
  catalogFields: 'id, tableId, order',
  catalogRows: 'id, tableId',
  meta: 'key',
})
```


### 字段类型补充

- `reference`：单条资料引用，值为目标行 id。
- `references`：多条资料引用，值为目标行 id 数组；当前用于精灵 `skillRefs` 与技能 `learnerRefs`。该字段类型仍存储在 `catalogRows.values` 中，不需要新增 IndexedDB 表或索引。

### 表结构

| 表 | 主键 | 索引 | 说明 |
|---|---|---|---|
| `scenes` | `id` | `order` | 场景：`name` / `type` / `tools[]` / `order` / `createdAt` / `updatedAt` |
| `catalogTables` | `id` | `sceneId`, `order` | 资料表：`sceneId` / `name` / `order` / 时间戳 / 可选的 `kind`（非索引属性；值为 `'owned'` 时表示收集记录表，`undefined`/缺省表示普通资料库表；历史版本可能存在 `kind: 'stock'` 的旧统计表，导入导出会保留但新统计视图不再依赖它） |
| `catalogFields` | `id` | `tableId`, `order` | 字段：`tableId` / `key` / `name` / `type` / `order` / `hidden` / 类型相关配置（`options` / `statsMap` / `statsDimensions` / `statsStyle` / `referenceTableId` 等） |
| `catalogRows` | `id` | `tableId` | 行：`tableId` / `values`（以字段 `key` 为键的对象） / 时间戳 |
| `meta` | `key` | — | 内部标记，如播种标记 `seededRockKingdom` |

字段的 `key` 由 `deriveFieldKey`（`src/utils.js`）从字段名派生，并保证在同一资料表内唯一；行数据 `values` 用字段 `key`（而非字段 `id`）作为属性名存取。普通新建场景不会预置业务字段；资料库字段和收集记录字段都由用户在字段管理里创建。洛克王国作为应用自带预置场景，会在自己的资料库表与收集记录表里补齐官方/场景专属字段。

### `catalogTables.kind` 与收集记录 / 统计视图

- 收集记录工具（`owned`）复用 `catalogTables` / `catalogFields` / `catalogRows` 三张表存储数据，通过 `catalogTables.kind === 'owned'` 与普通资料库表区分。
- 收集记录表还可以带非索引配置 `collectionMode: 'single' | 'multiple'`：`single` 表示同一 reference 只保留一条收集记录，`multiple` 表示同一 reference 可记录多条。
- 普通新建场景首次打开收集记录工具时，只创建空的收集记录表，不写入默认字段；洛克王国场景会补齐精灵收集字段，这是该预置场景自身的数据模板，不是全局模板。
- 统计视图工具（仍沿用内部工具值 `stock`）不再创建固定字段表；它从当前场景的普通资料表和收集记录表中选择数据源，按字段分组并叠加数值阈值条件做即时统计。
- `kind` 和 `collectionMode` 都是非索引属性（不在 `.stores()` 的索引串里），只在按 `sceneId` 查询后用 JS 过滤/读取，因此**没有引入 Dexie schema 版本变更**。
- 资料库工具（`CatalogTool`）的普通资料表选择器会用 `.filter((t) => !t.kind)` 只保留普通资料表，避免收集记录表混入。性格推荐工具现在固定绑定洛克王国 `精灵基础资料` 表，并通过 `skillRefs` 读取技能资料，不再提供任意资料表选择。
- 因为导出/导入是对整张 Dexie 表做全量操作（不区分 `kind`），`kind` 与 `collectionMode` 会随 `catalogTables` 记录本身一起被导出/导入，**无需任何额外的导出/导入代码改动**。

## 预置资料加载（播种）

- 应用启动时 `App.jsx` 调用 `ensureSeeded()`。
- 该函数检查 `meta` 表中 `seededRockKingdom` 是否已为 `true`；若不是，则先写入 `src/presets/rockKingdom.js` 中定义的洛克王国场景 / 默认资料表 / 字段结构。场景骨架只播种一次，不会覆盖用户后续的修改或删除。
- 精灵行数据通过 `fetch(`${BASE_URL}presets/rockKingdomRows.json`)` 拉取，技能行数据通过 `fetch(`${BASE_URL}presets/rockKingdomSkillRows.json`)` 拉取，孵蛋辅助资料通过 `fetch(`${BASE_URL}presets/rockKingdomBreedingRows.json`)` 拉取，文件放在 `public/` 下，不参与 JS 打包。当前线上预置文件仍由已提交的同步产物提供；用户已确认后续以 BWiki staging / 详情页解析作为新版本主同步来源，字段映射确认后可完全覆盖旧精灵/技能预置产物。拉取失败（如离线）时仅打印警告，不阻塞场景/表/字段骨架。
- 旧版目标行数据来源是洛克王国公开图鉴静态 JSON：`https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json`。当前仓库保留了可信本地源 `scripts/data/rockKingdom.d.json`，用于执行环境无法访问源站时复现旧同步。同步脚本 `npm run sync:rock` 会读取 `l` 基础条目并展开详情里的 `forms` 独立形态，预期为 `375 + 121 = 496` 条精灵 / 形态资料；同时读取 `sk.s` / `sk.b` / `sk.t` 生成技能资料。后续 BWiki 转换脚本落地后，BWiki 将作为新版本主同步来源，`d.json` 保留为回退 / 对照源。
- 精灵图、系别图标、特性图标、技能图标、技能类型图标均使用同源公开静态资源前缀 `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/`，路径逐段 `encodeURIComponent` 编码；不使用本地 SVG 或 `data:image/svg+xml` 作为精灵图。
- 系别字段使用 `multiselect` 类型，覆盖官方 18 个系别：普通/草/火/水/光/地/冰/龙/电/毒/虫/武/翼/萌/幽/恶/机械/幻，对应内部值为 `normal`/`grass`/`fire`/`water`/`light`/`earth`/`ice`/`dragon`/`electric`/`poison`/`bug`/`fighting`/`flying`/`cute`/`ghost`/`dark`/`mech`/`illusion`。精灵行使用 `skillRefs` 多引用指向技能行；技能行使用 `learnerRefs` 多引用反向指向可学习该技能的精灵行。技能行还包含派生的 `effectTags` 多选效果标签（先手、速度、回复、减伤、能量、强化、控制、应对、轮转等），这些标签由官方技能效果文本生成，用于资料查看与性格推荐解释；它们不是战斗模拟结果。
- 资料库、收集记录、统计视图三者关系：资料库是对象种类 / 图鉴 / 静态资料；收集记录是用户与这些资料项的一对一或一对多关系；统计视图从资料库和收集记录中即时汇总，不再为新场景创建固定字段统计表。
- BWiki 是 WIKI 页面数据快照（页面自身显示更新日期），不是本应用运行时实时查询接口。用户已确认后续以 BWiki 为新版本主同步来源：维护者先运行 `npm run sync:bwiki:staging` 生成精灵 / 技能 / 精灵蛋 staging 与报告；详情页解析和字段映射确认后，再运行后续显式转换命令完全覆盖精灵 / 技能预置产物。精灵蛋和精灵果实不再做独立资料表，而是作为精灵基础资料中的 `eggImage` / `fruitImage` 两个图片字段写入。应用启动迁移仍只读取仓库内预置 JSON，不在用户浏览器里实时抓取 BWiki。
- 预置资料迁移策略：
  1. 新安装 / 干净 IndexedDB 只会插入官方图鉴行，不应出现旧 `row-rock-*` 占位行。
  2. 老用户若已播种旧占位资料，`migrateRockKingdomRows()` 会在默认洛克王国资料表中删除可明确识别的旧占位行（`id` 以 `row-rock-` 开头，或 `values.image` 以 `data:image/svg+xml` 开头），再按新稳定 id 插入官方行，避免重复。
  3. 若浏览器里已存在 `rock-creature-src-*` 官方稳定 id 行，但某些官方字段仍为空（如旧缓存缺少 `element` / `form`），启动迁移会只补齐这些空值字段；若旧 `element` 值无法匹配当前系别选项，也会用官方值修正。已有非空字段不会被整体覆盖。
  4. 用户自己新增的非占位资料行不会被删除；无法安全判断为占位的数据不会被覆盖。
  5. owned / stock 表及其用户记录不属于默认资料表 `tableId`，迁移不会触碰。
  6. 迁移通过 `meta.rockKingdomRowsVersion = "official-d-json-2026-06-08"` 标记资料版本，不引入 Dexie schema 版本变更。

## 导出格式

`exportAllData()`（`src/db.js`）产出的 JSON 结构：

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-07-02T00:00:00.000Z",
  "data": {
    "scenes": [...],
    "catalogTables": [...],
    "catalogFields": [...],
    "catalogRows": [...],
    "meta": [...]
  }
}
```

- `schemaVersion`（`EXPORT_SCHEMA_VERSION`，当前为 `1`）用于未来 schema 变更时做兼容判断，第一轮尚未实现基于该版本号的迁移逻辑。
- 导出通过首页的「导出数据」按钮触发，文件名形如 `tangerine-tools-2026-07-02.json`。
- 导出范围是**全部** Dexie 表的**全部**数据，不支持按场景/按表部分导出。

## 导入与合并策略

`importAllData(payload)`（`src/db.js`）：

1. 先调用 `validateImportPayload(payload)` 做基础结构校验：
   - `payload` 必须是对象，且含 `data` 对象字段。
   - `data` 下每个可导入的键（`scenes` / `catalogTables` / `catalogFields` / `catalogRows` / `meta`）若存在，必须是数组。
   - 至少要有一个可导入的键存在，否则视为无效文件。
   - 校验失败会抛出中文错误信息，由 UI 层展示给用户。
2. 校验通过后，在一个 Dexie 事务内对每张表执行 `bulkPut`。

**合并语义（重要）**：导入采用的是 **"同 id 覆盖，文件中未包含的本地数据保留"**，即：

- 若导入文件中的某条记录 `id` 在本地已存在 → 本地记录被整条覆盖（不是字段级合并）。
- 若导入文件中的某条记录 `id` 本地不存在 → 新增。
- 若本地存在但导入文件中**没有**该 `id` 的记录 → **不会被删除**，原样保留。

这意味着导入操作**不是**"用文件完全替换本地数据"，而是**增量合并**。如果用户需要"用导出文件完全恢复/替换"的语义（例如清空后再导入），当前实现不支持，需要用户自行先清空数据（第一轮未提供"清空全部数据"的入口）。

UI 层（`App.jsx` 的 `GlobalDataActions`）在实际执行导入前会用 `ConfirmDialog` 向用户明确提示这一合并语义（"相同 id 的数据会被覆盖，文件中未包含的数据将保留在本地，此操作不可撤销"）。

## 关于"数据同步"的范围说明

当前的"同步"仅指**手动的、单机内的 JSON 导出/导入**，用于在同一用户的不同浏览器/设备间手动搬运数据，具体流程为：设备 A 导出 JSON → 通过用户自行选择的方式（网盘/传输文件等）转移文件 → 设备 B 导入 JSON。

以下能力**不**属于当前范围，如需实现请作为独立任务规划：

- 自动化/云端同步（无后端，无云账号体系）
- 增量导出（只导出变更部分）
- 导入时的字段级合并或冲突提示（当前是整条记录覆盖，无冲突检测）
- 基于 `schemaVersion` 的自动迁移
- 洛克王国完整对战模拟、进化链、属性克制、PVP 规则等对局向深度功能（当前技能资料仅作为可查看资料与性格推荐输入，不做技能组合求解或配队模拟）
