import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

import {
  ROCK_APPEARANCE_TEMPLATES,
  ROCK_PARTNER_MARK_TEMPLATES,
  ROCK_SCANNER_DEVICE_PROFILE,
  appearanceTemplateSimilarity,
  appearanceFlags,
  bestAppearanceTemplateMatch,
  bestPartnerMarkTemplateMatch,
  bestScanMatch,
  constrainScannerFormulaInputs,
  isScannerFrameReady,
  normalizeScanText,
  normalizedPartnerMarkMask,
  parseScannerPanelStat,
  parseScannerLevel,
  partnerMarkMaskSimilarity,
  recognizeGenderColor,
  recognizeScannerStatTone,
  recognizeScannerStarCount,
  reconcileScannerPanelStat,
  resolveScannerReference,
  scannerAnchorQuality,
  scannerCharacterWhitelist,
  scannerSignatureDifference,
  scannerCultivationFit,
  scannerLegalPanelStatValues,
  scannerStatShapeSimilarity,
  selectScannerPanelStat,
  selectScannerLevel,
  selectStableScannerSamples,
  valuesWithAppearance,
} from '../../src/domain/rockKingdomScanner.js'

test('scanner accepts the fixed 3200 by 1440 recording profile', () => {
  assert.deepEqual(ROCK_SCANNER_DEVICE_PROFILE, {
    width: 3200,
    height: 1440,
    label: '固定手机 · 3200×1440 横屏',
  })
})

test('panel formula repairs an extra icon digit and rejects an impossible short value', () => {
  const candidates = [
    { value: 'ordinary', stats: { pdef: 64, spd: 45 } },
    { value: 'shedding', stats: { pdef: 56, spd: 48 } },
  ]
  const options = {
    level: 1,
    stars: 0,
    nature: { raise: 'spd', lower: 'patk' },
  }
  const legalPdef = scannerLegalPanelStatValues(candidates, 'pdef', {
    ...options,
    tone: 'white',
  })
  const legalSpeed = scannerLegalPanelStatValues(candidates, 'spd', {
    ...options,
    tone: 'yellow',
  })
  assert.ok(legalPdef.includes(43))
  assert.deepEqual(reconcileScannerPanelStat({
    value: 943,
    candidates: [943],
    ambiguous: false,
  }, legalPdef), {
    value: 43,
    candidates: [943],
    ambiguous: false,
    formulaRepaired: true,
  })
  assert.deepEqual(reconcileScannerPanelStat({
    value: 7,
    candidates: [7],
    ambiguous: false,
  }, legalSpeed), {
    value: 0,
    candidates: [7],
    ambiguous: true,
    rejectedByFormula: true,
  })
  assert.deepEqual(reconcileScannerPanelStat({
    value: 0,
    candidates: [],
    ambiguous: false,
  }, legalSpeed), {
    value: 0,
    candidates: [],
    ambiguous: false,
  })
})

test('Board Shell resolves after formula validation repairs 943 and discards speed 7', () => {
  const candidates = [
    {
      value: 'ordinary',
      label: '板板壳',
      traitName: '缩壳',
      stats: { hp: 67, patk: 28, matk: 72, pdef: 64, mdef: 81, spd: 45 },
    },
    {
      value: 'shedding',
      label: '板板壳（蜕皮时的样子）',
      traitName: '缩壳',
      stats: { hp: 88, patk: 24, matk: 72, pdef: 56, mdef: 59, spd: 48 },
    },
  ]
  const panelStats = { hp: 48, patk: 22, matk: 49, pdef: 943, mdef: 51, spd: 7 }
  const statTones = Object.fromEntries([
    ['hp', 'yellow'],
    ['patk', 'white'],
    ['matk', 'yellow'],
    ['pdef', 'white'],
    ['mdef', 'white'],
    ['spd', 'yellow'],
  ].map(([key, tone]) => [key, { tone }]))
  const options = {
    level: 1,
    stars: 0,
    nature: { raise: 'spd', lower: 'patk' },
  }
  const initial = resolveScannerReference({
    rawName: '板板壳',
    rawTrait: '缩壳',
    panelStats,
    statTones,
    candidates,
    ...options,
  })
  for (const key of ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']) {
    const result = reconcileScannerPanelStat({
      value: panelStats[key],
      candidates: [panelStats[key]],
      ambiguous: false,
    }, scannerLegalPanelStatValues(initial.candidates, key, {
      ...options,
      tone: statTones[key].tone,
    }))
    panelStats[key] = result.value
  }
  assert.deepEqual(panelStats, {
    hp: 48,
    patk: 22,
    matk: 49,
    pdef: 43,
    mdef: 51,
    spd: 0,
  })
  const resolved = resolveScannerReference({
    rawName: '板板壳',
    rawTrait: '缩壳',
    panelStats,
    statTones,
    candidates,
    ...options,
  })
  assert.equal(resolved.value, 'ordinary')
  assert.equal(resolved.source, 'name+formula')
})

