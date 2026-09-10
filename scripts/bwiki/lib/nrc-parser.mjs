import { parse } from 'parse5'

export const NRC_ROOT = 'https://wiki.biligame.com/nrc/'
export const NRC_PAGES = Object.freeze({ creatures: `${NRC_ROOT}精灵图鉴`, skills: `${NRC_ROOT}技能列表`, breeding: `${NRC_ROOT}孵蛋组别查询` })
const attr = (node, name) => node?.attrs?.find((a) => a.name === name)?.value ?? ''
const hasClass = (node, name) => attr(node, 'class').split(/\s+/).includes(name)
function nodes(root, predicate) {
  const result = []
  function visit(node) {
    if (predicate(node)) result.push(node)
    for (const child of node.childNodes ?? []) visit(child)
  }
  if (root) visit(root)
  return result
}
const byClass = (root, name) => nodes(root, (node) => hasClass(node, name))
const text = (node) => (node?.nodeName === '#text' ? node.value : (node?.childNodes ?? []).map(text).join('')).replace(/\s+/g, ' ').trim()
const classText = (root, name) => text(byClass(root, name)[0])
function url(value, host = 'wiki.biligame.com') {
  if (!value) return ''
  const result = new URL(value, NRC_ROOT)
  if (result.protocol !== 'https:' || result.hostname !== host) throw new Error(`Unexpected source URL: ${value}`)
  return result.href
}
function image(root) {
  const img = nodes(root, (node) => node.tagName === 'img')[0]
  return url(attr(img, 'data-src') || attr(img, 'src'), 'patchwiki.biligame.com')
}
function link(root) {
  const a = nodes(root, (node) => node.tagName === 'a' && attr(node, 'href'))[0]
  return { title: attr(a, 'title') || text(a), url: url(attr(a, 'href')) }
}
function number(value, label, optional = false) {
  if (optional && /^(?:|—|--|-)$/.test(value)) return null
  if (!/^\d+$/.test(value)) throw new Error(`${label}: invalid number ${value}`)
  return Number(value)
}
function validate(rows, label) {
  if (!rows.length) throw new Error(`${label}: no rows; page may be incomplete or blocked`)
  const seen = new Set()
  for (const row of rows) {
    if (!row.name || seen.has(row.name)) throw new Error(`${label}: missing/duplicate name ${row.name}`)
    seen.add(row.name)
  }
  return rows
}

export function parseNrcCreatures(html) {
  return validate(byClass(parse(html), 'npc-card').map((card) => {
    const target = link(byClass(card, 'npc-card-target')[0])
    const no = String(number(attr(card, 'data-number'), 'creature number')).padStart(3, '0')
    const shiny = attr(card, 'data-shiny')
    if (!['yes', 'no'].includes(shiny)) throw new Error(`${target.title}: unknown shiny marker`)
    return {
      source: 'bwiki-nrc', sourceUrl: NRC_PAGES.creatures, detailUrl: target.url,
      sourceId: attr(card, 'data-id'), no: `NO.${no}`, name: target.title,
      elements: attr(card, 'data-type').split('|').filter(Boolean),
      stageLabel: classText(card, 'npc-stage'), formCategoryLabel: attr(card, 'data-form').split('|').includes('lord') ? '首领形态' : '',
      seasonLabel: attr(card, 'data-season'), shinyLabel: shiny === 'yes' ? '是' : '否',
      image: image(byClass(card, 'npc-art-normal')[0]), shinyImage: image(byClass(card, 'npc-art-shiny')[0]),
    }
  }), 'creatures')
}

