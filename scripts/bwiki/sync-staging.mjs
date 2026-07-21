import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const BASE_URL = 'https://wiki.biligame.com'
const SOURCE_PAGES = {
  creatures: `${BASE_URL}/rocom/%E7%B2%BE%E7%81%B5%E7%AD%9B%E9%80%89`,
  skills: `${BASE_URL}/rocom/%E6%8A%80%E8%83%BD%E6%9F%A5%E8%AF%A2`,
  eggs: `${BASE_URL}/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E7%AD%9B%E9%80%89`,
  creatureCatalog: `${BASE_URL}/rocom/%E7%B2%BE%E7%81%B5%E5%9B%BE%E9%89%B4`,
  eggCatalog: `${BASE_URL}/rocom/%E7%B2%BE%E7%81%B5%E8%9B%8B%E5%9B%BE%E9%89%B4`,
  fruitCatalog: `${BASE_URL}/rocom/%E7%B2%BE%E7%81%B5%E6%9E%9C%E5%AE%9E%E5%9B%BE%E9%89%B4`,
}

const OUTPUTS = {
  creatures: 'scripts/bwiki/data/staging/creatures.json',
  skills: 'scripts/bwiki/data/staging/skills.json',
  eggs: 'scripts/bwiki/data/staging/eggs.json',
  reportJson: 'artifacts/bwiki/source-report.json',
  reportMd: 'artifacts/bwiki/staging-report.md',
}

const LOCAL_CREATURE_PRESET = 'public/presets/rockKingdomRows.json'
const LOCAL_SKILL_PRESET = 'public/presets/rockKingdomSkillRows.json'

const FORM_CATEGORY_MAP = new Map([
  ['原始形态', 'original'],
  ['地区形态', 'regional'],
  ['首领形态', 'leader'],
])

const ELEMENTS = [
  '普通',
  '草',
  '火',
  '水',
  '光',
  '地',
  '冰',
  '龙',
  '电',
  '毒',
  '虫',
  '武',
  '翼',
  '萌',
  '幽',
  '恶',
  '机械',
  '幻',
]

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'TangerineTools data staging audit',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.text()
  } catch {
    const { stdout } = await execFileAsync('curl', ['-L', '--fail', '--silent', '--show-error', url], {
      maxBuffer: 80 * 1024 * 1024,
    })
    return stdout
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function fetchTextWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchText(url)
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(500 * attempt)
    }
  }
  throw lastError
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

function stripTags(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractAttr(tag, attr) {
  const pattern = new RegExp(`${attr}=(['"])(.*?)\\1`, 'i')
  return tag.match(pattern)?.[2] ?? ''
}

function extractDataAttrs(tag) {
  const attrs = {}
  for (const match of tag.matchAll(/\sdata-([\w-]+)=(['"])(.*?)\2/gi)) {
    attrs[match[1]] = decodeHtml(match[3]).trim()
  }
  return attrs
}

function absoluteUrl(href) {
  if (!href) return ''
  return new URL(decodeHtml(href), BASE_URL).href
}

function extractCells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1])
}

function extractRows(html) {
  return [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0])
}

function extractFirstImage(cellHtml) {
  const img = cellHtml.match(/<img\b[^>]*>/i)?.[0] ?? ''
  const src = extractAttr(img, 'data-src') || extractAttr(img, 'src')
  return absoluteUrl(src)
}


function extractMediaName(cellHtml) {
  const img = cellHtml.match(/<img\b[^>]*>/i)?.[0] ?? ''
  const imgAlt = extractAttr(img, 'alt')
  if (imgAlt && !imgAlt.startsWith('图标 ')) return decodeHtml(imgAlt).trim()
  const anchor = cellHtml.match(/<a\b[^>]*>/i)?.[0] ?? ''
  const title = extractAttr(anchor, 'title')
  if (title && !title.startsWith('文件:')) return decodeHtml(title).trim()
  return normalizeName(cellHtml)
}

function extractFirstLink(cellHtml) {
  const anchor = cellHtml.match(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>/i)
  return anchor ? absoluteUrl(anchor[2]) : ''
}

