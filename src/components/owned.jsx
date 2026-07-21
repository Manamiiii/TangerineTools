// 收集记录工具：记录“我与资料项的关系”。普通新建场景默认不预置字段，
// 可在字段管理里按场景自行配置；洛克王国预置场景会补齐精灵收集字段。
//
// 数据复用资料库的 catalogTables/catalogFields/catalogRows（kind: 'owned'），
// 与资料库、统计视图均相互隔离。reference 字段可绑定到当前场景的普通资料表
// （例如"精灵图鉴"），因此可以复用 catalog 的 ReferenceCellView/Input。

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { createRow, db, deleteRow, ensureOwnedTable, updateRow } from '../db.js'
import { matchesOwnedSearch } from '../domain/owned.js'
import { ConfirmDialog, EmptyState, FormRow, IconButton, Modal } from './common.jsx'
import { CellView, FieldInput, FieldManagerModal } from './catalog.jsx'

export function OwnedTool({ scene }) {
  useEffect(() => {
    ensureOwnedTable(scene.id)
  }, [scene.id])

  const table = useLiveQuery(
    () =>
      db.catalogTables
        .where('sceneId')
        .equals(scene.id)
        .filter((t) => t.kind === 'owned')
        .first(),
    [scene.id],
  )

  if (!table) return null

  return <OwnedTableView table={table} sceneId={scene.id} />
}

function defaultValueForType(type) {
  if (type === 'multiselect') return []
  if (type === 'boolean') return false
  return ''
}

function collectionModeLabel(mode) {
  return mode === 'multiple' ? '一对多' : '一对一'
}

