import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAnnouncementAudit,
  extractImageUrls,
  extractPlainText,
  isAnnouncementCandidate,
  parseJsonp,
} from '../bwiki/lib/official-announcements.mjs'

test('解析腾讯官方公告 JSONP', () => {
  assert.deepEqual(parseJsonp('var NewsObj={"status":0,"msg":{"result":[]}};', 'NewsObj'), {
    status: 0,
    msg: { result: [] },
  })
  assert.throws(() => parseJsonp('{}', 'NewsObj'), /缺少 NewsObj/)
})

test('提取公告正文和协议相对图片地址', () => {
  const html = '<p>技能调整&nbsp;说明</p><img src="//example.com/a.png"><img src="//example.com/a.png">'
  assert.equal(extractPlainText(html), '技能调整 说明')
  assert.deepEqual(extractImageUrls(html), ['https://example.com/a.png'])
})

test('只把版本与平衡相关标题列为候选', () => {
  assert.equal(isAnnouncementCandidate('S3赛季「铅字幻梦」版本更新公告'), true)
  assert.equal(isAnnouncementCandidate('部分精灵平衡性调整说明'), true)
  assert.equal(isAnnouncementCandidate('违规行为处罚公告'), false)
})

test('正文信号和图片型公告采用不同复核状态', () => {
  const rows = [
    { iNewsId: '1', sTitle: 'S3赛季版本更新公告', sIdxTime: '2026-07-13 15:30:00' },
    { iNewsId: '2', sTitle: 'S2赛季更新公告', sIdxTime: '2026-05-19 18:45:19' },
    { iNewsId: '3', sTitle: '违规行为处罚公告', sIdxTime: '2026-08-12 21:41:48' },
  ]
  const details = new Map([
    ['1', { iNewsId: '1', sContent: '<p>本次包含技能调整与特性调整。</p>' }],
    ['2', { iNewsId: '2', sContent: '<p></p><img src="//example.com/s2.jpg">' }],
  ])
  const audit = buildAnnouncementAudit({ rows, detailsById: details, generatedAt: '2026-08-14T00:00:00.000Z' })

  assert.equal(audit.summary.candidates, 2)
  assert.equal(audit.summary.balanceSignalsFound, 1)
  assert.equal(audit.summary.manualImageReviews, 1)
  assert.equal(audit.announcements[0].reviewStatus, 'balance-signal-found')
  assert.equal(audit.announcements[1].reviewStatus, 'manual-image-review')
})

test('起始日期限制候选范围', () => {
  const audit = buildAnnouncementAudit({
    rows: [
      { iNewsId: '1', sTitle: 'S3赛季版本更新公告', sIdxTime: '2026-07-13 15:30:00' },
      { iNewsId: '2', sTitle: 'S2赛季更新公告', sIdxTime: '2026-05-19 18:45:19' },
    ],
    since: '2026-07-01T00:00:00.000Z',
    generatedAt: '2026-08-14T00:00:00.000Z',
  })
  assert.deepEqual(audit.announcements.map((item) => item.id), ['1'])
})
