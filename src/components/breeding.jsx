import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureOwnedTable } from '../db.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { buildOwnedCreatures, EGG_GROUP_SOURCE_URL, recommendBreedingBatches } from '../domain/breeding.js'
import { EmptyState } from './common.jsx'
import { OWNED_NATURE_OPTIONS } from '../domain/owned.js'

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

  const creatures = useMemo(() => buildOwnedCreatures({ ownedRows, catalogRows, catalogFields, skillRows }), [ownedRows, catalogRows, catalogFields, skillRows])
  const batches = useMemo(() => recommendBreedingBatches(creatures), [creatures])
  const missingEggGroups = creatures.filter((item) => item.catalog.eggGroups.length === 0).length

  if (!ownedTable || !ownedRows || !catalogRows || !catalogFields || !skillRows) return null

  return <div className="breeding-tool">
    <div className="breeding-hero">
      <div>
        <h2>孵蛋推荐</h2>
        <p>异色优先、同蛋组配对；概率规则统一在顶部展示。</p>
      </div>
      <a className="btn" href={EGG_GROUP_SOURCE_URL} target="_blank" rel="noreferrer">B站蛋组计算器</a>
    </div>
    <div className="breeding-notes">
      <span>规则：后代种类跟随母亲；性格：父 30% / 母 30% / 随机 40%；异色/炫彩：单亲 0.36%，双亲 0.72%。</span>
      {missingEggGroups > 0 && <span>有 {missingEggGroups} 条拥有记录对应精灵缺少 eggGroups/蛋组 字段，暂不参与配对。</span>}
    </div>
    {batches.length === 0 ? <EmptyState title="暂无可推荐组合" description="请确认收集记录已填写性别、是否异色/炫彩，且资料库精灵行已填写蛋组。" /> : batches.map((batch, index) => <section className="breeding-batch" key={batch.id}>
      <div className="breeding-batch-title"><strong>第 {index + 1} 组</strong><span>{batch.pairs.length * 2} / 10 只</span></div>
      <div className="breeding-pairs">{batch.pairs.map((pair) => <article className="breeding-pair breeding-pair-card" key={`${pair.father.id}-${pair.mother.id}`}>
        <div className="breeding-pair-head"><span>{pair.eggGroup}</span><span>{pair.canRecommendedNature ? '可孵推荐性格' : '异色优先配对'}</span></div>
        <div className="breeding-lineup">
          <BreedingCreature gender="male" item={pair.father} />
          <div className="breeding-arrow">➜</div>
          <BreedingCreature gender="female" item={pair.mother} />
        </div>
        <div className="breeding-offspring-row">
          <BreedingCreature item={pair.mother} compact />
          <BreedingProbability pair={pair} />
        </div>
      </article>)}</div>
    </section>)}
  </div>
}

const NATURE_LABELS = Object.fromEntries(OWNED_NATURE_OPTIONS.map((item) => [item.value, item.label.replace(/（.+$/, '')]))

function natureLabel(value) {
  return NATURE_LABELS[value] || value || '未知性格'
}

function BreedingCreature({ gender, item, compact = false }) {
  const trait = item.catalog.row.values?.traitName || '无特性'
  return <div className={`breeding-creature-row ${compact ? 'compact' : ''}`}>
    <img src={item.catalog.row.values?.image || ''} alt="" />
    <span className={`breeding-sex-symbol ${gender || 'offspring'}`}>{gender === 'male' ? '♂' : gender === 'female' ? '♀' : '↻'}</span>
    <span className="breeding-creature-text" title={`${item.name} · ${natureLabel(item.nature)} · ${trait}`}>
      <strong>{item.name}</strong><em>{natureLabel(item.nature)}</em><small>{trait}</small>
    </span>
    {item.shiny && <img className="breeding-status-image" src="https://patchwiki.biligame.com/images/rocom/2/2e/buxc6y4s0r7d8ix03zzkahnk4h8urtv.png" alt="异色" title="异色" />}
    {item.colorful && <span className="rock-status-icon colorful-icon" title="炫彩">✦</span>}
  </div>
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
    <span>性格：{natureLabel(pair.father.nature)} 30% / {natureLabel(pair.mother.nature)} 30% / 随机 40%</span>
    <span>异色：{probabilityText(shinyBoth, shinyAny)}</span>
    <span>炫彩：{probabilityText(colorfulBoth, colorfulAny)}</span>
  </div>
}
