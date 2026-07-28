const DECISION_RANK = {
  recommended: 0,
  keepable: 1,
  notRecommended: 2,
}

function compareTargets(a, b) {
  return (DECISION_RANK[a.decision] ?? 99) - (DECISION_RANK[b.decision] ?? 99)
    || Number(b.score || 0) - Number(a.score || 0)
}

export function bestSilverMirrorTarget(candidate, candidates = []) {
  if (!candidate?.raise) return null
  const currentRank = DECISION_RANK[candidate.decision] ?? 99
  return [...candidates]
    .filter((item) =>
      item?.id !== candidate.id
      && item?.raise === candidate.raise
      && (DECISION_RANK[item.decision] ?? 99) < currentRank,
    )
    .sort(compareTargets)[0] || null
}

export function natureRetentionAdvice(candidate, candidates = []) {
  if (!candidate) return null
  const mirrorTarget = bestSilverMirrorTarget(candidate, candidates)

  if (candidate.decision === 'recommended') {
    return {
      status: 'ready',
      normalLabel: '普通个体：直接保留',
      rareLabel: '异色/炫彩：已成型',
      description: '当前强化与减益组合已经命中推荐方向，不需要使用残缺魔镜。',
      mirrorTarget: null,
    }
  }

  if (candidate.decision === 'keepable') {
    return {
      status: mirrorTarget ? 'keepableUpgrade' : 'keepable',
      normalLabel: '普通个体：按需保留',
      rareLabel: '异色/炫彩：直接保留',
      description: mirrorTarget
        ? '当前性格本身可保留；若希望进一步优化，可以只修改减益，转成同强化项下的推荐性格。'
        : '当前性格具有明确玩法依据；稀有个体可以直接保留，普通个体按刷取成本决定。',
      mirrorTarget,
    }
  }

  if (mirrorTarget) {
    return {
      status: mirrorTarget.decision === 'recommended' ? 'repairRecommended' : 'repairKeepable',
      normalLabel: '普通个体：优先继续刷',
      rareLabel: mirrorTarget.decision === 'recommended'
        ? '异色/炫彩：银镜可修'
        : '异色/炫彩：可修为保留路线',
      description: '问题只在减益属性；残缺魔镜可以保留当前强化项，并替换成更合适的减益。',
      mirrorTarget,
    }
  }

  return {
    status: 'collectionOnly',
    normalLabel: '普通个体：继续刷取',
    rareLabel: '异色/炫彩：仅收藏保留',
    description: '同一强化项下没有推荐或可保留目标，残缺魔镜无法修正强化方向。',
    mirrorTarget: null,
  }
}

export function summarizeOwnedNatureRecords(records = []) {
  const normalized = Array.isArray(records) ? records : []
  const shiny = normalized.filter((record) => record.shiny).length
  const colorful = normalized.filter((record) => record.colorful).length
  const rare = normalized.filter((record) => record.shiny || record.colorful).length
  return {
    total: normalized.length,
    normal: normalized.length - rare,
    rare,
    shiny,
    colorful,
  }
}
