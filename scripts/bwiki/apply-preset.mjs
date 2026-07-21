#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')
const FILES = {
  creaturePreview: 'scripts/bwiki/data/preview/creature-rows.json',
  skillPreview: 'scripts/bwiki/data/preview/skill-rows.json',
  details: 'scripts/bwiki/data/staging/creature-details.json',
  creaturePreset: 'public/presets/rockKingdomRows.json',
  skillPreset: 'public/presets/rockKingdomSkillRows.json',
  migrationPreview: 'artifacts/bwiki/rockKingdomPresetMigration.preview.json',
  migrationPreset: 'public/presets/rockKingdomPresetMigration.json',
  report: 'artifacts/bwiki/apply-report.md',
}
const CONFIRMATION = 'CONFIRM_BWIKI_PRESET'

function absolute(relativePath) {
  return path.join(repoRoot, relativePath)
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(absolute(relativePath), 'utf8'))
}

async function readOptionalJson(relativePath, fallback) {
  try {
    return await readJson(relativePath)
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertRows(rows, label) {
  assert(Array.isArray(rows) && rows.length > 0, `${label} 必须是非空数组`)
  const ids = new Set()
  for (const [index, row] of rows.entries()) {
    assert(row && typeof row === 'object', `${label} 第 ${index + 1} 行不是对象`)
    assert(typeof row.id === 'string' && row.id, `${label} 第 ${index + 1} 行缺少 id`)
    assert(!ids.has(row.id), `${label} 存在重复 id：${row.id}`)
    assert(row.values && typeof row.values === 'object' && !Array.isArray(row.values), `${label} ${row.id} 缺少 values`)
    ids.add(row.id)
  }
  return ids
}

function presetRowsFromPreview(payload, label) {
  assert(payload?.source === 'bwiki-preview', `${label} source 不是 bwiki-preview`)
  assert(Array.isArray(payload.rows), `${label} 缺少 rows 数组`)
  assert(payload.rowCount === payload.rows.length, `${label} rowCount 与 rows.length 不一致`)
  return payload.rows.map((row) => ({ id: row.id, values: row.values }))
}

function compareIds(beforeRows, afterRows) {
  const beforeIds = new Set(beforeRows.map((row) => row.id))
  const afterIds = new Set(afterRows.map((row) => row.id))
  return {
    before: beforeIds.size,
    after: afterIds.size,
    reused: [...afterIds].filter((id) => beforeIds.has(id)),
    added: [...afterIds].filter((id) => !beforeIds.has(id)),
    omitted: [...beforeIds].filter((id) => !afterIds.has(id)),
  }
}

function buildMigrationSection(beforeRows, afterRows, previousSection = {}) {
  const beforeById = new Map(beforeRows.map((row) => [row.id, row]))
  const patchById = new Map((previousSection.rows ?? []).map((row) => [row.id, {
    id: row.id,
    fields: (row.fields ?? []).map((field) => ({
      key: field.key,
      acceptedHashes: [...new Set(field.acceptedHashes ?? [])],
    })),
  }]))

  for (const row of afterRows) {
    const before = beforeById.get(row.id)
    if (!before) continue
    let rowPatch = patchById.get(row.id)
    for (const [key, nextValue] of Object.entries(row.values)) {
      if (!Object.hasOwn(before.values, key)) continue
      const previousValue = before.values[key]
      if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) continue
      if (!rowPatch) {
        rowPatch = { id: row.id, fields: [] }
        patchById.set(row.id, rowPatch)
      }
      let fieldPatch = rowPatch.fields.find((field) => field.key === key)
      if (!fieldPatch) {
        fieldPatch = { key, acceptedHashes: [] }
        rowPatch.fields.push(fieldPatch)
      }
      const previousHash = sha256(JSON.stringify(previousValue))
      if (!fieldPatch.acceptedHashes.includes(previousHash)) fieldPatch.acceptedHashes.push(previousHash)
    }
  }

  const rows = [...patchById.values()]
    .map((row) => ({ ...row, fields: row.fields.sort((a, b) => a.key.localeCompare(b.key)) }))
    .filter((row) => row.fields.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id))
  return {
    rowCount: rows.length,
    fieldCount: rows.reduce((total, row) => total + row.fields.length, 0),
    rows,
  }
}

