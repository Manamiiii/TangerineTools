import assert from 'node:assert/strict'
import test from 'node:test'
import { createAsyncAction } from '../../src/hooks/useAsyncAction.js'

test('rapid repeated submissions perform one write until the operation finishes', async () => {
  const changes = []
  const action = createAsyncAction((state) => changes.push(state))
  let complete
  let writes = 0
  const save = () => { writes += 1; return new Promise((resolve) => { complete = resolve }) }
  const first = action.run(save)
  assert.equal(action.pending, true)
  assert.equal(await action.run(save), false)
  assert.equal(writes, 1)
  complete()
  assert.equal(await first, true)
  assert.equal(action.pending, false)
  assert.deepEqual(changes, [{ pending: true, error: '' }, { pending: false, error: '' }])
})

test('failed writes expose the reason and release the lock for retry with the same input', async () => {
  let state
  const action = createAsyncAction((next) => { state = next })
  const input = { name: '保留的输入' }
  let attempts = 0
  const save = async () => {
    attempts += 1
    assert.deepEqual(input, { name: '保留的输入' })
    if (attempts === 1) throw new Error('本地存储写入失败')
  }
  assert.equal(await action.run(save), false)
  assert.deepEqual(state, { pending: false, error: '本地存储写入失败' })
  const retry = action.run(save)
  assert.deepEqual(state, { pending: true, error: '' })
  assert.equal(await retry, true)
  assert.equal(attempts, 2)
  assert.deepEqual(state, { pending: false, error: '' })
})

test('synchronous failures and missing error messages remain retryable', async () => {
  let state
  const action = createAsyncAction((next) => { state = next })
  assert.equal(await action.run(() => { throw null }), false)
  assert.deepEqual(state, { pending: false, error: '操作失败，请重试' })
  assert.equal(await action.run(() => {}), true)
  assert.equal(action.pending, false)
})

test('independent forms do not block each other', async () => {
  const first = createAsyncAction(() => {})
  const second = createAsyncAction(() => {})
  let finish
  const waiting = first.run(() => new Promise((resolve) => { finish = resolve }))
  assert.equal(await second.run(() => {}), true)
  assert.equal(first.pending, true)
  finish()
  await waiting
})
