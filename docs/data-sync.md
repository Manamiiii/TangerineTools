# TangerineTools · 数据模型与迁移

本文定义 Dexie 存储、JSON 备份、导入合并、正式预置与阅读数据迁移的当前语义。

## Dexie schema

数据库名为 `tangerine-tools`，`src/db/core.js` 保持 schema v1：

```js
db.version(1).stores({
  scenes: 'id, order',
  catalogTables: 'id, sceneId, order',
  catalogFields: 'id, tableId, order',
  catalogRows: 'id, tableId',
  meta: 'key',
})
```

| 表 | 主键 | 用途 |
|---|---|---|
| `scenes` | `id` | 游戏场景、启用工具和顺序 |
| `catalogTables` | `id` | 资料表；`kind === 'owned'` 表示收集记录 |
| `catalogFields` | `id` | 字段定义；行值使用字段 `key`，不使用字段记录 id |
| `catalogRows` | `id` | 资料行和收集行 |
| `meta` | `key` | 播种、运行时迁移和兼容数据 |

`catalogTables.kind`、`collectionMode`、字段显示配置和引用配置均为非索引属性，不需要 schema 升级。`reference` 保存一个行 id，`references` 保存行 id 数组，`stats` 是不可直接编辑的派生视图。

## 场景与正式预置

`ensureSeeded()` 初始化稳定 id 为 `scene-rock-kingdom` 的洛克王国世界场景。场景骨架只播种一次；正式精灵与技能资料从 `public/presets/` 加载，并通过版本标记执行字段级三方合并。

预置迁移可以补充空值、修正仍匹配正式基线指纹的字段，并保留用户自定义的非空值。用户新增资料以及 owned / stock 记录不属于正式资料迁移目标。正式资料只通过 BWiki staging → preview → 显式 apply 流程维护。

默认工具列表仅用于创建内置场景，已有场景的工具选择保持原样；需要启用其他工具时通过场景编辑操作。播种标记缺失时只补齐缺失的结构，保留已有场景、表和同 key 字段，包括随机字段 id。

收集表初始化只补齐缺少的固定字段，已有字段的名称、选项、显示配置、隐藏状态、顺序及引用目标保持原样。资料字段布局迁移有版本标记，仅补齐缺失的配置；已有非空名称和显式配置不由启动流程重置。

启动流程不按演示 id、测试 id 前缀或备注删除收集记录；这类记录及兼容标记同样随备份保留。

## 全量导出

`exportAllData()` 产生：

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-13T00:00:00.000Z",
  "data": {
    "scenes": [],
    "catalogTables": [],
    "catalogFields": [],
    "catalogRows": [],
    "meta": []
  }
}
```

首页「导出数据」在同一个只读事务中读取五张表的完整内容，保证备份快照一致。模型连接地址、模型 ID 与 API Key 不在 Dexie 中，因此不进入文件。

## 全量导入

`importAllData(payload)` 先校验备份版本、可导入数组、记录结构和重复主键，再在一个 Dexie 写事务中执行 `bulkPut`。校验失败或事务中任意写入失败时，不保留部分写入，运行时迁移标记也保持原样。

兼容规则：

- 支持 `schemaVersion: 1` 和未标版本的早期备份；不接受其他版本或其他应用的专用迁移格式。
- 五个集合均可省略，但至少需要提供一个可导入数组。主键必须是非空字符串，同一集合中不得重复；不限制稳定 id 或随机 id 的命名方式。
- 资料表需要 `sceneId`，字段需要 `tableId`、`key`、`type`，行需要 `tableId` 和对象形式的 `values`。字段选项兼容字符串形式，未知扩展属性和行值保持原样。
- 导入前通过 `previewImportData()` 只读预览各集合新增与覆盖的数量。引用关系结合本地数据和文件中待导入的数据检查，部分备份无需重复携带本地已有的关联对象。
- 待导入表、字段和行的缺失关联，以及行引用格式或目标表异常，只产生警告，不阻止恢复孤立记录，也不自动修改引用。界面显示警告总数和前 20 项明细。数量按预览时本地数据估算，其他标签页的后续写入可能改变实际覆盖数量。
- 文件读取、预览和导入期间禁止重复提交；失败时显示错误，成功时显示完成提示。

合并规则：

- 相同 id 或 key 的记录由文件内容整条覆盖。
- 文件中新增的记录写入本地。
- 文件没有包含的本地记录保持不变。
- 导入不提供清空或整库替换入口。

导入后清除洛克王国运行时迁移标记，使正式预置在下次启动时重新执行安全三方合并。该过程不得清理 owned / stock 数据，不改变稳定 id，也兼容早期随机 id。

## 阅读数据迁移

游戏界面不渲染类型为 `reading` 或启用 `reader` 工具的场景，但相关 IndexedDB 记录保持不变。首页检测下列 `meta.key` 前缀：

- `readerState:`：阅读进度和阅读记忆。
- `readerPersonalPackage:`：个人书籍资料包。

检测到至少一条时显示「迁移阅读数据」。`exportReadingCompanionData()` 只导出这两个命名空间，格式为：

```json
{
  "format": "tangerine-reading-companion-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-08-13T00:00:00.000Z",
  "data": { "meta": [] }
}
```

该文件可直接导入 Tangerine Reading Companion。导出是只读操作，不删除源记录；全量 TangerineTools 备份也继续包含这些兼容记录。阅读伴侣导入时把状态归一到自己的稳定场景 id，并对同一书籍版本保留 `updatedAt` 较新的状态。

## 手动迁移范围

“同步”仅指用户主动导出 JSON、转移文件并在另一浏览器导入。不包含自动云同步、增量日志、冲突界面或账号体系。
