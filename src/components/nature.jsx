// 性格推荐工具：手动录入或从场景资料库带入六维 + 特性标签，
// 推荐一组强化/弱化搭配，并展示可解释的推荐理由。
// 除首选之外，工具还会同时暴露若干候选方案（推荐/可选清单），
// 用户可以直接点击某个候选，替换主结果卡片的展示内容。

import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, Plus, Sparkles } from 'lucide-react'
import { db, ensureOwnedTable } from '../db.js'
import { STATS_DIMENSIONS } from '../constants.js'
import {
  evaluateAllNatures,
  evaluateNatureProfiles,
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
  pairRockKingdomComparisonForms,
  primaryRockKingdomNatureRows,
  visibleRockKingdomCreatureRows,
} from '../domain/rockKingdom.js'
import { TRAIT_TAG_OPTIONS } from '../presets/rockKingdom.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { EmptyState, FormRow, OptionTag, SearchableSelect, StatsChart } from './common.jsx'
import { OwnedFormModal } from './owned.jsx'

const EMPTY_STATS = Object.fromEntries(STATS_DIMENSIONS.map((d) => [d.key, '']))
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
          <NatureFixedEvidence nature={candidates[0]} forms={pveForms} />
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
              populationStats={input.populationStats}
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
        <div className="stats-scale-note">
          统一刻度 0–{input.populationStats?.globalMax || 0} · 最低有效值参考线 {input.populationStats?.globalMin || 0}
        </div>
        <StatsChart
          stats={chartStats}
          variant="bars"
          size="sm"
          scaleMax={input.populationStats?.globalMax}
          referenceMin={input.populationStats?.globalMin}
        />
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
      <FormAnalysis analysis={input.formAnalysis} populationStats={input.populationStats} />
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

  useEffect(() => {
    ensureOwnedTable(scene.id)
  }, [scene.id])

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
  const selectableRows = primaryRockKingdomNatureRows(visibleRows)
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
      ...buildNatureAnalysisInput(target, sameNumberRows, fields, skillRows, visibleRows),
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

function FormComparisonCard({ form, baseline, populationStats }) {
  return (
    <div className="nature-boss-form">
      <div className="nature-form-head">
        {form.image && <img src={form.image} alt="" />}
        <span>
          <strong>{form.name}</strong>
          <small>{form.form || '默认形态'}</small>
          <span className="nature-form-elements">
            {form.elements.length > 0 ? form.elements.map((element) => <OptionTag key={element.value} option={element} />) : '系别未知'}
          </span>
        </span>
      </div>
      <StatsChart
        stats={STATS_DIMENSIONS.map((dimension) => {
          const populationDimension = form.populationStats?.dimensions?.find((item) => item.key === dimension.key)
          const baselineDimension = baseline.find((item) => item.key === dimension.key)
          const change = form.statChanges.find((item) => item.key === dimension.key)
          return {
            ...dimension,
            value: form.stats[dimension.key] || 0,
            context: {
              percentile: populationDimension?.percentile || 0,
              delta: change?.delta || 0,
              percentileDelta: (populationDimension?.percentile || 0) - (baselineDimension?.percentile || 0),
            },
          }
        })}
        variant="bars"
        size="sm"
        scaleMax={populationStats?.globalMax}
        referenceMin={populationStats?.globalMin}
      />
      <div className="nature-form-trait-inline">
        {form.traitIcon && <img src={form.traitIcon} alt="" />}
        <span><strong>{form.traitName}</strong><small>{form.traitDesc || '暂无特性说明'}</small></span>
      </div>
      {form.uniqueSkillNames.length > 0 && (
        <strong className="nature-unique-skills">本形态独有：{form.uniqueSkillNames.join('、')}</strong>
      )}
      <details className="nature-inline-disclosure">
        <summary>技能组（{form.skillNames.length}）</summary>
        <span>{form.skillNames.join('、') || '暂无技能资料'}</span>
      </details>
    </div>
  )
}

