import { sha256 } from './snapshots.mjs'

export function assertPublishablePreview(payload, label, approval, kind) {
  if (payload?.source !== 'bwiki-preview') throw new Error(`${label} source 不是 bwiki-preview`)
  if (!Array.isArray(payload.rows) || payload.rowCount !== payload.rows.length) throw new Error(`${label} 行数无效`)
  if (payload.sourceProfile === 'nrc' && (!Array.isArray(payload.releaseBlockers) || !payload.sourceVersion || !payload.stagingHashes)) throw new Error(`${label} 缺少 NRC 审阅状态与来源版本`)
  if (payload.sourceProfile === 'nrc') {
    if (!approval || approval.source !== 'nrc-user-release-approval' || !approval.decision || !approval.approvedAt
      || approval.version !== payload.sourceVersion || !['creatures', 'skills'].includes(kind)
      || approval.rowHashes?.[kind] !== sha256(JSON.stringify(payload.rows))
      || JSON.stringify(approval.stagingHashes) !== JSON.stringify(payload.stagingHashes)
      || JSON.stringify(approval.reviewedBlockers) !== JSON.stringify(payload.releaseBlockers)) {
      throw new Error(`${label} 缺少与当前候选及源指纹一致的用户发布确认`)
    }
  } else if (payload.releaseBlockers?.length) throw new Error(`${label} 尚有发布阻塞：${payload.releaseBlockers.slice(0, 3).join('；')}`)
}
