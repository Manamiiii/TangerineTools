import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { reviewNrc, renderReview } from '../bwiki/review-nrc.mjs'

test('NRC review validates full candidates without approving publication and detects damaged inputs', async () => {
  const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
  const staging = {}
  for (const [key, file] of Object.entries({ creatures: 'creatures', skills: 'skills', details: 'creature-details', breeding: 'breeding-rows' })) staging[key] = await json(`../bwiki/data/nrc/staging/${file}.json`)
  const input = { staging, creatures: await json('../bwiki/data/nrc/preview/creature-rows.json'), skills: await json('../bwiki/data/nrc/preview/skill-rows.json'), currentCreatures: await json('../../public/presets/rockKingdomRows.json'), currentSkills: await json('../../public/presets/rockKingdomSkillRows.json') }
  const before = JSON.stringify(input)
  const report = reviewNrc(input)
  assert.deepEqual(report.errors, [])
  assert.equal(report.publicationApproved, false)
  assert(report.releaseBlockers.length > 0)
  assert.match(renderReview(report), /不批准发布/)
  assert.equal(JSON.stringify(input), before)
  const broken = structuredClone(input)
  broken.creatures.rows[0].values.speciesGroup = ''
  broken.creatures.rows[0].values.hp = 0
  broken.skills.rows[0].values.cost++
  broken.creatures.stagingHashes.skills = 'outdated'
  broken.skills.rows[0].values.learnerRefs.push('nonexistent')
  const errors = reviewNrc(broken).errors.join('\n')
  for (const pattern of [/繁育字段缺失/, /六维不一致/, /技能cost不一致/, /指纹不一致/, /正向引用缺失/]) assert.match(errors, pattern)
  const omitted = structuredClone(input)
  omitted.creatures.rows.splice(0, 1)
  assert(reviewNrc(omitted).errors.some(error => error.includes('旧 ID 遗漏')))
})
