// 资料库通用控件：字段管理弹窗、列头菜单、单元格展示/编辑组件。
// 这些是资料表格的底层构件，被 dataTables.jsx 中的资料库/资料表/详情页组合使用。

import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { FIELD_TYPES, isOptionFieldType, STATS_DIMENSIONS } from '../constants.js'
import { createField, db, deleteField, reorderFields, updateField } from '../db.js'
import { generateId, getStatsValues, resolveStatsMapping, stringifyCellValue } from '../utils.js'
import {
  ClampText,
  ColorSwatchPicker,
  DragHandle,
  Ellipsis,
  IconButton,
  Modal,
  OptionTag,
  Popover,
  StatsChart,
  useDragReorder,
} from './common.jsx'

// ---------------------------------------------------------------------------
// 字段管理弹窗
// ---------------------------------------------------------------------------

export function FieldManagerModal({ tableId, fields, sceneTables, onClose, focusFieldId }) {
  const sorted = [...fields].sort((a, b) => a.order - b.order)
  const { onDragStart, onDragOver, onDrop } = useDragReorder(sorted, (next) => {
    reorderFields(next.map((f) => f.id))
  })

  useEffect(() => {
    if (!focusFieldId) return
    document.getElementById(`field-row-${focusFieldId}`)?.scrollIntoView({ block: 'center' })
  }, [focusFieldId])

  async function handleAddField() {
    await createField(tableId, { name: '新字段', type: 'text' })
  }

  return (
    <Modal
      title="字段管理"
      onClose={onClose}
      width={680}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          完成
        </button>
      }
    >
      <div className="field-manager">
        {sorted.map((field, index) => (
          <div
            key={field.id}
            id={`field-row-${field.id}`}
            className={`field-row-card ${focusFieldId === field.id ? 'field-row-focus' : ''}`}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(index)}
          >
            <FieldRow field={field} allFields={sorted} sceneTables={sceneTables} />
          </div>
        ))}
        <button type="button" className="btn btn-dashed" onClick={handleAddField}>
          <Plus size={14} /> 添加字段
        </button>
      </div>
    </Modal>
  )
}

async function handleTypeChange(field, nextType) {
  const patch = { type: nextType }
  if (!isOptionFieldType(nextType)) {
    patch.options = []
  } else if (!field.options || field.options.length === 0) {
    patch.options = [{ value: generateId('opt'), label: '选项 1', color: '#64748b', image: '' }]
  }
  if (nextType !== 'stats') {
    patch.statsMap = {}
    patch.statsDimensions = []
  } else {
    patch.statsStyle = field.statsStyle || 'bars'
  }
  if (nextType !== 'reference') patch.referenceTableId = null
  await updateField(field.id, patch)
}

function FieldRow({ field, allFields, sceneTables }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="field-row">
      <div className="field-row-main">
        <DragHandle />
        <input
          className="input field-name-input"
          value={field.name}
          onChange={(e) => updateField(field.id, { name: e.target.value })}
        />
        <select
          className="select field-type-select"
          value={field.type}
          onChange={(e) => handleTypeChange(field, e.target.value)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="field-hidden-toggle">
          <input
            type="checkbox"
            checked={field.hidden}
            onChange={(e) => updateField(field.id, { hidden: e.target.checked })}
          />
          隐藏
        </label>
        {confirmingDelete ? (
          <span className="field-delete-confirm">
            <button
              type="button"
              className="btn btn-danger btn-xs"
              onClick={() => deleteField(field.id)}
            >
              确认删除
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setConfirmingDelete(false)}>
              取消
            </button>
          </span>
        ) : (
          <IconButton
            icon={Trash2}
            variant="danger"
            title="删除字段"
            onClick={() => setConfirmingDelete(true)}
          />
        )}
      </div>

      {isOptionFieldType(field.type) && (
        <div className="field-row-section">
          <OptionsEditor field={field} />
        </div>
      )}

      {field.type === 'stats' && (
        <div className="field-row-section">
          <StatsMappingEditor field={field} allFields={allFields} />
        </div>
      )}

      {field.type === 'reference' && (
        <div className="field-row-section">
          <ReferenceTableEditor field={field} sceneTables={sceneTables || []} />
        </div>
      )}
    </div>
  )
}

