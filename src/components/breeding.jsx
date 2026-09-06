import { useEffect, useMemo, useState } from 'react'
import { useOwnedTable } from '../hooks/useOwnedTable.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { RotateCcw } from 'lucide-react'
import { db } from '../db.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import {
  BREEDING_RULE_STORAGE_KEY,
  buildBreedingDataset,
  DEFAULT_BREEDING_RULES,
  matchesBreedingCoverageFilter,
  normalizeBreedingRules,
  recommendBreedingPairs,
  summarizeMissingEggGroups,
} from '../domain/breeding.js'
import { OWNED_COLORFUL_OPTIONS, OWNED_NATURE_OPTIONS } from '../domain/owned.js'
import { DragHandle, EmptyState, LoadState, OptionTag, useDragReorder } from './common.jsx'
import { RowDetailModal } from './rowDetail.jsx'

function loadBreedingRules() {
  try {
    return normalizeBreedingRules(JSON.parse(localStorage.getItem(BREEDING_RULE_STORAGE_KEY) || 'null'))
  } catch {
    return normalizeBreedingRules(DEFAULT_BREEDING_RULES)
  }
}

export function BreedingTool({ scene }) {
  const { table: ownedTable, error: ownedError, retry: retryOwned } = useOwnedTable(scene.id)

  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const skillTableId = ROCK_KINGDOM_PRESET.tables[1].id
  const ownedRows = useLiveQuery(() => ownedTable ? db.catalogRows.where('tableId').equals(ownedTable.id).toArray() : [], [ownedTable?.id])
  const ownedFields = useLiveQuery(() => ownedTable ? db.catalogFields.where('tableId').equals(ownedTable.id).sortBy('order') : [], [ownedTable?.id])
  const catalogRows = useLiveQuery(() => db.catalogRows.where('tableId').equals(creatureTableId).toArray(), [creatureTableId])
  const catalogFields = useLiveQuery(() => db.catalogFields.where('tableId').equals(creatureTableId).sortBy('order'), [creatureTableId])
  const skillRows = useLiveQuery(() => db.catalogRows.where('tableId').equals(skillTableId).toArray(), [skillTableId])
  const [selectedOwnedCreature, setSelectedOwnedCreature] = useState(null)
  const [referenceDetail, setReferenceDetail] = useState(null)
  const [rules, setRules] = useState(loadBreedingRules)
  const [coverageFilter, setCoverageFilter] = useState('all')
  const [coverageQuery, setCoverageQuery] = useState('')
  const [targetSpeciesId, setTargetSpeciesId] = useState('')

  const dataset = useMemo(
    () => buildBreedingDataset({ ownedRows, catalogRows, catalogFields, skillRows }),
    [ownedRows, catalogRows, catalogFields, skillRows],
  )
  const pairs = useMemo(
    () => recommendBreedingPairs(dataset.creatures, { rules, species: dataset.species, targetSpeciesId }),
    [dataset, rules, targetSpeciesId],
  )
  const targetSpecies = dataset.species.find((item) => item.id === targetSpeciesId) || null
  const missingEggGroups = useMemo(() => summarizeMissingEggGroups(dataset.creatures), [dataset.creatures])

  useEffect(() => {
    localStorage.setItem(
      BREEDING_RULE_STORAGE_KEY,
      JSON.stringify(rules.map(({ id, enabled }) => ({ id, enabled }))),
    )
  }, [rules])

  function toggleRule(id) {
    setRules((current) => current.map((rule) => (
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    )))
  }

  const { onDragStart, onDragOver, onDrop } = useDragReorder(rules, setRules)

  if (!ownedTable) return <LoadState error={ownedError} onRetry={retryOwned} />
  if (!ownedRows || !ownedFields || !catalogRows || !catalogFields || !skillRows) return <LoadState message="正在加载繁育资料…" />

  return <div className="breeding-tool">
    <div className="breeding-hero">
      <div>
        <h2>孵蛋推荐</h2>
        <p>稀有父母读取收集记录，普通父母按可现抓处理，组成最多 5 对同蛋组父母。</p>
      </div>
      <span className="breeding-selection-count">{pairs.length} / 5 对</span>
    </div>

    <details className="breeding-rules">
      <summary>
        <span><strong id="breeding-rules-title">孵蛋规则</strong><small>{rules.filter((rule) => rule.enabled).length} 项已启用 · 拖动可调整优先级</small></span>
      </summary>
      <div className="breeding-rules-content">
        <div className="breeding-rules-main">
          <span>后代种类跟随母亲</span>
          <span>性格：父 30% / 母 30% / 随机 40%</span>
          <span>异色/炫彩：单亲 0.36% / 双亲 0.72%</span>
        </div>
        <div className="breeding-priority">
        <div className="breeding-priority-heading">
          <div>
            <strong>推荐规则</strong>
            <small>按编号逐级比较；拖动卡片调整顺序。</small>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setRules(normalizeBreedingRules(DEFAULT_BREEDING_RULES))}
          >
            <RotateCcw size={13} /> 恢复默认
          </button>
        </div>
        <ol className="breeding-rule-list">
          {rules.map((rule, index) => (
            <li
              key={rule.id}
              className={rule.enabled ? '' : 'disabled'}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(index)}
            >
              <DragHandle />
              <label>
                <input type="checkbox" checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
                <span><strong>{rule.label}</strong><small title={rule.description}>{rule.description}</small></span>
              </label>
            </li>
          ))}
        </ol>
        </div>
        {missingEggGroups.recordCount > 0 && (
        <details className="breeding-warning">
          <summary>
            当前本地资料有 {missingEggGroups.recordCount} 条拥有记录（{missingEggGroups.creatureCount} 种精灵）缺少蛋组，暂不参与配对
          </summary>
          <p>正式内置资料的蛋组字段完整；这里通常是浏览器中的旧资料或自定义资料。缺失项：</p>
          <ul>
            {missingEggGroups.creatures.map((item) => (
              <li key={item.catalogRowId}>
                {item.name}{item.recordCount > 1 ? `（${item.recordCount} 条记录）` : ''}
              </li>
            ))}
          </ul>
        </details>
        )}
      </div>
    </details>

    {targetSpecies && (
      <div className="breeding-target-bar">
        <span>正在为 <strong>{targetSpecies.name}</strong> 推荐</span>
        <button type="button" className="btn btn-sm" onClick={() => setTargetSpeciesId('')}>返回全局推荐</button>
      </div>
    )}

    {pairs.length === 0 ? (
      <EmptyState title="暂无可推荐组合" description="当前没有能推进已启用目标的组合；异色或炫彩目标需要收集记录中存在可用的稀有亲本。" />
    ) : (
      <section className="breeding-recommendation">
        <div className="breeding-section-title">
          <strong>推荐配对</strong>
          <span>稀有收藏每条只使用一次 · 普通精灵可按推荐条件现抓</span>
        </div>
        <div className="breeding-pairs">
          {pairs.map((pair, index) => (
            <article className="breeding-pair-card" key={`${pair.father.id}-${pair.mother.id}`}>
              <div className="breeding-pair-head">
                <strong>配对 {index + 1}</strong>
                <span>{pair.eggGroup} · {pair.priorityReason}</span>
              </div>
              <div className="breeding-lineup">
                <BreedingCreature gender="male" item={pair.father} onOpen={() => pair.father.owned && setSelectedOwnedCreature(pair.father)} />
                <span className="breeding-pair-mark" aria-label="配对">×</span>
                <BreedingCreature gender="female" item={pair.mother} onOpen={() => pair.mother.owned && setSelectedOwnedCreature(pair.mother)} />
              </div>
              <div className="breeding-offspring-row">
                <BreedingOffspring pair={pair} />
                <BreedingProbability pair={pair} />
              </div>
            </article>
          ))}
        </div>
      </section>
    )}

    <BreedingCoverageDashboard
      species={dataset.species}
      filter={coverageFilter}
      query={coverageQuery}
      onFilterChange={setCoverageFilter}
      onQueryChange={setCoverageQuery}
      onRecommend={(id) => {
        setTargetSpeciesId(id)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      targetSpeciesId={targetSpeciesId}
    />

    {selectedOwnedCreature && (
      <RowDetailModal
        title={`${selectedOwnedCreature.catalog.row.values?.name || '精灵'} · 收集记录详情`}
        row={selectedOwnedCreature.owned}
        fields={ownedFields}
        rows={ownedRows}
        onClose={() => setSelectedOwnedCreature(null)}
        onOpenReference={setReferenceDetail}
      />
    )}
    {referenceDetail && (
      <RowDetailModal
        title="引用资料详情"
        row={referenceDetail.row}
        fields={referenceDetail.fields}
        rows={referenceDetail.rows}
        onClose={() => setReferenceDetail(null)}
        onOpenReference={setReferenceDetail}
      />
    )}
  </div>
}

const NATURE_LABELS = Object.fromEntries(OWNED_NATURE_OPTIONS.map((item) => [item.value, item.label.replace(/（.+$/, '')]))
const SHINY_ICON = 'https://patchwiki.biligame.com/images/rocom/2/2e/buxc6y4s0r7d8ix03zzkahnk4h8urtv.png'

function natureLabel(value) {
  return NATURE_LABELS[value] || value || '未知性格'
}

function creatureImage(values, shiny) {
  return shiny ? values.shinyImage || values.image || '' : values.image || ''
}

function BreedingCreature({ gender, item, onOpen }) {
  const values = item.catalog.row.values || {}
  const trait = values.traitName || '无特性'
  return (
    <button
      type="button"
      className={`breeding-creature-row ${item.source === 'catch' ? 'catch' : ''}`}
      onClick={onOpen}
      title={item.source === 'catch' ? '普通精灵可按此条件现抓' : `查看 ${values.name || item.name} 的收集记录`}
    >
      <img className="breeding-creature-avatar" src={creatureImage(values, item.shiny)} alt="" />
      <span className="breeding-creature-text">
        <strong>{values.name || item.name}</strong>
        <small>{natureLabel(item.nature)} · {trait}</small>
      </span>
      <span className="breeding-parent-meta">
        <span className={`breeding-parent-source ${item.source}`}>{item.source === 'catch' ? '可现抓' : '已收藏'}</span>
        <span className={`breeding-sex-symbol ${gender}`} title={gender === 'male' ? '公' : '母'}>{gender === 'male' ? '♂' : '♀'}</span>
        {item.colorful && <OptionTag option={OWNED_COLORFUL_OPTIONS.find((option) => option.value === 'yes')} iconOnly size="sm" />}
      </span>
      {item.shiny && <img className="breeding-status-image" src={SHINY_ICON} alt="异色" title="异色" />}
    </button>
  )
}

function BreedingOffspring({ pair }) {
  const values = pair.mother.catalog.row.values || {}
  return (
    <div className="breeding-offspring">
      <img src={values.image || ''} alt="" />
      <span>
        <small>孩子 · 随母亲种类</small>
        <strong>{values.name || pair.targetSpecies || '未知精灵'}</strong>
      </span>
    </div>
  )
}

function probabilityText(bothParentsHave, oneParentHas) {
  if (bothParentsHave) return '0.72%'
  if (oneParentHas) return '0.36%'
  return '—'
}

function BreedingProbability({ pair }) {
  const shinyBoth = pair.father.shiny && pair.mother.shiny
  const shinyAny = pair.father.shiny || pair.mother.shiny
  const colorfulBoth = pair.father.colorful && pair.mother.colorful
  const colorfulAny = pair.father.colorful || pair.mother.colorful
  return <div className="breeding-prob-row">
    <span><strong>性格</strong>{natureLabel(pair.father.nature)} 30% / {natureLabel(pair.mother.nature)} 30% / 随机 40%</span>
    <span><strong>异色</strong>{probabilityText(shinyBoth, shinyAny)}</span>
    <span><strong>炫彩</strong>{probabilityText(colorfulBoth, colorfulAny)}</span>
  </div>
}

const COVERAGE_FILTERS = [
  { value: 'gaps', label: '已有收集的缺口' },
  { value: 'missingShiny', label: '缺异色' },
  { value: 'missingColorful', label: '缺炫彩' },
  { value: 'missingShinyMale', label: '缺异色公' },
  { value: 'missingShinyFemale', label: '缺异色母' },
  { value: 'missingColorfulMale', label: '缺炫彩公' },
  { value: 'missingColorfulFemale', label: '缺炫彩母' },
  { value: 'missingGoodNature', label: '缺好性格' },
  { value: 'complete', label: '已完整' },
  { value: 'all', label: '全部谱系' },
]

function SexCoverage({ summary }) {
  return (
    <span className="breeding-sex-coverage">
      <b className={summary.male > 0 ? 'covered' : 'missing'} title={`公：${summary.male}`}>♂ {summary.male}</b>
      <b className={summary.female > 0 ? 'covered' : 'missing'} title={`母：${summary.female}`}>♀ {summary.female}</b>
    </span>
  )
}

function RareCoverage({ available = true, label, summary }) {
  if (!available) return <span className="breeding-rare-unavailable">无此形态</span>
  return (
    <div className="breeding-rare-coverage">
      <span><strong>{summary.total}</strong><small>{label}</small></span>
      <SexCoverage summary={summary} />
    </div>
  )
}

function BreedingCoverageDashboard({ species, filter, query, onFilterChange, onQueryChange, onRecommend, targetSpeciesId }) {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  const inScope = species.filter((item) => matchesBreedingCoverageFilter(item, filter))
  const visible = inScope.filter((item) => (
    !normalizedQuery || item.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery)
  ))
  const collectedSpecies = species.filter((item) => item.ownedCount > 0)
  const collected = collectedSpecies.length
  const missingShiny = species.filter((item) => item.missing.shiny).length
  const missingColorful = species.filter((item) => item.missing.colorful).length
  const complete = species.filter((item) => !item.hasGap).length

  return (
    <section className="breeding-coverage" aria-labelledby="breeding-coverage-title">
      <div className="breeding-coverage-heading">
        <div>
          <strong id="breeding-coverage-title">当前场景 · 稀有外观收集概览</strong>
          <small>按繁育谱系合并，默认展示全部可繁育精灵；具体个体仍在图鉴和收集记录中管理。</small>
        </div>
      </div>
      <div className="breeding-coverage-summary">
        <span><strong>{species.length}</strong><small>可繁育谱系</small></span>
        <span><strong>{collected}</strong><small>已有收集</small></span>
        <span><strong>{missingShiny}</strong><small>缺异色</small></span>
        <span><strong>{missingColorful}</strong><small>缺炫彩</small></span>
        <span><strong>{complete}</strong><small>收集目标完整</small></span>
      </div>
      <div className="breeding-coverage-controls">
        <input
          className="input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索繁育谱系…"
        />
        <select className="select" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
          {COVERAGE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <span>{visible.length} / {inScope.length}</span>
      </div>
      {visible.length === 0 ? (
        <p className="breeding-coverage-empty">没有符合当前条件的繁育谱系。</p>
      ) : (
        <div className="breeding-coverage-table-wrap">
          <table className="breeding-coverage-table">
            <thead>
              <tr>
                <th>繁育谱系</th>
                <th>收集</th>
                <th>异色</th>
                <th>炫彩</th>
                <th>好性格</th>
                <th>缺口</th>
                <th>推荐</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const gaps = [
                  item.missing.shiny && '异色',
                  item.missing.colorful && '炫彩',
                  item.missing.shinyMale && '异色公',
                  item.missing.shinyFemale && '异色母',
                  item.missing.colorfulMale && '炫彩公',
                  item.missing.colorfulFemale && '炫彩母',
                  item.missing.goodNature && '好性格',
                ].filter(Boolean)
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="breeding-species-name">
                        {item.image && <img src={item.image} alt="" />}
                        <span><strong>{item.name}</strong><small>{item.eggGroups.join(' · ')}</small></span>
                      </span>
                    </td>
                    <td><strong>{item.ownedCount}</strong></td>
                    <td><RareCoverage available={item.shinyAvailable} label="异色" summary={item.shiny} /></td>
                    <td><RareCoverage label="炫彩" summary={item.colorful} /></td>
                    <td>
                      <span className="breeding-good-nature">
                        <strong>{item.goodNature.total}</strong>
                        <small>推荐 {item.goodNature.recommended} · 可留 {item.goodNature.keepable}</small>
                      </span>
                    </td>
                    <td>
                      <span className="breeding-gap-tags">
                        {gaps.length > 0 ? gaps.map((gap) => <b key={gap}>{gap}</b>) : <em>完整</em>}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn btn-sm ${targetSpeciesId === item.id ? 'btn-primary' : ''}`}
                        onClick={() => onRecommend(item.id)}
                      >
                        {targetSpeciesId === item.id ? '推荐中' : '为它推荐'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