test('panel stat OCR prefers raw engines and only uses processed retries as fallback', () => {
  assert.equal(parseScannerPanelStat('1 3 5'), 135)
  assert.equal(parseScannerPanelStat('速度 203'), 203)
  assert.equal(parseScannerPanelStat('12345'), 0)
  assert.deepEqual(selectScannerPanelStat(['22', '', '222', '222'], { trustedVariantCount: 2 }), {
    value: 22,
    candidates: [22, 222],
    ambiguous: false,
  })
  assert.deepEqual(selectScannerPanelStat(['', '135', '35', '35'], { trustedVariantCount: 2 }), {
    value: 135,
    candidates: [135, 35],
    ambiguous: false,
  })
  assert.deepEqual(selectScannerPanelStat(['15', '135', '135'], { trustedVariantCount: 2 }), {
    value: 135,
    candidates: [15, 135],
    ambiguous: false,
  })
  assert.deepEqual(selectScannerPanelStat(['', '', '43', ''], { trustedVariantCount: 2 }), {
    value: 43,
    candidates: [43],
    ambiguous: false,
  })
  assert.deepEqual(selectScannerPanelStat(['15', '135', ''], { trustedVariantCount: 2 }), {
    value: 0,
    candidates: [15, 135],
    ambiguous: true,
  })
})
import { OWNED_SPECIALTY_OPTIONS } from '../../src/domain/owned.js'

function syntheticPixels(width, height, foreground = [220, 80, 150]) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const active = x >= 2 && x <= 4 && y >= 1 && y <= 5
      const color = active ? foreground : [39, 43, 45]
      pixels.set([...color, 255], offset)
    }
  }
  return { pixels, width, height }
}

test('appearance flags preserve the existing shiny/colorful fields', () => {
  assert.deepEqual(appearanceFlags('none'), { shiny: 'no', colorful: 'no' })
  assert.deepEqual(appearanceFlags('shiny'), { shiny: 'yes', colorful: 'no' })
  assert.deepEqual(appearanceFlags('s2-colorful'), { shiny: 'no', colorful: 'yes' })
  assert.deepEqual(appearanceFlags('bw-shiny-colorful'), { shiny: 'yes', colorful: 'yes' })
  assert.deepEqual(valuesWithAppearance({ appearance: 's3-shiny-colorful', note: '扫描' }), {
    appearance: 's3-shiny-colorful',
    note: '扫描',
    shiny: 'yes',
    colorful: 'yes',
  })
})

test('confirmed appearance templates stay explicit while missing variants remain manual', async () => {
  assert.deepEqual(ROCK_APPEARANCE_TEMPLATES.map((template) => template.value), [
    'shiny',
    'colorful',
    'shiny-colorful',
    'bw-colorful',
    's1-colorful',
    's1-shiny-colorful',
    's2-colorful',
    's2-shiny-colorful',
    's3-colorful',
  ])
  assert.equal(ROCK_APPEARANCE_TEMPLATES.some((template) => template.value === 'bw-shiny-colorful'), false)
  assert.equal(ROCK_APPEARANCE_TEMPLATES.some((template) => template.value === 's3-shiny-colorful'), false)
  await Promise.all(ROCK_APPEARANCE_TEMPLATES.map((template) => access(
    new URL(`../../public/icons/rock-kingdom-appearance/${template.fileName}`, import.meta.url),
  )))
})

test('appearance matching accepts a distinct template and rejects an ambiguous pair', () => {
  const sample = syntheticPixels(7, 7)
  const exact = { value: 'exact', ...syntheticPixels(7, 7) }
  const different = { value: 'different', ...syntheticPixels(7, 7, [40, 210, 90]) }

  assert.equal(appearanceTemplateSimilarity(sample, exact), 1)
  assert.equal(bestAppearanceTemplateMatch(sample, [different, exact])?.value, 'exact')
  assert.equal(bestAppearanceTemplateMatch(sample, [exact, { ...exact, value: 'duplicate' }]), null)
})

