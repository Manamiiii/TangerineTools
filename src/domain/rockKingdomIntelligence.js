import {
  evaluateNatureProfiles,
  natureName,
  NATURE_DECISION_LABELS,
} from './nature.js'
import { natureRetentionAdvice } from './natureRetention.js'
import { buildNatureAnalysisInput } from './natureRowAdapter.js'
import { ownedFieldValue } from './owned.js'
import {
  getSameNumberRows,
  visibleRockKingdomCreatureRows,
} from './rockKingdom.js'
import { appearanceFlags } from './rockKingdomScanner.js'

function fieldByKey(fields, key) {
  return fields.find((field) => field.key === key)
}

function appearanceIsRare(value) {
  return value && value !== 'none'
}

export function buildRockOwnedDiagnostics({
  records = [],
  ownedFields = [],
  creatureRows = [],
  creatureFields = [],
  skillRows = [],
}) {
  const refField = ownedFields.find((field) => field.type === 'reference')
  const natureField = fieldByKey(ownedFields, 'nature')
  const appearanceField = fieldByKey(ownedFields, 'appearance')
  const visibleRows = visibleRockKingdomCreatureRows(creatureRows)
  const creatureById = new Map(creatureRows.map((row) => [row.id, row]))

  return records.map((record) => {
    const refId = refField ? record.values?.[refField.key] : ''
    const natureId = natureField ? record.values?.[natureField.key] : ''
    const appearance = appearanceField
      ? ownedFieldValue(record, appearanceField)
      : 'none'
    const issues = []
    if (!refId) issues.push('缺少精灵')
    if (!natureId) issues.push('缺少性格')
    const target = creatureById.get(refId)
    if (refId && !target) issues.push('精灵引用已失效')

    if (appearanceField && record.values?.appearance) {
      const expected = appearanceFlags(appearance)
      if (
        record.values?.shiny !== expected.shiny
        || record.values?.colorful !== expected.colorful
      ) {
        issues.push('外观细分与兼容的异色/炫彩字段不一致')
      }
    }

    const result = {
      id: record.id,
      creatureId: refId || '',
      creatureName: target?.values?.name || '未知精灵',
      natureId: natureId || '',
      natureLabel: natureField?.options?.find((option) => option.value === natureId)?.label || natureId || '未填写',
      appearance,
      rare: appearanceIsRare(appearance),
      issues,
      decision: '',
      decisionLabel: '',
      actionLabel: '',
      explanation: '',
      mirrorTarget: '',
    }
    if (!target || !natureId) return result

    const sameNumberRows = getSameNumberRows(target, visibleRows, creatureFields)
    const analysis = buildNatureAnalysisInput(
      target,
      sameNumberRows,
      creatureFields,
      skillRows,
      visibleRows,
    )
    const candidates = evaluateNatureProfiles(
      analysis.stats,
      analysis.traitTags,
      analysis.skillInfo,
      analysis.analysisProfiles,
      {
        primaryProfileId: target.id,
        primaryProfileLabel: [analysis.name, target.values?.form].filter(Boolean).join(' · '),
      },
    )
    const candidate = candidates.find((item) => item.id === natureId)
    if (!candidate) {
      result.issues.push('性格值不在当前合法候选中')
      return result
    }
    const retention = natureRetentionAdvice(candidate, candidates)
    return {
      ...result,
      decision: candidate.decision,
      decisionLabel: NATURE_DECISION_LABELS[candidate.decision],
      actionLabel: result.rare ? retention.rareLabel : retention.normalLabel,
      explanation: retention.description,
      mirrorTarget: retention.mirrorTarget ? natureName(retention.mirrorTarget) : '',
    }
  })
}

export function summarizeRockOwnedDiagnostics(diagnostics = []) {
  return {
    total: diagnostics.length,
    issueCount: diagnostics.filter((item) => item.issues.length > 0).length,
    recommended: diagnostics.filter((item) => item.decision === 'recommended').length,
    keepable: diagnostics.filter((item) => item.decision === 'keepable').length,
    notRecommended: diagnostics.filter((item) => item.decision === 'notRecommended').length,
    repairable: diagnostics.filter((item) => item.mirrorTarget).length,
  }
}
