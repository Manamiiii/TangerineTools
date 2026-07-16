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
          <NaturePveOverview candidates={candidates} />
          <NaturePriorityRules />
          <div className="nature-workbench">
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
          </div>
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
    const traitDesc = target.values?.traitDesc || ''
    const traitText = /继承.*增益|增益.*继承|传递.*增益|增益.*传递|下个入场.*继承|入场精灵继承|击鼓传花/.test(traitDesc)
      ? traitDesc
      : ''
    onImport({
      name: summary.name,
      stats,
      traitTags,
      skillInfo: traitText ? { ...skillInfo, traitText } : skillInfo,
    })
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

// 候选清单：展示全部 30 个合法性格，先按「强化维度」分组，组内再展示推荐分档。
function NatureCandidateList({ candidates, activeIndex, onSelect }) {
  if (!candidates || candidates.length === 0) return null
  const activeCandidate = candidates[activeIndex]
  const groups = groupByRaise(candidates)
  return (
    <div className="nature-candidates">
      <div className="nature-candidates-title">全部性格候选（按强化维度）</div>
      <div className="nature-raise-groups">
        {groups.map((group) => (
          <section key={group.raise} className="nature-raise-group">
            <div className="nature-raise-group-title">
              <span>强化{STAT_LABELS[group.raise]}</span>
              <span>{group.items.length} 个</span>
            </div>
            <div className="nature-decision-groups">
              {NATURE_DECISION_ORDER.map((decision) => {
                const items = group.items.filter((item) => item.decision === decision)
                if (items.length === 0) return null
                return (
                  <div key={decision} className="nature-decision-group">
                    <div className="nature-decision-group-title">
                      <span className={`nature-candidate-tag ${decision}`}>
                        {NATURE_DECISION_LABELS[decision]}
                      </span>
                      <span>{items.length} 个</span>
                    </div>
                    <ul className="nature-candidates-list">
                      {items.map((c) => (
                        <NatureCandidateListItem
                          key={c.id || `${c.raise}-${c.lower}`}
                          candidate={c}
                          candidates={candidates}
                          activeCandidate={activeCandidate}
                          onSelect={onSelect}
                        />
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

const NATURE_DECISION_ORDER = ['recommended', 'keepable', 'notRecommended']

function groupByRaise(items = []) {
  const order = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']
  return order
    .map((raise) => ({
      raise,
      items: items.filter((item) => item.raise === raise),
    }))
    .filter((group) => group.items.length > 0)
}

function NatureCandidateListItem({ candidate, candidates, activeCandidate, onSelect }) {
  const candidateIndex = candidates.indexOf(candidate)
  const isActive = candidate === activeCandidate
  return (
    <li>
      <button
        type="button"
        className={`nature-candidate ${isActive ? 'active' : ''}`}
        onClick={() => onSelect(candidateIndex)}
      >
        <span className={`nature-candidate-tag ${candidate.decision}`}>
          {NATURE_DECISION_LABELS[candidate.decision]}
        </span>
        <span className="nature-candidate-name">{natureName(candidate)}</span>
        <span className="nature-candidate-role">{natureModifierSummary(candidate)}</span>
        <span className="nature-candidate-score">{candidate.score.toFixed(1)}</span>
      </button>
    </li>
  )
}


function NaturePriorityRules() {
  return (
    <section className="nature-priority-rules" aria-label="推荐优先级规则">
      <strong>推荐优先级</strong>
      <ol>
        <li>先按精灵定位与技能路线判断主攻 / 耐久 / 速度 / 辅助方向。</li>
        <li>推荐优先强化主路线关键属性，避免弱化主输出、关键速度线或核心耐久。</li>
        <li>可保留表示捕捉时可先留档；不推荐通常存在硬风险或被同强化方向更优性格支配。</li>
      </ol>
    </section>
  )
}

function NatureResult({ nature, baseStats, adjustedStats, reasoning }) {
  if (!nature) return null
  const speedProfile = nature.speedProfile
  const highlights = natureHighlights(nature)

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

      {highlights.length > 0 && (
        <div className="nature-highlight-card">
          <div className="nature-highlight-title">解析重点</div>
          <ul className="nature-highlight-list">
            {highlights.map((item) => (
              <li key={`${item.type}-${item.text}`} className={`nature-highlight-item ${item.type}`}>
                <span>{item.label}</span>
                <strong>{item.text}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NatureStatDistribution stats={baseStats} />

      {nature.skillProfile && (
        <NatureSkillInsight skillProfile={nature.skillProfile} formulaAssist={nature.formulaAssist} />
      )}

      {speedProfile && (
        <div className={`nature-speed-note ${speedProfile.concern.level}`}>
          <strong>速度线：{speedProfile.concern.label}</strong>
          <span>基础速度 {speedProfile.base}（{speedProfile.baseTier}）。</span>
          <details className="nature-inline-disclosure">
            <summary>查看速度线解释</summary>
            <span>
              最近锚点 {speedProfile.nearestAnchor}。{speedProfile.concern.reason}；{speedProfile.note}
            </span>
          </details>
        </div>
      )}

      <details className="nature-detail-disclosure">
        <summary>查看完整推荐理由 / 风险</summary>
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
      </details>

      <NatureStatsBars nature={nature} baseStats={baseStats} adjustedStats={adjustedStats} />
    </div>
  )
}


function NatureSkillInsight({ skillProfile, formulaAssist }) {
  const breakdown = skillProfile.breakdown || {}
  const routeLabel = {
    physical: '物理路线',
    magical: '魔法路线',
    mixed: '双攻接近',
    unknown: '未知',
  }[skillProfile.attackMode] || '未知'
  const formulaRouteLabel = {
    physical: '物理更高',
    magical: '魔法更高',
    mixed: '物理/魔法接近',
    unknown: '未知',
  }[formulaAssist?.routeHint] || '未知'

  return (
    <div className="nature-skill-note">
      <strong>技能线索</strong>
      <span>{skillProfile.summary}</span>
      <details className="nature-inline-disclosure nature-skill-breakdown">
        <summary>技能数值 / 公式辅助</summary>
        <div className="nature-skill-metrics">
          <div>
            <span>技能路线</span>
            <strong>{routeLabel}</strong>
            <small>路线差 {formatSignedNumber(skillProfile.routeGap)}</small>
          </div>
          <div>
            <span>技能数量</span>
            <strong>物理 {breakdown.physicalCount || 0} / 魔法 {breakdown.magicalCount || 0}</strong>
            <small>状态 {breakdown.statusCount || 0}；攻击占比 {formatPercent(breakdown.attackShare)}</small>
          </div>
          <div>
            <span>攻击占比</span>
            <strong>物理 {formatPercent(breakdown.physicalShare)} / 魔法 {formatPercent(breakdown.magicalShare)}</strong>
            <small>路线分 {formatNumber(breakdown.physicalRouteScore)} : {formatNumber(breakdown.magicalRouteScore)}</small>
          </div>
          <div>
            <span>平均威力</span>
            <strong>物理 {formatNumber(breakdown.physicalAveragePower)} / 魔法 {formatNumber(breakdown.magicalAveragePower)}</strong>
            <small>攻击均值 {formatNumber(breakdown.attackAveragePower)}</small>
          </div>
          {formulaAssist && (
            <div>
              <span>公式辅助</span>
              <strong>{formulaRouteLabel}</strong>
              <small>
                物理线 {formatNumber(formulaAssist.physicalOutput)} / 魔法线 {formatNumber(formulaAssist.magicalOutput)}
                {formulaAssist.outputRatio != null ? `；比值 ${formatNumber(formulaAssist.outputRatio)}` : ''}
              </small>
            </div>
          )}
          {formulaAssist && (
            <div>
              <span>耐久辅助</span>
              <strong>物耐 {formatNumber(formulaAssist.physicalBulk)} / 魔耐 {formatNumber(formulaAssist.magicalBulk)}</strong>
              <small>短板耐久 {formatNumber(formulaAssist.balancedBulk)}</small>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  if (Math.abs(number) >= 1000) return Math.round(number).toLocaleString('zh-CN')
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

function formatSignedNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  const text = formatNumber(Math.abs(number))
  if (number > 0) return `+${text}`
  if (number < 0) return `-${text}`
  return text
}

function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0%'
  return `${Math.round(number * 100)}%`
}

function NaturePveOverview({ candidates }) {
  const summary = pveOverviewSummary(candidates)

  if (!summary) return null

  return (
    <section className={`nature-pve-note ${summary.level}`} aria-label="PVE 培养投入提示">
      <div className="nature-pve-note-header">
        <strong>PVE 培养投入</strong>
        <span className="nature-pve-rating">
          {summary.badge}
          <span className="nature-pve-stars" aria-label={`PVE 星级：${summary.stars} / 5`}>
            {pveStarText(summary.stars)}
          </span>
        </span>
      </div>
      <div className="nature-pve-verdict">{summary.verdict}</div>
      {summary.tags.length > 0 && (
        <div className="nature-pve-tags">
          {summary.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}
      <div className="nature-pve-meta">
        {summary.role && <span>定位：{summary.role}</span>}
        <span>主属性：{summary.primaryStat}</span>
        <span>主性格：{summary.capture}</span>
        {summary.alternatives && <span>备选：{summary.alternatives}</span>}
      </div>
      <details className="nature-inline-disclosure nature-pve-note-footnote">
        <summary>详细依据 / 口径</summary>
        <span>{summary.detail || '暂无额外机制依据。'} PVP 不计培养投入；异色/炫彩是否培养，看 PVE 强度、机制和队伍需求。</span>
      </details>
    </section>
  )
}

const PVE_TIER_SCALE = [
  { key: 'priority', label: '优先培养', level: 'priority' },
  { key: 'suitable', label: '适合培养', level: 'good' },
  { key: 'situational', label: '按需培养', level: 'situational' },
  { key: 'watch', label: '可留观望', level: 'watch' },
  { key: 'skip', label: '不建议投入', level: 'risk' },
]

function pveStarText(stars = 0) {
  const filled = Math.max(0, Math.min(5, Number(stars) || 0))
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`
}

function pveOverviewSummary(candidates = []) {
  if (candidates.length === 0) return null
  const recommended = candidates.filter((item) => item.decision === 'recommended')
  const keepable = candidates.filter((item) => item.decision === 'keepable')
  const pvePool = [...recommended, ...keepable]
  const profile = pveSpeciesProfile(candidates)
  const best = bestPveCandidate(pvePool, profile) || recommended[0] || keepable[0] || candidates[0]
  const pairCandidates = pvePairedCandidates(pvePool, profile, best)
  const primaryName = pveNatureSummary(best, pairCandidates) || '暂无推荐性格'
  const primaryStat = pvePrimaryStatSummary(best, pairCandidates)
  const alternatives = pveAlternativeSummary(best, pairCandidates)
  const hasViableNature = pvePool.some((item) => item && !item.hardRisk)
  const detail = profile.basis.length ? `依据：${profile.basis.join('；')}。` : ''
  const tier = PVE_TIER_SCALE.find((item) => item.key === profile.tier) || PVE_TIER_SCALE.at(-1)
  const tierIndex = PVE_TIER_SCALE.findIndex((item) => item.key === tier.key) + 1
  const stars = Math.max(1, PVE_TIER_SCALE.length - tierIndex + 1)

  if (!hasViableNature) {
    return {
      level: 'risk',
      badge: profile.score >= 5 ? '需换性格' : '不建议投入',
      verdict: profile.score >= 5
        ? '精灵机制有 PVE 价值，但当前候选性格风险过高，建议另抓。'
        : '当前未发现足够 PVE 机制或可用性格，先收藏不投入。',
      capture: '无',
      primaryStat: '无',
      role: profile.label,
      alternatives: '',
      tags: profile.tags,
      detail,
      tierKey: profile.score >= 5 ? 'skip' : tier.key,
      stars: 1,
    }
  }

  if (profile.tier === 'priority') {
    return {
      level: 'priority',
      badge: '优先培养',
      verdict: `${profile.label}，资源投入优先级高；优先看${primaryName}。`,
      capture: primaryName,
      primaryStat,
      role: profile.label,
      alternatives,
      tags: profile.tags,
      detail,
      tierKey: tier.key,
      stars,
    }
  }

  if (profile.tier === 'suitable') {
    return {
      level: 'good',
      badge: '适合培养',
      verdict: `${profile.label}，适合 PVE 投入；性格看${primaryName}。`,
      capture: primaryName,
      primaryStat,
      role: profile.label,
      alternatives,
      tags: profile.tags,
      detail,
      tierKey: tier.key,
      stars,
    }
  }

  if (profile.tier === 'situational') {
    return {
      level: 'situational',
      badge: '按需培养',
      verdict: `${profile.label}，有对应副本/队伍需求再投入；当前可看${primaryName}。`,
      capture: primaryName,
      primaryStat,
      role: profile.label,
      alternatives,
      tags: profile.tags,
      detail,
      tierKey: tier.key,
      stars,
    }
  }

  if (profile.tier === 'skip') {
    return {
      level: 'risk',
      badge: '不建议投入',
      verdict: '当前没有识别到足够 PVE 投入价值；捕捉可留不等于值得培养。',
      capture: primaryName,
      primaryStat,
      role: profile.label,
      alternatives,
      tags: profile.tags,
      detail,
      tierKey: tier.key,
      stars,
    }
  }

  return {
    level: 'watch',
    badge: '可留观望',
    verdict: `${profile.label}，捕捉可留不等于 PVE 优先；先收藏观望。`,
    capture: primaryName,
    primaryStat,
    role: profile.label,
    alternatives,
    tags: profile.tags,
    detail,
    tierKey: tier.key,
    stars,
  }
}

function pvePairedCandidates(candidates = [], profile = null, best = null) {
  const stats = profile?.pairedStats || []
  if (stats.length === 0) return []
  return stats
    .map((stat) => bestPveCandidate(candidates.filter((candidate) => candidate.raise === stat), profile))
    .filter((candidate) => candidate && candidate !== best)
    .filter((candidate, index, list) => list.findIndex((item) => natureName(item) === natureName(candidate)) === index)
}

function pveNatureSummary(best, alternatives = []) {
  const names = [best, ...alternatives].filter(Boolean).map(natureName)
  return [...new Set(names)].join(' / ')
}

function pvePrimaryStatSummary(best, alternatives = []) {
  const stats = [best, ...alternatives]
    .filter(Boolean)
    .map((candidate) => STAT_LABELS[candidate.raise])
    .filter(Boolean)
  return [...new Set(stats)].join(' / ') || '无'
}

function pveAlternativeSummary(best, alternatives = []) {
  const bestName = best ? natureName(best) : ''
  const names = alternatives
    .map(natureName)
    .filter((name) => name && name !== bestName)
  return [...new Set(names)].join(' / ')
}

function bestPveCandidate(candidates = [], profile = null) {
  const preferredStats = profile?.preferredStats || []
  return [...candidates]
    .filter((candidate) => candidate && !candidate.hardRisk)
    .sort((a, b) => {
      const preferredDiff = preferredStatRank(b, preferredStats) - preferredStatRank(a, preferredStats)
      if (preferredDiff !== 0) return preferredDiff
      return pveCandidateRank(b, profile) - pveCandidateRank(a, profile) || b.score - a.score
    })[0] || null
}

function preferredStatRank(candidate, preferredStats = []) {
  const index = preferredStats.indexOf(candidate?.raise)
  return index < 0 ? 0 : preferredStats.length - index
}

function pveCandidateRank(candidate, profile = null) {
  const breakdown = candidate.skillProfile?.breakdown || {}
  const raisesAttack = ['patk', 'matk'].includes(candidate.raise)
  const raisesSpeed = candidate.raise === 'spd'
  const raisesBulk = ['hp', 'pdef', 'mdef'].includes(candidate.raise)
  const hasOutputRole = candidate.roleTags?.some((role) =>
    ['mixedAttacker', 'physicalAttacker', 'magicalAttacker'].includes(role),
  )
  const hasBulkRole = candidate.roleTags?.some((role) =>
    ['bulky', 'support', 'physicalWall', 'magicalWall'].includes(role),
  )
  const hasSpeedRole = candidate.roleTags?.some((role) => role === 'fastAttacker')
  const strongOutput =
    Number(breakdown.attackAveragePower) >= 80 &&
    Number(breakdown.attackCount) >= 8 &&
    hasOutputRole
  const riskySpeedBranch =
    raisesSpeed &&
    candidate.warnings.some((warning) => /双攻|弱化另一攻|削弱.*攻击|冲突/.test(warning))

  let rank = candidate.score
  if (raisesAttack && strongOutput && profile?.tier === 'priority') rank += 36
  if (raisesAttack && strongOutput && profile?.tier !== 'priority') rank += 16
  if (raisesBulk && hasBulkRole) rank += profile?.mechanism === 'tank' ? 36 : 24
  if (raisesSpeed && hasSpeedRole) rank += profile?.mechanism === 'carry' ? 18 : 10
  if (raisesSpeed && !hasSpeedRole) rank -= 28
  if (riskySpeedBranch) rank -= 26
  if (candidate.warnings.length > 0) rank -= Math.min(candidate.warnings.length * 4, 24)
  return rank
}

function pveSpeciesProfile(candidates = []) {
  const sample = candidates.find(Boolean) || {}
  const skillProfile = sample.skillProfile || {}
  const breakdown = skillProfile.breakdown || {}
  const roleTags = sample.roleTags || []
  const stats = baseStatsFromCandidate(sample)
  const texts = skillProfile.texts || []
  const joined = texts.join('；')
  const hasRecommendedCore = candidates.some((item) =>
    item.decision === 'recommended' &&
    !item.hardRisk &&
    ['patk', 'matk', 'spd'].includes(item.raise) &&
    item.warnings.length === 0
  )
  const attackCount = Number(breakdown.attackCount) || 0
  const attackShare = Number(breakdown.attackShare) || 0
  const attackAveragePower = Number(breakdown.attackAveragePower) || 0
  const physicalCount = Number(breakdown.physicalCount) || 0
  const magicalCount = Number(breakdown.magicalCount) || 0
  const physicalShare = Number(breakdown.physicalShare) || 0
  const magicalShare = Number(breakdown.magicalShare) || 0
  const physicalRouteScore = Number(breakdown.physicalRouteScore) || 0
  const magicalRouteScore = Number(breakdown.magicalRouteScore) || 0
  const strongAttackStat = Math.max(stats.patk || 0, stats.matk || 0)
  const hasSingleOutputRole = roleTags.some((role) => ['physicalAttacker', 'magicalAttacker'].includes(role))
  const hasFastRole = roleTags.includes('fastAttacker')
  const hasBulkRole = roleTags.some((role) =>
    ['bulky', 'support', 'physicalWall', 'magicalWall', 'energyCycle'].includes(role),
  )
  const dotPattern = /中毒|剧毒|灼烧|烧伤|寄生|星陨|持续伤害|灼烧.*层|中毒.*层|回合结束.*(?:中毒|灼烧|寄生|星陨|持续伤害|伤害)/
  const dotCount = texts.filter((text) => dotPattern.test(text)).length
  const dotShare = texts.length ? dotCount / texts.length : 0
  const hasDot = dotCount >= 4 && (dotShare >= 0.18 || dotCount >= 8)
  const hasPercentOrTrueDamage = /百分比|最大生命|生命值上限|真实伤害|真伤|固定伤害/.test(joined)
  const hasLoop = Boolean(skillProfile.energy || /能耗-|能耗降低|回复\d*能量|获得\d*能量|自动回能|技能循环|连续释放/.test(joined))
  const hasTeamUtility = Boolean(skillProfile.boostTransfer)
  const hasSustain = Boolean(skillProfile.sustain || skillProfile.defense)
  const hasControl = Boolean(skillProfile.control)
  const hasAdvancedMechanism = hasDot || hasPercentOrTrueDamage || hasTeamUtility
  const hasFocusedOutputRoute =
    (
      (stats.patk || 0) >= 120 &&
      physicalCount >= 8 &&
      physicalShare >= 0.65 &&
      physicalRouteScore >= 12
    ) ||
    (
      (stats.matk || 0) >= 120 &&
      magicalCount >= 8 &&
      magicalShare >= 0.65 &&
      magicalRouteScore >= 12
    )
  const highOutputEvidence =
    hasSingleOutputRole &&
    strongAttackStat >= 115 &&
    attackCount >= 4 &&
    (attackAveragePower >= 75 || hasFocusedOutputRoute)
  const fastCarryEvidence =
    highOutputEvidence &&
    hasFastRole &&
    (stats.spd || 0) >= 110 &&
    hasRecommendedCore &&
    (attackShare >= 0.45 || attackAveragePower >= 90)
  const carrySuitableEvidence =
    highOutputEvidence &&
    (hasFastRole || strongAttackStat >= 130 || attackAveragePower >= 90)
  const mechanismScore =
    (hasDot ? 2 : 0) +
    (hasPercentOrTrueDamage ? 2 : 0) +
    (hasLoop ? 1.5 : 0) +
    (hasTeamUtility ? 2 : 0) +
    (hasSustain ? 1 : 0) +
    (hasControl ? 0.8 : 0)
  const basis = [
    highOutputEvidence && `输出线：主攻 ${strongAttackStat} / 攻击技能 ${attackCount} / 均威 ${formatNumber(attackAveragePower)}`,
    hasDot && '存在 DOT/层数/回合结束触发线索',
    hasPercentOrTrueDamage && '存在百分比或真伤线索',
    hasLoop && '存在能量/能耗循环线索',
    hasTeamUtility && '存在队伍增益或传递线索',
    hasSustain && '存在续航/减伤/站场线索',
    hasControl && '存在控制/异常线索',
  ].filter(Boolean)
  const tags = [
    hasDot && 'DOT/层数',
    hasPercentOrTrueDamage && '百分比/真伤',
    hasTeamUtility && '队伍插件',
    hasLoop && '能量循环',
    hasSustain && '续航站场',
    hasControl && !hasDot && '控制异常',
  ].filter(Boolean).slice(0, 4)

  if (fastCarryEvidence || (highOutputEvidence && hasRecommendedCore && mechanismScore < 2.5)) {
    return {
      tier: 'priority',
      mechanism: 'carry',
      label: hasFastRole ? '高速主 C / 清场输出' : '主 C 输出',
      preferredStats: pvePreferredStats(skillProfile, stats, 'carry'),
      pairedStats: pveCarryPairedStats(skillProfile, stats),
      score: 8 + mechanismScore,
      basis,
      tags,
    }
  }

  if (carrySuitableEvidence) {
    return {
      tier: 'suitable',
      mechanism: 'carry',
      label: hasFastRole ? '高速输出 / PVE 打手' : '输出打手 / PVE 补强',
      preferredStats: pvePreferredStats(skillProfile, stats, 'carry'),
      pairedStats: pveCarryPairedStats(skillProfile, stats),
      score: 6 + mechanismScore,
      basis,
      tags: tags.filter((tag) => tag !== '续航站场' && tag !== '控制异常'),
    }
  }

  if (hasPercentOrTrueDamage || hasTeamUtility || (hasDot && mechanismScore >= 3.5)) {
    const label = hasDot
      ? 'DOT 消耗位'
      : hasPercentOrTrueDamage
        ? '机制消耗位'
        : '功能循环 / 队伍插件'
    return {
      tier: 'suitable',
      mechanism: hasDot || hasPercentOrTrueDamage ? 'dot' : 'utility',
      label,
      preferredStats: pvePreferredStats(skillProfile, stats, hasDot || hasPercentOrTrueDamage ? 'dot' : 'utility'),
      pairedStats: highOutputEvidence ? pveCarryPairedStats(skillProfile, stats) : [],
      score: 6 + mechanismScore,
      basis,
      tags,
    }
  }

  if (
    (hasBulkRole && (hasSustain || mechanismScore >= 1.5)) ||
    (hasLoop && hasControl) ||
    (hasLoop && hasSustain)
  ) {
    const utilityLabel = hasAdvancedMechanism ? '功能循环 / 机制位' : '功能循环 / 对策位'
    return {
      tier: 'situational',
      mechanism: hasLoop && (hasControl || hasSustain) ? 'utility' : 'tank',
      label: hasLoop && (hasControl || hasSustain) ? utilityLabel : '站场功能 / 按需承伤位',
      preferredStats: pvePreferredStats(skillProfile, stats, hasLoop && (hasControl || hasSustain) ? 'utility' : 'tank'),
      pairedStats: highOutputEvidence ? pveCarryPairedStats(skillProfile, stats) : [],
      score: 4 + mechanismScore,
      basis,
      tags,
    }
  }

  if (highOutputEvidence || hasLoop || hasControl || hasSustain) {
    return {
      tier: 'watch',
      mechanism: highOutputEvidence ? 'carry' : 'utility',
      label: highOutputEvidence ? '输出补位' : '功能补位',
      preferredStats: pvePreferredStats(skillProfile, stats, highOutputEvidence ? 'carry' : 'utility'),
      pairedStats: highOutputEvidence ? pveCarryPairedStats(skillProfile, stats) : [],
      score: 3 + mechanismScore,
      basis,
      tags,
    }
  }

  return {
    tier: 'skip',
    mechanism: 'unknown',
    label: 'PVE 机制不明确',
    preferredStats: [],
    score: mechanismScore,
    basis,
    tags,
  }
}

function baseStatsFromCandidate(candidate = {}) {
  return Object.fromEntries(STATS_DIMENSIONS.map((dimension) => {
    const adjusted = Number(candidate.adjustedStats?.[dimension.key]) || 0
    const delta = Number(candidate.deltas?.[dimension.key]) || 0
    return [dimension.key, adjusted - delta]
  }))
}

function pvePreferredStats(skillProfile = {}, stats = {}, mechanism = 'utility') {
  const mode = skillProfile.attackMode
  const attackStat = mode === 'physical' ? 'patk' : mode === 'magical' ? 'matk' : null
  const speedFirst = (stats.spd || 0) >= 100 || skillProfile.speedRequired || skillProfile.control
  if (mechanism === 'carry') {
    return [
      speedFirst && 'spd',
      attackStat,
      'hp',
      'pdef',
      'mdef',
    ].filter(Boolean)
  }
  if (mechanism === 'dot') {
    return [
      speedFirst && 'spd',
      'hp',
      (stats.mdef || 0) >= (stats.pdef || 0) ? 'mdef' : 'pdef',
      attackStat,
    ].filter(Boolean)
  }
  if (mechanism === 'tank') {
    return [
      'hp',
      (stats.pdef || 0) <= (stats.mdef || 0) ? 'pdef' : 'mdef',
      (stats.pdef || 0) > (stats.mdef || 0) ? 'pdef' : 'mdef',
    ]
  }
  return [
    speedFirst && 'spd',
    'hp',
    attackStat,
    'pdef',
    'mdef',
  ].filter(Boolean)
}

function pveCarryPairedStats(skillProfile = {}, stats = {}) {
  const mode = skillProfile.attackMode
  const attackStat = mode === 'physical' ? 'patk' : mode === 'magical' ? 'matk' : null
  const speedUseful = (stats.spd || 0) >= 95 || skillProfile.speedRequired || skillProfile.control
  return [
    speedUseful && 'spd',
    attackStat,
  ].filter(Boolean)
}

function natureHighlights(nature) {
  const highlights = []
  const push = (type, label, text) => {
    if (!text || highlights.some((item) => item.text === text)) return
    highlights.push({ type, label, text })
  }
  if (nature.dominatedBy) {
    push('risk', '支配', `同类强化里 ${nature.dominatedBy} 代价更低`)
  }
  if (nature.decision === 'notRecommended') {
    const mainWarning = nature.warnings.find((warning) => /支配|硬性|核心|短板|生命|速度|魔防|物防|冲突/.test(warning))
    push('risk', '不推荐', mainWarning || nature.warnings[0])
  } else if (nature.decision === 'recommended') {
    const mainReason = nature.reasons.find((reason) => /低成本|核心|代价较低|公式辅助|技能|生命|速度/.test(reason))
    push('good', '首选', mainReason || nature.reasons[0])
  } else {
    const mainReason = nature.reasons.find((reason) => /低成本|可保留|单攻|公式辅助|技能|生命|耐久/.test(reason))
    push('good', '可留依据', mainReason || nature.reasons[0])
    const mainWarning = nature.warnings.find((warning) => /风险|冲突|短板|核心|双攻|不应|削弱/.test(warning))
    push('warn', '主要风险', mainWarning || nature.warnings[0])
  }
  const lowerWarning = nature.warnings.find((warning) => warning.includes(`弱化${STAT_LABELS[nature.lower]}`))
  push('warn', '牺牲项', lowerWarning)
  return highlights.slice(0, 3)
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