test('gender color recognition accepts clear symbols and rejects weak or mixed evidence', () => {
  const pixels = (...colors) => ({
    data: new Uint8ClampedArray(colors.flatMap((color) => [...color, 255])),
  })
  assert.equal(recognizeGenderColor(pixels(
    ...Array(8).fill([48, 132, 238]),
    ...Array(2).fill([230, 230, 230]),
  ))?.value, 'male')
  assert.equal(recognizeGenderColor(pixels(
    ...Array(8).fill([225, 55, 92]),
    ...Array(2).fill([230, 230, 230]),
  ))?.value, 'female')
  assert.equal(recognizeGenderColor(pixels(...Array(8).fill([230, 230, 230]))), null)
  assert.equal(recognizeGenderColor(pixels(
    ...Array(4).fill([48, 132, 238]),
    ...Array(4).fill([225, 55, 92]),
  )), null)
})

test('stat tone recognition separates white base values from yellow talent values', () => {
  const white = syntheticPixels(20, 20, [224, 224, 220])
  const yellow = syntheticPixels(20, 20, [232, 185, 106])
  const dark = syntheticPixels(20, 20, [70, 72, 68])

  assert.equal(recognizeScannerStatTone(white).tone, 'white')
  assert.equal(recognizeScannerStatTone(yellow).tone, 'yellow')
  assert.equal(recognizeScannerStatTone(dark).tone, 'unknown')
})

test('partner mark templates cover no mark and all nine game marks', async () => {
  assert.deepEqual(ROCK_PARTNER_MARK_TEMPLATES.map((template) => template.value), [
    'none',
    'fruit',
    'lightning',
    'home',
    'hp',
    'patk',
    'matk',
    'pdef',
    'mdef',
    'spd',
  ])
  await Promise.all(ROCK_PARTNER_MARK_TEMPLATES.map(async (template) => {
    const url = new URL(
      `../../public/icons/rock-kingdom-partner-marks/${template.fileName}`,
      import.meta.url,
    )
    await access(url)
    const image = await readFile(url)
    assert.equal(image.subarray(1, 4).toString(), 'PNG')
    assert.equal(image.readUInt32BE(16), 72)
    assert.equal(image.readUInt32BE(20), 72)
  }))
})

test('partner mark matching accepts a clear shape, rejects ambiguity, and recognizes no mark', () => {
  function markPixels(activePoints = []) {
    const width = 9
    const height = 9
    const active = new Set(activePoints.map(([x, y]) => `${x}:${y}`))
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4
        pixels.set(active.has(`${x}:${y}`) ? [220, 165, 45, 255] : [39, 43, 45, 255], offset)
      }
    }
    return { data: pixels, width, height }
  }
  const sample = normalizedPartnerMarkMask(markPixels([[3, 2], [4, 2], [3, 3], [4, 3], [4, 4]]))
  const exact = { value: 'exact', ...sample }
  const different = {
    value: 'different',
    ...normalizedPartnerMarkMask(markPixels([[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]])),
  }
  assert.equal(partnerMarkMaskSimilarity(sample, exact), 1)
  assert.equal(bestPartnerMarkTemplateMatch(sample, [different, exact])?.value, 'exact')
  assert.equal(bestPartnerMarkTemplateMatch(sample, [exact, { ...exact, value: 'duplicate' }]), null)
  assert.equal(bestPartnerMarkTemplateMatch(normalizedPartnerMarkMask(markPixels()), [exact])?.value, 'none')
})

test('partner mark matching rejects a weak 50 percent shape match', () => {
  const sample = {
    pixels: new Float32Array(28 * 28).fill(1),
    width: 28,
    height: 28,
  }
  const weak = {
    value: 'weak',
    pixels: Float32Array.from(sample.pixels, (value, index) => index % 2 ? value : 0),
    width: 28,
    height: 28,
  }
  assert.equal(bestPartnerMarkTemplateMatch(sample, [weak]), null)
})

