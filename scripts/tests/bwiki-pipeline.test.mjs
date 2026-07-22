import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { BWIKI_PATHS, resolveRepoPath } from '../bwiki/lib/paths.mjs'

test('BWiki detail staging keeps relation fields without duplicating skill bodies', async () => {
  const payload = JSON.parse(await readFile(resolveRepoPath(BWIKI_PATHS.staging.details), 'utf8'))
  const allowedSkillKeys = new Set(['sourceType', 'category', 'element', 'name', 'unlock'])

  assert.equal(payload.rowCount, payload.rows.length)
  assert.equal(payload.errorCount, 0)

  let skillCardCount = 0
  for (const row of payload.rows) {
    for (const skill of row.skills ?? []) {
      skillCardCount += 1
      assert.ok(skill.name, `${row.no} ${row.name} 存在无名称技能关系`)
      assert.deepEqual(
        Object.keys(skill).filter((key) => !allowedSkillKeys.has(key)),
        [],
        `${row.no} ${row.name} 的 ${skill.name} 重复保存了技能正文`,
      )
    }
  }

  assert.ok(skillCardCount > 0)
})
