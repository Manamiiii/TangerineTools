// 收集记录工具：记录“我与资料项的关系”。普通新建场景默认不预置字段，
// 可在字段管理里按场景自行配置；洛克王国预置场景会补齐精灵收集字段。
//
// 数据复用资料库的 catalogTables/catalogFields/catalogRows（kind: 'owned'），
// 与资料库、统计视图均相互隔离。reference 字段可绑定到当前场景的普通资料表
// （例如"精灵图鉴"），因此可以复用 catalog 的 ReferenceCellView/Input。

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, FilterX, ListChecks, Pencil, Plus, ScanLine, Search, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { createRow, db, deleteRow, ensureOwnedTable, updateRow, updateRows } from '../db.js'
import { matchesOwnedFieldFilters, matchesOwnedSearch, ownedFieldValue } from '../domain/owned.js'
import { valuesWithAppearance } from '../domain/rockKingdomScanner.js'
import { buildStockSummary, defaultStockGroupField } from '../domain/stock.js'
import { RockKingdomScannerModal } from '../features/rock-kingdom-scanner/RockKingdomScannerModal.jsx'
import { OwnedIntelligenceModal } from '../features/rock-kingdom-model/OwnedIntelligenceModal.jsx'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { ConfirmDialog, EmptyState, FormRow, IconButton, Modal, Pagination } from './common.jsx'
import { CellView, FieldInput, FieldManagerModal, fieldDisplayProps } from './catalog.jsx'

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

const FILTER_FIELD_TYPES = new Set(['select', 'multiselect', 'boolean', 'reference'])
const ROCK_BATCH_FIELD_KEYS = new Set(['nature', 'bloodline', 'appearance', 'specialty', 'gender'])

function filterOptionsForField(field, rows, referenceNameMap) {
  if (field.type === 'boolean') {
    return [
      { value: 'true', label: '是' },
      { value: 'false', label: '否' },
    ]
  }
  const present = new Set()
  for (const row of rows) {
    const raw = ownedFieldValue(row, field)
    if (Array.isArray(raw)) raw.forEach((value) => present.add(String(value)))
    else if (raw != null && raw !== '') present.add(String(raw))
  }
  if (field.type === 'reference') {
    return [...present]
      .map((value) => ({ value, label: referenceNameMap?.get(value) || value }))
      .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'))
  }
  return (field.options || [])
    .filter((option) => present.has(String(option.value)))
    .map((option) => ({ value: String(option.value), label: option.label || String(option.value) }))
}

