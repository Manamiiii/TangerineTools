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
| `catalogTables` | `id` | `sceneId`, `order` | 资料表：`sceneId` / `name` / `order` / 时间戳 / 可选的 `kind`（非索引属性；值为 `'stock'` 时表示这是属性库存工具专用的表，`undefined`/缺省表示普通资料库表，见下方说明） |
| `catalogFields` | `id` | `tableId`, `order` | 字段：`tableId` / `key` / `name` / `type` / `order` / `hidden` / 类型相关配置（`options` / `statsMap` 等） |
| `catalogRows` | `id` | `tableId` | 行：`tableId` / `values`（以字段 `key` 为键的对象） / 时间戳 |
| `meta` | `key` | — | 内部标记，如播种标记 `seededRockKingdom` |

字段的 `key` 由 `deriveFieldKey`（`src/utils.js`）从字段名派生，并保证在同一资料表内唯一；行数据 `values` 用字段 `key`（而非字段 `id`）作为属性名存取。属性库存工具（`stock.jsx`）的固定字段是例外——它们的 `key` 是手动指定的英文字面量（`name`/`level`/`category`/`status`/`note`，定义在 `src/domain/stock.js` 的 `STOCK_FIXED_FIELDS`），不经过 `deriveFieldKey` 生成。

### `catalogTables.kind` 与属性库存工具

属性库存工具（`stock` 场景工具）不使用独立的 Dexie 表，而是复用 `catalogTables` / `catalogFields` / `catalogRows` 三张表存储数据，通过在对应 `catalogTables` 记录上打 `kind: 'stock'` 标记来与普通资料库表区分：

- 每个场景首次打开属性库存工具时，`db.js` 的 `ensureStockTable(sceneId)` 会幂等地创建一张 `kind: 'stock'` 的表及其 5 个固定字段（若已存在则直接返回，不会重复创建或覆盖数据）。
- `kind` 是非索引属性（不在 `.stores()` 的索引串里），只在用 `.where('sceneId').equals(...)` 查出结果后，再用 JS 的 `.filter((t) => t.kind === 'stock')` 或 `.filter((t) => t.kind !== 'stock')` 做区分，因此**没有引入 Dexie schema 版本变更**。
- 资料库工具（`CatalogTool`）与性格推荐工具的资料带入面板（`RowImportPanel`）都会用 `.filter((t) => t.kind !== 'stock')` 排除库存表，避免它出现在这两处的资料表选择器里。
- 因为导出/导入是对整张 Dexie 表做全量操作（不区分 `kind`），`kind` 字段会随 `catalogTables` 记录本身一起被导出/导入，**无需任何额外的导出/导入代码改动**。

## 预置资料加载（播种）

- 应用启动时 `App.jsx` 调用 `ensureSeeded()`。
- 该函数检查 `meta` 表中 `seededRockKingdom` 是否已为 `true`；若是则跳过，保证只播种一次，不会覆盖用户后续的修改或删除。
- 首次播种时：
  1. 写入 `src/presets/rockKingdom.js` 中定义的场景 / 资料表 / 字段（结构化数据，随 JS bundle 一起打包）。
  2. 通过 `fetch(`${BASE_URL}presets/rockKingdomRows.json`)` 拉取行数据（放在 `public/` 下，不参与 JS 打包，避免图片占位数据体积膨胀主 bundle）。
  3. 拉取失败（如离线）时仅打印警告，不阻塞——场景/表/字段骨架依然可用，用户可以自行录入数据。
- 当前 `rockKingdomRows.json` 包含 **10 条**示例精灵数据（迪莫/喵喵/魔力猫/水灵/圣水守护/鸭吉吉/鸭吉吉国王/烈焰虎/烈焰霸王/磐石龟，含 4 组同编号的进化形态对，用于演示资料库详情弹窗的"同编号形态对比"功能），**不是**完整的洛克王国精灵图鉴。

### 全量数据同步：当前决策与未来接入方式

补齐完整图鉴（数百条精灵、每条精灵的真实数值/技能/系别等）明确**不在当前范围内**，原因：

- 需要真实、准确的官方数值资料作为数据源，而不是靠猜测或臆造凑数——凭空编造大量"看起来合理"的精灵数据对使用者没有实际价值，反而可能造成误导。
- 数据体量大，属于独立的数据整理工作，不适合与功能开发耦合在同一轮改动里。

若后续要接入全量数据，建议的技术路径（无需改动播种逻辑本身）：

1. 保持现有的行数据结构（`id` / `tableId` / `values` / `createdAt` / `updatedAt`），把真实数据整理成同样格式。
2. 数据量较大时，可以把单一的 `rockKingdomRows.json` 拆分为多个分片文件（例如按系别或编号区间分片），播种时依次 `fetch` 并合并，避免单个 JSON 文件过大。
3. 复用现有的「同 id 覆盖、缺失保留」合并语义（见下方导入与合并策略）：后续更新数据时，可以让用户通过导出/导入功能自行合并新数据，而不必重新设计一套同步机制。
4. 用户手动编辑过的行（包括通过导入带入的自定义数据）应始终优先于预置数据——不要设计成"重新播种会覆盖用户修改"的逻辑。

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
- 洛克王国全量数据（需求中提到的目标规模为 496 条）的完整同步——当前仅有 10 条示例数据，接入方式见上方"全量数据同步：当前决策与未来接入方式"
