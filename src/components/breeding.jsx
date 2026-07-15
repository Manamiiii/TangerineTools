import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'
import { ROCK_KINGDOM_PRESET } from '../presets/rockKingdom.js'
import { buildOwnedCreatures, EGG_GROUP_SOURCE_URL, recommendBreedingBatches } from '../domain/breeding.js'
import { EmptyState } from './common.jsx'

export function BreedingTool({ scene }) {
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
        <p>从当前收集记录中筛选一公一母、同蛋组的异色优先组合；每组最多 5 对，共 10 只精灵。</p>
      </div>
      <a className="btn" href={EGG_GROUP_SOURCE_URL} target="_blank" rel="noreferrer">B站蛋组计算器</a>
    </div>
    <div className="breeding-notes">
      <span>规则：后代种类跟随母亲；性格按父/母/随机继承概率提示处理；异色/炫彩父母越多，异色炫彩期望越高。</span>
      {missingEggGroups > 0 && <span>有 {missingEggGroups} 条拥有记录对应精灵缺少 eggGroups/蛋组 字段，暂不参与配对。</span>}
    </div>
    {batches.length === 0 ? <EmptyState title="暂无可推荐组合" description="请确认收集记录已填写性别、是否异色/炫彩，且资料库精灵行已填写蛋组。" /> : batches.map((batch, index) => <section className="breeding-batch" key={batch.id}>
      <div className="breeding-batch-title"><strong>第 {index + 1} 组</strong><span>{batch.pairs.length * 2} / 10 只</span></div>
      <div className="breeding-pairs">{batch.pairs.map((pair) => <article className="breeding-pair" key={`${pair.father.id}-${pair.mother.id}`}>
        <div className="breeding-pair-head"><span>{pair.eggGroup}</span><span>{pair.canRecommendedNature ? '可孵推荐性格' : '先刷异色/炫彩'}</span></div>
        <BreedingParent label="父" item={pair.father} />
        <BreedingParent label="母" item={pair.mother} />
        <p>目标同种：{pair.targetSpecies}；后代种类按母亲「{pair.mother.name}」。</p>
      </article>)}</div>
    </section>)}
  </div>
}

function BreedingParent({ label, item }) {
  return <div className="breeding-parent"><strong>{label}</strong><span>{item.name}</span><span>{item.shiny ? '异色' : '普通'}</span><span>{item.colorful ? '炫彩' : '非炫彩'}</span></div>
}
