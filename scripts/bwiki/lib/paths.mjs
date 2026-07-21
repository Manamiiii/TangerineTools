import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const BWIKI_PATHS = Object.freeze({
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
  }),
  artifacts: Object.freeze({
    stagingJson: 'artifacts/bwiki/source-report.json',
    stagingReport: 'artifacts/bwiki/staging-report.md',
    detailReport: 'artifacts/bwiki/detail-staging-report.md',
    previewReport: 'artifacts/bwiki/preview-report.md',
    migrationPreview: 'artifacts/bwiki/rockKingdomPresetMigration.preview.json',
    applyReport: 'artifacts/bwiki/apply-report.md',
  }),
})

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

export function resolveRepoPath(relativePath) {
  return resolve(repoRoot, relativePath)
}
