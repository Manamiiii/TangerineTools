# TangerineTools · 数据模型与同步说明

本文档描述数据存储、导出、导入和预置资料加载的当前语义。

## 存储引擎

使用 [Dexie.js](https://dexie.org/)（IndexedDB 的封装）作为唯一的数据存储，数据库名为 `tangerine-tools`。Schema 定义在 `src/db/core.js`，`src/db.js` 只保留稳定的兼容导出：

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
- `summary`：图文摘要，当前字段值仍是主文字；图片和描述通过 `display.imageField` / `display.descriptionField` 关联同一行的其他字段，不引入新的存储结构。

### 表结构

| 表 | 主键 | 索引 | 说明 |
|---|---|---|---|
| `scenes` | `id` | `order` | 场景：`name` / `type` / `tools[]` / `order` / `createdAt` / `updatedAt` |
| `catalogTables` | `id` | `sceneId`, `order` | 资料表：`sceneId` / `name` / `order` / 时间戳 / 可选的 `kind`（非索引属性；`'owned'` 表示收集记录表，缺省表示普通资料库表；导入兼容 `kind: 'stock'` 记录，但统计视图不读取该类固定表） |
| `catalogFields` | `id` | `tableId`, `order` | 字段：`tableId` / `key` / `name` / `type` / `order` / `hidden` / 类型相关配置（`options` / `statsMap` / `statsDimensions` / `statsStyle` / `referenceTableId` / `display` 等） |
| `catalogRows` | `id` | `tableId` | 行：`tableId` / `values`（以字段 `key` 为键的对象） / 时间戳 |
| `meta` | `key` | — | 内部标记，如播种标记 `seededRockKingdom` |

字段的 `key` 由 `deriveFieldKey`（`src/utils.js`）从字段名派生，并保证在同一资料表内唯一；行数据 `values` 用字段 `key`（而非字段 `id`）作为属性名存取。普通新建场景不会预置业务字段；资料库字段和收集记录字段都由用户在字段管理里创建。洛克王国作为应用自带预置场景，会在自己的资料库表与收集记录表里补齐官方/场景专属字段。

`display` 是非索引展示配置，不改变字段值结构或 Dexie schema。通用表格按该配置处理列宽、括号换行、多行标签与溢出数量、摘要字段组合、引用行的标签/图片，以及单选项的图标模式。预置场景只声明展示元数据；`CellView` 不按场景字段名选择渲染分支。

### `catalogTables.kind` 与收集记录 / 统计视图

- 收集记录工具（`owned`）复用 `catalogTables` / `catalogFields` / `catalogRows` 三张表存储数据，通过 `catalogTables.kind === 'owned'` 与普通资料库表区分。
- 收集记录表还可以带非索引配置 `collectionMode: 'single' | 'multiple'`：`single` 表示同一 reference 只保留一条收集记录，`multiple` 表示同一 reference 可记录多条。
- 普通新建场景首次打开收集记录工具时，只创建空的收集记录表，不写入默认字段；洛克王国场景会补齐精灵收集字段，这是该预置场景自身的数据模板，不是全局模板。
- 统计视图工具的内部工具值为 `stock`；它从当前场景的普通资料表和收集记录表中选择数据源，按字段分组并叠加数值阈值条件做即时统计，不创建固定字段表。
- `kind` 和 `collectionMode` 都是非索引属性（不在 `.stores()` 的索引串里），只在按 `sceneId` 查询后用 JS 过滤/读取，因此**没有引入 Dexie schema 版本变更**。
- 资料库工具（`CatalogTool`）的普通资料表选择器使用 `.filter((t) => !t.kind)` 排除收集记录表。性格推荐工具固定绑定洛克王国 `精灵基础资料` 表，并通过 `skillRefs` 读取技能资料。
- 导出/导入对整张 Dexie 表操作且不区分 `kind`，因此 `kind` 与 `collectionMode` 随 `catalogTables` 记录一起传输。

## 预置资料加载（播种）

- 应用启动时 `App.jsx` 调用 `ensureSeeded()`。
- 该函数检查 `meta.seededRockKingdom`；未播种时写入 `src/presets/rockKingdom.js` 定义的洛克王国场景、默认资料表和字段结构。场景骨架只播种一次，不覆盖用户修改。
- 精灵行通过 `fetch(`${BASE_URL}presets/rockKingdomRows.json`)` 加载，技能行通过 `fetch(`${BASE_URL}presets/rockKingdomSkillRows.json`)` 加载；文件位于 `public/` 且不参与 JS 打包。繁育字段包含在正式精灵行中。加载失败时保留场景、表和字段骨架，不写完成标记，并在启动流程提供重试入口。
- 正式预置只通过 BWiki staging → preview → 显式 apply 链路维护。
- 完整运行时迁移按 `ROCK_KINGDOM_ROWS_VERSION` 写入 `meta.rockKingdomRuntimeMigrationVersion`；同一版本只扫描一次。导入备份会清除此标记，使三方安全合并在启动时重新执行。
- 精灵与技能图片使用经审计的 BWiki / patchwiki URL，UI 图标使用可信静态资源。精灵图不得使用本地 SVG 或 `data:image/svg+xml`。
- 系别字段使用 `multiselect` 类型，覆盖官方 18 个系别：普通/草/火/水/光/地/冰/龙/电/毒/虫/武/翼/萌/幽/恶/机械/幻，对应内部值为 `normal`/`grass`/`fire`/`water`/`light`/`earth`/`ice`/`dragon`/`electric`/`poison`/`bug`/`fighting`/`flying`/`cute`/`ghost`/`dark`/`mech`/`illusion`。精灵行使用 `skillRefs` 多引用指向技能行；技能行使用 `learnerRefs` 多引用反向指向可学习该技能的精灵行。技能行还包含派生的 `effectTags` 多选效果标签（先手、速度、回复、减伤、能量、强化、控制、应对、轮转等），这些标签由官方技能效果文本生成，用于资料查看与性格推荐解释；它们不是战斗模拟结果。
- 资料库保存对象种类、图鉴和静态资料；收集记录保存用户与资料项的一对一或一对多关系；统计视图从两类数据中即时汇总，不创建固定字段统计表。
- BWiki 是版本化页面快照，不是运行时查询接口。维护者先运行 `npm run check:bwiki:preset` 做 dry-run；正式发布必须显式运行 `BWIKI_PRESET_OVERWRITE=CONFIRM_BWIKI_PRESET npm run apply:bwiki:preset`。正式基线包含 592 条精灵、553 条技能和迁移清单。发布脚本只把 preview 的 `id` / `values` 写入预置，不把 `previewMeta` 带入运行时。精灵蛋和果实以 `eggImage` / `fruitImage` 字段存入精灵资料。应用启动迁移只读取仓库内预置 JSON。
- 预置资料迁移策略：
  1. 新安装 / 干净 IndexedDB 只会插入官方图鉴行，不应出现旧 `row-rock-*` 占位行。
  2. 老用户若已播种旧占位资料，`migrateRockKingdomRows()` 会在默认洛克王国资料表中删除可明确识别的旧占位行（`id` 以 `row-rock-` 开头，或 `values.image` 以 `data:image/svg+xml` 开头），再按新稳定 id 插入官方行，避免重复。
  3. `rockKingdomPresetMigration.json` 保存发生变化字段的基线正式值 SHA-256，不含用户数据。稳定 id 行的字段为空、系别无效，或当前值指纹匹配基线正式值时，才写入目标预置值；不匹配时视为用户自定义并保留。精灵和技能使用相同的字段级三方合并规则。
  4. 用户自己新增的非占位资料行不会被删除；无法安全判断为占位的数据不会被覆盖。
  5. owned / stock 表及其用户记录不属于默认资料表 `tableId`，迁移不会触碰。
  6. 迁移通过清单 `version` 更新 `meta.rockKingdomRowsVersion` / `rockKingdomSkillRowsVersion`；缺少清单时使用兼容版本常量。该流程不改变 Dexie schema 版本。

## 导出格式

`exportAllData()`（`src/db/importExport.js`）产出的 JSON 结构：

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

- `schemaVersion`（`EXPORT_SCHEMA_VERSION`，当前为 `1`）用于兼容判断；导入流程不执行基于该字段的自动 schema 迁移。
- 导出通过首页的「导出数据」按钮触发，文件名形如 `tangerine-tools-2026-07-02.json`。
- 导出范围是**全部** Dexie 表的**全部**数据，不支持按场景/按表部分导出。

## 导入与合并策略

`importAllData(payload)`（`src/db/importExport.js`）：

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

导入属于**增量合并**，不提供“用文件完全替换本地数据”或“清空全部数据”的入口。

UI 层（`App.jsx` 的 `GlobalDataActions`）在实际执行导入前会用 `ConfirmDialog` 向用户明确提示这一合并语义（"相同 id 的数据会被覆盖，文件中未包含的数据将保留在本地，此操作不可撤销"）。

## 关于"数据同步"的范围说明

当前的"同步"仅指**手动的、单机内的 JSON 导出/导入**，用于在同一用户的不同浏览器/设备间手动搬运数据，具体流程为：设备 A 导出 JSON → 通过用户自行选择的方式（网盘/传输文件等）转移文件 → 设备 B 导入 JSON。

以下能力**不**属于当前范围，如需实现请作为独立任务规划：

- 自动化/云端同步（无后端，无云账号体系）
- 增量导出（只导出变更部分）
- 导入时的字段级合并或冲突提示（当前是整条记录覆盖，无冲突检测）
- 基于 `schemaVersion` 的自动迁移
- 洛克王国完整对战模拟、进化链、属性克制、PVP 规则等对局向深度功能（当前技能资料仅作为可查看资料与性格推荐输入，不做技能组合求解或配队模拟）