function buildMigrationManifest({ currentCreatures, currentSkills, creatureRows, skillRows, existingManifest, hashes, generatedAt }) {
  return {
    source: 'bwiki-preset-migration',
    version: `bwiki-${generatedAt.slice(0, 10)}-${hashes.creatures.slice(0, 8)}${hashes.skills.slice(0, 8)}`,
    generatedAt,
    target: {
      creatureRows: creatureRows.length,
      skillRows: skillRows.length,
      creaturePreviewSha256: hashes.creatures,
      skillPreviewSha256: hashes.skills,
    },
    creatures: buildMigrationSection(currentCreatures, creatureRows, existingManifest?.creatures),
    skills: buildMigrationSection(currentSkills, skillRows, existingManifest?.skills),
  }
}

function assertMigrationManifest(manifest) {
  assert(manifest.source === 'bwiki-preset-migration', '迁移清单 source 不正确')
  for (const [label, section] of [['精灵', manifest.creatures], ['技能', manifest.skills]]) {
    assert(section.rowCount === section.rows.length, `${label}迁移清单 rowCount 不一致`)
    assert(section.fieldCount === section.rows.reduce((total, row) => total + row.fields.length, 0), `${label}迁移清单 fieldCount 不一致`)
    for (const row of section.rows) {
      assert(typeof row.id === 'string' && row.id, `${label}迁移清单存在空 id`)
      for (const field of row.fields) {
        assert(typeof field.key === 'string' && field.key, `${label}迁移清单 ${row.id} 存在空字段 key`)
        assert(Object.keys(field).every((key) => key === 'key' || key === 'acceptedHashes'), `${label}迁移清单 ${row.id}.${field.key} 包含非指纹数据`)
        assert(field.acceptedHashes.length > 0 && field.acceptedHashes.every((hash) => /^[a-f0-9]{64}$/.test(hash)), `${label}迁移清单 ${row.id}.${field.key} 指纹无效`)
      }
    }
  }
}

function validateRelations(creatureRows, skillRows) {
  const creatures = new Map(creatureRows.map((row) => [row.id, row]))
  const skills = new Map(skillRows.map((row) => [row.id, row]))
  const problems = []
  let forwardEdges = 0
  let reverseEdges = 0

  for (const creature of creatureRows) {
    const refs = creature.values.skillRefs
    if (!Array.isArray(refs) || refs.length === 0) problems.push(`${creature.id} 没有 skillRefs`)
    for (const skillId of refs ?? []) {
      forwardEdges += 1
      const skill = skills.get(skillId)
      if (!skill) problems.push(`${creature.id} 引用了不存在的技能 ${skillId}`)
      else if (!(skill.values.learnerRefs ?? []).includes(creature.id)) problems.push(`${creature.id} → ${skillId} 缺少反向引用`)
    }
  }
  for (const skill of skillRows) {
    assert(Array.isArray(skill.values.learnerRefs), `${skill.id} 的 learnerRefs 不是数组`)
    for (const creatureId of skill.values.learnerRefs) {
      reverseEdges += 1
      const creature = creatures.get(creatureId)
      if (!creature) problems.push(`${skill.id} 引用了不存在的精灵 ${creatureId}`)
      else if (!(creature.values.skillRefs ?? []).includes(skill.id)) problems.push(`${skill.id} → ${creatureId} 缺少正向引用`)
    }
  }
  assert(problems.length === 0, `技能关系校验失败：${problems.slice(0, 5).join('；')}`)
  assert(forwardEdges === reverseEdges, `技能关系边数不一致：${forwardEdges} / ${reverseEdges}`)
  return { forwardEdges, reverseEdges }
}

function renderIdExamples(ids) {
  if (ids.length === 0) return '- （无）'
  return ids.slice(0, 20).map((id) => `- ${id}`).join('\n') + (ids.length > 20 ? `\n- ……另有 ${ids.length - 20} 条` : '')
}