function OptionsEditor({ field }) {
  const options = field.options || []
  const { onDragStart, onDragOver, onDrop } = useDragReorder(options, (next) => {
    updateField(field.id, { options: next })
  })

  function updateOption(value, patch) {
    const next = options.map((o) => (o.value === value ? { ...o, ...patch } : o))
    updateField(field.id, { options: next })
  }

  function addOption() {
    const next = [
      ...options,
      { value: generateId('opt'), label: `选项 ${options.length + 1}`, color: '#64748b', image: '' },
    ]
    updateField(field.id, { options: next })
  }

  function removeOption(value) {
    updateField(field.id, { options: options.filter((o) => o.value !== value) })
  }

  return (
    <div className="options-editor">
      <div className="options-editor-header">选项（拖拽调整顺序，点击色块选择颜色，图片可留空）</div>
      {options.map((opt, index) => (
        <div
          key={opt.value}
          className="option-row"
          draggable
          onDragStart={() => onDragStart(index)}
          onDragOver={onDragOver}
          onDrop={() => onDrop(index)}
        >
          <DragHandle />
          <input
            className="input option-label-input"
            value={opt.label}
            onChange={(e) => updateOption(opt.value, { label: e.target.value })}
            placeholder="选项名称"
          />
          <ColorSwatchPicker value={opt.color} onChange={(color) => updateOption(opt.value, { color })} />
          <input
            className="input option-image-input"
            value={opt.image || ''}
            onChange={(e) => updateOption(opt.value, { image: e.target.value })}
            placeholder="图片 URL（可留空）"
          />
          <IconButton icon={X} title="删除选项" onClick={() => removeOption(opt.value)} />
        </div>
      ))}
      <button type="button" className="btn btn-dashed btn-xs" onClick={addOption}>
        <Plus size={12} /> 添加选项
      </button>
    </div>
  )
}

function StatsMappingEditor({ field, allFields }) {
  const candidateFields = allFields.filter((f) => f.id !== field.id && f.type === 'number')
  const mapping = resolveStatsMapping(allFields, field.statsMap, field.statsDimensions)
  const dimensions =
    field.statsDimensions?.length > 0
      ? field.statsDimensions
      : STATS_DIMENSIONS.map((dim) => ({
          key: dim.key,
          label: dim.label,
          fieldKey: mapping[dim.key] || '',
        }))

  function commitDimensions(nextDimensions) {
    const nextMap = Object.fromEntries(nextDimensions.map((dim) => [dim.key, dim.fieldKey || null]))
    updateField(field.id, { statsDimensions: nextDimensions, statsMap: nextMap })
  }

  function updateDimension(index, patch) {
    const next = dimensions.map((dim, i) => (i === index ? { ...dim, ...patch } : dim))
    commitDimensions(next)
  }

  function addDimension() {
    const nextKey = generateId('stat')
    commitDimensions([
      ...dimensions,
      {
        key: nextKey,
        label: `指标 ${dimensions.length + 1}`,
        fieldKey: candidateFields[0]?.key || '',
      },
    ])
  }

  function removeDimension(index) {
    commitDimensions(dimensions.filter((_, i) => i !== index))
  }

  return (
    <div className="stats-mapping-editor">
      <div className="options-editor-header">指标视图（可映射任意数量值字段）</div>
      <label className="stats-style-row">
        <span>展示形式</span>
        <select
          className="select"
          value={field.statsStyle || 'bars'}
          onChange={(e) => updateField(field.id, { statsStyle: e.target.value })}
        >
          <option value="bars">条形列表（默认）</option>
          <option value="radar">雷达图</option>
        </select>
      </label>
      <div className="stats-mapping-grid stats-mapping-grid-wide">
        {dimensions.map((dim, index) => (
          <div key={dim.key} className="stats-mapping-row stats-mapping-row-editable">
            <input
              className="input"
              value={dim.label || ''}
              onChange={(e) => updateDimension(index, { label: e.target.value })}
              placeholder="指标名称"
            />
            <select
              className="select"
              value={dim.fieldKey || mapping[dim.key] || ''}
              onChange={(e) => updateDimension(index, { fieldKey: e.target.value })}
            >
              <option value="">自动识别</option>
              {candidateFields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name}
                </option>
              ))}
            </select>
            <IconButton icon={X} title="删除指标" onClick={() => removeDimension(index)} />
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-dashed btn-xs" onClick={addDimension}>
        <Plus size={12} /> 添加指标
      </button>
    </div>
  )
}

