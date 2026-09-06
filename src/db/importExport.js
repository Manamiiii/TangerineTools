import { nowIso } from '../utils.js'
import { db } from './core.js'

export const EXPORT_SCHEMA_VERSION = 1
export const READING_BACKUP_FORMAT = 'tangerine-reading-companion-backup'
const IMPORTABLE_KEYS = ['scenes', 'catalogTables', 'catalogFields', 'catalogRows', 'meta']
const COLLECTION_LABELS = ['场景', '资料表与收集表', '字段', '资料行与收集记录', '应用数据']
const primaryKey = (key) => key === 'meta' ? 'key' : 'id'
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isId = (value) => typeof value === 'string' && value.trim().length > 0

async function readAllData() {
  const collections = await Promise.all(IMPORTABLE_KEYS.map((key) => db[key].toArray()))
  return Object.fromEntries(IMPORTABLE_KEYS.map((key, index) => [key, collections[index]]))
}

export async function exportAllData() {
  const data = await db.transaction('r', IMPORTABLE_KEYS.map((key) => db[key]), readAllData)
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    data,
  }
}

export async function exportReadingCompanionData() {
  const meta = (await db.meta.toArray()).filter((record) => (
    typeof record?.key === 'string'
    && (record.key.startsWith('readerState:') || record.key.startsWith('readerPersonalPackage:'))
  ))
  return {
    format: READING_BACKUP_FORMAT,
    schemaVersion: 1,
    exportedAt: nowIso(),
    data: { meta },
  }
}

export function validateImportPayload(payload) {
  if (!isObject(payload)) return '文件内容不是有效的 JSON 对象'
  if (payload.schemaVersion !== undefined && payload.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return '不支持该备份的 schemaVersion；仅支持版本 1 或未标版本的早期备份'
  }
  if (payload.format !== undefined && payload.format !== 'tangerine-tools-backup') {
    return '文件属于其他应用或专用迁移格式，请选择 TangerineTools 全量备份'
  }
  if (!isObject(payload.data)) return '文件缺少有效的 data 对象'
  for (const key of IMPORTABLE_KEYS) {
    if (payload.data[key] !== undefined && !Array.isArray(payload.data[key])) {
      return `data.${key} 必须是数组`
    }
    const ids = new Set()
    for (const [index, record] of (payload.data[key] || []).entries()) {
      const path = `data.${key}[${index}]`
      if (!isObject(record)) return `${path} 必须是对象`
      const idKey = primaryKey(key)
      if (!isId(record[idKey])) return `${path}.${idKey} 必须是非空字符串`
      if (ids.has(record[idKey])) return `${path}.${idKey} 重复：${record[idKey]}`
      ids.add(record[idKey])
      const requiredKeys = key === 'catalogTables' ? ['sceneId']
        : key === 'catalogFields' ? ['tableId', 'key', 'type']
          : key === 'catalogRows' ? ['tableId'] : []
      for (const name of requiredKeys) {
        if (!isId(record[name])) return `${path}.${name} 必须是非空字符串`
      }
      if (key === 'catalogRows' && !isObject(record.values)) return `${path}.values 必须是对象`
      if (key === 'scenes' && record.tools !== undefined
        && (!Array.isArray(record.tools) || !record.tools.every(isId))) {
        return `${path}.tools 必须是字符串数组`
      }
      if (key === 'catalogFields') {
        if (record.options !== undefined && (!Array.isArray(record.options)
          || !record.options.every((option) => typeof option === 'string' || isObject(option)))) {
          return `${path}.options 必须是选项数组`
        }
        for (const name of ['display', 'statsMap']) {
          if (record[name] !== undefined && !isObject(record[name])) return `${path}.${name} 必须是对象`
        }
        if (record.statsDimensions !== undefined && (!Array.isArray(record.statsDimensions)
          || !record.statsDimensions.every(isObject))) return `${path}.statsDimensions 必须是对象数组`
      }
    }
  }
  if (!IMPORTABLE_KEYS.some((key) => Array.isArray(payload.data[key]))) {
    return '文件不包含任何可导入的数据'
  }
  return null
}

// 预览使用合并后的本地关系；缺失关系仅提示，不阻止恢复含孤立记录的备份。
export async function previewImportData(payload) {
  const error = validateImportPayload(payload)
  if (error) throw new Error(error)
  const local = await db.transaction('r', IMPORTABLE_KEYS.map((key) => db[key]), readAllData)
  const merged = {}
  const collections = IMPORTABLE_KEYS.map((key, index) => {
    const idKey = primaryKey(key)
    const existing = new Map(local[key].map((record) => [record[idKey], record]))
    const incoming = payload.data[key] || []
    const overwritten = incoming.filter((record) => existing.has(record[idKey])).length
    merged[key] = new Map([...existing, ...incoming.map((record) => [record[idKey], record])])
    return { key, label: COLLECTION_LABELS[index], added: incoming.length - overwritten, overwritten }
  })
  const warnings = []
  let warningCount = 0
  function warn(message) {
    warningCount += 1
    if (warnings.length < 20) warnings.push(message)
  }
  for (const table of payload.data.catalogTables || []) {
    if (!merged.scenes.has(table.sceneId)) warn(`资料表 ${table.id} 的场景 ${table.sceneId} 不存在`)
  }
  for (const field of payload.data.catalogFields || []) {
    if (!merged.catalogTables.has(field.tableId)) warn(`字段 ${field.id} 的资料表 ${field.tableId} 不存在`)
    if (field.referenceTableId && !merged.catalogTables.has(field.referenceTableId)) {
      warn(`字段 ${field.id} 引用的资料表 ${field.referenceTableId} 不存在`)
    }
  }
  const referenceFields = new Map()
  for (const field of merged.catalogFields.values()) {
    if (!['reference', 'references'].includes(field.type)) continue
    const fields = referenceFields.get(field.tableId) || []
    fields.push(field)
    referenceFields.set(field.tableId, fields)
  }
  for (const row of payload.data.catalogRows || []) {
    if (!merged.catalogTables.has(row.tableId)) warn(`记录 ${row.id} 的资料表 ${row.tableId} 不存在`)
    for (const field of referenceFields.get(row.tableId) || []) {
      const value = row.values[field.key]
      if (value == null || value === '') continue
      const ids = field.type === 'references' ? value : [value]
      if (!Array.isArray(ids) || !ids.every(isId)) {
        warn(`记录 ${row.id} 的引用字段 ${field.key} 格式异常`)
        continue
      }
      for (const id of ids) {
        const target = merged.catalogRows.get(id)
        if (!target || (field.referenceTableId && target.tableId !== field.referenceTableId)) {
          warn(`记录 ${row.id} 的引用 ${field.key} → ${id} 缺失或不属于目标表`)
        }
      }
    }
  }
  return { collections, warnings, warningCount }
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