function FormAnalysis({ analysis, populationStats }) {
  if (!analysis?.forms || analysis.forms.length < 2) return null
  const baselineForm = analysis.forms[0]
  const baseline = baselineForm?.populationStats?.dimensions || []
  const formGroups = pairRockKingdomComparisonForms(analysis.forms)
  const hasPairedForms = formGroups.some((group) => group.paired)
  return (
    <details className="nature-boss-analysis">
      <summary>
        <strong>同编号 {analysis.forms.length} 个形态对比</strong>
        <span className={analysis.allFormsEquivalent ? 'same' : 'different'}>
          {analysis.allFormsEquivalent ? '核心资料一致' : '存在明显差异'}
        </span>
      </summary>
      <div className="nature-boss-analysis-body">
        <p>
          推荐会同时核对这些形态；六维变化以“{baselineForm.name}”为基准。
          {hasPairedForms ? '普通形态与对应首领形态按同一样子成对展示。' : '下方列出六维、系别、特性与技能组。'}
        </p>
        <div className={hasPairedForms ? 'nature-form-pairs' : 'nature-boss-forms'}>
          {hasPairedForms
            ? formGroups.map((group) => (
              <section className={`nature-form-pair ${group.paired ? 'paired' : ''}`} key={group.key}>
                {group.variant && <strong className="nature-form-pair-title">{group.variant}</strong>}
                <div>
                  {group.forms.map((form) => (
                    <FormComparisonCard form={form} baseline={baseline} populationStats={populationStats} key={form.id} />
                  ))}
                </div>
              </section>
            ))
            : analysis.forms.map((form) => (
              <FormComparisonCard form={form} baseline={baseline} populationStats={populationStats} key={form.id} />
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

function formatNatureScore(value) {
  const fixed = Number(value).toFixed(1)
  return fixed.startsWith('-') ? `−${fixed.slice(1)}` : fixed
}

function natureScoreSummary(candidate) {
  const scores = (candidate.formDecisions || [])
    .map((form) => Number(form.score))
    .filter(Number.isFinite)
  if (scores.length === 0) return formatNatureScore(candidate.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  return min === max ? formatNatureScore(max) : `${formatNatureScore(min)} 至 ${formatNatureScore(max)}`
}

function NatureCandidateListItem({ candidate, candidates, activeCandidate, onSelect, ownedCount = 0, onQuickAdd }) {
  const candidateIndex = candidates.indexOf(candidate)
  const isActive = candidate === activeCandidate
  const canQuickAdd = candidate.decision !== 'notRecommended' && ownedCount === 0 && onQuickAdd
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
        {ownedCount > 0 ? (
          <span className="nature-candidate-owned acquired">
            <CheckCircle2 size={13} />
            已获得{ownedCount > 1 ? ` ×${ownedCount}` : ''}
          </span>
        ) : (
          <span className="nature-candidate-owned empty" aria-hidden="true" />
        )}
        <span
          className="nature-candidate-score"
          title={(candidate.formDecisions || []).length > 1 ? '各形态评分范围' : '评分'}
        >
          {natureScoreSummary(candidate)}
        </span>
      </button>
      {canQuickAdd && (
        <button
          type="button"
          className="nature-candidate-owned missing actionable nature-candidate-owned-overlay"
          onClick={() => onQuickAdd(candidate)}
          title="新增收集记录"
        >
          <Plus size={12} /> 未获得
        </button>
      )}
    </li>
  )
}


function NatureResult({ nature, baseStats, adjustedStats, populationStats }) {
  if (!nature) return null
  const formDecisions = nature.formDecisions || []
  const coreReason = nature.decision === 'notRecommended'
    ? nature.warnings[0]
    : nature.reasons[0]

  return (
    <div className="nature-result">
      <div className="nature-result-header">
        <span className="nature-result-icon"><Sparkles size={16} /></span>
        <div className="nature-result-title-wrap">
          <span className="nature-result-title">{natureName(nature)}</span>
          <span className="nature-result-subtitle">
            {natureModifierSummary(nature)} · {formDecisions.length > 1 ? '形态评分' : '评分'} {natureScoreSummary(nature)}
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

      <div className="nature-result-summary">
        <div>
          <small>定位</small>
          <span className="nature-result-role-tags">
            {String(nature.roleLabel || '通用培养').split(/\s*\/\s*/).slice(0, 3).map((role) => <strong key={role}>{role}</strong>)}
          </span>
        </div>
        <div>
          <small>核心判断</small>
          <p><EmphasizedText text={coreReason || '暂无额外判断'} /></p>
        </div>
        {formDecisions.length > 1 && (
          <div>
            <small>形态判断</small>
            <span className="nature-result-form-scores">
              {formDecisions.map((form) => (
                <span className={form.decision} key={form.id || form.label}>
                  <strong>{form.label}</strong>
                  <em>{NATURE_DECISION_LABELS[form.decision]} · {formatNatureScore(form.score)}</em>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>

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

      <NatureStatsBars
        nature={nature}
        baseStats={baseStats}
        adjustedStats={adjustedStats}
        scaleMax={populationStats?.globalMax}
      />
    </div>
  )
}

function NatureFixedEvidence({ nature, forms = [] }) {
  if (!nature) return null
  const formEvidence = forms.map((form) => ({ label: form.label, nature: form.candidates?.[0] })).filter((form) => form.nature)
  const primaryNature = formEvidence[0]?.nature || nature
  const speedProfile = primaryNature.speedProfile
  const evidenceSignatures = new Set(formEvidence.map(({ nature: item }) => JSON.stringify({
    speed: item.speedProfile?.base,
    concern: item.speedProfile?.concern?.level,
    skills: item.skillProfile?.summary,
  })))
  const hasFormDifferences = evidenceSignatures.size > 1
  return (
    <section className="nature-fixed-evidence">
      <div className="nature-fixed-evidence-title">
        <strong>固定分析依据</strong>
        <span>性格切换时不变；形态差异单独列出</span>
      </div>
      {primaryNature.skillProfile && (
        <NatureSkillInsight skillProfile={primaryNature.skillProfile} formulaAssist={primaryNature.formulaAssist} />
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
      {hasFormDifferences && (
        <details className="nature-form-evidence">
          <summary>不同形态的技能 / 速度依据不同（{formEvidence.length}）</summary>
          <div>
            {formEvidence.map(({ label, nature: item }) => (
              <span key={label}>
                <strong>{label}</strong>
                <small>速度 {item.speedProfile?.base || 0} · {item.speedProfile?.concern?.label || '无速度结论'}</small>
                <small>{item.skillProfile?.summary || '暂无技能线索'}</small>
              </span>
            ))}
          </div>
        </details>
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

function natureModifierSummary(candidate) {
  const raiseDelta = candidate.deltas?.[candidate.raise] || 0
  const lowerDelta = candidate.deltas?.[candidate.lower] || 0
  const raiseText = `${STAT_LABELS[candidate.raise]} ${raiseDelta > 0 ? `+${raiseDelta}` : raiseDelta}`
  const lowerText = `${STAT_LABELS[candidate.lower]} ${lowerDelta}`
  return `${raiseText} / ${lowerText}`
}


function NatureStatsBars({ nature, baseStats, adjustedStats, scaleMax }) {
  const maxValue = Math.max(Number(scaleMax) || 1, ...Object.values(adjustedStats).map(Number))
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
              <span className="nature-bar-base" style={{ width: `${Math.min((base / maxValue) * 100, 100)}%` }} />
              <span className="nature-bar-adjusted" style={{ width: `${Math.min((adjusted / maxValue) * 100, 100)}%` }} />
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
