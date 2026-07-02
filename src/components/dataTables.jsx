// 资料库工具：资料表切换 + 统一工具栏（搜索 → 资料表选择 → 筛选 → 主要操作）
// + 数据表格 + 分页 + 行新增/编辑弹窗 + 行详情页。

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Filter, Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import { DEFAULT_PAGE_SIZE, isEditableFieldType } from '../constants.js'
import {
  createCatalogTable,
  createField,
  createRow,
  db,
  deleteCatalogTable,
  deleteField,
  deleteRow,
  renameCatalogTable,
  updateField,
  updateRow,
} from '../db.js'
import {
  compareRowsBySort,
  hasActiveFilters,
  paginate,
  rowMatchesFilters,
  rowMatchesSearch,
  totalPages,
} from '../utils.js'
import {
  buildFormComparisonRows,
  buildFormComparisonSummary,
  findNumberField,
  getSameNumberRows,
} from '../domain/rockKingdom.js'
import {
  ConfirmDialog,
  EmptyState,
  FormRow,
  IconButton,
  Modal,
  Pagination,
  Popover,
} from './common.jsx'
import { CellView, DataGrid, FieldInput, FieldManagerModal, FilterPanel } from './catalog.jsx'

// ---------------------------------------------------------------------------
// 资料库：管理场景下的资料表，展示当前选中资料表的工作台
// ---------------------------------------------------------------------------

