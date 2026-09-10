export function assertPublishablePreview(payload, label) {
  if (payload?.source !== 'bwiki-preview') throw new Error(`${label} source 不是 bwiki-preview`)
  if (!Array.isArray(payload.rows) || payload.rowCount !== payload.rows.length) throw new Error(`${label} 行数无效`)
  if (payload.releaseBlockers?.length) throw new Error(`${label} 尚有发布阻塞：${payload.releaseBlockers.slice(0, 3).join('；')}`)
  if (payload.sourceProfile === 'nrc' && (!Array.isArray(payload.releaseBlockers) || !payload.sourceVersion || !payload.stagingHashes)) throw new Error(`${label} 缺少 NRC 审阅状态与来源版本`)
}
