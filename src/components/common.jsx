// 通用控件：弹窗、确认框、按钮、颜色选择器、标签、
// 指标视图、分页、弹出菜单、拖拽排序等。所有工具型页面共用。

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, GripVertical, X } from 'lucide-react'
import { COLOR_PALETTE, PAGE_SIZE_OPTIONS, STATS_SCALE_MAX } from '../constants.js'
import { clamp } from '../utils.js'

// ---------------------------------------------------------------------------
// 弹窗
// ---------------------------------------------------------------------------

export function Modal({ title, onClose, children, width = 520, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="modal-panel" style={{ maxWidth: width }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={400}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// 按钮 / 表单行
// ---------------------------------------------------------------------------

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  title,
  variant = 'default',
  size = 16,
  disabled,
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`icon-btn ${variant} ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title || label}
      disabled={disabled}
    >
      {Icon && <Icon size={size} />}
      {label && <span>{label}</span>}
    </button>
  )
}

export function FormRow({ label, children, hint }) {
  return (
    <label className="form-row">
      <span className="form-row-label">{label}</span>
      {children}
      {hint && <span className="form-row-hint">{hint}</span>}
    </label>
  )
}

export function ColorSwatchPicker({ value, onChange, colors = COLOR_PALETTE }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const activeColor = value || colors[0]
  return (
    <div className="color-picker" ref={ref}>
      <button
        type="button"
        className="color-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="选择颜色"
        title={activeColor}
      >
        <span style={{ background: activeColor }} />
      </button>
      {open ? (
        <div className="color-picker-popover">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${value === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => {
                onChange(c)
                setOpen(false)
              }}
              aria-label={c}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 文本截断
// ---------------------------------------------------------------------------

export function Ellipsis({ text }) {
  return (
    <span className="ellipsis-text" title={text || ''}>
      {text}
    </span>
  )
}

export function ClampText({ text, lines = 2 }) {
  return (
    <span className="clamp-text" style={{ WebkitLineClamp: lines }} title={text || ''}>
      {text}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 选项标签（单选 / 多选）
// ---------------------------------------------------------------------------

export function OptionTag({ option, size = 'sm' }) {
  if (!option) return null
  const style = option.color
    ? {
        background: `${option.color}1f`,
        color: option.color,
        borderColor: `${option.color}55`,
      }
    : undefined
  return (
    <span className={`option-tag option-tag-${size}`} style={style}>
      {option.image ? <img src={option.image} alt="" className="option-tag-img" /> : null}
      {option.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 指标视图
// ---------------------------------------------------------------------------

function statAngle(index, total) {
  return (-90 + (360 / Math.max(total, 1)) * index) * (Math.PI / 180)
}

function statPoint(cx, cy, radius, value, max, index, total) {
  const r = radius * clamp(value / max, 0, 1)
  const angle = statAngle(index, total)
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

export function StatsRadarChart({ stats, size = 'sm' }) {
  const safeStats = stats.length > 0 ? stats : [{ key: 'empty', label: '无', value: 0 }]
  const dim = size === 'lg' ? 200 : 52
  const cx = dim / 2
  const cy = dim / 2
  const radius = dim / 2 - (size === 'lg' ? 28 : 8)
  const max = STATS_SCALE_MAX
  const total = safeStats.length
  const dataPoints = safeStats.map((s, i) => statPoint(cx, cy, radius, s.value, max, i, total))
  const dataPath = dataPoints.map((p) => p.join(',')).join(' ')

  return (
    <div className={`stats-radar stats-radar-${size}`}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        {[0.25, 0.5, 0.75, 1].map((lvl) => (
          <polygon
            key={lvl}
            points={safeStats
              .map((_, i) => statPoint(cx, cy, radius, lvl * max, max, i, total).join(','))
              .join(' ')}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        <polygon points={dataPath} fill="rgba(37,99,235,0.25)" stroke="#2563eb" strokeWidth="1.5" />
      </svg>
      {size === 'lg' ? (
        <ul className="stats-legend">
          {stats.map((s) => (
            <li key={s.key}>
              <span className="stats-legend-label">{s.label}</span>
              <span className="stats-legend-value">{s.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="stats-mini-grid">
          {stats.map((s) => (
            <span key={s.key} className="stats-mini-item" title={s.label}>
              <em>{s.label.slice(0, 1)}</em>
              {s.value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function StatsBarsChart({ stats, size = 'sm' }) {
  const maxValue = Math.max(STATS_SCALE_MAX, ...stats.map((s) => Number(s.value) || 0))
  return (
    <div className={`stats-bars stats-bars-${size}`}>
      {stats.map((s) => {
        const value = Number(s.value) || 0
        const width = `${clamp((value / maxValue) * 100, 0, 100)}%`
        return (
          <div key={s.key} className="stats-bar-row" title={`${s.label}：${value}`}>
            <span className="stats-bar-label">{s.label}</span>
            <span className="stats-bar-track" aria-hidden="true">
              <span className="stats-bar-fill" style={{ width }} />
            </span>
            <span className="stats-bar-value">{value}</span>
          </div>
        )
      })}
    </div>
  )
}

export function StatsChart({ stats, variant = 'bars', size = 'sm' }) {
  if (variant === 'radar') return <StatsRadarChart stats={stats} size={size} />
  return <StatsBarsChart stats={stats} size={size} />
}

// ---------------------------------------------------------------------------
// 分页
// ---------------------------------------------------------------------------

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}) {
  return (
    <div className="pagination-bar">
      <span className="pagination-info">共 {total} 条</span>
      <div className="pagination-controls">
        <button
          type="button"
          className="icon-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pagination-page">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <select
        className="pagination-size"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        {pageSizeOptions.map((n) => (
          <option key={n} value={n}>
            {n} 条/页
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 弹出面板（列菜单 / 筛选面板等的定位容器）
// ---------------------------------------------------------------------------

export function Popover({ open, onClose, children, align = 'left', className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    function handleClick(e) {
      const popover = ref.current
      const anchor = popover?.parentElement
      if (!popover) return
      if (popover.contains(e.target) || anchor?.contains(e.target)) return
      onClose?.()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null
  return (
    <div ref={ref} className={`popover popover-${align} ${className}`}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 空状态
// ---------------------------------------------------------------------------

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={28} strokeWidth={1.5} />}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-desc">{description}</p>}
      {action}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 拖拽排序
// ---------------------------------------------------------------------------

export function DragHandle() {
  return (
    <span className="drag-handle" aria-hidden="true">
      <GripVertical size={14} />
    </span>
  )
}

// 极简的原生 HTML5 拖拽排序：返回绑定到每一行的事件处理器。
export function useDragReorder(items, onReorder) {
  const dragIndex = useRef(null)
  function onDragStart(index) {
    dragIndex.current = index
  }
  function onDragOver(e) {
    e.preventDefault()
  }
  function onDrop(index) {
    const from = dragIndex.current
    dragIndex.current = null
    if (from == null || from === index) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(index, 0, moved)
    onReorder(next)
  }
  return { onDragStart, onDragOver, onDrop }
}
