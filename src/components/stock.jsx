// 统计视图工具：从资料库或收集记录中选择一个数据源，按字段分组并可叠加
// 一个数值阈值条件，快速回答“满足条件的记录有哪些/有多少”。

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3 } from 'lucide-react'
import { db } from '../db.js'
import { visibleRockKingdomCreatureRows } from '../domain/rockKingdom.js'
import { ROCK_KINGDOM_CREATURE_TABLE_ID } from '../presets/rockKingdom.js'
import { stringifyCellValue } from '../utils.js'
import { EmptyState } from './common.jsx'

function tableKindLabel(table) {
  if (table.kind === 'owned') return '收集记录'
  return '资料库'
}

function optionLabel(field, value) {
  if (field?.type === 'select') return field.options?.find((o) => o.value === value)?.label || value
  if (field?.type === 'multiselect') {
    const arr = Array.isArray(value) ? value : []
    return arr
      .map((item) => field.options?.find((o) => o.value === item)?.label || item)
      .filter(Boolean)
      .join(' / ')
  }
  return stringifyCellValue(value, field)
}

function rowGroupKeys(row, field) {
  if (!field) return ['全部记录']
  const raw = row.values?.[field.key]
  if (field.type === 'multiselect') {
    const arr = Array.isArray(raw) ? raw : []
    return arr.length ? arr.map((item) => optionLabel(field, item)) : ['未填写']
  }
  const label = optionLabel(field, raw)
  return label ? [label] : ['未填写']
}

function passesNumberCondition(row, field, threshold) {
  if (!field || threshold === '') return true
  return Number(row.values?.[field.key]) >= Number(threshold)
}

export function StockTool({ scene }) {
  const tables = useLiveQuery(
    () =>
      db.catalogTables
        .where('sceneId')
        .equals(scene.id)
        .filter((t) => !t.kind || t.kind === 'owned')
        .sortBy('order'),
    [scene.id],
  )
  const [sourceTableId, setSourceTableId] = useState('')
  const sourceTable = tables?.find((table) => table.id === sourceTableId) || tables?.[0] || null

  const fields = useLiveQuery(
    () => (sourceTable ? db.catalogFields.where('tableId').equals(sourceTable.id).sortBy('order') : []),
    [sourceTable?.id || ''],
  )
  const rows = useLiveQuery(
    () => (sourceTable ? db.catalogRows.where('tableId').equals(sourceTable.id).toArray() : []),
    [sourceTable?.id || ''],
  )

  const [groupFieldKey, setGroupFieldKey] = useState('')
  const [numberFieldKey, setNumberFieldKey] = useState('')
  const [threshold, setThreshold] = useState('')

  if (!tables || !fields || !rows) return null
  if (tables.length === 0) {
    return (
      <EmptyState
        title="还没有可统计的数据源"
        description="先在资料库创建资料表，或在收集记录中添加字段和记录后，再回来配置统计视图。"
      />
    )
  }

  const groupableFields = fields.filter((field) => field.type !== 'stats')
  const numberFields = fields.filter((field) => field.type === 'number')
  const groupField = fields.find((field) => field.key === groupFieldKey) || groupableFields[0] || null
  const numberField = fields.find((field) => field.key === numberFieldKey) || null
  const displayRows = sourceTable?.id === ROCK_KINGDOM_CREATURE_TABLE_ID
    ? visibleRockKingdomCreatureRows(rows)
    : rows

  const stats = useMemo(() => {
    const map = new Map()
    const matchedRows = displayRows.filter((row) => passesNumberCondition(row, numberField, threshold))
    for (const row of matchedRows) {
      for (const key of rowGroupKeys(row, groupField)) map.set(key, (map.get(key) || 0) + 1)
    }
    return {
      total: displayRows.length,
      matched: matchedRows.length,
      groups: Array.from(map.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }
  }, [displayRows, groupField, numberField, threshold])

  return (
    <div className="table-view">
      <div className="toolbar toolbar-catalog stats-toolbar">
        <BarChart3 size={16} />
        <label className="stats-control">
          数据源
          <select
            className="select"
            value={sourceTable?.id || ''}
            onChange={(e) => {
              setSourceTableId(e.target.value)
              setGroupFieldKey('')
              setNumberFieldKey('')
              setThreshold('')
            }}
          >
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name} · {tableKindLabel(table)}
              </option>
            ))}
          </select>
        </label>
        <label className="stats-control">
          分组字段
          <select
            className="select"
            value={groupField?.key || ''}
            onChange={(e) => setGroupFieldKey(e.target.value)}
          >
            {groupableFields.map((field) => (
              <option key={field.id} value={field.key}>
                {field.name}
              </option>
            ))}
          </select>
        </label>
        <label className="stats-control">
          数值条件
          <select
            className="select"
            value={numberField?.key || ''}
            onChange={(e) => setNumberFieldKey(e.target.value)}
          >
            <option value="">不限制</option>
            {numberFields.map((field) => (
              <option key={field.id} value={field.key}>
                {field.name} ≥
              </option>
            ))}
          </select>
        </label>
        {numberField && (
          <input
            type="number"
            className="input stats-threshold-input"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="阈值"
          />
        )}
      </div>

      {fields.length === 0 ? (
        <EmptyState title="当前数据源还没有字段" description="请先为该资料表或收集记录添加字段。" />
      ) : rows.length === 0 ? (
        <EmptyState title="当前数据源还没有记录" description="添加记录后即可在这里按字段统计。" />
      ) : (
        <div className="stock-stats-panel">
          <div className="stock-stats-card stock-stats-card-wide">
            <div className="stock-stats-card-title">
              {sourceTable.name} · 按「{groupField?.name || '全部'}」统计
            </div>
            <p className="stats-summary">
              共 {stats.total} 条，当前条件命中 {stats.matched} 条
            </p>
            <ul className="stock-stats-list">
              {stats.groups.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <span className="stock-stats-count">{item.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
