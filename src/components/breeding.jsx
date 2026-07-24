import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureOwnedTable } from '../db.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import {
  BREEDING_PRIORITY_RULES,
  buildOwnedCreatures,
  recommendBreedingPairs,
} from '../domain/breeding.js'
import { OWNED_COLORFUL_OPTIONS, OWNED_NATURE_OPTIONS } from '../domain/owned.js'
import { EmptyState, OptionTag } from './common.jsx'
import { RowDetailModal } from './rowDetail.jsx'

export function BreedingTool({ scene }) {
  useEffect(() => {
    ensureOwnedTable(scene.id)
  }, [scene.id])

  const creatureTableId = ROCK_KINGDOM_PRESET.tables[0].id
  const skillTableId = ROCK_KINGDOM_PRESET.tables[1].id
  const ownedTable = useLiveQuery(() => db.catalogTables.where('sceneId').equals(scene.id).filter((t) => t.kind === 'owned').first(), [scene.id])
  const ownedRows = useLiveQuery(() => ownedTable ? db.catalogRows.where('tableId').equals(ownedTable.id).toArray() : [], [ownedTable?.id])
  const catalogRows = useLiveQuery(() => db.catalogRows.where('tableId').equals(creatureTableId).toArray(), [creatureTableId])
  const catalogFields = useLiveQuery(() => db.catalogFields.where('tableId').equals(creatureTableId).sortBy('order'), [creatureTableId])
  const skillRows = useLiveQuery(() => db.catalogRows.where('tableId').equals(skillTableId).toArray(), [skillTableId])
  const [selectedCreature, setSelectedCreature] = useState(null)
  const [referenceDetail, setReferenceDetail] = useState(null)

  const creatures = useMemo(() => buildOwnedCreatures({ ownedRows, catalogRows, catalogFields, skillRows }), [ownedRows, catalogRows, catalogFields, skillRows])
  const pairs = useMemo(() => recommendBreedingPairs(creatures), [creatures])
  const missingEggGroups = creatures.filter((item) => item.catalog.eggGroups.length === 0).length

  if (!ownedTable || !ownedRows || !catalogRows || !catalogFields || !skillRows) return null

  return <div className="breeding-tool">
    <div className="breeding-hero">
      <div>
        <h2>孵蛋推荐</h2>
        <p>从异色收集记录中挑选 10 只精灵，组成 5 对不重复的同蛋组父母。</p>
      </div>
      <span className="breeding-selection-count">{pairs.length * 2} / 10 只</span>
    </div>

    <section className="breeding-rules" aria-labelledby="breeding-rules-title">
      <div className="breeding-rules-main">
        <strong id="breeding-rules-title">孵蛋规则</strong>
        <span>后代种类跟随母亲</span>
        <span>性格：父 30% / 母 30% / 随机 40%</span>
        <span>异色/炫彩：单亲 0.36% / 双亲 0.72%</span>
      </div>
      <div className="breeding-priority">
        <strong>当前排序优先级</strong>
        <ol>
          {BREEDING_PRIORITY_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ol>
      </div>
      {missingEggGroups > 0 && <p className="breeding-warning">有 {missingEggGroups} 条拥有记录对应精灵缺少蛋组字段，暂不参与配对。</p>}
    </section>

    {pairs.length === 0 ? (
      <EmptyState title="暂无可推荐组合" description="请确认收集记录已填写性别、是否异色，且资料库精灵行已填写蛋组。" />
    ) : (
      <section className="breeding-recommendation">
        <div className="breeding-section-title">
          <strong>推荐配对</strong>
          <span>每只精灵只使用一次 · 点击父母查看详情</span>
        </div>
        <div className="breeding-pairs">
          {pairs.map((pair, index) => (
            <article className="breeding-pair-card" key={`${pair.father.id}-${pair.mother.id}`}>
              <div className="breeding-pair-head">
                <strong>配对 {index + 1}</strong>
                <span>{pair.eggGroup} · {pair.priorityReason}</span>
              </div>
              <div className="breeding-lineup">
                <BreedingCreature gender="male" item={pair.father} onOpen={() => setSelectedCreature(pair.father.catalog.row)} />
                <span className="breeding-pair-mark" aria-label="配对">×</span>
                <BreedingCreature gender="female" item={pair.mother} onOpen={() => setSelectedCreature(pair.mother.catalog.row)} />
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

    {selectedCreature && (
      <RowDetailModal
        title={`${selectedCreature.values?.name || '精灵'} · 精灵详情`}
        row={selectedCreature}
        fields={catalogFields}
        rows={catalogRows}
        onClose={() => setSelectedCreature(null)}
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

function BreedingCreature({ gender, item, onOpen }) {
  const values = item.catalog.row.values || {}
  const trait = values.traitName || '无特性'
  return (
    <button
      type="button"
      className="breeding-creature-row"
      onClick={onOpen}
      title={`查看 ${values.name || item.name} 详情`}
    >
      <img className="breeding-creature-avatar" src={values.image || ''} alt="" />
      <span className="breeding-creature-text">
        <strong>{values.name || item.name}</strong>
        <small>{natureLabel(item.nature)} · {trait}</small>
      </span>
      <span className={`breeding-sex-symbol ${gender}`} title={gender === 'male' ? '公' : '母'}>{gender === 'male' ? '♂' : '♀'}</span>
      {item.shiny && <img className="breeding-status-image" src={SHINY_ICON} alt="异色" title="异色" />}
      {item.colorful && <OptionTag option={OWNED_COLORFUL_OPTIONS.find((option) => option.value === 'yes')} iconOnly size="sm" />}
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