test('stable frame selection skips transitions, long duplicate runs, and a failed switch', () => {
  const signature = (value, accent = 0) => {
    const result = new Uint8Array(40).fill(value)
    result[0] = value + accent
    result[1] = value + accent
    return result
  }
  const samples = [
    { time: 0, signature: signature(20) },
    { time: 0.4, signature: signature(20, 1) },
    { time: 0.8, signature: signature(20) },
    { time: 1.2, signature: signature(80) },
    { time: 1.6, signature: signature(20) },
    { time: 2, signature: signature(20, 1) },
    { time: 2.4, signature: signature(20) },
    { time: 2.8, signature: signature(100) },
    { time: 3.2, signature: signature(45) },
    { time: 3.6, signature: signature(45, 1) },
    { time: 4, signature: signature(45) },
    { time: 4.4, signature: signature(45) },
  ]
  assert.equal(scannerSignatureDifference(signature(20), signature(20, 1)) < 7, true)
  assert.deepEqual(
    selectStableScannerSamples(samples).map((sample) => sample.time),
    [0.8, 4],
  )
})

test('stable frame selection prefers the sharpest anchored terminal frame', () => {
  const base = new Uint8Array(40).fill(30)
  const selected = selectStableScannerSamples([
    { time: 0, signature: base, anchorQuality: 0.12 },
    { time: 0.45, signature: base, anchorQuality: 0.28 },
    { time: 0.9, signature: base, anchorQuality: 0.74 },
    { time: 1.35, signature: base, anchorQuality: 0.63 },
  ])
  assert.deepEqual(selected.map((sample) => sample.time), [0.9])
})

test('anchor quality rewards crisp content in the fixed information regions', () => {
  const width = 120
  const height = 80
  const blank = new Uint8Array(width * height).fill(35)
  const crisp = blank.slice()
  for (let y = 2; y < height - 2; y += 4) {
    for (let x = 8; x < width - 8; x += 6) crisp[y * width + x] = 230
  }
  assert.equal(scannerAnchorQuality(blank, width, height), 0)
  assert.equal(scannerAnchorQuality(crisp, width, height) > 0.4, true)
})

test('scan matching tolerates labels, suffixes, whitespace, and one OCR error', () => {
  const options = [
    { value: 'sharing', label: '爱分享' },
    { value: 'swift', label: '疾行' },
    { value: 'bug', label: '虫系' },
  ]
  assert.equal(bestScanMatch(' 爱 分享 ', options)?.value, 'sharing')
  assert.equal(bestScanMatch('虫', options)?.value, 'bug')
  assert.equal(bestScanMatch('爱分亨', options)?.value, 'sharing')
  assert.equal(bestScanMatch('', options), null)
  assert.equal(normalizeScanText('S2 异色·炫彩'), 's2异色炫彩')
})

test('scan matching can require a distinct best finite-vocabulary candidate', () => {
  const candidates = [
    { value: 'one', label: '板板壳' },
    { value: 'two', label: '板壳壳' },
  ]
  assert.equal(bestScanMatch('板板壳', candidates, { minimumScore: 0.62, minimumGap: 0.08 })?.value, 'one')
  assert.equal(bestScanMatch('板壳', candidates, { minimumScore: 0.62, minimumGap: 0.08 }), null)
})

test('an exact short game name wins over a longer evolution name containing it', () => {
  assert.equal(bestScanMatch('地鼠', [
    { value: 'ground-mouse', label: '地鼠（枯水期的样子）' },
    { value: 'evolved', label: '遁地鼠（枯水期的样子）' },
  ], { minimumScore: 0.62, minimumGap: 0.08 })?.value, 'ground-mouse')
})

test('scan matching treats catalog forms with the same visible game name as one OCR identity', () => {
  const candidates = [
    { value: 'ordinary', label: '板板壳' },
    { value: 'variant', label: '板板壳（蜕皮时的样子）' },
    { value: 'other', label: '鸭吉吉' },
  ]
  assert.equal(
    bestScanMatch('板板吉', candidates, { minimumScore: 0.62, minimumGap: 0.08 })?.value,
    'ordinary',
  )
})

test('scanner OCR whitelist only contains finite candidate characters', () => {
  assert.equal(
    scannerCharacterWhitelist([
      { label: '机械方方' },
      { label: 'S1 炫彩', aliases: ['一阶炫彩'] },
    ]),
    '机械方S1炫彩一阶',
  )
})

test('scanner specialty vocabulary includes visible empty and current fearless labels', () => {
  assert.equal(OWNED_SPECIALTY_OPTIONS.find((option) => option.value === 'none')?.label, '无')
  assert.deepEqual(
    OWNED_SPECIALTY_OPTIONS.find((option) => option.value === 'brave'),
    { value: 'brave', label: '无畏', aliases: ['勇敢'], color: '#dc2626' },
  )
})

