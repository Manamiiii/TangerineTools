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

首页「导出数据」始终导出五张表的完整内容。模型连接地址、模型 ID 与 API Key 不在 Dexie 中，因此不进入文件。

## 全量导入

`importAllData(payload)` 先校验 `data` 下的可导入数组，再在一个 Dexie 写事务中执行 `bulkPut`。

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
