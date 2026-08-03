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