function toNumber(value) {
  const text = stripTags(value)
  if (!text || text === '-' || text === '—') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function splitElements(value) {
  const text = stripTags(value)
  if (!text) return []
  return ELEMENTS.filter((element) => text.includes(element))
}

function normalizeName(value) {
  return stripTags(value).replace(/^\d+\s*/, '').trim()
}

function parseNo(value) {
  const text = stripTags(value)
  const no = text.match(/NO\.\s*(\d+)/i)?.[1] ?? text.match(/(\d+)/)?.[1] ?? ''
  return no ? `NO.${no.padStart(3, '0')}` : text
}

function parseCreatureRows(html) {
  const rows = extractRows(html)
  return rows
    .map((rowHtml, index) => {
      const cells = extractCells(rowHtml)
      if (cells.length < 12 || index === 0) return null
      const data = extractDataAttrs(rowHtml)
      const no = parseNo(cells[0])
      const name = normalizeName(cells[2])
      if (!no || !name) return null
      const formCategoryLabel = data.param4 || ''
      const isMainForm = data.param5 === '主形态'
      return {
        source: 'bwiki-creature-filter',
        sourceUrl: SOURCE_PAGES.creatures,
        no,
        numericNo: Number(no.match(/\d+/)?.[0] ?? 0),
        name,
        displayName: normalizeName(cells[1]) || name,
        stageLabel: data.param1 || '',
        elements: splitElements(cells[3]),
        traitName: stripTags(cells[4]),
        hp: toNumber(cells[5]),
        spd: toNumber(cells[6]),
        patk: toNumber(cells[7]),
        matk: toNumber(cells[8]),
        pdef: toNumber(cells[9]),
        mdef: toNumber(cells[10]),
        bst: toNumber(cells[11]),
        formCategory: FORM_CATEGORY_MAP.get(formCategoryLabel) ?? '',
        formCategoryLabel,
        isMainForm,
        shinyLabel: data.param6 || '',
        availabilityLabel: data.param7 || '',
        seasonLabel: data.param8 || '',
        image: extractFirstImage(cells[1]),
        detailUrl: extractFirstLink(cells[2]) || extractFirstLink(cells[1]),
        rawParams: data,
      }
    })
    .filter(Boolean)
}

function parseCreatureCatalogRows(html) {
  return html
    .split(/<div class="divsort dex-card dex-pet-card(?:\s|")/)
    .slice(1)
    .map((segment) => {
      const block = `<div class="divsort dex-card dex-pet-card ${segment}`
      const nameBlock = block.match(/<div class="dex-card-name[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''
      const baseName = normalizeName(nameBlock)
      const subtitle = stripTags(block.match(/<div class="dex-card-subtitle">([\s\S]*?)<\/div>/i)?.[1] ?? '')
      const name = subtitle && subtitle !== '首领形态' ? `${baseName}（${subtitle}）` : baseName
      const no = parseNo(block.match(/<div class="dex-card-kicker">([\s\S]*?)<span>/i)?.[1] ?? '')
      const normalArt = block.match(/<span class="dex-pet-art-layer dex-pet-art-normal">([\s\S]*?)<\/span>/i)?.[0] ?? ''
      const artBlock = normalArt || block.match(/<div class="dex-pet-art">[\s\S]*?(?=<div class="dex-card-types")/i)?.[0] || ''
      if (!name || !no) return null
      return {
        no,
        name,
        image: extractFirstImage(artBlock),
      }
    })
    .filter(Boolean)
}

function parseSkillRows(html) {
  const rows = extractRows(html)
  return rows
    .map((rowHtml, index) => {
      const cells = extractCells(rowHtml)
      if (cells.length < 7 || index === 0) return null
      const name = normalizeName(cells[1])
      if (!name) return null
      return {
        source: 'bwiki-skill-query',
        sourceUrl: SOURCE_PAGES.skills,
        name,
        element: stripTags(cells[2]),
        category: stripTags(cells[3]),
        cost: toNumber(cells[4]),
        power: toNumber(cells[5]),
        effect: stripTags(cells[6]),
        image: extractFirstImage(cells[0]),
        detailUrl: extractFirstLink(cells[1]) || extractFirstLink(cells[0]),
      }
    })
    .filter(Boolean)
}

function parseEggRows(html) {
  const rows = extractRows(html)
  return rows
    .map((rowHtml, index) => {
      const cells = extractCells(rowHtml)
      if (cells.length < 5 || index === 0) return null
      const data = extractDataAttrs(rowHtml)
      const creatureName = normalizeName(cells[3])
      if (!creatureName) return null
      return {
        source: 'bwiki-egg-filter',
        sourceUrl: SOURCE_PAGES.eggs,
        eggName: extractMediaName(cells[0]),
        fruitName: extractMediaName(cells[1]),
        creatureName,
        creatureDisplayName: extractMediaName(cells[2]) || creatureName,
        elements: splitElements(data.param1 || cells[4]),
        eggImage: extractFirstImage(cells[0]),
        fruitImage: extractFirstImage(cells[1]),
        creatureImage: extractFirstImage(cells[2]),
        creatureDetailUrl: extractFirstLink(cells[3]) || extractFirstLink(cells[2]),
        rawParams: data,
      }
    })
    .filter(Boolean)
}


function buildEggByCreatureName(eggs) {
  const result = new Map()
  for (const egg of eggs) {
    if (!egg.creatureName || result.has(egg.creatureName)) continue
    result.set(egg.creatureName, egg)
  }
  return result
}

function enrichCreaturesWithEggAssets(creatures, eggs) {
  const eggByCreatureName = buildEggByCreatureName(eggs)
  return creatures.map((creature) => {
    const egg = eggByCreatureName.get(creature.name)
    if (!egg) {
      return {
        ...creature,
        eggName: '',
        fruitName: '',
        eggImage: '',
        fruitImage: '',
      }
    }
    return {
      ...creature,
      eggName: egg.eggName,
      fruitName: egg.fruitName,
      eggImage: egg.eggImage,
      fruitImage: egg.fruitImage,
    }
  })
}

function enrichCreaturesWithCatalogImages(creatures, catalogRows) {
  const byExact = groupBy(catalogRows, (row) => `${row.no}|${row.name}`)
  const byName = groupBy(catalogRows, (row) => row.name)
  return creatures.map((creature) => {
    const exactMatches = byExact.get(`${creature.no}|${creature.name}`) ?? []
    const nameMatches = byName.get(creature.name) ?? []
    const catalog = exactMatches.length === 1 ? exactMatches[0] : nameMatches.length === 1 ? nameMatches[0] : null
    return {
      ...creature,
      image: creature.image || catalog?.image || '',
      imageSource: creature.image ? 'creature-filter' : catalog?.image ? 'creature-catalog' : 'empty',
    }
  })
}

function countBy(rows, getter) {
  const result = {}
  for (const row of rows) {
    const key = getter(row) || '（空）'
    result[key] = (result[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN')))
}

function groupBy(rows, getter) {
  const result = new Map()
  for (const row of rows) {
    const key = getter(row)
    if (!result.has(key)) result.set(key, [])
    result.get(key).push(row)
  }
  return result
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function compareNames(stagingRows, localRows) {
  const stagingNames = new Set(stagingRows.map((row) => row.name))
  const localNames = new Set(localRows.map((row) => row.values?.name).filter(Boolean))
  return {
    missingInBwiki: [...localNames].filter((name) => !stagingNames.has(name)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    extraInBwiki: [...stagingNames].filter((name) => !localNames.has(name)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
  }
}

function compareSkillNames(stagingRows, localRows) {
  const stagingNames = new Set(stagingRows.map((row) => row.name))
  const localNames = new Set(localRows.map((row) => row.values?.name).filter(Boolean))
  return {
    missingInBwiki: [...localNames].filter((name) => !stagingNames.has(name)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    extraInBwiki: [...stagingNames].filter((name) => !localNames.has(name)).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
  }
}

function topMultiNoGroups(creatures) {
  return [...groupBy(creatures, (row) => row.no).entries()]
    .map(([no, rows]) => ({ no, count: rows.length, names: rows.map((row) => row.name) }))
    .filter((group) => group.count > 1)
    .sort((a, b) => b.count - a.count || a.no.localeCompare(b.no))
    .slice(0, 12)
}

function renderCountTable(counts) {
  return Object.entries(counts)
    .map(([label, count]) => `| ${label} | ${count} |`)
    .join('\n')
}

function renderList(items, limit = 30) {
  const visible = items.slice(0, limit)
  const suffix = items.length > limit ? `\n- ……另有 ${items.length - limit} 项` : ''
  return `${visible.map((item) => `- ${item}`).join('\n')}${suffix}` || '- （无）'
}

function renderReport({ syncedAt, creatures, skills, eggs, localCreatures, localSkills, creatureDiff, skillDiff }) {
  const creatureEggAssetCounts = countBy(creatures, (row) => (row.eggImage ? '有精灵蛋图' : '缺精灵蛋图'))
  const creatureFruitAssetCounts = countBy(creatures, (row) => (row.fruitImage ? '有精灵果实图' : '缺精灵果实图'))
  const creatureImageSourceCounts = countBy(creatures, (row) => row.imageSource)
  const formCounts = countBy(creatures, (row) => row.formCategoryLabel)
  const mainFormCounts = countBy(creatures, (row) => (row.isMainForm ? '主形态' : '非主形态/未标注'))
  const stageCounts = countBy(creatures, (row) => row.stageLabel)
  const availabilityCounts = countBy(creatures, (row) => row.availabilityLabel)
  const seasonCounts = countBy(creatures, (row) => row.seasonLabel)
  const skillCategoryCounts = countBy(skills, (row) => row.category)
  const eggElementCounts = countBy(eggs, (row) => row.elements.join('/') || '（空）')
  const multiNoGroups = topMultiNoGroups(creatures)

  return `# BWiki staging source report

Generated at: ${syncedAt}

> This report is generated by \`npm run sync:bwiki:staging\`. It records BWiki staging snapshots only; it does not replace \`public/presets\` and does not touch Dexie/browser data.

## Snapshot outputs

| Dataset | Source page | Output | Rows |
|---|---|---:|---:|
| 精灵筛选 | ${SOURCE_PAGES.creatures} | \`${OUTPUTS.creatures}\` | ${creatures.length} |
| 技能查询 | ${SOURCE_PAGES.skills} | \`${OUTPUTS.skills}\` | ${skills.length} |
| 精灵蛋筛选 | ${SOURCE_PAGES.eggs} | \`${OUTPUTS.eggs}\` | ${eggs.length} |

## Local preset comparison

| Dataset | BWiki staging rows | Current local preset rows | Local names absent from BWiki | BWiki names absent from local preset |
|---|---:|---:|---:|---:|
| 精灵 | ${creatures.length} | ${localCreatures.length} | ${creatureDiff.missingInBwiki.length} | ${creatureDiff.extraInBwiki.length} |
| 技能 | ${skills.length} | ${localSkills.length} | ${skillDiff.missingInBwiki.length} | ${skillDiff.extraInBwiki.length} |

### BWiki 精灵形态标记

| Label | Count |
|---|---:|
${renderCountTable(formCounts)}

| Main-form label | Count |
|---|---:|
${renderCountTable(mainFormCounts)}

| Stage | Count |
|---|---:|
${renderCountTable(stageCounts)}

### 同编号多形态样例

| No. | Count | Names |
|---|---:|---|
${multiNoGroups.map((group) => `| ${group.no} | ${group.count} | ${group.names.join('、')} |`).join('\n')}

## Parseable fields found in staging

### 精灵筛选

- 基础：编号、名称、详情页链接、头像、属性、特性、生命、速度、物攻、魔攻、物防、魔防、总种族值。
- 形态：\`data-param4\` 可区分原始形态 / 地区形态 / 首领形态；\`data-param5\` 标记主形态。
- 补充：\`data-param7\` 暴露进化 / 活动 / 捕捉等获取线索；\`data-param8\` 暴露归属赛季（S1 / S2 / S3 / 无），不是蛋组。

| 精灵图来源 | Count |
|---|---:|
${renderCountTable(creatureImageSourceCounts)}

| 获取/来源标签 | Count |
|---|---:|
${renderCountTable(availabilityCounts)}

| 归属赛季 | Count |
|---|---:|
${renderCountTable(seasonCounts)}

### 技能查询

- 可解析：技能名称、属性、分类、能耗、威力、效果、图标、详情页链接。
- 技能与精灵的“会的技能 / 血脉技能”关系仍建议下一阶段从精灵详情页解析，并统一写成 \`skillRefs\` / \`learnerRefs\`。

| Skill category | Count |
|---|---:|
${renderCountTable(skillCategoryCounts)}

### 精灵蛋筛选

- 可解析：精灵蛋、精灵果实、对应精灵、精灵属性，以及三类图标/详情链接。
- 用户已确认蛋和果实不做独立资料表；后续转换时作为精灵资料里的 \`eggImage\` / \`fruitImage\` 两个图片字段写入。

| 精灵资料图片字段 | Count |
|---|---:|
${renderCountTable(creatureEggAssetCounts)}
${renderCountTable(creatureFruitAssetCounts)}

| Element | Count |
|---|---:|
${renderCountTable(eggElementCounts)}

## Gaps to review before replacing presets

### Local creature names absent from BWiki exact-name staging

${renderList(creatureDiff.missingInBwiki)}

### BWiki creature names absent from local exact-name preset

${renderList(creatureDiff.extraInBwiki, 50)}

### BWiki skill names absent from local exact-name preset

${renderList(skillDiff.extraInBwiki, 50)}

## Recommended next steps

1. Parse a controlled batch of BWiki creature detail pages from \`detailUrl\` to confirm trait detail, evolution chain, skill groups, bloodline skills, egg group, and image fields from the detail layout.
2. Build a deterministic transform from staging JSON to local preset shape; user confirmed BWiki should become the primary source and may fully replace previous preset rows after this explicit transform is reviewed.
3. Keep 精灵蛋 / 精灵果实 as image fields on creature rows (\`eggImage\` / \`fruitImage\`) instead of creating independent catalog tables.
4. Upgrade the detail UI to block sections: identity/image, stats, trait, skills, evolution, breeding, source/notes. This can be done without Dexie schema changes because hidden fields are already available in detail views.
`
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`)
}

async function main() {
  const syncedAt = new Date().toISOString()
  const catalogOnly = process.env.BWIKI_CATALOG_ONLY === '1'
  let parsedCreatures
  let skills
  let eggs
  let creatureCatalogHtml
  if (catalogOnly) {
    const [creatureSnapshot, skillSnapshot, eggSnapshot, catalogHtml] = await Promise.all([
      readJson(OUTPUTS.creatures),
      readJson(OUTPUTS.skills),
      readJson(OUTPUTS.eggs),
      fetchTextWithRetry(SOURCE_PAGES.creatureCatalog),
    ])
    parsedCreatures = creatureSnapshot.rows ?? []
    skills = skillSnapshot.rows ?? []
    eggs = eggSnapshot.rows ?? []
    creatureCatalogHtml = catalogHtml
  } else {
    const [creatureHtml, skillHtml, eggHtml, catalogHtml] = await Promise.all([
      fetchTextWithRetry(SOURCE_PAGES.creatures),
      fetchTextWithRetry(SOURCE_PAGES.skills),
      fetchTextWithRetry(SOURCE_PAGES.eggs),
      fetchTextWithRetry(SOURCE_PAGES.creatureCatalog),
    ])
    parsedCreatures = parseCreatureRows(creatureHtml)
    skills = parseSkillRows(skillHtml)
    eggs = parseEggRows(eggHtml)
    creatureCatalogHtml = catalogHtml
  }

  const creatureCatalogRows = parseCreatureCatalogRows(creatureCatalogHtml)
  const creatures = enrichCreaturesWithEggAssets(enrichCreaturesWithCatalogImages(parsedCreatures, creatureCatalogRows), eggs)
  const localCreatures = await readJson(LOCAL_CREATURE_PRESET)
  const localSkills = await readJson(LOCAL_SKILL_PRESET)
  const creatureDiff = compareNames(creatures, localCreatures)
  const skillDiff = compareSkillNames(skills, localSkills)

  await writeJson(OUTPUTS.creatures, {
    source: SOURCE_PAGES.creatures,
    syncedAt,
    rowCount: creatures.length,
    rows: creatures,
  })
  await writeJson(OUTPUTS.skills, {
    source: SOURCE_PAGES.skills,
    syncedAt,
    rowCount: skills.length,
    rows: skills,
  })
  await writeJson(OUTPUTS.eggs, {
    source: SOURCE_PAGES.eggs,
    syncedAt,
    rowCount: eggs.length,
    rows: eggs,
  })
  await writeJson(OUTPUTS.reportJson, {
    syncedAt,
    sourcePages: SOURCE_PAGES,
    outputs: OUTPUTS,
    counts: {
      creatures: creatures.length,
      skills: skills.length,
      eggs: eggs.length,
      localCreatures: localCreatures.length,
      localSkills: localSkills.length,
    },
    creatureDiff,
    skillDiff,
    creatureFormCounts: countBy(creatures, (row) => row.formCategoryLabel),
    creatureStageCounts: countBy(creatures, (row) => row.stageLabel),
    skillCategoryCounts: countBy(skills, (row) => row.category),
    eggElementCounts: countBy(eggs, (row) => row.elements.join('/') || '（空）'),
    multiNoGroups: topMultiNoGroups(creatures),
  })
  await writeFile(resolve(OUTPUTS.reportMd), renderReport({
    syncedAt,
    creatures,
    skills,
    eggs,
    localCreatures,
    localSkills,
    creatureDiff,
    skillDiff,
  }))

  console.log(`Wrote BWiki creature staging rows: ${creatures.length}`)
  if (catalogOnly) console.log('Refreshed creature images from the versioned staging snapshots plus the BWiki creature catalog')
  console.log(`Wrote BWiki skill staging rows: ${skills.length}`)
  console.log(`Wrote BWiki egg staging rows: ${eggs.length}`)
  console.log(`Report: ${OUTPUTS.reportMd}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
