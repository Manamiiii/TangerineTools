// 性格推荐工具：手动录入或从场景资料库带入六维 + 特性标签，
// 推荐一组强化/弱化搭配，并展示可解释的推荐理由。
// 除首选之外，工具还会同时暴露若干候选方案（推荐/可选清单），
// 用户可以直接点击某个候选，替换主结果卡片的展示内容。

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Plus, Sparkles } from 'lucide-react'
import { db } from '../db.js'
import { STATS_DIMENSIONS } from '../constants.js'
import {
  evaluateAllNatures,
  evaluateNatureProfiles,
  explainNatureRecommendation,
  natureName,
  NATURE_DECISION_LABELS,
  STAT_LABELS,
} from '../domain/nature.js'
import { pveOverviewSummary, pveStarText } from '../domain/naturePve.js'
import { buildNatureAnalysisInput, buildPopulationStatSummary, extractRowSummary } from '../domain/natureRowAdapter.js'
import { buildOwnedNatureIndex } from '../domain/owned.js'
import {
  compareRockKingdomCreatureRows,
  buildEvolutionReferenceGroups,
  getSameNumberRows,
  isRockKingdomNatureSelectableRow,
  visibleRockKingdomCreatureRows,
} from '../domain/rockKingdom.js'
import { TRAIT_TAG_OPTIONS } from '../presets/rockKingdom.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { EmptyState, FormRow, OptionTag, SearchableSelect, StatsChart } from './common.jsx'
import { OwnedFormModal } from './owned.jsx'

const EMPTY_STATS = Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, '']))
const TRAIT_TAG_LABELS = Object.fromEntries(TRAIT_TAG_OPTIONS.map((o) => [o.value, o.label]))

function TraitTagList({ value }) {
  const selected = Array.isArray(value) ? value : []
  const options = TRAIT_TAG_OPTIONS.filter((option) => selected.includes(option.value))
  if (options.length === 0) return <span className="nature-empty-tags">所选精灵没有特性标签</span>
  return (
    <div className="nature-trait-tags">
      {options.map((option) => <OptionTag key={option.value} option={option} />)}
    </div>
  )
}