test('stat shape resolves parenthesized forms without depending on level scale', () => {
  const candidates = [
    {
      value: 'dry',
      label: '地鼠（枯水期的样子）',
      traitName: '警惕',
      stats: { patk: 71, matk: 31, pdef: 72, mdef: 51, spd: 66 },
    },
    {
      value: 'water',
      label: '地鼠（储水时的样子）',
      traitName: '警惕',
      stats: { patk: 71, matk: 14, pdef: 51, mdef: 79, spd: 60 },
    },
  ]
  const panelStats = { patk: 192, matk: 112, pdef: 194, mdef: 152, spd: 182 }
  assert.equal(scannerStatShapeSimilarity(panelStats, candidates[0].stats), 1)
  assert.equal(resolveScannerReference({
    rawName: '地鼠',
    rawTrait: '警惕',
    panelStats,
    candidates,
  }).value, 'dry')
})

test('star recognition counts separated gold cultivation icons and ignores gray icons', () => {
  const width = 200
  const height = 40
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels.set([92, 96, 90, 255], offset)
  }
  for (let star = 0; star < 3; star += 1) {
    for (let y = 8; y < 32; y += 1) {
      for (let x = 8 + star * 38; x < 28 + star * 38; x += 1) {
        const offset = (y * width + x) * 4
        pixels.set([240, 178, 62, 255], offset)
      }
    }
  }
  assert.equal(recognizeScannerStarCount({ pixels, width, height }), 3)
  assert.equal(recognizeScannerStarCount(syntheticPixels(20, 20, [100, 105, 100])), 0)
})

test('level recognition keeps only the current one-to-sixty panel level', () => {
  assert.equal(parseScannerLevel('1/60'), 1)
  assert.equal(parseScannerLevel(' 44 / 60 '), 44)
  assert.equal(parseScannerLevel('60/60'), 60)
  assert.equal(parseScannerLevel('1360'), 13)
  assert.equal(parseScannerLevel('1350'), 13)
  assert.equal(parseScannerLevel('0/18770'), 0)
  assert.deepEqual(selectScannerLevel(['/60', '1350', '1350']), {
    value: 13,
    candidates: [13],
    ambiguous: false,
  })
})

test('level and star formula exactly separates the two Board Shell forms', () => {
  const panelStats = { hp: 48, patk: 22, matk: 49, pdef: 43, mdef: 51, spd: 39 }
  const nature = { raise: 'spd', lower: 'patk' }
  const ordinaryStats = { hp: 67, patk: 28, matk: 72, pdef: 64, mdef: 81, spd: 45 }
  const sheddingStats = { hp: 88, patk: 24, matk: 72, pdef: 56, mdef: 59, spd: 48 }
  assert.equal(scannerCultivationFit(panelStats, ordinaryStats, {
    level: 1,
    stars: 0,
    nature,
  }).rmse, 0)
  assert.ok(scannerCultivationFit(panelStats, sheddingStats, {
    level: 1,
    stars: 0,
    nature,
  }).rmse > 5)
  const resolved = resolveScannerReference({
    rawName: '板板壳',
    rawTrait: '缩壳',
    panelStats,
    level: 1,
    stars: 0,
    nature,
    candidates: [
      { value: 'ordinary', label: '板板壳', traitName: '缩壳', stats: ordinaryStats },
      { value: 'shedding', label: '板板壳（蜕皮时的样子）', traitName: '缩壳', stats: sheddingStats },
    ],
  })
  assert.equal(resolved.value, 'ordinary')
  assert.equal(resolved.source, 'name+formula')
})

