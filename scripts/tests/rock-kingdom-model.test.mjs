import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRockOwnedDiagnostics,
  summarizeRockOwnedDiagnostics,
} from '../../src/domain/rockKingdomIntelligence.js'
import {
  correctRockScannerFields,
  explainRockNature,
  explainRockOwnedDiagnostics,
} from '../../src/features/rock-kingdom-model/rockKingdomModel.js'

function modelConfig(model) {
  return {
    endpoint: 'https://model.example.test/v1/chat/completions',
    model,
    apiKey: 'test-key',
    temperature: 0,
  }
}

function fakeModel(payload) {
  return async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
  })
}

test('scanner model correction accepts only values from the bounded candidate list', async () => {
  const corrections = await correctRockScannerFields({
    config: modelConfig('scanner-candidate-test'),
    fields: [{
      key: 'nature',
      rawText: '胆尘',
      candidates: [
        { value: 'timid', label: '胆小' },
        { value: 'hasty', label: '急躁' },
      ],
    }],
    fetchImpl: fakeModel({
      corrections: [
        { key: 'nature', value: 'timid', reason: '字形最接近', confidence: 0.93 },
        { key: 'nature', value: 'invented', reason: '擅自生成', confidence: 1 },
      ],
    }),
  })
  assert.deepEqual(corrections, [{
    key: 'nature',
    value: 'timid',
    reason: '字形最接近',
    confidence: 0.93,
  }])
})

test('nature model explanation preserves a narrow normalized response', async () => {
  const result = await explainRockNature({
    config: modelConfig('nature-explanation-test'),
    context: {
      creature: '测试精灵',
      nature: '胆小',
      decision: '推荐',
      modifier: '速度 +20% / 物攻 -10%',
      reasons: ['速度是核心'],
      warnings: [],
      retention: '直接保留',
      stats: {},
    },
    fetchImpl: fakeModel({
      summary: '程序已经判定该性格为推荐。',
      keyPoints: ['强化核心速度', '削弱非主攻'],
      caution: '',
      recommendation: '无法进入结果',
    }),
  })
  assert.deepEqual(result, {
    summary: '程序已经判定该性格为推荐。',
    keyPoints: ['强化核心速度', '削弱非主攻'],
    caution: '',
  })
})

test('owned diagnostics flag missing references and incompatible appearance flags without model input', () => {
  const diagnostics = buildRockOwnedDiagnostics({
    records: [
      {
        id: 'owned-1',
        values: {
          ref: 'missing-creature',
          nature: 'timid',
          appearance: 'shiny-colorful',
          shiny: 'no',
          colorful: 'yes',
        },
      },
      { id: 'owned-2', values: { appearance: 'none', shiny: 'no', colorful: 'no' } },
    ],
    ownedFields: [
      { key: 'ref', type: 'reference' },
      { key: 'nature', type: 'select', options: [{ value: 'timid', label: '胆小' }] },
      { key: 'appearance', type: 'select' },
    ],
  })
  assert.deepEqual(diagnostics[0].issues, [
    '精灵引用已失效',
    '外观细分与兼容的异色/炫彩字段不一致',
  ])
  assert.deepEqual(diagnostics[1].issues, ['缺少精灵', '缺少性格'])
  assert.deepEqual(summarizeRockOwnedDiagnostics(diagnostics), {
    total: 2,
    issueCount: 2,
    recommended: 0,
    keepable: 0,
    notRecommended: 0,
    repairable: 0,
  })
})

test('owned model explanation cannot add database edits to its normalized result', async () => {
  const result = await explainRockOwnedDiagnostics({
    config: modelConfig('owned-explanation-test'),
    diagnostics: [{
      creatureName: '测试精灵',
      natureLabel: '胆小',
      appearance: 'shiny',
      decisionLabel: '不推荐',
      actionLabel: '异色/炫彩：银镜可修',
      mirrorTarget: '开朗',
      issues: [],
    }],
    summary: { total: 1, repairable: 1 },
    fetchImpl: fakeModel({
      summary: '优先处理这只可修稀有个体。',
      priorities: ['用银镜修改减益'],
      caution: '保存前核对。',
      updates: [{ id: 'owned-1', delete: true }],
    }),
  })
  assert.deepEqual(result, {
    summary: '优先处理这只可修稀有个体。',
    priorities: ['用银镜修改减益'],
    caution: '保存前核对。',
  })
})
