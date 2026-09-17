import test from 'node:test'
import assert from 'node:assert/strict'
import { auditNrc, renderNrcAudit } from '../bwiki/audit-nrc.mjs'

function sample() {
  const wrap = (rows) => ({ source: 'bwiki-nrc', version: 'S4-test', rowCount: rows.length, rows })
  return {
    currentRows: [{ id: 'old-id', values: { name: '精灵', no: 'NO.001', shiny: 'yes', element: ['light'], eggGroups: ['未发现'], hp: 100, skillRefs: ['skill-id'] } }],
    currentSkills: [{ id: 'skill-id', values: { name: '技能', category: 'status', element: 'light', cost: 3, power: 95, effect: '旧效果' } }],
    staging: {
      creatures: wrap([{ sourceId: 'pet_1', name: '精灵', no: 'NO.002', shinyLabel: '否', elements: ['光'], hp: 999, detailUrl: 'https://wiki.biligame.com/nrc/精灵' }]),
      skills: wrap([{ name: '技能', category: '防御', element: '光', cost: 3, power: 90, effect: '新效果' }]),
      breeding: wrap([{ sourceId: 'pet_1', name: '精灵', no: 'NO.002', eggGroups: ['无法孵蛋'], femaleOnly: true }]),
      details: wrap([]),
    },
  }
}

test('NRC audit separates category notation, uses source coverage and shows baseline skill impact', () => {
  const input = sample()
  const before = structuredClone(input)
  const report = auditNrc(input)
  assert.equal(report.categoryMappings.length, 1)
  assert.deepEqual(report.skillChanges[0].changes.map((row) => row.field), ['power', 'effect'])
  assert.equal(report.skillChanges[0].baselineLearners[0].id, 'old-id')
  assert.deepEqual(report.creatureChanges[0].changes.map((row) => row.field), ['no', 'shiny'])
  assert.equal(report.missingDetails.length, 1)
  assert.equal(report.femaleOnly.length, 1)
  assert.equal(report.inputHashes.currentRows.length, 64)
  assert.match(renderNrcAudit(report), /缺详情不代表未变化/)
  assert.deepEqual(input, before)
})

test('Same-number alternative names remain candidates even when there are several forms', () => {
  const input = sample()
  input.staging.creatures.rows[0].name = '精灵（新形态）'
  input.staging.breeding.rows[0].name = '精灵（新形态）'
  input.currentRows[0].values.no = 'NO.002'
  input.currentRows.push({ id: 'other-id', values: { name: '另一形态', no: 'NO.002' } })
  const report = auditNrc(input)
  assert.equal(report.unmatchedCreatures.length, 1)
  assert.equal(report.absentCreatures.length, 2)
  assert.equal(report.identityCandidates[0].candidates.length, 2)
  assert.equal(report.creatureChanges.length, 0)
})

test('NRC audit rejects mixed versions, duplicate source identities and misbound details', () => {
  const mixed = sample()
  mixed.staging.skills.version = 'S3'
  assert.throws(() => auditNrc(mixed), /source\/version\/rowCount/)
  const duplicate = sample()
  duplicate.staging.creatures.rows.push({ ...duplicate.staging.creatures.rows[0], name: '另一只' })
  duplicate.staging.creatures.rowCount++
  assert.throws(() => auditNrc(duplicate), /duplicate key/)
  const detail = sample()
  detail.staging.details.rows.push({ sourceId: 'pet_1', name: '错误精灵', no: 'NO.002' })
  detail.staging.details.rowCount++
  assert.throws(() => auditNrc(detail), /identity mismatch/)
})

test('Only valid details supply stats and skill-pool changes; Markdown escapes source text', () => {
  const input = sample()
  input.staging.details.rows.push({
    sourceId: 'pet_1', name: '精灵', no: 'NO.002',
    stats: { hp: 120, patk: 80, matk: 80, pdef: 105, mdef: 105, spd: 92, bst: 582 },
    skills: [{ name: '缺失技能', sourceType: 'blood' }],
    trait: { name: '特性', description: '内容 | <script>\n下一行' },
  })
  input.staging.details.rowCount++
  const report = auditNrc(input)
  assert.equal(report.missingDetails.length, 0)
  assert.ok(report.creatureChanges[0].changes.some((change) => change.field === 'hp' && change.after === 120))
  assert.ok(report.creatureChanges[0].changes.some((change) => change.field === 'skillNames'))
  assert.equal(report.detailIssues.length, 2)
  input.staging.details.rows[0].skills[0].sourceType = 'legendary'
  assert.equal(auditNrc(input).detailIssues.some(row => row.issue === '未知技能来源'), false)
  input.staging.details.rows[0].skills[0].sourceType = 'unknown'
  assert.equal(auditNrc(input).detailIssues.some(row => row.issue === '未知技能来源'), true)
  const markdown = renderNrcAudit(report)
  assert.match(markdown, /&#124; &lt;script&gt; \/ 下一行/)
  input.staging.details.rows[0].stats.hp = 0
  assert.throws(() => auditNrc(input), /Invalid detail stats/)
})