test('three white unboosted stats can resolve Board Shell when yellow values are unreliable', () => {
  const panelStats = { hp: 999, patk: 22, matk: 999, pdef: 43, mdef: 51, spd: 999 }
  const statTones = {
    hp: { tone: 'yellow' },
    patk: { tone: 'white' },
    matk: { tone: 'yellow' },
    pdef: { tone: 'white' },
    mdef: { tone: 'white' },
    spd: { tone: 'yellow' },
  }
  const nature = { raise: 'spd', lower: 'patk' }
  const ordinaryStats = { hp: 67, patk: 28, matk: 72, pdef: 64, mdef: 81, spd: 45 }
  const sheddingStats = { hp: 88, patk: 24, matk: 72, pdef: 56, mdef: 59, spd: 48 }
  const resolved = resolveScannerReference({
    rawName: '板板壳',
    rawTrait: '缩壳',
    panelStats,
    statTones,
    level: 1,
    stars: 0,
    nature,
    candidates: [
      { value: 'ordinary', label: '板板壳', traitName: '缩壳', stats: ordinaryStats },
      { value: 'shedding', label: '板板壳（蜕皮时的样子）', traitName: '缩壳', stats: sheddingStats },
    ],
  })

  assert.equal(resolved.value, 'ordinary')
  assert.equal(resolved.source, 'name+formula')
  assert.equal(resolved.diagnostics.mode, 'white-first')
  assert.deepEqual(resolved.diagnostics.whiteStatKeys, ['patk', 'pdef', 'mdef'])
  assert.equal(resolved.candidates[0].cultivationFit.rmse, 0)
})

test('formula diagnostics explain a candidate gap that is too small', () => {
  const stats = { hp: 67, patk: 28, matk: 72, pdef: 64, mdef: 81, spd: 45 }
  const resolved = resolveScannerReference({
    rawName: '板板壳',
    panelStats: { hp: 48, patk: 22, matk: 49, pdef: 43, mdef: 51, spd: 39 },
    level: 1,
    stars: 0,
    nature: { raise: 'spd', lower: 'patk' },
    minimumFormulaRmseGap: 1.5,
    candidates: [
      { value: 'one', label: '板板壳', stats },
      { value: 'two', label: '板板壳（相同数据）', stats },
    ],
  })

  assert.equal(resolved.value, '')
  assert.equal(resolved.diagnostics.failure, 'candidate-gap-too-small')
  assert.equal(resolved.diagnostics.rmseGap, 0)
})

test('cultivation fit reproduces a middle-level Duck form from the scanner video', () => {
  const fit = scannerCultivationFit(
    { hp: 108, patk: 62, matk: 36, pdef: 57, mdef: 46, spd: 82 },
    { hp: 108, patk: 89, matk: 41, pdef: 74, mdef: 48, spd: 115 },
    {
      level: 13,
      stars: 0,
      nature: { raise: 'mdef', lower: 'patk' },
    },
  )
  assert.equal(fit.rmse, 0)
  assert.deepEqual(fit.individualStats, {
    hp: 7,
    patk: 8,
    matk: 0,
    pdef: 0,
    mdef: 7,
    spd: 0,
  })
})

test('real Duck OCR candidates recover level 13 and resolve Burning Duck from four stats', () => {
  const candidates = [
    { value: 'fluffy', label: '鸭吉吉（蓬松的样子）', traitName: '挺起胸脯', stats: { hp: 136, patk: 95, matk: 35, pdef: 55, mdef: 45, spd: 105 } },
    { value: 'solid', label: '鸭吉吉（紧实的样子）', traitName: '挺起胸脯', stats: { hp: 136, patk: 35, matk: 95, pdef: 45, mdef: 55, spd: 105 } },
    { value: 'urgent', label: '鸭吉吉（急急急鸭）', traitName: '挺起胸脯', stats: { hp: 130, patk: 95, matk: 35, pdef: 55, mdef: 45, spd: 110 } },
    { value: 'wait', label: '鸭吉吉（等一等鸭）', traitName: '挺起胸脯', stats: { hp: 137, patk: 35, matk: 94, pdef: 46, mdef: 57, spd: 100 } },
    { value: 'burning', label: '鸭吉吉（燃了鸭）', traitName: '挺起胸脯', stats: { hp: 108, patk: 89, matk: 41, pdef: 74, mdef: 48, spd: 115 } },
    { value: 'rise', label: '鸭吉吉（起来鸭）', traitName: '挺起胸脯', stats: { hp: 107, patk: 53, matk: 125, pdef: 80, mdef: 113, spd: 100 } },
  ]
  const nature = { raise: 'mdef', lower: 'patk' }
  const statTones = {
    hp: { tone: 'yellow' },
    patk: { tone: 'yellow' },
    matk: { tone: 'white' },
    pdef: { tone: 'white' },
    mdef: { tone: 'yellow' },
    spd: { tone: 'white' },
  }
  const panelStatOcr = {
    hp: { value: 108, candidates: [108], ambiguous: false },
    patk: { value: 0, candidates: [4627, 527, 62, 852], ambiguous: true },
    matk: { value: 36, candidates: [36], ambiguous: false },
    pdef: { value: 0, candidates: [5, 457, 57], ambiguous: true },
    mdef: { value: 3, candidates: [3], ambiguous: false },
    spd: { value: 2, candidates: [2], ambiguous: false },
  }
  const constrained = constrainScannerFormulaInputs({
    rawName: '鸭吉吉',
    rawTrait: '挺起胸脯',
    panelStatOcr,
    levelOcr: { value: 0, candidates: [], ambiguous: false, rawVariants: ['/60'] },
    stars: 0,
    nature,
    statTones,
    candidates,
  })
  assert.equal(constrained.applied, true)
  assert.equal(constrained.level, 13)
  assert.equal(constrained.levelInferred, true)
  assert.deepEqual(constrained.panelStats, {
    hp: 108,
    patk: 62,
    matk: 36,
    pdef: 57,
    mdef: 0,
    spd: 0,
  })
  assert.equal(constrained.identity.value, 'burning')
  assert.equal(constrained.identity.source, 'name+formula')
  assert.equal(constrained.identity.diagnostics.mode, 'mixed-evidence')
  assert.equal(constrained.identity.candidates[0].cultivationFit.rmse, 0)
})