function renderReport({ generatedAt, mode, creatureDiff, skillDiff, relations, hashes, legacyUnmatched, migrationManifest }) {
  return `# BWiki 正式预置发布检查报告

生成时间：${generatedAt}

执行模式：${mode === 'write' ? '**已显式覆盖**' : '**只读 dry-run，未覆盖 public presets**'}

## 覆盖摘要

| 预置 | 覆盖前 | 覆盖后 | 复用 id | 新增 id | 目标中不再包含的旧 id |
|---|---:|---:|---:|---:|---:|
| 精灵 | ${creatureDiff.before} | ${creatureDiff.after} | ${creatureDiff.reused.length} | ${creatureDiff.added.length} | ${creatureDiff.omitted.length} |
| 技能 | ${skillDiff.before} | ${skillDiff.after} | ${skillDiff.reused.length} | ${skillDiff.added.length} | ${skillDiff.omitted.length} |

## 技能关系完整性

| 精灵 → 技能边数 | 技能 → 精灵边数 | 缺失 / 悬空引用 |
|---:|---:|---:|
| ${relations.forwardEdges} | ${relations.reverseEdges} | 0 |

## 旧 id 兼容审计

精灵目标中不再包含的旧 id：

${renderIdExamples(creatureDiff.omitted)}

技能目标中不再包含的旧 id：

${renderIdExamples(skillDiff.omitted)}

> 静态 preset 覆盖不会直接操作 IndexedDB。历史上未进入新版预置的 29 个旧 id 仍保留在已有浏览器中，以兼容 owned / stock 引用；资料库、引用选择、性格推荐和统计视图会在对应新版行存在时隐藏这些旧概括行。

## 旧模板审计

${legacyUnmatched.length ? legacyUnmatched.map((item) => `- ${item}`).join('\n') : '- （无）'}

> 无法在当前技能 staging 中确认的旧模板引用不会生成技能预置行。

## 实际覆盖前的运行时复核

- 新安装会直接读取覆盖后的完整预置。
- 已有浏览器会读取版本化迁移清单；字段为空、值无效，或当前值的 SHA-256 与旧官方值匹配时才更新为新版预置值。
- 当前值不匹配任何旧官方指纹时视为用户自定义，精灵和技能字段都保持不变。
- 迁移不会删除历史旧 id、用户新增行或 owned / stock 引用；重复显示由只读归并视图处理。

| 迁移清单 | 涉及行数 | 涉及字段数 |
|---|---:|---:|
| 精灵 | ${migrationManifest.creatures.rowCount} | ${migrationManifest.creatures.fieldCount} |
| 技能 | ${migrationManifest.skills.rowCount} | ${migrationManifest.skills.fieldCount} |

迁移清单 preview：\`${FILES.migrationPreview}\`

## 输入指纹

| 文件 | SHA-256 |
|---|---|
| \`${FILES.creaturePreview}\` | \`${hashes.creatures}\` |
| \`${FILES.skillPreview}\` | \`${hashes.skills}\` |

## 安全边界

- dry-run 只写本报告，不修改 \`public/presets/*\`。
- 真正覆盖只能通过 \`BWIKI_PRESET_OVERWRITE=${CONFIRMATION} npm run apply:bwiki:preset\` 触发。
- 覆盖产物只保留 \`id\` / \`values\`，不会把 \`previewMeta\` 写入运行时预置。
- 正式覆盖会同时发布 \`${FILES.migrationPreset}\`，使已有浏览器能三方合并旧官方值、新官方值和用户当前值。
- 命令不读取或写入 Dexie / IndexedDB，不删除 owned / stock 数据，也不改变 import/export 的 merge-by-id 语义。
`
}