export function NatureTool({ scene }) {
  const emptyInput = {
    name: '',
    stats: { ...EMPTY_STATS },
    traitTags: [],
    skillInfo: { skills: [] },
    analysisProfiles: [],
    sourceRowId: '',
    sourceMeta: null,
    ownedNatures: {},
    formAnalysis: null,
    formProfiles: [],
    populationStats: null,
    ownedContext: null,
  }
  const [draftInput, setDraftInput] = useState(emptyInput)
  const [input, setInput] = useState(draftInput)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [quickAddNature, setQuickAddNature] = useState(null)

  function handleQuickAddSaved() {
    if (!quickAddNature) return
    const updateOwned = (previous) => ({
      ...previous,
      ownedNatures: {
        ...previous.ownedNatures,
        [quickAddNature.id]: (previous.ownedNatures?.[quickAddNature.id] || 0) + 1,
      },
    })
    setInput(updateOwned)
    setDraftInput(updateOwned)
    setQuickAddNature(null)
  }

  function updateStat(key, value) {
    setDraftInput((prev) => ({ ...prev, stats: { ...prev.stats, [key]: value } }))
  }

  function handleImport(payload) {
    if (!payload) {
      const next = { ...emptyInput, stats: { ...EMPTY_STATS }, skillInfo: { skills: [] } }
      setDraftInput(next)
      setInput(next)
      setSelectedIndex(0)
      return
    }
    const { name, stats, traitTags, skillInfo, analysisProfiles, formProfiles, sourceRowId, sourceMeta, ownedNatures, formAnalysis, populationStats, ownedContext } = payload
    const next = {
      name: name || '',
      stats: { ...EMPTY_STATS, ...stats },
      traitTags: traitTags || [],
      skillInfo: skillInfo || { skills: [] },
      analysisProfiles: analysisProfiles || [],
      formProfiles: formProfiles || [],
      sourceRowId: sourceRowId || '',
      sourceMeta: sourceMeta || null,
      ownedNatures: ownedNatures || {},
      formAnalysis: formAnalysis || null,
      populationStats: populationStats || null,
      ownedContext: ownedContext || null,
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
    () => evaluateNatureProfiles(numericStats, input.traitTags, input.skillInfo, input.analysisProfiles, {
      primaryProfileId: input.sourceRowId,
      primaryProfileLabel: [input.name, input.sourceMeta?.form].filter(Boolean).join(' · ') || '当前形态',
    }),
    [numericStats, input.traitTags, input.skillInfo, input.analysisProfiles, input.sourceMeta?.form, input.sourceRowId, input.name],
  )
  const pveForms = useMemo(() => (input.formProfiles || []).map((profile) => ({
    ...profile,
    candidates: evaluateAllNatures(profile.stats, profile.traitTags, profile.skillInfo),
  })), [input.formProfiles])
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

      {draftInput.sourceRowId ? (
        <CreatureAnalysisOverview input={draftInput} />
      ) : (
        <ManualNatureInput
          input={draftInput}
          onNameChange={(name) => setDraftInput((prev) => ({ ...prev, name }))}
          onStatChange={updateStat}
          onCalculate={() => {
            setInput(draftInput)
            setSelectedIndex(0)
          }}
        />
      )}

      {hasAnyStat ? (
        <>
          <NaturePveOverview forms={pveForms} />
          <div className="nature-workbench">
            <NatureCandidateList
              candidates={candidates}
              activeIndex={activeIndex}
              onSelect={setSelectedIndex}
              ownedNatures={input.ownedNatures}
              onQuickAdd={input.ownedContext ? setQuickAddNature : null}
            />
            <NatureResult
              nature={nature}
              baseStats={numericStats}
              adjustedStats={adjustedStats}
              reasoning={reasoning}
              fixedNature={candidates[0]}
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="选择精灵后查看推荐"
          description="在上方输入框中搜索精灵；也可以展开手动输入六维。"
        />
      )}
      {quickAddNature && input.ownedContext && (
        <OwnedFormModal
          table={input.ownedContext.table}
          fields={input.ownedContext.fields.filter((field) => !field.hidden)}
          rows={input.ownedContext.rows}
          collectionMode={input.ownedContext.table.collectionMode || 'single'}
          initialValues={{
            [input.ownedContext.referenceKey]: input.sourceRowId,
            [input.ownedContext.natureKey]: quickAddNature.id,
          }}
          onClose={() => setQuickAddNature(null)}
          onSaved={handleQuickAddSaved}
        />
      )}
    </div>
  )
}

