const VALID_DECISIONS = new Set(['recommended', 'keepable'])

function isRareRecord(record) {
  return Boolean(record?.shiny || record?.colorful)
}

function decisionCounts(entries, decision) {
  const matching = entries.filter((entry) => entry.candidate.decision === decision)
  return {
    total: matching.length,
    exact: matching.filter((entry) => entry.status === 'exact').length,
    repairable: matching.filter((entry) => entry.status === 'repairable').length,
    missing: matching.filter((entry) => entry.status === 'missing').length,
  }
}

export function buildNatureCoverage(candidates = [], ownedRecordsByNature = {}) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const targets = candidates.filter((candidate) => VALID_DECISIONS.has(candidate.decision))
  const entries = targets.map((candidate) => {
    const records = ownedRecordsByNature[candidate.id] || []
    return {
      candidate,
      records,
      status: records.length > 0 ? 'exact' : 'missing',
    }
  })

  for (const raise of new Set(targets.map((candidate) => candidate.raise))) {
    const raisedEntries = entries.filter((entry) => entry.candidate.raise === raise)
    const rareRecords = Object.entries(ownedRecordsByNature).flatMap(([natureId, records]) => {
      const ownedCandidate = candidateById.get(natureId)
      if (ownedCandidate?.raise !== raise) return []
      return (records || []).filter(isRareRecord)
    })
    const rareRecordsUsedForExactCoverage = raisedEntries.filter((entry) =>
      entry.records.length > 0
      && !entry.records.some((record) => !isRareRecord(record))
      && entry.records.some(isRareRecord),
    ).length
    let flexibleRareCount = Math.max(0, rareRecords.length - rareRecordsUsedForExactCoverage)
    const missingEntries = raisedEntries
      .filter((entry) => entry.status === 'missing')
      .sort((left, right) => {
        const decisionRank = { recommended: 0, keepable: 1 }
        return decisionRank[left.candidate.decision] - decisionRank[right.candidate.decision]
          || Number(right.candidate.score || 0) - Number(left.candidate.score || 0)
      })
    for (const entry of missingEntries) {
      if (flexibleRareCount <= 0) break
      entry.status = 'repairable'
      flexibleRareCount -= 1
    }
  }

  const recommended = decisionCounts(entries, 'recommended')
  const keepable = decisionCounts(entries, 'keepable')
  const exact = entries.filter((entry) => entry.status === 'exact').length
  const repairable = entries.filter((entry) => entry.status === 'repairable').length
  const missing = entries.filter((entry) => entry.status === 'missing').length
  return {
    entries,
    recommended,
    keepable,
    total: entries.length,
    exact,
    repairable,
    missing,
    status: missing > 0 ? 'incomplete' : repairable > 0 ? 'repairable' : 'complete',
  }
}

export function summarizeNatureCoverage(rows = []) {
  return {
    total: rows.length,
    complete: rows.filter((row) => row.coverage.status === 'complete').length,
    repairable: rows.filter((row) => row.coverage.status === 'repairable').length,
    incomplete: rows.filter((row) => row.coverage.status === 'incomplete').length,
    missing: rows.reduce((sum, row) => sum + row.coverage.missing, 0),
  }
}

// 方向表示一套可选择的培养路线，不表示同时拥有所有减益组合。
// 跨形态没有明确转换契约时，只使用该资料行的收藏，避免误报替代。
export function buildNatureDirectionCoverage(candidates = [], ownedRecordsByNature = {}, sourceRowId = '') {
  const profiles = candidates[0]?.formDecisions || []
  const scopes = profiles.length ? profiles : [{ id: sourceRowId, label: '' }]
  const entries = scopes.flatMap((profile) => {
    const scoped = candidates.map((candidate) => ({
      ...candidate,
      decision: profiles.length
        ? candidate.formDecisions?.find((form) => form.id === profile.id)?.decision
        : candidate.decision,
    }))
    return [...new Set(scoped.filter((c) => VALID_DECISIONS.has(c.decision)).map((c) => c.raise))].map((raise) => {
      const targets = scoped.filter((c) => c.raise === raise && VALID_DECISIONS.has(c.decision))
      const targetIds = new Set(targets.map((c) => c.id))
      const records = scoped.filter((c) => c.raise === raise).flatMap((c) =>
        (ownedRecordsByNature[c.id] || [])
          .filter((record) => !profile.id || record.referenceId === profile.id)
          .map((record) => ({ ...record, nature: c.id })),
      )
      const exact = records.filter((record) => targetIds.has(record.nature))
      const rare = records.filter(isRareRecord)
      const rareReady = rare.some((record) => targetIds.has(record.nature))
      return {
        id: `${profile.id}:${raise}`,
        profileLabel: profile.label,
        raise,
        candidate: targets.find((c) => c.decision === 'recommended') || targets[0],
        targets,
        records,
        rare,
        rareReady,
        status: exact.length ? 'exact' : rare.length ? 'repairable' : 'missing',
      }
    })
  })
  const exact = entries.filter((e) => e.status === 'exact').length
  const repairable = entries.filter((e) => e.status === 'repairable').length
  const missing = entries.filter((e) => e.status === 'missing').length
  return {
    entries, exact, repairable, missing, total: entries.length,
    recommended: decisionCounts(entries, 'recommended'),
    keepable: decisionCounts(entries, 'keepable'),
    status: missing ? 'incomplete' : repairable ? 'repairable' : 'complete',
  }
}
