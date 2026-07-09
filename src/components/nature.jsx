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
  analyzeStats,
  explainNatureRecommendation,
  extractSkillInfoFromReferenceRows,
  extractSkillRefsFromRow,
  extractSkillInfoFromRow,
  extractRowSummary,
  extractStatsFromRow,
  extractTraitTagsFromRow,
  natureName,
  NATURE_DECISION_LABELS,
  STAT_LABELS,
} from '../domain/nature.js'
import { TRAIT_TAG_OPTIONS } from '../presets/rockKingdom.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { EmptyState, FormRow } from './common.jsx'
import { FieldInput } from './catalog.jsx'

const EMPTY_STATS = Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, '']))
const TRAIT_TAG_FIELD = { type: 'multiselect', options: TRAIT_TAG_OPTIONS }
const TRAIT_TAG_LABELS = Object.fromEntries(TRAIT_TAG_OPTIONS.map((o) => [o.value, o.label]))

export function NatureTool({ scene }) {
  const [draftInput, setDraftInput] = useState({
    name: '',
    stats: { ...EMPTY_STATS },
    traitTags: [],
    skillInfo: { skills: [] },
  })
  const [input, setInput] = useState(draftInput)
  const [selectedIndex, setSelectedIndex] = useState(0)

  function updateStat(key, value) {
    setDraftInput((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } }))
  }

  function handleImport({ name, stats, traitTags, skillInfo }) {
    const next = {
      name: name || '',
      stats: { ...EMPTY_STATS, ...stats },
      traitTags: traitTags || [],
      skillInfo: skillInfo || { skills: [] },
    }
    setDraftInput(next)
    setInput(next)
    setSelectedIndex(0)
  }

  const numericStats = useMemo(
    () => Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, Number(input.stats[d.key]) || 0])),
    [input.stats],
  )
  const hasAnyStat = STATS_DIMENSIONS.some((d) => numericStats[d.key] > 0)
  const candidates = useMemo(
    () => evaluateAllNatures(numericStats, input.traitTags, input.skillInfo),
    [numericStats, input.traitTags, input.skillInfo],
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
            value={draftInput.name}
            onChange={(e) => setDraftInput((prev) => ({ ...prev, name: e.target.value }))}
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
                value={draftInput.stats[d.key]}
                onChange={(e) => updateStat(d.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <FormRow label="特性标签" hint="标签会影响强化/弱化方向的推荐权重">
          <FieldInput
            field={TRAIT_TAG_FIELD}
            value={draftInput.traitTags}
            onChange={(tags) => setDraftInput((prev) => ({ ...prev, traitTags: tags }))}
          />
        </FormRow>

        <FormRow label="技能关联" hint="从精灵基础资料选择后，会通过「可用技能」引用读取技能资料参与分析">
          <div className="nature-linked-skills">
            已关联 {draftInput.skillInfo?.skills?.length || 0} 个技能
          </div>
        </FormRow>

        <div className="nature-manual-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setInput(draftInput)
              setSelectedIndex(0)
            }}
          >
            计算推荐
          </button>
          <span>手动输入不会实时计算，点击后刷新结果。</span>
        </div>
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
  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const skillTableId = ROCK_KINGDOM_PRESET.tables[1].id
  const creatureTable = useLiveQuery(
    () => db.catalogTables.get(creatureTableId),
    [scene.id],
  )
  const [rowId, setRowId] = useState(null)

  const fields = useLiveQuery(
    () => db.catalogFields.where('tableId').equals(creatureTableId).sortBy('order'),
    [creatureTableId],
  )
  const rows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(creatureTableId).toArray(),
    [creatureTableId],
  )
  const skillRows = useLiveQuery(
    () => db.catalogRows.where('tableId').equals(skillTableId).toArray(),
    [skillTableId],
  )

  if (creatureTable === undefined || !fields || !rows || !skillRows) return null
  if (!creatureTable) {
    return (
      <div className="nature-import-panel nature-import-empty">
        未找到洛克王国「精灵基础资料」表，可先等待预置资料初始化完成，或直接手动输入六维后计算。
      </div>
    )
  }

  const summaries = rows.map((row) => ({ row, summary: extractRowSummary(row, fields) }))

  function importRow(target) {
    if (!target) return
    const summary = extractRowSummary(target, fields)
    const stats = extractStatsFromRow(target, fields)
    const traitTags = extractTraitTagsFromRow(target, fields)
    const skillRefs = extractSkillRefsFromRow(target, fields)
    const referencedSkillRows = skillRows.filter((row) => skillRefs.includes(row.id))
    const skillInfo = referencedSkillRows.length > 0
      ? extractSkillInfoFromReferenceRows(referencedSkillRows)
      : extractSkillInfoFromRow(target, fields)
    onImport({ name: summary.name, stats, traitTags, skillInfo })
  }

  return (
    <div className="nature-import-panel">
      <div className="nature-import-row">
        <select
          className="select"
          value={rowId || ''}
          onChange={(e) => {
            const nextRowId = e.target.value
            setRowId(nextRowId)
            importRow(rows.find((r) => r.id === nextRowId))
          }}
        >
          <option value="">从资料库选择一行带入</option>
          {summaries.map(({ row, summary }) => (
            <option key={row.id} value={row.id}>
              {[summary.no, summary.name, summary.form].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
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
                        <span className="nature-candidate-role">{natureModifierSummary(c)}</span>
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
  const speedProfile = nature.speedProfile

  return (
    <div className="nature-result">
      <div className="nature-result-header">
        <span className="nature-result-icon"><Sparkles size={16} /></span>
        <div className="nature-result-title-wrap">
          <span className="nature-result-title">{natureName(nature)}</span>
          <span className="nature-result-subtitle">
            {natureModifierSummary(nature)} · 评分 {nature.score.toFixed(1)}
          </span>
        </div>
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

      <NatureStatDistribution stats={baseStats} />

      {nature.skillProfile && (
        <div className="nature-skill-note">
          <strong>技能线索</strong>
          <span>{nature.skillProfile.summary}</span>
          <span className="nature-skill-breakdown">
            物攻 {nature.skillProfile.breakdown.physicalCount} 个 / 魔攻 {nature.skillProfile.breakdown.magicalCount} 个 / 状态 {nature.skillProfile.breakdown.statusCount} 个；
            攻击技能平均威力 {nature.skillProfile.breakdown.attackAveragePower.toFixed(0)}
          </span>
        </div>
      )}

      {speedProfile && (
        <div className={`nature-speed-note ${speedProfile.concern.level}`}>
          <strong>速度线：{speedProfile.concern.label}</strong>
          <span>
            基础速度 {speedProfile.base}（{speedProfile.baseTier}，最近锚点 {speedProfile.nearestAnchor}）。
            {speedProfile.concern.reason}；{speedProfile.note}
          </span>
        </div>
      )}

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

      <NatureStatsBars nature={nature} baseStats={baseStats} adjustedStats={adjustedStats} />
    </div>
  )
}

function natureModifierSummary(candidate) {
  const raiseDelta = candidate.deltas?.[candidate.raise] || 0
  const lowerDelta = candidate.deltas?.[candidate.lower] || 0
  const raiseText = `${STAT_LABELS[candidate.raise]} ${raiseDelta > 0 ? `+${raiseDelta}` : raiseDelta}`
  const lowerText = `${STAT_LABELS[candidate.lower]} ${lowerDelta}`
  return `${raiseText} / ${lowerText}`
}


function percentileBandText(score) {
  return [
    '后10%档',
    'P10-P25',
    'P25-P50',
    'P50-P75',
    'P75-P90',
    '前10%档',
  ][score] || '未知档位'
}

function NatureStatDistribution({ stats }) {
  const analysis = useMemo(() => analyzeStats(stats), [stats])
  return (
    <div className="nature-stats-scroll nature-stat-distribution">
      <table className="nature-stats-table">
        <thead>
          <tr>
            <th>维度</th>
            <th>数值</th>
            <th>分布位置</th>
            <th>粗分位档</th>
          </tr>
        </thead>
        <tbody>
          {STATS_DIMENSIONS.map((d) => {
            const percentile = analysis.percentiles[d.key]
            return (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td>{analysis.stats[d.key] || 0}</td>
                <td>{percentile.label}</td>
                <td>{percentileBandText(percentile.score)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function NatureStatsBars({ nature, baseStats, adjustedStats }) {
  const maxValue = Math.max(1, ...STATS_DIMENSIONS.map((d) => baseStats[d.key] || 0), ...STATS_DIMENSIONS.map((d) => adjustedStats[d.key] || 0))
  return (
    <div className="nature-bars">
      {STATS_DIMENSIONS.map((d) => {
        const base = baseStats[d.key] || 0
        const adjusted = adjustedStats[d.key] || 0
        const delta = adjusted - base
        return (
          <div key={d.key} className={`nature-bar-row ${cellMarkClass(d.key, nature)}`}>
            <span className="nature-bar-label">{d.label}</span>
            <div className="nature-bar-track">
              <span className="nature-bar-base" style={{ width: `${(base / maxValue) * 100}%` }} />
              <span className="nature-bar-adjusted" style={{ width: `${(adjusted / maxValue) * 100}%` }} />
            </div>
            <span className="nature-bar-value">
              {base} → {adjusted}
              {delta !== 0 && <em>{delta > 0 ? `+${delta}` : delta}</em>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function cellMarkClass(key, nature) {
  if (key === nature.raise) return 'nature-cell-raised'
  if (key === nature.lower) return 'nature-cell-lowered'
  return ''
}
