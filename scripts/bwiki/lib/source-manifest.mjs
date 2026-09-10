import { createHash } from 'node:crypto'

export const SOURCE_NOTICES = Object.freeze({
  rocom: {
    name: '洛克王国世界 BWIKI（rocom）', url: 'https://wiki.biligame.com/rocom/首页',
    authors: '原页面作者与贡献者（见页面历史）', license: 'CC BY-NC-SA',
    licenseUrl: 'https://wiki.biligame.com/rocom/首页',
    scope: '依原站及各页面实际许可；游戏与第三方素材除外',
  },
  nrc: {
    name: '洛克王国：世界 Wiki（NRC BWIKI）', url: 'https://wiki.biligame.com/nrc/首页',
    authors: 'sizau（维护者）及原页面作者与贡献者（见页面历史）',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans',
    statementUrl: 'https://wiki.biligame.com/nrc/洛克王国世界:站点声明',
    scope: '原创文字及有权授权的整理成果；游戏与第三方素材除外',
  },
})

export function buildSourceManifest({ creatures, skills, creaturePreview, skillPreview }) {
  const rows = {}
  const usedSources = new Set()
  for (const [presets, preview] of [[creatures, creaturePreview], [skills, skillPreview]]) {
    const byId = new Map(preview.rows.map((row) => [row.id, row]))
    for (const row of presets) {
      const candidate = byId.get(row.id)
      if (!candidate || JSON.stringify(row.values) !== JSON.stringify(candidate.values)) throw new Error(`来源与正式数据不一致：${row.id}`)
      const meta = candidate.previewMeta
      const address = new URL(meta.detailUrl || meta.sourceUrl)
      const source = address.pathname.split('/')[1]
      if (address.protocol !== 'https:' || address.hostname !== 'wiki.biligame.com' || !SOURCE_NOTICES[source]) throw new Error(`不支持的来源：${address.href}`)
      usedSources.add(source)
      rows[row.id] = { name: row.values.name, source, url: address.href }
    }
  }
  return {
    format: 'tangerine-bwiki-sources-v1',
    // Hash actual runtime rows, not preview generation timestamps.
    presetHashes: Object.fromEntries([['creatures', creatures], ['skills', skills]].map(([key, value]) => [key, createHash('sha256').update(JSON.stringify(value)).digest('hex')])),
    sources: Object.fromEntries([...usedSources].map((key) => [key, SOURCE_NOTICES[key]])),
    sourceVersions: { creatures: creaturePreview.sourceVersion || creaturePreview.generatedAt, skills: skillPreview.sourceVersion || skillPreview.generatedAt },
    modifications: '字段归一化、结构转换、稳定 ID 匹配及关系整理；派生标签和推荐由 TangerineTools 自身规则生成。',
    assets: '游戏角色、立绘、图标等素材权利归魔方工作室、腾讯游戏及相应权利人所有，不适用 Wiki 的 CC 许可。',
    rows,
  }
}