function ReferenceTableEditor({ field, sceneTables }) {
  return (
    <div className="stats-mapping-editor">
      <div className="options-editor-header">
        引用资料表：行编辑时会从该表选择一条记录，表格中显示被引用行的文本字段名称。
      </div>
      <select
        className="select"
        value={field.referenceTableId || ''}
        onChange={(e) => updateField(field.id, { referenceTableId: e.target.value || null })}
      >
        <option value="">未设置</option>
        {sceneTables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 引用类型：解析引用资料表的字段 / 行
// ---------------------------------------------------------------------------

function useReferenceContext(tableId) {
  const result = useLiveQuery(async () => {
    if (!tableId) return { fields: [], rows: [] }
    const [fields, rows] = await Promise.all([
      db.catalogFields.where('tableId').equals(tableId).sortBy('order'),
      db.catalogRows.where('tableId').equals(tableId).toArray(),
    ])
    return { fields, rows }
  }, [tableId])
  return result || { fields: [], rows: [] }
}

function referenceRowLabel(fields, row) {
  if (!row) return ''
  const labelField = fields.find((f) => f.type === 'text') || fields[0]
  if (!labelField) return row.id
  return stringifyCellValue(row.values?.[labelField.key], labelField) || row.id
}

function ReferenceCellView({ field, value, onOpenReference }) {
  const { fields, rows } = useReferenceContext(field.referenceTableId)
  if (!value) return <span className="cell-empty">—</span>
  const row = rows.find((r) => r.id === value)
  const label = row ? referenceRowLabel(fields, row) : value
  if (!row || !onOpenReference) return <span className="reference-tag">{label}</span>
  return (
    <button
      type="button"
      className="reference-tag reference-tag-button"
      onClick={(e) => {
        e.stopPropagation()
        onOpenReference({ field, row, fields, rows })
      }}
      title="查看引用资料"
    >
      {label}
    </button>
  )
}

function ReferenceFieldInput({ field, value, onChange }) {
  const { fields, rows } = useReferenceContext(field.referenceTableId)
  if (!field.referenceTableId) {
    return (
      <input
        className="input"
        value=""
        placeholder="请先在字段管理中设置引用资料表"
        disabled
      />
    )
  }
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">未选择</option>
      {rows.map((r) => (
        <option key={r.id} value={r.id}>
          {referenceRowLabel(fields, r)}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// 单元格展示
// ---------------------------------------------------------------------------

export function CellView({ field, row, allFields, mode = 'table', onOpenReference }) {
  if (field.type === 'stats') {
    const stats = getStatsValues(allFields, field.statsMap, row.values, field.statsDimensions)
    return <StatsChart stats={stats} variant={field.statsStyle || 'bars'} size={mode === 'detail' ? 'lg' : 'sm'} />
  }

  const value = row.values?.[field.key]

  switch (field.type) {
    case 'longtext':
      return mode === 'detail' ? (
        <p className="detail-longtext">{value || '—'}</p>
      ) : (
        <ClampText text={value} lines={2} />
      )
    case 'text':
      return mode === 'detail' ? <span>{value || '—'}</span> : <Ellipsis text={value} />
    case 'number':
      return <span className="cell-number">{value == null || value === '' ? '—' : value}</span>
    case 'image':
      return value ? (
        <img src={value} alt="" className={mode === 'detail' ? 'cell-image-lg' : 'cell-image-sm'} />
      ) : (
        <span className="cell-empty">—</span>
      )
    case 'select': {
      const opt = field.options?.find((o) => o.value === value)
      return opt ? (
        <OptionTag option={opt} size={mode === 'detail' ? 'md' : 'sm'} />
      ) : (
        <span className="cell-empty">—</span>
      )
    }
    case 'multiselect': {
      const values = Array.isArray(value) ? value : []
      if (values.length === 0) return <span className="cell-empty">—</span>
      const shown = mode === 'detail' ? values : values.slice(0, 3)
      const extra = values.length - shown.length
      return (
        <span className="cell-tag-group">
          {shown.map((v) => {
            const opt = field.options?.find((o) => o.value === v)
            return opt ? <OptionTag key={v} option={opt} size={mode === 'detail' ? 'md' : 'sm'} /> : null
          })}
          {extra > 0 && <span className="option-tag option-tag-sm">+{extra}</span>}
        </span>
      )
    }
    case 'boolean':
      return value ? (
        <CheckCircle2 size={16} className="bool-true" />
      ) : (
        <XCircle size={16} className="bool-false" />
      )
    case 'url':
      return value ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="cell-link"
          onClick={(e) => e.stopPropagation()}
        >
          {mode === 'detail' ? value : '链接'}
        </a>
      ) : (
        <span className="cell-empty">—</span>
      )
    case 'date':
      return <span>{value || '—'}</span>
    case 'reference':
      return <ReferenceCellView field={field} value={value} onOpenReference={onOpenReference} />
    default:
      return <span>{value == null ? '' : String(value)}</span>
  }
}

// ---------------------------------------------------------------------------
// 字段输入（新增 / 编辑行表单）
// ---------------------------------------------------------------------------

export function FieldInput({ field, value, onChange }) {
  switch (field.type) {
    case 'longtext':
      return (
        <textarea
          className="input textarea"
          rows={4}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className="input"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
    case 'image':
      return (
        <div className="image-input">
          <input
            className="input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="图片 URL"
          />
          {value ? <img src={value} alt="" className="image-input-preview" /> : null}
        </div>
      )
    case 'select':
      return (
        <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">未选择</option>
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    case 'multiselect': {
      const arr = Array.isArray(value) ? value : []
      function toggle(v) {
        onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
      }
      return (
        <div className="multiselect-input">
          {(field.options || []).map((o) => (
            <button
              type="button"
              key={o.value}
              className={`multiselect-chip ${arr.includes(o.value) ? 'selected' : ''}`}
              onClick={() => toggle(o.value)}
            >
              <OptionTag option={o} />
            </button>
          ))}
        </div>
      )
    }
    case 'boolean':
      return (
        <label className="boolean-input">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {value ? '是' : '否'}
        </label>
      )
    case 'url':
      return (
        <input
          type="url"
          className="input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
      )
    case 'date':
      return (
        <input
          type="date"
          className="input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'reference':
      return <ReferenceFieldInput field={field} value={value} onChange={onChange} />
    case 'text':
    default:
      return <input className="input" value={value || ''} onChange={(e) => onChange(e.target.value)} />
  }
}

// ---------------------------------------------------------------------------
// 列头菜单
// ---------------------------------------------------------------------------

export function ColumnMenu({ onSort, onInsertLeft, onInsertRight, onOpenFilter, onEditField, onHide, onDelete }) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function close() {
    setOpen(false)
    setConfirmingDelete(false)
  }

  return (
    <span className="column-menu-anchor">
      <button
        type="button"
        className="column-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="列操作"
      >
        <MoreVertical size={14} />
      </button>
      <Popover open={open} onClose={close} align="right" className="column-menu-popover">
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onSort('asc')
            close()
          }}
        >
          <ArrowUp size={13} /> 升序排序
        </button>
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onSort('desc')
            close()
          }}
        >
          <ArrowDown size={13} /> 降序排序
        </button>
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onOpenFilter()
            close()
          }}
        >
          <FilterIcon size={13} /> 筛选
        </button>
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onInsertLeft()
            close()
          }}
        >
          <ArrowLeftToLine size={13} /> 左侧插入列
        </button>
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onInsertRight()
            close()
          }}
        >
          <ArrowRightToLine size={13} /> 右侧插入列
        </button>
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onEditField()
            close()
          }}
        >
          <Pencil size={13} /> 编辑列
        </button>
        <button
          type="button"
          className="popover-item"
          onClick={() => {
            onHide()
            close()
          }}
        >
          <EyeOff size={13} /> 隐藏列
        </button>
        {confirmingDelete ? (
          <div className="popover-confirm">
            <span>确认删除该列？</span>
            <button
              type="button"
              className="btn btn-danger btn-xs"
              onClick={() => {
                onDelete()
                close()
              }}
            >
              删除
            </button>
            <button type="button" className="btn btn-xs" onClick={() => setConfirmingDelete(false)}>
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="popover-item popover-item-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={13} /> 删除列
          </button>
        )}
      </Popover>
    </span>
  )
}

