import { nowIso } from '../utils.js'
import { db } from './core.js'

export const EXPORT_SCHEMA_VERSION = 1
const IMPORTABLE_KEYS = ['scenes', 'catalogTables', 'catalogFields', 'catalogRows', 'meta']

export async function exportAllData() {
  const [scenes, catalogTables, catalogFields, catalogRows, meta] = await Promise.all([
    db.scenes.toArray(),
    db.catalogTables.toArray(),
    db.catalogFields.toArray(),
    db.catalogRows.toArray(),
    db.meta.toArray(),
  ])
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: { scenes, catalogTables, catalogFields, catalogRows, meta },
  }
}

export function validateImportPayload(payload) {
  if (!payload || typeof payload !== 'object') return '文件内容不是有效的 JSON 对象'
  if (!payload.data || typeof payload.data !== 'object') return '文件缺少 data 字段'
  for (const key of IMPORTABLE_KEYS) {
    if (payload.data[key] !== undefined && !Array.isArray(payload.data[key])) {
      return `data.${key} 必须是数组`
    }
  }
  if (!IMPORTABLE_KEYS.some((key) => Array.isArray(payload.data[key]))) {
    return '文件不包含任何可导入的数据'
  }
  return null
}

// 同 id 覆盖，文件中不存在的本地数据保留；导入后仅清除迁移标记，
// 让正式预置在下次启动时重新执行三方安全合并。
export async function importAllData(payload) {
  const error = validateImportPayload(payload)
  if (error) throw new Error(error)
  const { data } = payload
  await db.transaction(
    'rw',
    db.scenes,
    db.catalogTables,
    db.catalogFields,
    db.catalogRows,
    db.meta,
    async () => {
      if (data.scenes) await db.scenes.bulkPut(data.scenes)
      if (data.catalogTables) await db.catalogTables.bulkPut(data.catalogTables)
      if (data.catalogFields) await db.catalogFields.bulkPut(data.catalogFields)
      if (data.catalogRows) await db.catalogRows.bulkPut(data.catalogRows)
      if (data.meta) await db.meta.bulkPut(data.meta)
      await db.meta.delete('rockKingdomRuntimeMigrationVersion')
    },
  )
}
