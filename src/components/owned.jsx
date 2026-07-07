// 个体清单工具：记录场景下用户具体拥有的个体（例如洛克王国里的每一只
// 已捕获、正在培养的精灵）。字段是固定的（精灵/昵称/等级/性格方向/血脉/
// 状态/异色/获取日期/备注），支持增删改查、搜索、统计视图。
//
// 数据复用资料库的 catalogTables/catalogFields/catalogRows（kind: 'owned'），
// 与资料库、条件统计均相互隔离。ref 字段绑定到当前场景的普通资料表
// （例如"精灵图鉴"），因此可以复用 catalog 的 ReferenceCellView/Input。

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { createRow, db, deleteRow, ensureOwnedTable, updateRow } from '../db.js'
import {
  OWNED_SHINY_OPTIONS,
  countByBloodline,
  countByStatus,
  countShiny,
  matchesOwnedSearch,
} from '../domain/owned.js'
import { ConfirmDialog, EmptyState, FormRow, IconButton, Modal, OptionTag } from './common.jsx'
import { CellView, FieldInput } from './catalog.jsx'

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

function OwnedTableView({ table, sceneId }) {
  const fields = useLiveQuery(
    () => db.catalogFields.where('tableId').equals(table.id).sortBy('order'),
    [table.id],
  )
  const rows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(table.id).toArray(),
    [table.id],
  )
  // 个体清单的 ref 字段引用的资料表内容用于把关键字扩展到"被引用行的名称"，
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

  const [statsOpen, setStatsOpen] = useState(false)
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

  return (
    <div className="table-view">
      <div className="toolbar toolbar-catalog">
        <div className="owned-search">
          <Search size={14} />
          <input
            className="input owned-search-input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索昵称 / 精灵名 / 备注"
          />
        </div>
        <span className="toolbar-spacer" />
        <IconButton
          icon={BarChart3}
          label="统计"
          active={statsOpen}
          onClick={() => setStatsOpen((v) => !v)}
        />
        <IconButton
          icon={Plus}
          label="新增个体"
          variant="primary"
          onClick={() => setRowForm('new')}
        />
      </div>

      {statsOpen && <OwnedStatsPanel rows={rows} />}

      {rows.length === 0 ? (
        <EmptyState
          title="还没有个体记录"
          description={'点击"新增个体"记录第一只已拥有 / 培养中的精灵。'}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setRowForm('new')}>
              新增个体
            </button>
          }
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState title="没有匹配的个体" description="试试更换关键字或清空搜索框。" />
      ) : (
        <OwnedGrid
          fields={sortedFields}
          rows={filteredRows}
          onEditRow={setRowForm}
          onDeleteRow={setDeletingRow}
        />
      )}

      {rowForm && (
        <OwnedFormModal
          table={table}
          fields={sortedFields}
          row={rowForm === 'new' ? null : rowForm}
          onClose={() => setRowForm(null)}
        />
      )}

      {deletingRow && (
        <ConfirmDialog
          title="删除个体"
          message="确定删除这条个体清单记录吗？此操作不可撤销。"
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
// 表格：与条件统计一致的精简表格，无字段管理/排序控件
// ---------------------------------------------------------------------------

function OwnedGrid({ fields, rows, onEditRow, onDeleteRow }) {
  return (
    <div className="data-grid-scroll">
      <table className="data-grid">
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field.id}>{field.name}</th>
            ))}
            <th className="th-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="data-grid-row">
              {fields.map((field) => (
                <td key={field.id}>
                  <CellView field={field} row={row} allFields={fields} mode="table" />
                </td>
              ))}
              <td className="td-actions">
                <IconButton icon={Pencil} title="编辑" onClick={() => onEditRow(row)} />
                <IconButton
                  icon={Trash2}
                  variant="danger"
                  title="删除"
                  onClick={() => onDeleteRow(row)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 新增 / 编辑个体弹窗
// ---------------------------------------------------------------------------

function OwnedFormModal({ table, fields, row, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {}
    fields.forEach((f) => {
      init[f.key] = row?.values?.[f.key] ?? ''
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  function setFieldValue(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (row) {
      await updateRow(row.id, { ...row.values, ...values })
    } else {
      await createRow(table.id, values)
    }
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      title={row ? '编辑个体' : '新增个体'}
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
        {fields.map((field) => (
          <FormRow key={field.id} label={field.name}>
            <FieldInput
              field={field}
              value={values[field.key]}
              onChange={(v) => setFieldValue(field.key, v)}
            />
          </FormRow>
        ))}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// 统计视图：按状态 / 血脉 / 异色分别汇总
// ---------------------------------------------------------------------------

function OwnedStatsPanel({ rows }) {
  const statusStats = countByStatus(rows)
  const bloodlineStats = countByBloodline(rows)
  const shinyCount = countShiny(rows)
  const shinyOption = OWNED_SHINY_OPTIONS.find((o) => o.value === 'yes')

  return (
    <div className="stock-stats-panel">
      <div className="stock-stats-card">
        <div className="stock-stats-card-title">按状态统计</div>
        <ul className="stock-stats-list">
          {statusStats.map((s) => (
            <li key={s.value}>
              <OptionTag option={s} size="sm" />
              <span className="stock-stats-count">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="stock-stats-card">
        <div className="stock-stats-card-title">按血脉统计</div>
        <ul className="stock-stats-list">
          {bloodlineStats.map((s) => (
            <li key={s.value}>
              <OptionTag option={s} size="sm" />
              <span className="stock-stats-count">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="stock-stats-card">
        <div className="stock-stats-card-title">异色统计</div>
        <div className="owned-shiny-row">
          {shinyOption ? <OptionTag option={shinyOption} size="sm" /> : null}
          <span className="stock-stats-count stock-stats-count-lg">{shinyCount}</span>
        </div>
        <p className="owned-shiny-hint">
          共 {rows.length} 条记录，异色占比 {rows.length ? Math.round((shinyCount / rows.length) * 100) : 0}%
        </p>
      </div>
    </div>
  )
}