test('joint formula constraints do not force an indistinguishable form or level', () => {
  const stats = { hp: 108, patk: 89, matk: 41, pdef: 74, mdef: 48, spd: 115 }
  const panelStatOcr = Object.fromEntries(
    Object.entries({ hp: 108, patk: 62, matk: 36, pdef: 57, mdef: 46, spd: 82 })
      .map(([key, value]) => [key, { value, candidates: [value], ambiguous: false }]),
  )
  const constrained = constrainScannerFormulaInputs({
    rawName: 'same',
    rawTrait: 'same trait',
    panelStatOcr,
    levelOcr: { value: 0, candidates: [], ambiguous: false },
    stars: 0,
    nature: { raise: 'mdef', lower: 'patk' },
    statTones: Object.fromEntries(
      ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd'].map((key) => [key, { tone: 'unknown' }]),
    ),
    candidates: [
      { value: 'one', label: 'same', traitName: 'same trait', stats },
      { value: 'two', label: 'same', traitName: 'same trait', stats },
    ],
  })
  assert.equal(constrained.applied, false)
  assert.equal(constrained.failure, 'no-legal-attempt')
})

test('cultivation fit accepts a lower talent tier with one boosted stat', () => {
  const fit = scannerCultivationFit(
    { hp: 40, patk: 41, matk: 33, pdef: 51, mdef: 32, spd: 38 },
    { hp: 51, patk: 53, matk: 53, pdef: 80, mdef: 44, spd: 54 },
    {
      level: 1,
      stars: 0,
      nature: { raise: 'patk', lower: 'matk' },
    },
  )
  assert.equal(fit.rmse, 0)
  assert.deepEqual(fit.individualStats, {
    hp: 8,
    patk: 0,
    matk: 0,
    pdef: 0,
    mdef: 0,
    spd: 0,
  })
})

test('trait and stat shape can resolve a custom nickname conservatively', () => {
  const candidates = [
    {
      value: 'physical',
      label: '鸭吉吉（蓬松的样子）',
      traitName: '挺起胸脯',
      stats: { patk: 95, matk: 35, pdef: 55, mdef: 45, spd: 105 },
    },
    {
      value: 'magical',
      label: '鸭吉吉（紧实的样子）',
      traitName: '挺起胸脯',
      stats: { patk: 35, matk: 95, pdef: 45, mdef: 55, spd: 105 },
    },
  ]
  assert.equal(resolveScannerReference({
    rawName: '梦梦',
    rawTrait: '挺起胸脯',
    panelStats: { patk: 80, matk: 200, pdef: 100, mdef: 120, spd: 220 },
    candidates,
  }).value, 'magical')
  assert.equal(resolveScannerReference({
    rawName: '梦梦',
    rawTrait: '挺起胸脯',
    panelStats: { patk: 100, matk: 100, pdef: 100, mdef: 100, spd: 100 },
    candidates,
  }).value, '')
})

test('scanner frames require both a creature reference and explicit review before saving', () => {
  assert.equal(isScannerFrameReady({ reviewed: false, values: { ref: 'creature-1' } }), false)
  assert.equal(isScannerFrameReady({ reviewed: true, values: { ref: '' } }), false)
  assert.equal(isScannerFrameReady({ reviewed: true, values: { ref: 'creature-1' } }), true)
})
