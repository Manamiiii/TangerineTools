// 条件统计工具：固定字段（名称/等级/分类/状态/备注）的记录列表，
// 支持新增/编辑/删除，以及按分类、按等级阈值、按状态的统计视图。
// 数据复用资料库的 catalogTables/catalogFields/catalogRows（kind: 'stock'），
// 与资料库工具的普通资料表相互隔离。

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, Pencil, Plus, Trash2 } from 'lucide-react'
import { createRow, db, deleteRow, ensureStockTable, updateRow } from '../db.js'
import { countByLevelAtLeast, countByStatus, groupByCategory } from '../domain/stock.js'
import { ConfirmDialog, EmptyState, FormRow, IconButton, Modal, OptionTag } from './common.jsx'
import { CellView, FieldInput } from './catalog.jsx'

export function StockTool({ scene }) {
  useEffect(() => {
    ensureStockTable(scene.id)
  }, [scene.id])

  const table = useLiveQuery(
    () =>
      db.catalogTables
        .where('sceneId')
        .equals(scene.id)
        .filter((t) => t.kind === 'stock')
        .first(),
    [scene.id],
  )

  if (!table) return null

  return <StockTableView table={table} />
}

function StockTableView({ table }) {
  const fields = useLiveQuery(
    () => db.catalogFields.where('tableId').equals(table.id).sortBy('order'),
    [table.id],
  )
  const rows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(table.id).toArray(),
    [table.id],
  )

  const [statsOpen, setStatsOpen] = useState(false)
  const [rowForm, setRowForm] = useState(null) // null | 'new' | row
  const [deletingRow, setDeletingRow] = useState(null)

  if (!fields || !rows) return null

  const sortedFields = [...fields].sort((a, b) => a.order - b.order)

  return (
    <div className="table-view">
      <div className="toolbar toolbar-catalog">
        <span className="toolbar-spacer" />
        <IconButton
          icon={BarChart3}
          label="统计"
          active={statsOpen}
          onClick={() => setStatsOpen((v) => !v)}
        />
        <IconButton icon={Plus} label="新增记录" variant="primary" onClick={() => setRowForm('new')} />
      </div>

      {statsOpen && <StockStatsPanel rows={rows} />}

      {rows.length === 0 ? (
        <EmptyState
          title="还没有统计记录"
          description="点击“新增记录”添加第一条可统计记录。"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setRowForm('new')}>
              新增记录
            </button>
          }
        />
      ) : (
        <StockGrid
          fields={sortedFields}
          rows={rows}
          onEditRow={setRowForm}
          onDeleteRow={setDeletingRow}
        />
      )}

      {rowForm && (
        <StockFormModal
          table={table}
          fields={sortedFields}
          row={rowForm === 'new' ? null : rowForm}
          onClose={() => setRowForm(null)}
        />
      )}

      {deletingRow && (
        <ConfirmDialog
          title="删除记录"
          message="确定删除这条统计记录吗？此操作不可撤销。"
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
// 紧凑表格：固定字段，无字段管理/排序/筛选控件
// ---------------------------------------------------------------------------

function StockGrid({ fields, rows, onEditRow, onDeleteRow }) {
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
// 新增 / 编辑记录弹窗
// ---------------------------------------------------------------------------

function StockFormModal({ table, fields, row, onClose }) {
  const [values, setValues] = useState(() => {
    const init = {}
    fields.forEach((f) => {
      init[f.key] = row?.values?.[f.key] ?? (f.type === 'number' ? '' : '')
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
      title={row ? '编辑记录' : '新增记录'}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="stock-form" className="btn btn-primary" disabled={saving}>
            保存
          </button>
        </>
      }
    >
      <form id="stock-form" onSubmit={handleSubmit} className="stack-form">
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
// 统计视图：按分类分组计数 / 按状态计数 / 等级达标计数
// ---------------------------------------------------------------------------

function StockStatsPanel({ rows }) {
  const [threshold, setThreshold] = useState(10)
  const categoryStats = groupByCategory(rows)
  const statusStats = countByStatus(rows)
  const levelCount = countByLevelAtLeast(rows, threshold)

  return (
    <div className="stock-stats-panel">
      <div className="stock-stats-card">
        <div className="stock-stats-card-title">按分类统计</div>
        <ul className="stock-stats-list">
          {categoryStats.map((s) => (
            <li key={s.category}>
              <span>{s.category}</span>
              <span className="stock-stats-count">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>

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
        <div className="stock-stats-card-title">等级达标统计</div>
        <label className="stock-stats-threshold">
          等级 ≥
          <input
            type="number"
            className="input"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 0)}
          />
          的记录数
        </label>
        <div className="stock-stats-count stock-stats-count-lg">{levelCount}</div>
      </div>
    </div>
  )
}
