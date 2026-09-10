import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const LEGACY_PATHS = Object.freeze({
  staging: Object.freeze({
    creatures: 'scripts/bwiki/data/staging/creatures.json',
    skills: 'scripts/bwiki/data/staging/skills.json',
    eggs: 'scripts/bwiki/data/staging/eggs.json',
    details: 'scripts/bwiki/data/staging/creature-details.json',
    breeding: 'scripts/bwiki/data/staging/breeding-rows.json',
  }),
  preview: Object.freeze({
    creatures: 'scripts/bwiki/data/preview/creature-rows.json',
    skills: 'scripts/bwiki/data/preview/skill-rows.json',
  }),
  presets: Object.freeze({
    creatures: 'public/presets/rockKingdomRows.json',
    skills: 'public/presets/rockKingdomSkillRows.json',
    migration: 'public/presets/rockKingdomPresetMigration.json',
    sources: 'src/presets/rockKingdomSources.json',
  }),
  artifacts: Object.freeze({
    officialAnnouncementsJson: 'artifacts/bwiki/official-announcements.json',
    officialAnnouncementsReport: 'artifacts/bwiki/official-announcements.md',
    stagingJson: 'artifacts/bwiki/source-report.json',
    stagingReport: 'artifacts/bwiki/staging-report.md',
    detailReport: 'artifacts/bwiki/detail-staging-report.md',
    previewReport: 'artifacts/bwiki/preview-report.md',
    migrationPreview: 'artifacts/bwiki/rockKingdomPresetMigration.preview.json',
    applyReport: 'artifacts/bwiki/apply-report.md',
  }),
})

export function getBwikiPaths(source = 'rocom') {
  if (!['rocom', 'nrc'].includes(source)) throw new Error(`Unknown BWiki source: ${source}`)
  if (source === 'rocom') return LEGACY_PATHS
  return {
    ...LEGACY_PATHS,
    staging: Object.fromEntries(Object.entries(LEGACY_PATHS.staging).map(([key, value]) => [key, value.replace('/staging/', '/nrc/staging/')])),
    preview: Object.fromEntries(Object.entries(LEGACY_PATHS.preview).map(([key, value]) => [key, value.replace('/preview/', '/nrc/preview/')])),
    artifacts: Object.fromEntries(Object.entries(LEGACY_PATHS.artifacts).map(([key, value]) => [key, value.replace('artifacts/bwiki/', 'artifacts/bwiki/nrc/')])),
  }
}

export const BWIKI_PATHS = getBwikiPaths(process.argv.includes('--source=nrc') ? 'nrc' : 'rocom')

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

export function resolveRepoPath(relativePath) {
  return resolve(repoRoot, relativePath)
}
