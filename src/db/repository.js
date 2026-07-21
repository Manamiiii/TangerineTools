// 场景、资料表、字段、行和收集记录表的数据访问。

import { db } from './core.js'
import { OWNED_TABLE_NAME, ROCK_KINGDOM_COLLECTION_FIELDS } from '../domain/owned.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { deriveFieldKey, generateId, normalizeField, nowIso } from '../utils.js'

// ---------------------------------------------------------------------------
// 场景
// ---------------------------------------------------------------------------

export async function createScene({ name, type, tools }) {
  const count = await db.scenes.count()
  const now = nowIso()
  const scene = {
    id: generateId('scene'),
    name,
    type,
    tools: tools || [],
    order: count,
    createdAt: now,
    updatedAt: now,
  }
  await db.scenes.put(scene)
  return scene
}

export async function updateScene(id, patch) {
  await db.scenes.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteScene(id) {
  const tables = await db.catalogTables.where('sceneId').equals(id).toArray()
  await db.transaction(
    'rw',
    db.scenes,
    db.catalogTables,
    db.catalogFields,
    db.catalogRows,
    async () => {
      for (const table of tables) {
        await deleteCatalogTableInternal(table.id)
      }
      await db.scenes.delete(id)
    },
  )
}

// ---------------------------------------------------------------------------
// 资料表（catalogTables）
// ---------------------------------------------------------------------------

export async function createCatalogTable(sceneId, name) {
  const count = await db.catalogTables.where('sceneId').equals(sceneId).count()
  const now = nowIso()
  const table = {
    id: generateId('table'),
    sceneId,
    name,
    order: count,
    createdAt: now,
    updatedAt: now,
  }
  await db.catalogTables.put(table)
  return table
}

export async function renameCatalogTable(id, name) {
  await db.catalogTables.update(id, { name, updatedAt: nowIso() })
}

export async function deleteCatalogTable(id) {
  await db.transaction('rw', db.catalogTables, db.catalogFields, db.catalogRows, async () => {
    await deleteCatalogTableInternal(id)
  })
}

async function deleteCatalogTableInternal(id) {
  await db.catalogFields.where('tableId').equals(id).delete()
  await db.catalogRows.where('tableId').equals(id).delete()
  await db.catalogTables.delete(id)
}

// 为收集记录补齐缺失的固定字段：只新增本地还没有
// （按 key 判断）的字段，已存在的字段（含用户编辑过的选项/名称）一律不动。
// 用于 ensureOwnedTable 在表已存在但字段不全时的补齐场景，
// 例如从旧版本升级、或字段定义在新版本中有增补。
async function ensureFixedFields(tableId, sceneId, idPrefix, fixedFields, now, extraProps) {
  const existingFields = await db.catalogFields.where('tableId').equals(tableId).toArray()
  const existingKeys = new Set(existingFields.map((f) => f.key))
  const missing = fixedFields.filter((f) => !existingKeys.has(f.key))
  if (missing.length === 0) return
  // 用现有字段里最大的 order + 1 作为起点，而不是 existingFields.length：
  // deleteField 不会重排剩余字段的 order，删除中间字段后会留下空洞，
  // 此时 length 可能小于等于某个仍存在的 order，直接用 length 会产生重复 order。
  const startOrder = existingFields.length
    ? Math.max(...existingFields.map((f) => f.order ?? 0)) + 1
    : 0
  const newFields = missing.map((f, index) =>
    normalizeField({
      id: `field-${idPrefix}-${sceneId}-${f.key}`,
      tableId,
      key: f.key,
      name: f.name,
      type: f.type,
      order: startOrder + index,
      options: f.options,
      createdAt: now,
      updatedAt: now,
      ...(extraProps ? extraProps(f) : null),
    }),
  )
  await db.transaction('rw', db.catalogFields, async () => {
    for (const field of newFields) await db.catalogFields.put(field)
  })
}

// 收集记录：与资料库共享 catalogTables 存储，用 kind: 'owned' 标记；
// 与资料库、统计视图都相互隔离（不会出现在资料库工具的资料表选择器里）。
// 幂等：table/field 均使用按 sceneId 派生的稳定 id，重复调用不会创建
// 出重复的资料表（含旧随机 id 兼容）。
// ref 字段的 referenceTableId 会自动绑定到当前场景第一个"普通"资料表
// （即 !table.kind），例如洛克王国场景的"精灵图鉴"。用户新建的场景若
// 还没有普通资料表，则先创建收集记录表并留空引用，等资料表创建后再手动指定。

function hasMeaningfulValue(value) {
  return value != null && value !== '' && (!Array.isArray(value) || value.length > 0)
}

async function reconcileRockKingdomOwnedFields(tableId, sceneId, fixedFields, catalogTableId, now) {
  if (sceneId !== ROCK_KINGDOM_PRESET.scene.id) return
  const fields = await db.catalogFields.where('tableId').equals(tableId).toArray()
  const rows = await db.catalogRows.where('tableId').equals(tableId).toArray()
  const fixedByKey = new Map(fixedFields.map((field) => [field.key, field]))
  const deprecatedKeys = new Set(['nickname', 'level', 'natureDirection', 'status', 'shiny', 'acquiredAt'])

  await db.transaction('rw', db.catalogFields, async () => {
    for (const field of fields) {
      const fixed = fixedByKey.get(field.key)
      if (fixed) {
        await db.catalogFields.update(field.id, {
          name: fixed.name,
          type: fixed.type,
          options: fixed.options || [],
          hidden: false,
          referenceTableId: fixed.type === 'reference' ? catalogTableId || null : field.referenceTableId || null,
          updatedAt: now,
        })
        continue
      }
      if (!deprecatedKeys.has(field.key)) continue
      const hasData = rows.some((row) => hasMeaningfulValue(row.values?.[field.key]))
      if (hasData) {
        await db.catalogFields.update(field.id, { hidden: true, updatedAt: now })
      } else {
        await db.catalogFields.delete(field.id)
      }
    }
  })
}

function collectionFieldsForScene(sceneId) {
  return sceneId === ROCK_KINGDOM_PRESET.scene.id ? ROCK_KINGDOM_COLLECTION_FIELDS : []
}

export async function ensureOwnedTable(sceneId) {
  const tableId = `table-owned-${sceneId}`
  const now = nowIso()
  const catalogTable = await db.catalogTables
    .where('sceneId')
    .equals(sceneId)
    .filter((t) => !t.kind)
    .first()

  const existing =
    (await db.catalogTables.get(tableId)) ||
    (await db.catalogTables
      .where('sceneId')
      .equals(sceneId)
      .filter((t) => t.kind === 'owned')
      .first())
  if (existing) {
    const fixedFields = collectionFieldsForScene(sceneId)
    if (fixedFields.length > 0) {
      await ensureFixedFields(existing.id, sceneId, 'owned', fixedFields, now, (f) =>
        f.type === 'reference' ? { referenceTableId: catalogTable?.id || null } : null,
      )
      await reconcileRockKingdomOwnedFields(existing.id, sceneId, fixedFields, catalogTable?.id || null, now)
    }
    return existing
  }

  const order = await db.catalogTables.where('sceneId').equals(sceneId).count()
  const table = {
    id: tableId,
    sceneId,
    name: OWNED_TABLE_NAME,
    kind: 'owned',
    collectionMode: sceneId === ROCK_KINGDOM_PRESET.scene.id ? 'multiple' : 'single',
    order,
    createdAt: now,
    updatedAt: now,
  }
  const fixedFields = collectionFieldsForScene(sceneId)
  const fields = fixedFields.map((f, index) =>
    normalizeField({
      id: `field-owned-${sceneId}-${f.key}`,
      tableId: table.id,
      key: f.key,
      name: f.name,
      type: f.type,
      order: index,
      options: f.options,
      referenceTableId: f.type === 'reference' ? catalogTable?.id || null : undefined,
      createdAt: now,
      updatedAt: now,
    }),
  )
  await db.transaction('rw', db.catalogTables, db.catalogFields, async () => {
    await db.catalogTables.put(table)
    for (const field of fields) await db.catalogFields.put(field)
  })
  return table
}

// ---------------------------------------------------------------------------
// 字段（catalogFields）
// ---------------------------------------------------------------------------

export async function createField(tableId, { name, type }, atIndex = null) {
  const existing = await db.catalogFields.where('tableId').equals(tableId).sortBy('order')
  const key = deriveFieldKey(
    name,
    existing.map((f) => f.key),
  )
  const now = nowIso()
  const field = normalizeField({
    id: generateId('field'),
    tableId,
    key,
    name,
    type,
    order: atIndex == null ? existing.length : atIndex,
    createdAt: now,
    updatedAt: now,
  })
  if (atIndex == null) {
    await db.catalogFields.put(field)
    return field
  }
  const ordered = [...existing]
  ordered.splice(atIndex, 0, field)
  await db.transaction('rw', db.catalogFields, async () => {
    await Promise.all(ordered.map((f, index) => db.catalogFields.put({ ...f, order: index })))
  })
  return field
}

export async function updateField(id, patch) {
  await db.catalogFields.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteField(id) {
  await db.catalogFields.delete(id)
}

export async function reorderFields(orderedIds) {
  const now = nowIso()
  await db.transaction('rw', db.catalogFields, async () => {
    await Promise.all(
      orderedIds.map((id, index) => db.catalogFields.update(id, { order: index, updatedAt: now })),
    )
  })
}

// ---------------------------------------------------------------------------
// 行（catalogRows）
// ---------------------------------------------------------------------------

export async function createRow(tableId, values) {
  const now = nowIso()
  const row = { id: generateId('row'), tableId, values, createdAt: now, updatedAt: now }
  await db.catalogRows.put(row)
  return row
}

export async function updateRow(id, values) {
  await db.catalogRows.update(id, { values, updatedAt: nowIso() })
}

export async function deleteRow(id) {
  await db.catalogRows.delete(id)
}
