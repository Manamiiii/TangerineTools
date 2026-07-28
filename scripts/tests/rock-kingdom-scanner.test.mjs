import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appearanceFlags,
  bestScanMatch,
  isScannerFrameReady,
  normalizeScanText,
  valuesWithAppearance,
} from '../../src/domain/rockKingdomScanner.js'

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
