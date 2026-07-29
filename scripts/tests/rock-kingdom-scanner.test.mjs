import test from 'node:test'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'

import {
  ROCK_APPEARANCE_TEMPLATES,
  appearanceTemplateSimilarity,
  appearanceFlags,
  bestAppearanceTemplateMatch,
  bestScanMatch,
  isScannerFrameReady,
  normalizeScanText,
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

test('scanner frames require both a creature reference and explicit review before saving', () => {
  assert.equal(isScannerFrameReady({ reviewed: false, values: { ref: 'creature-1' } }), false)
  assert.equal(isScannerFrameReady({ reviewed: true, values: { ref: '' } }), false)
  assert.equal(isScannerFrameReady({ reviewed: true, values: { ref: 'creature-1' } }), true)
})