export function CatalogTool({ scene }) {
  const tables = useLiveQuery(
    () =>
      db.catalogTables
        .where('sceneId')
        .equals(scene.id)
        .filter((t) => t.kind !== 'stock')
        .sortBy('order'),
    [scene.id],
  )
  const [activeTableId, setActiveTableId] = useState(null)
  const [creating, setCreating] = useState(false)

  if (!tables) return null

  const activeTable = tables.find((t) => t.id === activeTableId) || tables[0] || null

  if (tables.length === 0) {
    return (
      <div className="table-view">
        <EmptyState
          title="还没有资料表"
          description="创建一个资料表，开始记录结构化数据。"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              新建资料表
            </button>
          }
        />
        {creating && (
          <TableNameModal
            title="新建资料表"
            onClose={() => setCreating(false)}
            onSubmit={async (name) => {
              const table = await createCatalogTable(scene.id, name)
              setActiveTableId(table.id)
              setCreating(false)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <TableView
      key={activeTable.id}
      table={activeTable}
      tables={tables}
      sceneId={scene.id}
      onSwitchTable={setActiveTableId}
    />
  )
}

function TableNameModal({ title, initialName = '', onClose, onSubmit }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSubmit(name.trim())
    setSaving(false)
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={400}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="table-name-form" className="btn btn-primary" disabled={saving}>
            保存
          </button>
        </>
      }
    >
      <form id="table-name-form" onSubmit={handleSubmit} className="stack-form">
        <FormRow label="名称">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：精灵基础资料"
            autoFocus
          />
        </FormRow>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// 单个资料表的工作台：工具栏 + 数据表格 + 分页 + 各类弹窗
// ---------------------------------------------------------------------------

function TableView({ table, tables, sceneId, onSwitchTable }) {
  const fields = useLiveQuery(
    () => db.catalogFields.where('tableId').equals(table.id).sortBy('order'),
    [table.id],
  )
  const rows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(table.id).toArray(),
    [table.id],
  )

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const [filterOpen, setFilterOpen] = useState(false)
  const [focusFilterKey, setFocusFilterKey] = useState(null)
  const [fieldManagerOpen, setFieldManagerOpen] = useState(false)
  const [focusFieldId, setFocusFieldId] = useState(null)
  const [rowForm, setRowForm] = useState(null) // null | 'new' | row
  const [rowDetail, setRowDetail] = useState(null)
  const [deletingRow, setDeletingRow] = useState(null)
  const [tableModal, setTableModal] = useState(null) // null | 'new' | 'rename'
  const [deletingTable, setDeletingTable] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, filters])

  if (!fields || !rows) return null

  const sortedFields = [...fields].sort((a, b) => a.order - b.order)

  const filteredRows = rows
    .filter((r) => rowMatchesSearch(r, sortedFields, search))
    .filter((r) => rowMatchesFilters(r, sortedFields, filters))
    .sort((a, b) => compareRowsBySort(a, b, sort, sortedFields))

  const pageCount = totalPages(filteredRows.length, pageSize)
  const pageRows = paginate(filteredRows, page, pageSize)

  function handleSortChange(fieldKey, direction) {
    if (direction !== 'toggle') {
      setSort({ fieldKey, direction })
      return
    }
    setSort((prev) => {
      if (!prev || prev.fieldKey !== fieldKey) return { fieldKey, direction: 'asc' }
      if (prev.direction === 'asc') return { fieldKey, direction: 'desc' }
      return null
    })
  }

  async function handleInsertField(atIndex) {
    const field = await createField(table.id, { name: '新字段', type: 'text' }, atIndex)
    setFieldManagerOpen(true)
    setFocusFieldId(field.id)
  }

  function openFilterFor(fieldKey) {
    setFilterOpen(true)
    setFocusFilterKey(fieldKey)
  }

  async function handleDeleteCurrentTable() {
    await deleteCatalogTable(table.id)
    const remaining = tables.filter((t) => t.id !== table.id)
    onSwitchTable(remaining[0]?.id || null)
    setDeletingTable(false)
  }

  return (
    <div className="table-view">
      <div className="toolbar toolbar-catalog">
        <label className="search-box">
          <Search size={14} />
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索当前资料表…"
          />
        </label>

        <div className="table-selector">
          <select
            className="select"
            value={table.id}
            onChange={(e) => onSwitchTable(e.target.value)}
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <IconButton icon={Plus} title="新建资料表" onClick={() => setTableModal('new')} />
          <IconButton icon={Pencil} title="重命名资料表" onClick={() => setTableModal('rename')} />
          <IconButton
            icon={Trash2}
            variant="danger"
            title="删除资料表"
            disabled={tables.length <= 1}
            onClick={() => setDeletingTable(true)}
          />
        </div>

        <span className="toolbar-spacer" />

        <span className="popover-anchor">
          <IconButton
            icon={Filter}
            label="筛选"
            active={filterOpen || hasActiveFilters(filters)}
            onClick={() => setFilterOpen((v) => !v)}
          />
          <Popover open={filterOpen} onClose={() => setFilterOpen(false)} align="right">
            <FilterPanel
              fields={sortedFields}
              filters={filters}
              onChange={setFilters}
              focusFieldKey={focusFilterKey}
            />
          </Popover>
        </span>
        <IconButton icon={Settings2} label="字段管理" onClick={() => setFieldManagerOpen(true)} />
        <IconButton icon={Plus} label="新增行" variant="primary" onClick={() => setRowForm('new')} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="还没有数据"
          description="点击“新增行”添加第一条数据。"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setRowForm('new')}>
              新增行
            </button>
          }
        />
      ) : (
        <>
          <DataGrid
            fields={sortedFields}
            rows={pageRows}
            allFields={sortedFields}
            sort={sort}
            onSortChange={handleSortChange}
            onInsertField={handleInsertField}
            onEditField={(id) => {
              setFieldManagerOpen(true)
              setFocusFieldId(id)
            }}
            onHideField={(id) => updateField(id, { hidden: true })}
            onDeleteField={(id) => deleteField(id)}
            onOpenFilter={openFilterFor}
            onRowClick={(row) => setRowDetail(row)}
            onEditRow={(row) => setRowForm(row)}
            onDeleteRow={(row) => setDeletingRow(row)}
          />
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={filteredRows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
          />
        </>
      )}

      {fieldManagerOpen && (
        <FieldManagerModal
          tableId={table.id}
          fields={sortedFields}
          sceneTables={tables}
          focusFieldId={focusFieldId}
          onClose={() => {
            setFieldManagerOpen(false)
            setFocusFieldId(null)
          }}
        />
      )}

      {rowForm && (
        <RowFormModal
          table={table}
          fields={sortedFields}
          row={rowForm === 'new' ? null : rowForm}
          onClose={() => setRowForm(null)}
        />
      )}

      {rowDetail && (
        <RowDetailModal
          row={rowDetail}
          fields={sortedFields}
          rows={rows}
          onClose={() => setRowDetail(null)}
          onEdit={() => {
            setRowForm(rowDetail)
            setRowDetail(null)
          }}
          onDelete={() => {
            setDeletingRow(rowDetail)
            setRowDetail(null)
          }}
        />
      )}

      {deletingRow && (
        <ConfirmDialog
          title="删除行"
          message="确定删除这一行数据吗？此操作不可撤销。"
          confirmText="删除"
          danger
          onCancel={() => setDeletingRow(null)}
          onConfirm={async () => {
            await deleteRow(deletingRow.id)
            setDeletingRow(null)
          }}
        />
      )}

      {tableModal === 'new' && (
        <TableNameModal
          title="新建资料表"
          onClose={() => setTableModal(null)}
          onSubmit={async (name) => {
            const created = await createCatalogTable(sceneId, name)
            setTableModal(null)
            onSwitchTable(created.id)
          }}
        />
      )}

      {tableModal === 'rename' && (
        <TableNameModal
          title="重命名资料表"
          initialName={table.name}
          onClose={() => setTableModal(null)}
          onSubmit={async (name) => {
            await renameCatalogTable(table.id, name)
            setTableModal(null)
          }}
        />
      )}

      {deletingTable && (
        <ConfirmDialog
          title="删除资料表"
          message={`确定删除资料表「${table.name}」吗？该表下的全部字段与行数据都会被一并删除，此操作不可撤销。`}
          confirmText="删除"
          danger
          onCancel={() => setDeletingTable(false)}
          onConfirm={handleDeleteCurrentTable}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 行新增 / 编辑弹窗
// ---------------------------------------------------------------------------

function defaultValueForType(type) {
  if (type === 'multiselect') return []
  if (type === 'boolean') return false
  return ''
}

function RowFormModal({ table, fields, row, onClose }) {
  const editableFields = fields.filter((f) => isEditableFieldType(f.type))
  const [values, setValues] = useState(() => {
    const init = {}
    editableFields.forEach((f) => {
      init[f.key] = row?.values?.[f.key] ?? defaultValueForType(f.type)
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
      title={row ? '编辑行' : '新增行'}
      onClose={onClose}
      width={640}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" form="row-form" className="btn btn-primary" disabled={saving}>
            保存
          </button>
        </>
      }
    >
      <form id="row-form" onSubmit={handleSubmit} className="stack-form row-form">
        {editableFields.map((field) => (
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
// 行详情页（弹窗形式，展示包括隐藏字段在内的全部字段）
// ---------------------------------------------------------------------------

function RowDetailModal({ row, fields, rows, onClose, onEdit, onDelete }) {
  const sorted = [...fields].sort((a, b) => a.order - b.order)
  const numberField = findNumberField(fields)
  const sameNumberRows = numberField ? getSameNumberRows(row, rows, fields) : []
  const comparisonRows = buildFormComparisonRows(sameNumberRows, fields)
  const comparisonSummary = buildFormComparisonSummary(comparisonRows)

  return (
    <Modal
      title="详情"
      onClose={onClose}
      width={680}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            关闭
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            删除
          </button>
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            编辑
          </button>
        </>
      }
    >
      <div className="row-detail">
        {sorted.map((field) => (
          <div key={field.id} className="row-detail-item">
            <div className="row-detail-label">
              {field.name}
              {field.hidden && <span className="filter-hidden-badge">隐藏列</span>}
            </div>
            <div className="row-detail-value">
              <CellView field={field} row={row} allFields={sorted} mode="detail" />
            </div>
          </div>
        ))}
      </div>

      {comparisonRows.length > 0 && (
        <FormComparisonSection rows={comparisonRows} summary={comparisonSummary} />
      )}
    </Modal>
  )
}

const MARK_LABELS = { highest: '最高', lowest: '最低' }

function FormComparisonSection({ rows, summary }) {
  const dims = rows[0]?.stats || []
  return (
    <div className="form-comparison">
      <div className="form-comparison-title">同编号形态对比</div>
      {summary && <p className="form-comparison-summary">{summary}</p>}
      <div className="form-comparison-scroll">
        <table className="form-comparison-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>形态</th>
              {dims.map((dim) => (
                <th key={dim.key}>
                  {dim.label}
                  {dim.mark === 'same' && <span className="form-comparison-same-badge">相同</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowId}>
                <td>{row.name}</td>
                <td>{row.form}</td>
                {row.stats.map((stat) => (
                  <td key={stat.key} className={`form-comparison-cell mark-${stat.mark}`}>
                    {stat.value}
                    {MARK_LABELS[stat.mark] && (
                      <span className="form-comparison-mark-badge">{MARK_LABELS[stat.mark]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