export function parseNrcSkills(html) {
  return validate(byClass(parse(html), 'nrc-skill-table-row').map((row) => {
    const cells = (row.childNodes ?? []).filter((node) => node.tagName === 'td')
    if (cells.length !== 7) throw new Error('skills: expected seven cells')
    const target = link(cells[1])
    return {
      source: 'bwiki-nrc', sourceUrl: NRC_PAGES.skills, detailUrl: target.url, name: target.title,
      image: image(cells[0]), element: text(cells[2]).replace(/系$/, ''), category: text(cells[3]),
      cost: number(text(cells[4]), `${target.title} cost`), power: number(text(cells[5]), `${target.title} power`, true), effect: text(cells[6]),
    }
  }), 'skills')
}

export function parseNrcBreeding(html) {
  return validate(byClass(parse(html), 'nrc-egg-card').map((card) => ({
    sourceUrl: NRC_PAGES.breeding, sourceId: attr(card, 'data-pet-key'),
    no: `NO.${String(number(attr(card, 'data-pet-number'), 'breeding number')).padStart(3, '0')}`,
    name: attr(card, 'data-pet-title'),
    eggGroups: byClass(card, 'nrc-egg-group-badge').map((node) => text(node) === '未发现' ? '无法孵蛋' : text(node)),
    femaleOnly: byClass(card, 'nrc-egg-female-only').length > 0,
  })), 'breeding')
}

export function parseNrcDetail(html, creature) {
  const root = parse(html)
  const dex = byClass(root, 'roco-dex')[0]
  if (!dex || attr(dex, 'data-pet-id') !== creature.sourceId) throw new Error(`${creature.name}: detail identity mismatch`)
  const keys = { HP: 'hp', ATK: 'patk', MATK: 'matk', DEF: 'pdef', MDEF: 'mdef', SPD: 'spd' }
  const stats = {}
  for (const node of byClass(dex, 'roco-stat')) {
    const key = keys[attr(byClass(node, 'roco-stat-rune')[0], 'data-rune')]
    if (!key || Object.hasOwn(stats, key)) throw new Error(`${creature.name}: unknown/duplicate stat`)
    stats[key] = number(attr(byClass(node, 'roco-stat-val')[0], 'data-val'), key)
  }
  stats.bst = number(attr(byClass(dex, 'roco-race-total')[0], 'data-val'), 'bst')
  if (Object.keys(keys).some((key) => !(stats[keys[key]] > 0)) || Object.values(keys).reduce((sum, key) => sum + stats[key], 0) !== stats.bst) throw new Error(`${creature.name}: invalid six stats/total`)
  const skills = nodes(dex, (node) => Boolean(attr(node, 'data-skill-id')) && Boolean(attr(node, 'data-source'))).map((node) => ({
    name: classText(node, 'roco-sk-name'), sourceType: attr(node, 'data-source'),
    category: attr(node, 'data-cat'), element: attr(node, 'data-type'), unlock: classText(node, 'roco-sk-lv'),
  }))
  if (!skills.length || skills.some((row) => !row.name || !['level', 'machine', 'blood'].includes(row.sourceType))) throw new Error(`${creature.name}: incomplete/unknown skill sources`)
  const trait = { name: classText(dex, 'roco-feature-name'), description: classText(dex, 'roco-feature-desc'), image: image(byClass(dex, 'roco-feature-icon')[0]) }
  if (!trait.name || !trait.description) throw new Error(`${creature.name}: missing trait`)
  const evolutionBranches = byClass(dex, 'roco-evo-timeline').map((branch) => byClass(branch, 'roco-evo-node').map((node) => ({
    name: classText(node, 'roco-evo-name-main'), linkName: link(byClass(node, 'roco-evo-name-main')[0]).title || classText(node, 'roco-evo-name-main'),
    image: image(byClass(node, 'roco-evo-avatar')[0]), isBoss: hasClass(node, 'is-lord'),
  })))
  const evolution = evolutionBranches.find((branch) => branch.some((node) => node.name === creature.name)) ?? []
  return { source: 'bwiki-nrc-detail', sourceUrl: creature.detailUrl, sourceId: creature.sourceId, name: creature.name, no: creature.no, stats, trait, skills, evolution, evolutionBranches, evolutionReviewRequired: !evolution.length }
}