// ---------------------------------------------------------------------------
// 数据表格
// ---------------------------------------------------------------------------

export function DataGrid({
  fields,
  rows,
  allFields,
  sort,
  onSortChange,
  onInsertField,
  onEditField,
  onHideField,
  onDeleteField,
  onOpenFilter,
  onRowClick,
  onEditRow,
  onDeleteRow,
  onOpenReference,
}) {
  const visibleFields = fields.filter((f) => !f.hidden)

  return (
    <div className="data-grid-scroll">
      <table className="data-grid">
        <thead>
          <tr>
            {visibleFields.map((field) => {
              const fullIndex = fields.findIndex((f) => f.id === field.id)
              return (
                <th key={field.id}>
                  <div className="th-content">
                    <span className="th-label">
                      {field.name}
                      {sort?.fieldKey === field.key &&
                        (sort.direction === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </span>
                    <ColumnMenu
                      onSort={(direction) => onSortChange(field.key, direction)}
                      onInsertLeft={() => onInsertField(fullIndex)}
                      onInsertRight={() => onInsertField(fullIndex + 1)}
                      onOpenFilter={() => onOpenFilter(field.key)}
                      onEditField={() => onEditField(field.id)}
                      onHide={() => onHideField(field.id)}
                      onDelete={() => onDeleteField(field.id)}
                    />
                  </div>
                </th>
              )
            })}
            <th className="th-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="data-grid-row" onClick={() => onRowClick(row)}>
              {visibleFields.map((field) => (
                <td key={field.id}>
                  <CellView
                    field={field}
                    row={row}
                    allFields={allFields}
                    mode="table"
                    onOpenReference={onOpenReference}
                  />
                </td>
              ))}
              <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                <IconButton icon={Eye} title="查看详情" onClick={() => onRowClick(row)} />
                <IconButton icon={Pencil} title="编辑" onClick={() => onEditRow(row)} />
                <IconButton icon={Trash2} variant="danger" title="删除" onClick={() => onDeleteRow(row)} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={visibleFields.length + 1} className="data-grid-empty">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 筛选面板
// ---------------------------------------------------------------------------

export function FilterPanel({ fields, filters, onChange, focusFieldKey }) {
  useEffect(() => {
    if (!focusFieldKey) return
    document.getElementById(`filter-row-${focusFieldKey}`)?.scrollIntoView({ block: 'center' })
  }, [focusFieldKey])

  function updateFilter(fieldKey, cond) {
    onChange({ ...filters, [fieldKey]: cond })
  }
  function clearAll() {
    onChange({})
  }
  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <span>筛选条件</span>
        <button type="button" className="link-btn" onClick={clearAll}>
          清空
        </button>
      </div>
      <div className="filter-panel-body">
        {fields.map((field) => (
          <div
            key={field.key}
            id={`filter-row-${field.key}`}
            className={`filter-row ${focusFieldKey === field.key ? 'filter-row-focus' : ''}`}
          >
            <div className="filter-row-label">
              {field.name}
              {field.hidden && <span className="filter-hidden-badge">隐藏列</span>}
            </div>
            <FilterControl
              field={field}
              value={filters[field.key]}
              onChange={(cond) => updateFilter(field.key, cond)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function FilterControl({ field, value, onChange }) {
  switch (field.type) {
    case 'number':
      return (
        <div className="filter-range">
          <input
            type="number"
            className="input input-sm"
            placeholder="最小"
            value={value?.min ?? ''}
            onChange={(e) => onChange({ ...value, min: e.target.value })}
          />
          <span>—</span>
          <input
            type="number"
            className="input input-sm"
            placeholder="最大"
            value={value?.max ?? ''}
            onChange={(e) => onChange({ ...value, max: e.target.value })}
          />
        </div>
      )
    case 'select':
    case 'multiselect':
      return (
        <div className="filter-checklist">
          {(field.options || []).map((opt) => {
            const checked = value?.values?.includes(opt.value)
            return (
              <label key={opt.value} className="filter-check-item">
                <input
                  type="checkbox"
                  checked={!!checked}
                  onChange={(e) => {
                    const prevValues = value?.values || []
                    const nextValues = e.target.checked
                      ? [...prevValues, opt.value]
                      : prevValues.filter((v) => v !== opt.value)
                    onChange({ values: nextValues })
                  }}
                />
                <OptionTag option={opt} />
              </label>
            )
          })}
        </div>
      )
    case 'boolean':
      return (
        <div className="segmented">
          {[
            { v: null, label: '全部' },
            { v: true, label: '是' },
            { v: false, label: '否' },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              className={`segmented-item ${(value?.value ?? null) === opt.v ? 'active' : ''}`}
              onClick={() => onChange({ value: opt.v })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )
    case 'date':
      return (
        <div className="filter-range">
          <input
            type="date"
            className="input input-sm"
            value={value?.from || ''}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span>—</span>
          <input
            type="date"
            className="input input-sm"
            value={value?.to || ''}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      )
    case 'stats':
      return <span className="filter-unsupported">指标视图不支持筛选</span>
    default:
      return (
        <input
          className="input input-sm"
          placeholder="包含文本"
          value={value?.contains || ''}
          onChange={(e) => onChange({ contains: e.target.value })}
        />
      )
  }
}