async function writePresetFiles(creatureRows, skillRows, migrationManifest) {
  const targets = [
    [absolute(FILES.creaturePreset), `${JSON.stringify(creatureRows, null, 2)}\n`],
    [absolute(FILES.skillPreset), `${JSON.stringify(skillRows, null, 2)}\n`],
    [absolute(FILES.migrationPreset), `${JSON.stringify(migrationManifest, null, 2)}\n`],
  ]
  const originals = await Promise.all(targets.map(async ([target]) => {
    try {
      return await readFile(target, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }))
  const temporary = targets.map(([target]) => `${target}.tmp-${process.pid}`)
  const replaced = []
  try {
    await Promise.all(targets.map(([, contents], index) => writeFile(temporary[index], contents)))
    for (const [index, [target]] of targets.entries()) {
      await rename(temporary[index], target)
      replaced.push(index)
    }
  } catch (error) {
    await Promise.all(replaced.map((index) => originals[index] == null
      ? rm(targets[index][0], { force: true })
      : writeFile(targets[index][0], originals[index])))
    throw error
  } finally {
    await Promise.all(temporary.map((file) => rm(file, { force: true })))
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const unknownArgs = [...args].filter((arg) => arg !== '--write')
  assert(unknownArgs.length === 0, `未知参数：${unknownArgs.join(' ')}`)
  const writeMode = args.has('--write')

  const [creaturePreviewText, skillPreviewText, currentCreatures, currentSkills, details, existingManifest] = await Promise.all([
    readFile(absolute(FILES.creaturePreview), 'utf8'),
    readFile(absolute(FILES.skillPreview), 'utf8'),
    readJson(FILES.creaturePreset),
    readJson(FILES.skillPreset),
    readJson(FILES.details),
    readOptionalJson(FILES.migrationPreset, null),
  ])
  const creaturePreview = JSON.parse(creaturePreviewText)
  const skillPreview = JSON.parse(skillPreviewText)
  if (existingManifest) assert(existingManifest.source === 'bwiki-preset-migration', '现有 public 迁移清单 source 不正确')
  const creatureRows = presetRowsFromPreview(creaturePreview, '精灵 preview')
  const skillRows = presetRowsFromPreview(skillPreview, '技能 preview')

  assertRows(currentCreatures, '当前精灵 preset')
  assertRows(currentSkills, '当前技能 preset')
  assertRows(creatureRows, '目标精灵 preset')
  assertRows(skillRows, '目标技能 preset')
  assert(details.rowCount === creatureRows.length && details.errorCount === 0, '详情 staging 未达到与目标精灵等量的 0-error 状态')
  assert(creatureRows.every((row) => row.values.name && row.values.no && row.values.image), '目标精灵存在名称、编号或图片空值')
  assert(skillRows.every((row) => row.values.name && row.values.image), '目标技能存在名称或图片空值')

  const relations = validateRelations(creatureRows, skillRows)
  const creatureDiff = compareIds(currentCreatures, creatureRows)
  const skillDiff = compareIds(currentSkills, skillRows)
  const legacyUnmatched = details.rows.flatMap((row) =>
    (row.legacyUnmatchedSkillNames ?? []).map((name) => `${row.no} ${row.name}：${name}`))
  const generatedAt = new Date().toISOString()
  const hashes = { creatures: sha256(creaturePreviewText), skills: sha256(skillPreviewText) }
  const migrationManifest = buildMigrationManifest({
    currentCreatures,
    currentSkills,
    creatureRows,
    skillRows,
    existingManifest,
    hashes,
    generatedAt,
  })
  assertMigrationManifest(migrationManifest)
  await mkdir(path.dirname(absolute(FILES.migrationPreview)), { recursive: true })
  await writeFile(absolute(FILES.migrationPreview), `${JSON.stringify(migrationManifest, null, 2)}\n`)

  if (writeMode) {
    assert(
      process.env.BWIKI_PRESET_OVERWRITE === CONFIRMATION,
      `拒绝覆盖：必须设置 BWIKI_PRESET_OVERWRITE=${CONFIRMATION}`,
    )
    await writePresetFiles(creatureRows, skillRows, migrationManifest)
    const [writtenCreatures, writtenSkills, writtenMigration] = await Promise.all([
      readFile(absolute(FILES.creaturePreset), 'utf8'),
      readFile(absolute(FILES.skillPreset), 'utf8'),
      readFile(absolute(FILES.migrationPreset), 'utf8'),
    ])
    assert(writtenCreatures === `${JSON.stringify(creatureRows, null, 2)}\n`, '精灵 preset 写入后校验失败')
    assert(writtenSkills === `${JSON.stringify(skillRows, null, 2)}\n`, '技能 preset 写入后校验失败')
    assert(writtenMigration === `${JSON.stringify(migrationManifest, null, 2)}\n`, '迁移清单写入后校验失败')
  }

  const report = renderReport({
    generatedAt,
    mode: writeMode ? 'write' : 'dry-run',
    creatureDiff,
    skillDiff,
    relations,
    hashes,
    legacyUnmatched,
    migrationManifest,
  })
  await mkdir(path.dirname(absolute(FILES.report)), { recursive: true })
  await writeFile(absolute(FILES.report), report)

  console.log(`${writeMode ? 'Applied' : 'Validated'} BWiki presets: ${creatureRows.length} creatures, ${skillRows.length} skills`)
  console.log(`IDs: creatures ${creatureDiff.reused.length} reused / ${creatureDiff.added.length} added / ${creatureDiff.omitted.length} omitted; skills ${skillDiff.reused.length} reused / ${skillDiff.added.length} added / ${skillDiff.omitted.length} omitted`)
  console.log(`Relations: ${relations.forwardEdges} forward / ${relations.reverseEdges} reverse`)
  console.log(`Migration patches: creatures ${migrationManifest.creatures.rowCount} rows / ${migrationManifest.creatures.fieldCount} fields; skills ${migrationManifest.skills.rowCount} rows / ${migrationManifest.skills.fieldCount} fields`)
  console.log(`Report: ${FILES.report}`)
}

main().catch((error) => {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
})