function OwnedTableView({ table, sceneId }) {
  const fields = useLiveQuery(
    () => db.catalogFields.where('tableId').equals(table.id).sortBy('order'),
    [table.id],
  )
  const rows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(table.id).toArray(),
    [table.id],
  )
  // 收集记录的 reference 字段引用的资料表内容用于把关键字扩展到"被引用行的名称"，
  // 这样搜索"卡卡露"也能命中昵称留空的行。
  const refFieldTables = useLiveQuery(
    () =>
      db.catalogTables
        .where('sceneId')
        .equals(sceneId)
        .filter((t) => !t.kind)
        .toArray(),
    [sceneId],
  )
  const refFieldRows = useLiveQuery(async () => {
    if (!refFieldTables || refFieldTables.length === 0) return {}
    const map = {}
    for (const t of refFieldTables) {
      const [tFields, tRows] = await Promise.all([
        db.catalogFields.where('tableId').equals(t.id).sortBy('order'),
        db.catalogRows.where('tableId').equals(t.id).toArray(),
      ])
      const nameField = tFields.find((f) => f.type === 'text') || tFields[0]
      map[t.id] = new Map(
        tRows.map((r) => [r.id, nameField ? String(r.values?.[nameField.key] || '') : r.id]),
      )
    }
    return map
  }, [refFieldTables?.map((t) => t.id).join('|') || ''])

  const [fieldManagerOpen, setFieldManagerOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [rowForm, setRowForm] = useState(null) // null | 'new' | row
  const [deletingRow, setDeletingRow] = useState(null)

  const filteredRows = useMemo(() => {
    if (!rows || !fields) return []
    const refField = fields.find((f) => f.type === 'reference')
    return rows.filter((row) => {
      if (matchesOwnedSearch(row, keyword)) return true
      if (!refField || !refFieldRows) return false
      const refTableId = refField.referenceTableId
      const nameMap = refTableId ? refFieldRows[refTableId] : null
      const refValue = row.values?.[refField.key]
      const refName = nameMap?.get(refValue) || ''
      return refName.toLowerCase().includes((keyword || '').trim().toLowerCase())
    })
  }, [rows, fields, refFieldRows, keyword])

  if (!fields || !rows) return null

  const sortedFields = [...fields].sort((a, b) => a.order - b.order)
  const visibleFields = sortedFields.filter((field) => !field.hidden)

  return (
    <div className="table-view">
      <div className="toolbar toolbar-catalog">
        <div className="owned-search">
          <Search size={14} />
          <input
            className="input owned-search-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索收集记录…"
          />
        </div>
        <div className="segmented collection-mode-switcher" title="一对一：同一资料项只保留一条收集记录；一对多：同一资料项可以记录多条。">
          {['single', 'multiple'].map((mode) => (
            <button
              key={mode}
              type="button"
              className={`segmented-item ${(table.collectionMode || 'single') === mode ? 'active' : ''}`}
              onClick={() => db.catalogTables.update(table.id, { collectionMode: mode })}
            >
              {collectionModeLabel(mode)}
            </button>
          ))}
        </div>
        <span className="toolbar-spacer" />
        <IconButton
          icon={Settings2}
          label="字段"
          onClick={() => setFieldManagerOpen(true)}
        />
        <IconButton
          icon={Plus}
          label="新增记录"
          variant="primary"
          disabled={visibleFields.length === 0}
          onClick={() => setRowForm('new')}
        />
      </div>


      {rows.length === 0 ? (
        <EmptyState
          title="还没有收集记录"
          description={visibleFields.length === 0 ? '先添加字段，再记录你的收集进度。' : '点击“新增记录”记录第一条收集进度。'}
          action={
            <button
              type="button"
              className="btn btn-primary"
              disabled={visibleFields.length === 0}
              onClick={() => setRowForm('new')}
            >
              新增记录
            </button>
          }
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState title="没有匹配的记录" description="试试更换关键字或清空搜索框。" />
      ) : (
        <OwnedGrid
          fields={visibleFields}
          rows={filteredRows}
          onEditRow={setRowForm}
          onDeleteRow={setDeletingRow}
        />
      )}

      {fieldManagerOpen && (
        <FieldManagerModal
          tableId={table.id}
          fields={sortedFields}
          sceneTables={refFieldTables || []}
          onClose={() => setFieldManagerOpen(false)}
        />
      )}

      {rowForm && (
        <OwnedFormModal
          table={table}
          fields={visibleFields}
          row={rowForm === 'new' ? null : rowForm}
          rows={rows}
          collectionMode={table.collectionMode || 'single'}
          onClose={() => setRowForm(null)}
        />
      )}

      {deletingRow && (
        <ConfirmDialog
          title="删除记录"
          message="确定删除这条收集记录吗？此操作不可撤销。"
          confirmText="删除"
          danger
          onCancel={() => setDeletingRow(null)}
          onConfirm={async () => {
            await deleteRow(deletingRow.id)
            setDeletingRow(null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 表格：与统计视图一致的精简表格，无字段管理/排序控件
// ---------------------------------------------------------------------------

function OwnedGrid({ fields, rows, onEditRow, onDeleteRow }) {
  return (
    <div className="data-grid-scroll">
      <table className="data-grid">
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field.id} data-field-key={field.key}>{field.name}</th>
            ))}
            <th className="th-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="data-grid-row">
              {fields.map((field) => (
                <td key={field.id} data-field-key={field.key}>
                  <CellView field={field} row={row} allFields={fields} mode="table" />
                </td>
              ))}
              <td className="td-actions">
                <span className="data-grid-actions">
                  <IconButton icon={Pencil} title="编辑" onClick={() => onEditRow(row)} />
                  <IconButton
                    icon={Trash2}
                    variant="danger"
                    title="删除"
                    onClick={() => onDeleteRow(row)}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 新增 / 编辑记录弹窗
// ---------------------------------------------------------------------------

function OwnedFormModal({ table, fields, row, rows, collectionMode, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {}
    fields.forEach((f) => {
      init[f.key] = row?.values?.[f.key] ?? defaultValueForType(f.type)
    })
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const refField = fields.find((field) => field.type === 'reference')
  const referencedRows = useLiveQuery(
    () => refField?.referenceTableId
      ? db.catalogRows.where('tableId').equals(refField.referenceTableId).toArray()
      : [],
    [refField?.referenceTableId || ''],
  )
  const selectedRefRow = referencedRows?.find((item) => item.id === values[refField?.key])
  const selectedHasShinyForm = selectedRefRow?.values?.shiny === 'yes' || selectedRefRow?.values?.shiny === true
  const shinyBlocked = values.shiny === 'yes' && selectedRefRow && !selectedHasShinyForm

  function setFieldValue(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (shinyBlocked) {
      setError('资料库标记该精灵无异色形态，不能把这只拥有记录标为异色个体。')
      return
    }
    setSaving(true)
    if (row) {
      await updateRow(row.id, { ...row.values, ...values })
    } else {
      const refField = fields.find((field) => field.type === 'reference')
      const duplicate = collectionMode === 'single' && refField
        ? rows.find((item) =>
            item.values?.[refField.key] && item.values?.[refField.key] === values[refField.key],
          )
        : null
      if (duplicate) await updateRow(duplicate.id, { ...duplicate.values, ...values })
      else await createRow(table.id, values)
    }
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      title={row ? '编辑记录' : '新增记录'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="owned-form" className="btn btn-primary" disabled={saving}>
            保存
          </button>
        </>
      }
    >
      <form id="owned-form" onSubmit={handleSubmit} className="stack-form">
        {error && <div className="form-error">{error}</div>}
        {fields.map((field) => (
          <FormRow key={field.id} label={field.name}>
            <FieldInput
              field={field}
              value={values[field.key]}
              onChange={(v) => setFieldValue(field.key, v)}
            />
            {field.key === 'shiny' && shinyBlocked && (
              <div className="form-error">资料库「异色形态」为无，不能选择异色个体。</div>
            )}
          </FormRow>
        ))}
      </form>
    </Modal>
  )
}