function CreatureAnalysisOverview({ input }) {
  const meta = input.sourceMeta || {}
  const chartStats = STATS_DIMENSIONS.map((dimension) => ({
    key: dimension.key,
    label: dimension.label,
    value: Number(input.stats[dimension.key]) || 0,
  }))
  const traits = uniqueFormTraits(input.formAnalysis?.forms || [])
  return (
    <section className="nature-creature-overview">
      <div className="nature-creature-identity">
        {meta.image && <img src={meta.image} alt="" />}
        <div>
          <strong>{input.name || '未命名精灵'}</strong>
          <span>{[meta.no, meta.form].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      <div className="nature-overview-stats-panel">
        <StatsChart stats={chartStats} variant="bars" size="sm" />
        <div className="nature-stat-ranks">
          {(input.populationStats?.dimensions || []).map((dimension) => (
            <span key={dimension.key} title={`全资料范围 ${dimension.min}–${dimension.max}`}>
              <strong>P{dimension.percentile}</strong>
              <small>约第 {dimension.rank}/{input.populationStats.count}</small>
            </span>
          ))}
        </div>
        {input.populationStats?.count > 0 && (
          <details className="nature-population-baseline">
            <summary>查看全部 {input.populationStats.count} 个可分析形态的六维统计基线</summary>
            <div className="nature-population-grid">
              {input.populationStats.dimensions.map((dimension) => (
                <span key={dimension.key}>
                  <strong>{dimension.label}</strong>
                  <small>{dimension.min} · P25 {dimension.p25} · 中位 {dimension.p50} · P75 {dimension.p75} · {dimension.max}</small>
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
      <div className="nature-overview-evidence">
        <div>
          <small>特性标签</small>
          <TraitTagList value={input.traitTags} />
        </div>
        <span className="nature-evidence-count">{input.skillInfo?.skills?.length || 0} 个技能参与分析</span>
      </div>
      {traits.length > 0 && (
        <div className="nature-form-traits">
          {traits.map((trait) => (
            <article key={`${trait.name}-${trait.description}`} className="nature-form-trait">
              {trait.icon && <img src={trait.icon} alt="" />}
              <div>
                <strong>{trait.name}</strong>
                <small>{trait.forms.join(' / ')}</small>
                {trait.description && <p>{trait.description}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      <FormAnalysis analysis={input.formAnalysis} />
    </section>
  )
}

function uniqueFormTraits(forms = []) {
  const byTrait = new Map()
  for (const form of forms) {
    const key = `${form.traitName || ''}::${form.traitDesc || ''}::${form.traitIcon || ''}`
    const existing = byTrait.get(key) || {
      name: form.traitName || '无特性',
      description: form.traitDesc || '',
      icon: form.traitIcon || '',
      forms: [],
    }
    existing.forms.push([form.name, form.form].filter(Boolean).join(' · '))
    byTrait.set(key, existing)
  }
  return [...byTrait.values()]
}

function ManualNatureInput({ input, onNameChange, onStatChange, onCalculate }) {
  return (
    <details className="nature-manual-panel">
      <summary>不选择精灵，手动输入六维</summary>
      <div className="nature-manual-content">
        <FormRow label="名称（可选）">
          <input className="input" value={input.name} onChange={(event) => onNameChange(event.target.value)} placeholder="精灵名称" />
        </FormRow>
        <div className="nature-stats-grid">
          {STATS_DIMENSIONS.map((dimension) => (
            <label key={dimension.key} className="nature-stat-input">
              <span>{dimension.label}</span>
              <input type="number" className="input" value={input.stats[dimension.key]} onChange={(event) => onStatChange(dimension.key, event.target.value)} />
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={onCalculate}>计算推荐</button>
      </div>
    </details>
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
  const ownedContext = useLiveQuery(async () => {
    const ownedTables = await db.catalogTables
      .where('sceneId')
      .equals(scene.id)
      .filter((table) => table.kind === 'owned')
      .toArray()
    const sources = []
    let quickAddContext = null
    for (const table of ownedTables) {
      const ownedFields = await db.catalogFields.where('tableId').equals(table.id).toArray()
      const refFields = ownedFields.filter((field) => field.type === 'reference' && field.referenceTableId === creatureTableId)
      const natureField = ownedFields.find((field) => field.key === 'nature' || field.name === '性格')
      if (refFields.length === 0 || !natureField) continue
      const ownedRows = await db.catalogRows.where('tableId').equals(table.id).toArray()
      sources.push({
        rows: ownedRows,
        referenceKeys: refFields.map((field) => field.key),
        natureKey: natureField.key,
      })
      if (!quickAddContext) {
        quickAddContext = {
          table,
          fields: ownedFields.sort((a, b) => a.order - b.order),
          rows: ownedRows,
          referenceKey: refFields[0].key,
          natureKey: natureField.key,
        }
      }
    }
    const creatureRows = await db.catalogRows.where('tableId').equals(creatureTableId).toArray()
    return {
      index: buildOwnedNatureIndex(sources, buildEvolutionReferenceGroups(creatureRows)),
      quickAddContext,
    }
  }, [scene.id, creatureTableId])

  if (creatureTable === undefined || !fields || !rows || !skillRows || !ownedContext) return null
  if (!creatureTable) {
    return (
      <div className="nature-import-panel nature-import-empty">
        未找到洛克王国「精灵基础资料」表，可先等待预置资料初始化完成，或直接手动输入六维后计算。
      </div>
    )
  }

  const visibleRows = visibleRockKingdomCreatureRows(rows).sort(compareRockKingdomCreatureRows)
  const selectableRows = visibleRows.filter(isRockKingdomNatureSelectableRow)
  const summaries = selectableRows.map((row) => ({ row, summary: extractRowSummary(row, fields) }))
  const options = summaries.map(({ row, summary }) => {
    const label = [summary.no, summary.name, summary.form].filter(Boolean).join(' · ')
    return {
      value: row.id,
      label,
      searchText: label,
      content: (
        <span className="nature-creature-option">
          {row.values?.image && <img src={row.values.image} alt="" />}
          <span><strong>{summary.name}</strong><small>{[summary.no, summary.form].filter(Boolean).join(' · ')}</small></span>
        </span>
      ),
    }
  })

  function importRow(target) {
    if (!target) return
    const sameNumberRows = getSameNumberRows(target, visibleRows, fields)
    onImport({
      ...buildNatureAnalysisInput(target, sameNumberRows, fields, skillRows),
      sourceRowId: target.id,
      sourceMeta: {
        image: target.values?.image || '',
        no: target.values?.no || '',
        form: target.values?.form || '',
      },
      populationStats: buildPopulationStatSummary(visibleRows, fields, target),
      ownedNatures: ownedContext.index.get(target.id) || {},
      ownedContext: ownedContext.quickAddContext,
    })
  }

  return (
    <div className="nature-import-panel">
      <SearchableSelect
        className="nature-creature-picker"
        value={rowId || ''}
        options={options}
        placeholder="搜索并选择精灵"
        searchPlaceholder="输入编号、名称或形态"
        emptyText="没有匹配的可培养形态"
        onChange={(nextRowId) => {
          setRowId(nextRowId || null)
          if (!nextRowId) onImport(null)
          else importRow(selectableRows.find((row) => row.id === nextRowId))
        }}
      />
    </div>
  )
}

function FormAnalysis({ analysis }) {
  if (!analysis?.forms || analysis.forms.length < 2) return null
  return (
    <details className="nature-boss-analysis">
      <summary>
        <strong>同编号 {analysis.forms.length} 个形态对比</strong>
        <span className={analysis.allFormsEquivalent ? 'same' : 'different'}>
          {analysis.allFormsEquivalent ? '核心资料一致' : '存在明显差异'}
        </span>
      </summary>
      <div className="nature-boss-analysis-body">
        <p>推荐会同时核对这些形态；下方列出六维、系别、特性与技能组，默认收起以保持页面紧凑。</p>
        <div className="nature-boss-forms">
          {analysis.forms.map((form) => (
            <div className="nature-boss-form" key={form.id}>
              <div className="nature-form-head">
                {form.image && <img src={form.image} alt="" />}
                <span><strong>{form.name}</strong><small>{form.form || '默认形态'} · {form.elements.join(' / ') || '系别未知'}</small></span>
              </div>
              <StatsChart stats={STATS_DIMENSIONS.map((dimension) => ({ ...dimension, value: form.stats[dimension.key] || 0 }))} variant="bars" size="sm" />
              <div className="nature-form-trait-inline">
                {form.traitIcon && <img src={form.traitIcon} alt="" />}
                <span><strong>{form.traitName}</strong><small>{form.traitDesc || '暂无特性说明'}</small></span>
              </div>
              <details className="nature-inline-disclosure">
                <summary>技能组（{form.skillNames.length}）</summary>
                <span>{form.skillNames.join('、') || '暂无技能资料'}</span>
              </details>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

// 候选清单：展示全部 30 个合法性格，先按「强化维度」分组，组内再展示推荐分档。
function NatureCandidateList({ candidates, activeIndex, onSelect, ownedNatures = {}, onQuickAdd }) {
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
                          ownedCount={ownedNatures[c.id] || 0}
                          onQuickAdd={onQuickAdd}
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

function NatureCandidateListItem({ candidate, candidates, activeCandidate, onSelect, ownedCount = 0, onQuickAdd }) {
  const candidateIndex = candidates.indexOf(candidate)
  const isActive = candidate === activeCandidate
  return (
    <li className="nature-candidate-row">
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
        {candidate.formDecisions?.length > 1 && (
          <span className="nature-candidate-forms">
            适合：{candidate.formDecisions
              .filter((form) => form.decision !== 'notRecommended')
              .map((form) => form.label)
              .join(' / ') || '仅作风险参考'}
          </span>
        )}
        <span className={`nature-candidate-owned ${ownedCount > 0 ? 'acquired' : 'missing'}`}>
          {ownedCount > 0 && <CheckCircle2 size={13} />}
          {ownedCount > 0 ? `已获得${ownedCount > 1 ? ` ×${ownedCount}` : ''}` : '未获得'}
        </span>
        <span className="nature-candidate-score">{candidate.score.toFixed(1)}</span>
      </button>
      {ownedCount === 0 && onQuickAdd && (
        <button type="button" className="nature-quick-add" onClick={() => onQuickAdd(candidate)} title="新增收集记录">
          <Plus size={13} /> 新增
        </button>
      )}
    </li>
  )
}


function NatureResult({ nature, baseStats, adjustedStats, reasoning, fixedNature }) {
  if (!nature) return null
  const highlights = natureHighlights(nature)

  return (
    <div className="nature-result">
      <NatureFixedEvidence nature={fixedNature || nature} />
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

      <p className="nature-result-reason"><EmphasizedText text={reasoning} /></p>

      {highlights.length > 0 && (
        <div className="nature-highlight-card">
          <div className="nature-highlight-title">解析重点</div>
          <ul className="nature-highlight-list">
            {highlights.map((item) => (
              <li key={`${item.type}-${item.text}`} className={`nature-highlight-item ${item.type}`}>
                <span>{item.label}</span>
                <strong><EmphasizedText text={item.text} /></strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="nature-detail-disclosure">
        <summary>查看完整推荐理由 / 风险</summary>
        <div className="nature-explain-grid">
          <div>
            <div className="nature-explain-title">推荐理由</div>
            <ul className="nature-explain-list">
              {nature.reasons.map((reason) => (
                <li key={reason}><EmphasizedText text={reason} /></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="nature-explain-title">风险提示</div>
            {nature.warnings.length > 0 ? (
              <ul className="nature-explain-list warning">
                {nature.warnings.map((warning) => (
                    <li key={warning}><EmphasizedText text={warning} /></li>
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

function NatureFixedEvidence({ nature }) {
  if (!nature) return null
  const speedProfile = nature.speedProfile
  return (
    <section className="nature-fixed-evidence">
      <div className="nature-fixed-evidence-title">
        <strong>固定分析依据</strong>
        <span>切换性格时保持不变</span>
      </div>
      {nature.skillProfile && (
        <NatureSkillInsight skillProfile={nature.skillProfile} formulaAssist={nature.formulaAssist} />
      )}
      {speedProfile && (
        <div className={`nature-speed-note ${speedProfile.concern.level}`}>
          <strong>速度线：{speedProfile.concern.label}</strong>
          <span>基础速度 {speedProfile.base}（{speedProfile.baseTier}）。</span>
          <details className="nature-inline-disclosure">
            <summary>查看速度线解释</summary>
            <span>最近锚点 {speedProfile.nearestAnchor}。{speedProfile.concern.reason}；{speedProfile.note}</span>
          </details>
        </div>
      )}
    </section>
  )
}

function EmphasizedText({ text = '' }) {
  const pattern = /(生命|物攻|魔攻|物防|魔防|速度|核心|硬性风险|风险|低代价|短板|推荐|可保留|不推荐|主攻|耐久|先手|后手|控制|能量循环)/g
  return String(text).split(pattern).map((part, index) => (
    /^(生命|物攻|魔攻|物防|魔防|速度|核心|硬性风险|风险|低代价|短板|推荐|可保留|不推荐|主攻|耐久|先手|后手|控制|能量循环)$/.test(part)
      ? <strong className="nature-text-emphasis" key={`${part}-${index}`}>{part}</strong>
      : part
  ))
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

function NaturePveOverview({ forms = [] }) {
  const summaries = forms.map((form) => ({ ...form, summary: pveOverviewSummary(form.candidates) })).filter((form) => form.summary)
  if (summaries.length === 0) return null
  return (
    <section className="nature-pve-overview" aria-label="PVE 培养投入提示">
      <div className="nature-pve-overview-head">
        <strong>PVE 培养投入</strong>
        <span>覆盖同编号全部 {summaries.length} 个可分析形态；PVP 属性平衡不计入投入。</span>
      </div>
      <div className="nature-pve-form-grid">
        {summaries.map(({ id, label, summary }) => (
          <article key={id || label} className={`nature-pve-form ${summary.level}`}>
            <div className="nature-pve-form-head">
              <strong>{label}</strong>
              <span className="nature-pve-stars" aria-label={`PVE 星级：${summary.stars} / 5`}>{pveStarText(summary.stars)}</span>
            </div>
            <div className="nature-pve-form-rating">{summary.badge} · {summary.role}</div>
            <div className="nature-pve-form-meta">
              <span>主属性 {summary.primaryStat}</span>
              <span>性格 {summary.capture}</span>
            </div>
            {summary.tags.length > 0 && <small>{summary.tags.join(' · ')}</small>}
          </article>
        ))}
      </div>
    </section>
  )
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
