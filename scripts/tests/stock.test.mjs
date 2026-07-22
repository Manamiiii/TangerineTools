import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStockSummary,
  defaultStockGroupField,
  stockOptionLabel,
  stockRowGroupKeys,
} from '../../src/domain/stock.js'

const tagField = {
  key: 'tags',
  type: 'multiselect',
  options: [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ],
}
const scoreField = { key: 'score', type: 'number' }
const rows = [
  { values: { tags: ['a', 'b'], score: 15 } },
  { values: { tags: ['a'], score: 5 } },
  { values: { tags: [], score: 12 } },
  { values: { score: '' } },
]

test('stock grouping expands multiselect values and keeps empty rows visible', () => {
  assert.deepEqual(stockRowGroupKeys(rows[0], tagField), ['A', 'B'])
  assert.deepEqual(stockRowGroupKeys(rows[2], tagField), ['未填写'])

  const summary = buildStockSummary(rows, tagField)
  assert.equal(summary.total, 4)
  assert.equal(summary.matched, 4)
  assert.deepEqual(Object.fromEntries(summary.groups.map(({ label, count }) => [label, count])), {
    A: 2,
    未填写: 2,
    B: 1,
  })
})

test('stock numeric threshold filters rows before grouping', () => {
  const summary = buildStockSummary(rows, tagField, scoreField, 10)
  assert.equal(summary.total, 4)
  assert.equal(summary.matched, 2)
  assert.deepEqual(Object.fromEntries(summary.groups.map(({ label, count }) => [label, count])), {
    A: 1,
    B: 1,
    未填写: 1,
  })
  assert.equal(buildStockSummary(rows, tagField, scoreField, 0).matched, 3)
})

test('stock labels preserve configured labels and fall back to raw values', () => {
  const field = { key: 'kind', type: 'select', options: [{ value: 'known', label: '已知' }] }
  assert.equal(stockOptionLabel(field, 'known'), '已知')
  assert.equal(stockOptionLabel(field, 'custom'), 'custom')
  assert.deepEqual(buildStockSummary(rows).groups, [{ label: '全部记录', count: 4 }])
})

test('stock default grouping prefers categorical fields over image and free text', () => {
  const image = { key: 'image', type: 'image' }
  const name = { key: 'name', type: 'text' }
  const element = { key: 'element', type: 'multiselect' }
  assert.equal(defaultStockGroupField([image, name, element]), element)
  assert.equal(defaultStockGroupField([image, name]), name)
  assert.equal(defaultStockGroupField([{ key: 'stats', type: 'stats' }]), null)
})
