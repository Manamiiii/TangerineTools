// 性格推荐工具：手动录入或从场景资料库带入六维 + 特性标签，
// 推荐一组强化/弱化搭配，并展示可解释的推荐理由。
// 除首选之外，工具还会同时暴露若干候选方案（推荐/可选清单），
// 用户可以直接点击某个候选，替换主结果卡片的展示内容。

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownCircle, ArrowUpCircle, Sparkles } from 'lucide-react'
import { db } from '../db.js'
import { STATS_DIMENSIONS } from '../constants.js'
import {
  evaluateAllNatures,
  explainNatureRecommendation,
  extractRowSummary,
  extractStatsFromRow,
  extractTraitTagsFromRow,
  natureName,
  NATURE_DECISION_LABELS,
  STAT_LABELS,
} from '../domain/nature.js'
import { TRAIT_TAG_OPTIONS } from '../presets/rockKingdom.js'
import { EmptyState, FormRow } from './common.jsx'
import { FieldInput } from './catalog.jsx'

const EMPTY_STATS = Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, '']))
const TRAIT_TAG_FIELD = { type: 'multiselect', options: TRAIT_TAG_OPTIONS }
const TRAIT_TAG_LABELS = Object.fromEntries(TRAIT_TAG_OPTIONS.map((o) => [o.value, o.label]))

