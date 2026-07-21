import Dexie from 'dexie'

export const db = new Dexie('tangerine-tools')

// Dexie schema 保持 v1；运行时数据迁移使用 meta 版本标记，不升级 IndexedDB schema。
db.version(1).stores({
  scenes: 'id, order',
  catalogTables: 'id, sceneId, order',
  catalogFields: 'id, tableId, order',
  catalogRows: 'id, tableId',
  meta: 'key',
})
