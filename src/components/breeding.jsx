import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureOwnedTable } from '../db.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { buildOwnedCreatures, EGG_GROUP_SOURCE_URL, recommendBreedingBatches } from '../domain/breeding.js'
import { EmptyState } from './common.jsx'

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
        <p>从当前收集记录中筛选异色个体，一公一母、同蛋组优先；每组最多 5 对，共 10 只精灵。</p>
      </div>
      <a className="btn" href={EGG_GROUP_SOURCE_URL} target="_blank" rel="noreferrer">B站蛋组计算器</a>
    </div>
    <div className="breeding-notes">
      <span>规则：后代种类跟随母亲；性格、异色、炫彩继承概率暂无官方精确数值，未确认前只显示来源类别，不写死概率。</span>
      {missingEggGroups > 0 && <span>有 {missingEggGroups} 条拥有记录对应精灵缺少 eggGroups/蛋组 字段，暂不参与配对。</span>}
    </div>
    {batches.length === 0 ? <EmptyState title="暂无可推荐组合" description="请确认收集记录已填写性别、是否异色/炫彩，且资料库精灵行已填写蛋组。" /> : batches.map((batch, index) => <section className="breeding-batch" key={batch.id}>
      <div className="breeding-batch-title"><strong>第 {index + 1} 组</strong><span>{batch.pairs.length * 2} / 10 只</span></div>
      <div className="breeding-pairs">{batch.pairs.map((pair) => <article className="breeding-pair breeding-pair-card" key={`${pair.father.id}-${pair.mother.id}`}>
        <div className="breeding-pair-head"><span>{pair.eggGroup}</span><span>{pair.canRecommendedNature ? '可孵推荐性格' : '异色优先配对'}</span></div>
        <div className="breeding-family-top">
          <BreedingParent label="父" item={pair.father} />
          <BreedingParent label="母" item={pair.mother} />
        </div>
        <div className="breeding-child">
          <img src={pair.mother.catalog.row.values?.image || ''} alt="" />
          <div>
            <strong>孩子：{pair.mother.name}</strong>
            <span>种类跟随母亲；繁育谱系：{pair.targetSpecies}</span>
          </div>
        </div>
        <BreedingInheritance pair={pair} />
      </article>)}</div>
    </section>)}
  </div>
}

function BreedingParent({ label, item }) {
  return <div className="breeding-parent-card">
    <img src={item.catalog.row.values?.image || ''} alt="" />
    <div>
      <strong>{label} · {item.name}</strong>
      <span>{item.gender === 'male' ? '公' : '母'} · {item.nature || '未知性格'}</span>
      <span>{item.shiny ? '异色个体' : '非异色'} · {item.colorful ? '炫彩' : '非炫彩'}</span>
    </div>
  </div>
}

function BreedingInheritance({ pair }) {
  return <div className="breeding-inheritance">
    <div><strong>性格来源</strong><span>父：{pair.father.nature || '未知'} · 母：{pair.mother.nature || '未知'} · 其他：随机候选</span><small>官方精确概率未确认，暂不显示数值。</small></div>
    <div><strong>异色/炫彩</strong><span>父母均为异色；{pair.father.colorful || pair.mother.colorful ? '存在炫彩亲代' : '暂无炫彩亲代'}</span><small>亲代状态只用于排序，精确概率未确认。</small></div>
  </div>
}