export function NatureTool({ scene }) {
  const [input, setInput] = useState({ name: '', stats: { ...EMPTY_STATS }, traitTags: [] })
  const [selectedIndex, setSelectedIndex] = useState(0)

  function updateStat(key, value) {
    setInput((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } }))
  }

  function handleImport({ name, stats, traitTags }) {
    setInput({
      name: name || '',
      stats: { ...EMPTY_STATS, ...stats },
      traitTags: traitTags || [],
    })
    setSelectedIndex(0)
  }

  const numericStats = useMemo(
    () => Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, Number(input.stats[d.key]) || 0])),
    [input.stats],
  )
  const hasAnyStat = STATS_DIMENSIONS.some((d) => numericStats[d.key] > 0)
  const candidates = useMemo(
    () => evaluateAllNatures(numericStats, input.traitTags),
    [numericStats, input.traitTags],
  )
  // 输入变化后如果原选中下标越界（例如输入被清空、候选变少），回退到首选。
  useEffect(() => {
    if (selectedIndex >= candidates.length) setSelectedIndex(0)
  }, [candidates.length, selectedIndex])

  const activeIndex = Math.min(selectedIndex, Math.max(candidates.length - 1, 0))
  const nature = candidates[activeIndex] || null
  const adjustedStats = nature?.adjustedStats || numericStats
  const reasoning = explainNatureRecommendation(nature, TRAIT_TAG_LABELS)

  return (
    <div className="nature-tool">
      <RowImportPanel scene={scene} onImport={handleImport} />

      <div className="nature-form">
        <FormRow label="名称（可选）">
          <input
            className="input"
            value={input.name}
            onChange={(e) => setInput((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="用于标记这次推荐，例如精灵名称"
          />
        </FormRow>

        <div className="nature-stats-grid">
          {STATS_DIMENSIONS.map((d) => (
            <label key={d.key} className="nature-stat-input">
              <span>{d.label}</span>
              <input
                type="number"
                className="input"
                value={input.stats[d.key]}
                onChange={(e) => updateStat(d.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <FormRow label="特性标签" hint="标签会影响强化/弱化方向的推荐权重">
          <FieldInput
            field={TRAIT_TAG_FIELD}
            value={input.traitTags}
            onChange={(tags) => setInput((prev) => ({ ...prev, traitTags: tags }))}
          />
        </FormRow>
      </div>

      {hasAnyStat ? (
        <>
          <NatureCandidateList
            candidates={candidates}
            activeIndex={activeIndex}
            onSelect={setSelectedIndex}
          />
          <NatureResult
            nature={nature}
            baseStats={numericStats}
            adjustedStats={adjustedStats}
            reasoning={reasoning}
          />
        </>
      ) : (
        <EmptyState
          title="填写六维后查看推荐"
          description="至少填写一项不为 0 的数值，即可查看性格推荐结果。"
        />
      )}
    </div>
  )
}

// 从场景已有资料表中选择一行，带入名称/六维/特性标签。
// 场景下没有任何资料表时返回 null，保证性格工具可以完全独立使用。
function RowImportPanel({ scene, onImport }) {
  const tables = useLiveQuery(
    () =>
      db.catalogTables
        .where('sceneId')
        .equals(scene.id)
        .filter((t) => !t.kind)
        .sortBy('order'),
    [scene.id],
  )
  const [tableId, setTableId] = useState(null)
  const [rowId, setRowId] = useState(null)

  const activeTableId = tableId || tables?.[0]?.id || null

  const fields = useLiveQuery(
    () =>
      activeTableId ? db.catalogFields.where('tableId').equals(activeTableId).sortBy('order') : [],
    [activeTableId],
  )
  const rows = useLiveQuery(
    () => (activeTableId ? db.catalogRows.where('tableId').equals(activeTableId).toArray() : []),
    [activeTableId],
  )

  if (!tables || tables.length === 0) return null
  if (!fields || !rows) return null

  const summaries = rows.map((row) => ({ row, summary: extractRowSummary(row, fields) }))

  function handleImportClick() {
    const target = rows.find((r) => r.id === rowId) || rows[0]
    if (!target) return
    const summary = extractRowSummary(target, fields)
    const stats = extractStatsFromRow(target, fields)
    const traitTags = extractTraitTagsFromRow(target, fields)
    onImport({ name: summary.name, stats, traitTags })
  }

  return (
    <div className="nature-import-panel">
      <div className="nature-import-row">
        {tables.length > 1 && (
          <select
            className="select"
            value={activeTableId || ''}
            onChange={(e) => {
              setTableId(e.target.value)
              setRowId(null)
            }}
          >
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <select className="select" value={rowId || ''} onChange={(e) => setRowId(e.target.value)}>
          <option value="">从资料库选择一行带入</option>
          {summaries.map(({ row, summary }) => (
            <option key={row.id} value={row.id}>
              {[summary.no, summary.name, summary.form].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn"
          onClick={handleImportClick}
          disabled={rows.length === 0}
        >
          带入
        </button>
      </div>
    </div>
  )
}

// 候选清单：展示全部 30 个合法性格，并按「推荐 / 可保留 / 不推荐」分组。
function NatureCandidateList({ candidates, activeIndex, onSelect }) {
  if (!candidates || candidates.length === 0) return null
  const activeCandidate = candidates[activeIndex]
  const groups = [
    ['recommended', '推荐'],
    ['keepable', '可保留'],
    ['notRecommended', '不推荐'],
  ]
  return (
    <div className="nature-candidates">
      <div className="nature-candidates-title">全部性格候选</div>
      <div className="nature-candidates-groups">
        {groups.map(([decision, label]) => {
          const items = candidates.filter((c) => c.decision === decision)
          if (items.length === 0) return null
          return (
            <section key={decision} className="nature-candidate-group">
              <div className="nature-candidate-group-title">
                <span className={`nature-candidate-tag ${decision}`}>{label}</span>
                <span>{items.length} 个</span>
              </div>
              <ul className="nature-candidates-list">
                {items.map((c) => {
                  const candidateIndex = candidates.indexOf(c)
                  const isActive = c === activeCandidate
                  return (
                    <li key={c.id || `${c.raise}-${c.lower}`}>
                      <button
                        type="button"
                        className={`nature-candidate ${isActive ? 'active' : ''}`}
                        onClick={() => onSelect(candidateIndex)}
                      >
                        <span className={`nature-candidate-tag ${c.decision}`}>
                          {NATURE_DECISION_LABELS[c.decision]}
                        </span>
                        <span className="nature-candidate-name">{natureName(c)}</span>
                        <span className="nature-candidate-role">{c.roleLabel}</span>
                        <span className="nature-candidate-score">{c.score.toFixed(1)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function NatureResult({ nature, baseStats, adjustedStats, reasoning }) {
  if (!nature) return null

  return (
    <div className="nature-result">
      <div className="nature-result-header">
        <Sparkles size={18} />
        <span className="nature-result-title">{natureName(nature)}</span>
        <span className={`nature-candidate-tag ${nature.decision}`}>
          {NATURE_DECISION_LABELS[nature.decision]}
        </span>
      </div>

      <div className="nature-result-badges">
        <span className="nature-badge nature-badge-raise">
          <ArrowUpCircle size={14} />
          强化：{STAT_LABELS[nature.raise]}（{baseStats[nature.raise]} → {adjustedStats[nature.raise]}）
        </span>
        <span className="nature-badge nature-badge-lower">
          <ArrowDownCircle size={14} />
          弱化：{STAT_LABELS[nature.lower]}（{baseStats[nature.lower]} → {adjustedStats[nature.lower]}）
        </span>
      </div>

      <p className="nature-result-reason">{reasoning}</p>

      <div className="nature-explain-grid">
        <div>
          <div className="nature-explain-title">推荐理由</div>
          <ul className="nature-explain-list">
            {nature.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="nature-explain-title">风险提示</div>
          {nature.warnings.length > 0 ? (
            <ul className="nature-explain-list warning">
              {nature.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="nature-explain-empty">暂无明显硬性风险。</p>
          )}
        </div>
      </div>

      <div className="nature-stats-scroll">
        <table className="nature-stats-table">
          <thead>
            <tr>
              <th />
              {STATS_DIMENSIONS.map((d) => (
                <th key={d.key} className={cellMarkClass(d.key, nature)}>
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>原始值</td>
              {STATS_DIMENSIONS.map((d) => (
                <td key={d.key}>{baseStats[d.key]}</td>
              ))}
            </tr>
            <tr>
              <td>加成后</td>
              {STATS_DIMENSIONS.map((d) => {
                const delta = adjustedStats[d.key] - baseStats[d.key]
                return (
                  <td key={d.key} className={cellMarkClass(d.key, nature)}>
                    {adjustedStats[d.key]}
                    {delta !== 0 && (
                      <span className="nature-mark-badge">
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function cellMarkClass(key, nature) {
  if (key === nature.raise) return 'nature-cell-raised'
  if (key === nature.lower) return 'nature-cell-lowered'
  return ''
}
