// 统计视图工具：从资料库或收集记录中选择一个数据源，按字段分组并可叠加
// 一个数值阈值条件，快速回答“满足条件的记录有哪些/有多少”。

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3 } from 'lucide-react'
import { db } from '../db.js'
import { visibleRockKingdomCreatureRows } from '../domain/rockKingdom.js'
import { buildStockSummary, defaultStockGroupField } from '../domain/stock.js'
import { ROCK_KINGDOM_CREATURE_TABLE_ID } from '../presets/rockKingdom.js'
import { EmptyState } from './common.jsx'

const EMPTY_LIST = []

function tableKindLabel(table) {
  if (table.kind === 'owned') return '收集记录'
  return '资料库'
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

  // LiveQuery 首次渲染会返回 undefined。所有 Hook 必须在加载前后保持同一调用顺序，
  // 因此先用空数组计算，再在 useMemo 之后决定是否显示加载/空状态。
  const safeFields = fields || EMPTY_LIST
  const safeRows = rows || EMPTY_LIST
  const groupableFields = safeFields.filter((field) => field.type !== 'stats')
  const numberFields = safeFields.filter((field) => field.type === 'number')
  const groupField = safeFields.find((field) => field.key === groupFieldKey)
    || defaultStockGroupField(groupableFields)
  const numberField = safeFields.find((field) => field.key === numberFieldKey) || null
  const displayRows = useMemo(
    () => sourceTable?.id === ROCK_KINGDOM_CREATURE_TABLE_ID
      ? visibleRockKingdomCreatureRows(safeRows)
      : safeRows,
    [safeRows, sourceTable?.id],
  )

  const stats = useMemo(
    () => buildStockSummary(displayRows, groupField, numberField, threshold),
    [displayRows, groupField, numberField, threshold],
  )

  if (!tables || !fields || !rows) return null
  if (tables.length === 0) {
    return (
      <EmptyState
        title="还没有可统计的数据源"
        description="先在资料库创建资料表，或在收集记录中添加字段和记录后，再回来配置统计视图。"
      />
    )
  }

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