function searchableRowMatch(row, keyword, refField, referenceNameMap) {
  if (matchesOwnedSearch(row, keyword)) return true
  if (!refField) return false
  const refName = referenceNameMap?.get(row.values?.[refField.key]) || ''
  return refName.toLowerCase().includes((keyword || '').trim().toLowerCase())
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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [batchOpen, setBatchOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryFieldKey, setSummaryFieldKey] = useState('')
  const [intelligenceOpen, setIntelligenceOpen] = useState(false)

  const filteredRows = useMemo(() => {
    if (!rows || !fields) return []
    const refField = fields.find((f) => f.type === 'reference')
    const nameMap = refField?.referenceTableId ? refFieldRows?.[refField.referenceTableId] : null
    return rows.filter((row) =>
      searchableRowMatch(row, keyword, refField, nameMap)
      && matchesOwnedFieldFilters(row, fields, filters),
    )
  }, [rows, fields, refFieldRows, keyword, filters])

  useEffect(() => {
    setPage(1)
  }, [keyword, filters])

  useEffect(() => {
    if (!rows) return
    const rowIds = new Set(rows.map((row) => row.id))
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => rowIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [rows])

  if (!fields || !rows) return null

  const sortedFields = [...fields].sort((a, b) => a.order - b.order)
  const visibleFields = sortedFields.filter((field) => !field.hidden)
  const refField = sortedFields.find((field) => field.type === 'reference')
  const referenceNameMap = refField?.referenceTableId ? refFieldRows?.[refField.referenceTableId] : null
  const filterFields = visibleFields.filter((field) =>
    FILTER_FIELD_TYPES.has(field.type)
    && !(sceneId === ROCK_KINGDOM_PRESET.scene.id && ['shiny', 'colorful'].includes(field.key)),
  )
  const activeFilterCount = Object.values(filters).filter(Boolean).length
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)
  const selectedRows = rows.filter((row) => selectedIds.has(row.id))
  const summaryFields = filterFields
  const defaultSummaryField = summaryFields.find((field) => field.key === 'appearance')
    || defaultStockGroupField(summaryFields)
  const summarySourceField = summaryFields.find((field) => field.key === summaryFieldKey)
    || defaultSummaryField
  const summaryField = summarySourceField?.type === 'reference'
    ? {
        ...summarySourceField,
        type: 'select',
        options: filterOptionsForField(summarySourceField, rows, referenceNameMap),
      }
    : summarySourceField
  const summaryRows = summarySourceField?.key === 'appearance'
    ? filteredRows.map((row) => ({
        ...row,
        values: { ...row.values, appearance: ownedFieldValue(row, summarySourceField) },
      }))
    : filteredRows
  const summary = buildStockSummary(summaryRows, summaryField)

  function setFieldFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function toggleRow(id) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePageRows() {
    const allSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id))
    setSelectedIds((current) => {
      const next = new Set(current)
      pageRows.forEach((row) => {
        if (allSelected) next.delete(row.id)
        else next.add(row.id)
      })
      return next
    })
  }

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
        {sceneId === ROCK_KINGDOM_PRESET.scene.id && (
          <IconButton
            icon={ScanLine}
            label="扫描录入"
            disabled={visibleFields.length === 0}
            onClick={() => setScannerOpen(true)}
          />
        )}
        <IconButton
          icon={ListChecks}
          label={selectedIds.size > 0 ? `批量修改 ${selectedIds.size}` : '批量修改'}
          disabled={selectedIds.size === 0}
          onClick={() => setBatchOpen(true)}
        />
        {sceneId === ROCK_KINGDOM_PRESET.scene.id && (
          <IconButton
            icon={Sparkles}
            label={selectedIds.size > 0 ? `智能检查 ${selectedIds.size}` : '智能检查'}
            disabled={selectedIds.size === 0}
            onClick={() => setIntelligenceOpen(true)}
          />
        )}
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

      {rows.length > 0 && filterFields.length > 0 && (
        <div className="owned-filter-panel">
          <div className="owned-filter-fields">
            {filterFields.map((field) => (
              <label key={field.id} className="owned-filter-control">
                <span>{field.name}</span>
                <select
                  className="select"
                  value={filters[field.key] || ''}
                  onChange={(event) => setFieldFilter(field.key, event.target.value)}
                >
                  <option value="">全部</option>
                  {filterOptionsForField(field, rows, referenceNameMap).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="owned-filter-actions">
            <span>显示 {filteredRows.length} / {rows.length} 条</span>
            <button
              type="button"
              className="btn btn-xs"
              disabled={!keyword && activeFilterCount === 0}
              onClick={() => {
                setKeyword('')
                setFilters({})
              }}
            >
              <FilterX size={13} /> 清空条件
            </button>
            <button
              type="button"
              className={`btn btn-xs ${summaryOpen ? 'btn-primary' : ''}`}
              onClick={() => setSummaryOpen((value) => !value)}
            >
              <BarChart3 size={13} /> 统计摘要
            </button>
          </div>
        </div>
      )}

      {summaryOpen && rows.length > 0 && (
        <section className="owned-summary" aria-label="收集记录统计摘要">
          <div className="owned-summary-heading">
            <div>
              <strong>当前筛选统计</strong>
              <span>共 {rows.length} 条，当前条件命中 {filteredRows.length} 条</span>
            </div>
            <label>
              按字段
              <select
                className="select"
                value={summarySourceField?.key || ''}
                onChange={(event) => setSummaryFieldKey(event.target.value)}
              >
                {summaryFields.map((field) => (
                  <option key={field.id} value={field.key}>{field.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="owned-summary-groups">
            {summary.groups.length === 0 ? (
              <span>当前条件没有可统计记录。</span>
            ) : summary.groups.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedIds.size > 0 && (
        <div className="owned-selection-bar">
          <span>已选择 {selectedIds.size} 条记录</span>
          <button type="button" className="btn btn-xs" onClick={() => setSelectedIds(new Set())}>取消选择</button>
          <button type="button" className="btn btn-primary btn-xs" onClick={() => setBatchOpen(true)}>
            批量修改
          </button>
        </div>
      )}

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
          rows={pageRows}
          selectedIds={selectedIds}
          allPageSelected={pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id))}
          onToggleRow={toggleRow}
          onTogglePage={togglePageRows}
          onEditRow={setRowForm}
          onDeleteRow={setDeletingRow}
        />
      )}

      {filteredRows.length > 0 && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={filteredRows.length}
          pageSizeOptions={[20, 50, 100]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
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

      {scannerOpen && (
        <RockKingdomScannerModal
          table={table}
          fields={visibleFields}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {batchOpen && (
        <OwnedBatchEditModal
          fields={visibleFields}
          rows={selectedRows}
          rockKingdom={sceneId === ROCK_KINGDOM_PRESET.scene.id}
          onClose={() => setBatchOpen(false)}
          onSaved={() => {
            setBatchOpen(false)
            setSelectedIds(new Set())
          }}
        />
      )}

      {intelligenceOpen && (
        <OwnedIntelligenceModal
          rows={selectedRows}
          fields={visibleFields}
          onClose={() => setIntelligenceOpen(false)}
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

function OwnedGrid({
  fields,
  rows,
  selectedIds,
  allPageSelected,
  onToggleRow,
  onTogglePage,
  onEditRow,
  onDeleteRow,
}) {
  return (
    <div className="data-grid-scroll">
      <table className="data-grid">
        <thead>
          <tr>
            <th className="owned-select-column">
              <input
                type="checkbox"
                aria-label="选择本页全部记录"
                checked={allPageSelected}
                onChange={onTogglePage}
              />
            </th>
            {fields.map((field) => (
              <th key={field.id} {...fieldDisplayProps(field)}>{field.name}</th>
            ))}
            <th className="th-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`data-grid-row ${selectedIds.has(row.id) ? 'owned-row-selected' : ''}`}>
              <td className="owned-select-column">
                <input
                  type="checkbox"
                  aria-label="选择这条记录"
                  checked={selectedIds.has(row.id)}
                  onChange={() => onToggleRow(row.id)}
                />
              </td>
              {fields.map((field) => (
                <td key={field.id} {...fieldDisplayProps(field)}>
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

function OwnedBatchEditModal({ fields, rows, rockKingdom, onClose, onSaved }) {
  const editableFields = fields.filter((field) => {
    if (field.type === 'stats' || field.type === 'reference' || field.type === 'references' || field.type === 'image') return false
    if (rockKingdom) return ROCK_BATCH_FIELD_KEYS.has(field.key)
    return true
  })
  const [fieldKey, setFieldKey] = useState(editableFields[0]?.key || '')
  const [value, setValue] = useState(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const field = editableFields.find((item) => item.key === fieldKey) || editableFields[0]

  async function applyBatch() {
    if (!field || value === undefined || rows.length === 0) return
    setSaving(true)
    setError('')
    try {
      await updateRows(rows.map((row) => {
        const next = { ...row.values, [field.key]: value }
        return {
          id: row.id,
          values: field.key === 'appearance' ? valuesWithAppearance(next) : next,
        }
      }))
      onSaved()
    } catch (batchError) {
      setError(batchError.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`批量修改 ${rows.length} 条记录`}
      onClose={onClose}
      width={500}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>取消</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={applyBatch}
            disabled={saving || !field || value === undefined}
          >
            {saving ? '正在修改…' : `应用到 ${rows.length} 条记录`}
          </button>
        </>
      }
    >
      <div className="stack-form">
        <p className="owned-batch-note">
          只修改下面选择的一个字段；其他字段、未勾选记录和现有精灵引用保持不变。
        </p>
        {error && <div className="form-error">{error}</div>}
        {editableFields.length === 0 ? (
          <EmptyState title="没有可批量修改的字段" description="引用资料和派生字段不会参与批量修改。" />
        ) : (
          <>
            <FormRow label="修改字段">
              <select
                className="select"
                value={field?.key || ''}
                onChange={(event) => {
                  setFieldKey(event.target.value)
                  setValue(undefined)
                }}
              >
                {editableFields.map((item) => (
                  <option key={item.id} value={item.key}>{item.name}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="统一修改为">
              <FieldInput
                field={field}
                value={value ?? defaultValueForType(field.type)}
                onChange={setValue}
              />
              {value === undefined && <small className="owned-batch-help">请选择目标值后才能应用。</small>}
            </FormRow>
          </>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// 新增 / 编辑记录弹窗
// ---------------------------------------------------------------------------

export function OwnedFormModal({ table, fields, row, rows, collectionMode, initialValues = {}, onClose, onSaved }) {
  const [values, setValues] = useState(() => {
    const init = {}
    fields.forEach((f) => {
      init[f.key] = row?.values?.[f.key] ?? initialValues[f.key] ?? defaultValueForType(f.type)
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
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      return key === 'appearance' && value ? valuesWithAppearance(next) : next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (shinyBlocked) {
      setError('资料库标记该精灵无异色形态，不能把这只拥有记录标为异色个体。')
      return
    }
    setSaving(true)
    const savedValues = values.appearance ? valuesWithAppearance(values) : values
    if (row) {
      await updateRow(row.id, { ...row.values, ...savedValues })
    } else {
      const refField = fields.find((field) => field.type === 'reference')
      const duplicate = collectionMode === 'single' && refField
        ? rows.find((item) =>
            item.values?.[refField.key] && item.values?.[refField.key] === savedValues[refField.key],
          )
        : null
      if (duplicate) await updateRow(duplicate.id, { ...duplicate.values, ...savedValues })
      else await createRow(table.id, savedValues)
    }
    setSaving(false)
    onSaved?.({ ...savedValues })
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
