import test from 'node:test'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'

import {
  ROCK_APPEARANCE_TEMPLATES,
  ROCK_PARTNER_MARK_TEMPLATES,
  appearanceTemplateSimilarity,
  appearanceFlags,
  bestAppearanceTemplateMatch,
  bestPartnerMarkTemplateMatch,
  bestScanMatch,
  isScannerFrameReady,
  normalizeScanText,
  normalizedPartnerMarkMask,
  partnerMarkMaskSimilarity,
  recognizeGenderColor,
  scannerAnchorQuality,
  scannerCharacterWhitelist,
  scannerSignatureDifference,
  selectStableScannerSamples,
  valuesWithAppearance,
} from '../../src/domain/rockKingdomScanner.js'

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

test('partner mark templates cover all nine game marks', async () => {
  assert.deepEqual(ROCK_PARTNER_MARK_TEMPLATES.map((template) => template.value), [
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
  await Promise.all(ROCK_PARTNER_MARK_TEMPLATES.map((template) => access(
    new URL(`../../public/icons/rock-kingdom-partner-marks/${template.fileName}`, import.meta.url),
  )))
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

test('scanner frames require both a creature reference and explicit review before saving', () => {
  assert.equal(isScannerFrameReady({ reviewed: false, values: { ref: 'creature-1' } }), false)
  assert.equal(isScannerFrameReady({ reviewed: true, values: { ref: '' } }), false)
  assert.equal(isScannerFrameReady({ reviewed: true, values: { ref: 'creature-1' } }), true)
})
