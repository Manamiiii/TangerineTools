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

### 表结构

| 表 | 主键 | 索引 | 说明 |
|---|---|---|---|
| `scenes` | `id` | `order` | 场景：`name` / `type` / `color` / `tools[]` / `order` / `createdAt` / `updatedAt` |
| `catalogTables` | `id` | `sceneId`, `order` | 资料表：`sceneId` / `name` / `order` / 时间戳 / 可选的 `kind`（非索引属性；值为 `'stock'` 时表示这是条件统计工具专用的表，值为 `'owned'` 时表示这是个体清单工具专用的表，`undefined`/缺省表示普通资料库表，见下方说明） |
| `catalogFields` | `id` | `tableId`, `order` | 字段：`tableId` / `key` / `name` / `type` / `order` / `hidden` / 类型相关配置（`options` / `statsMap` 等） |
| `catalogRows` | `id` | `tableId` | 行：`tableId` / `values`（以字段 `key` 为键的对象） / 时间戳 |
| `meta` | `key` | — | 内部标记，如播种标记 `seededRockKingdom` |

字段的 `key` 由 `deriveFieldKey`（`src/utils.js`）从字段名派生，并保证在同一资料表内唯一；行数据 `values` 用字段 `key`（而非字段 `id`）作为属性名存取。条件统计工具（`stock.jsx`）与个体清单工具（`owned.jsx`）的固定字段是例外——它们的 `key` 是手动指定的英文字面量（条件统计：`name`/`level`/`category`/`status`/`note`，定义在 `src/domain/stock.js` 的 `STOCK_FIXED_FIELDS`；个体清单：`ref`/`nickname`/`level`/`natureDirection`/`bloodline`/`status`/`shiny`/`acquiredAt`/`note`，定义在 `src/domain/owned.js` 的 `OWNED_FIXED_FIELDS`），不经过 `deriveFieldKey` 生成。

### `catalogTables.kind` 与 stock / owned 两类衍生工具

条件统计工具（`stock`）和个体清单工具（`owned`）都不使用独立的 Dexie 表，而是复用 `catalogTables` / `catalogFields` / `catalogRows` 三张表存储数据，通过在对应 `catalogTables` 记录上打 `kind: 'stock'` 或 `kind: 'owned'` 标记来与普通资料库表区分：

- 每个场景首次打开对应工具时，`db.js` 的 `ensureStockTable(sceneId)` / `ensureOwnedTable(sceneId)` 会创建一张带对应 `kind` 的表及其固定字段（条件统计 5 个字段、个体清单 9 个字段）。table 与 field 均使用按场景 id 派生的**稳定 id**（如 `table-stock-${sceneId}` / `field-owned-${sceneId}-${field.key}`），而不是随机 id：若按稳定 id 能 `get` 到表则直接返回（缺字段时只补齐缺失字段，不覆盖已有字段/选项）；若按稳定 id 找不到，再按 `sceneId` + `kind` 查一遍——命中说明是旧版本（随机 id）建的表，直接复用（不改其 id，避免级联改写 `catalogFields`/`catalogRows` 的 `tableId`）；两者都找不到才用固定 id `put` 一张新表。这样即使 React StrictMode 下 effect 被并发执行两次，两次调用也会作用在同一条记录上，不会产生重复的资料表；从旧版本升级、已有随机 id 表的场景同样不会被重复创建。
- `kind` 是非索引属性（不在 `.stores()` 的索引串里），只在用 `.where('sceneId').equals(...)` 查出结果后，再用 JS 的 `.filter((t) => t.kind === 'stock')`、`.filter((t) => t.kind === 'owned')` 或 `.filter((t) => !t.kind)` 做区分，因此**没有引入 Dexie schema 版本变更**。
- 资料库工具（`CatalogTool`）与性格推荐工具的资料带入面板（`RowImportPanel`）都会用 `.filter((t) => !t.kind)` 只保留普通资料表，避免 stock / owned 表出现在这两处的选择器里。
- 个体清单工具的"精灵"引用字段（`reference` 类型）在初始化/新增行时会自动挑选**当前场景内第一张 `!kind` 的普通资料表**作为引用目标（例如洛克王国场景的"精灵基础资料"）。
- 因为导出/导入是对整张 Dexie 表做全量操作（不区分 `kind`），`kind` 字段会随 `catalogTables` 记录本身一起被导出/导入，**无需任何额外的导出/导入代码改动**。

## 预置资料加载（播种）

- 应用启动时 `App.jsx` 调用 `ensureSeeded()`。
- 该函数检查 `meta` 表中 `seededRockKingdom` 是否已为 `true`；若不是，则先写入 `src/presets/rockKingdom.js` 中定义的洛克王国场景 / 默认资料表 / 字段结构。场景骨架只播种一次，不会覆盖用户后续的修改或删除。
- 行数据通过 `fetch(`${BASE_URL}presets/rockKingdomRows.json`)` 拉取，文件放在 `public/` 下，不参与 JS 打包。拉取失败（如离线）时仅打印警告，不阻塞场景/表/字段骨架。
- 目标行数据来源是洛克王国公开图鉴静态 JSON：`https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/d.json`。同步脚本 `npm run sync:rock` 会读取 `l` 基础条目，并展开每个条目详情里的 `forms` 独立形态，预期为 `375 + 121 = 496` 条预置资料。若官方源数量变化，脚本会输出实际统计并失败，避免硬塞成 496。
- 精灵图、系别图标、特性图标均使用同源公开静态资源前缀 `https://static.gamecenter.qq.com/xgame/roco-kingdom/compendium/`，路径逐段 `encodeURIComponent` 编码；不使用本地 SVG 或 `data:image/svg+xml` 作为精灵图。
- 系别字段使用 `multiselect` 类型，覆盖官方 18 个系别：普通/草/火/水/光/地/冰/龙/电/毒/虫/武/翼/萌/幽/恶/机械/幻，对应内部值为 `normal`/`grass`/`fire`/`water`/`light`/`earth`/`ice`/`dragon`/`electric`/`poison`/`bug`/`fighting`/`flying`/`cute`/`ghost`/`dark`/`mech`/`illusion`。
- 资料库、个体清单、条件统计三者关系：资料库是精灵种类 / 图鉴 / 静态资料；个体清单是用户实际抓到或培养的每一只个体；条件统计是资源、素材、条件统计类记录。个体清单和条件统计仍复用 `catalogTables`/`catalogFields`/`catalogRows`，通过 `kind: 'owned'` / `kind: 'stock'` 与资料库表区分。
- 预置资料迁移策略：
  1. 新安装 / 干净 IndexedDB 只会插入官方图鉴行，不应出现旧 `row-rock-*` 占位行。
  2. 老用户若已播种旧占位资料，`migrateRockKingdomRows()` 会在默认洛克王国资料表中删除可明确识别的旧占位行（`id` 以 `row-rock-` 开头，或 `values.image` 以 `data:image/svg+xml` 开头），再按新稳定 id 插入官方行，避免重复。
  3. 用户自己新增的非占位资料行不会被删除；无法安全判断为占位的数据不会被覆盖。
  4. owned / stock 表及其用户记录不属于默认资料表 `tableId`，迁移不会触碰。
  5. 迁移通过 `meta.rockKingdomRowsVersion = "official-d-json-2026-06-08"` 标记资料版本，不引入 Dexie schema 版本变更。

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
- 洛克王国技能、进化链、属性克制、PVP 规则等对局向深度资料（当前预置资料只覆盖公开图鉴 d.json 可映射的基础资料、六维、特性、图片、系别、形态）
