import test from 'node:test'
import assert from 'node:assert/strict'

import {
  hasStoredModelConfig,
  loadStoredModelConfig,
  MODEL_CONFIG_SCOPE,
  saveStoredModelConfig,
} from '../../src/features/model/modelConfig.js'

class MemoryStorage {
  #values = new Map()

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null
  }

  setItem(key, value) {
    this.#values.set(key, String(value))
  }

  removeItem(key) {
    this.#values.delete(key)
  }
}

function installBrowserStorage() {
  const previousWindow = globalThis.window
  const previousCustomEvent = globalThis.CustomEvent
  globalThis.window = {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
    dispatchEvent() {},
  }
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
      this.type = type
      this.detail = options.detail
    }
  }
  return () => {
    globalThis.window = previousWindow
    globalThis.CustomEvent = previousCustomEvent
  }
}

test('reading legacy config remains separate from a new Rock Kingdom profile', () => {
  const restore = installBrowserStorage()
  try {
    window.localStorage.setItem('readerModelProvider', 'custom')
    window.localStorage.setItem('readerModelEndpoint', 'https://reader.example/chat/completions')
    window.localStorage.setItem('readerModelName', 'reader-model')
    window.sessionStorage.setItem('readerModelApiKey', 'reader-key')

    const reading = loadStoredModelConfig('', true, MODEL_CONFIG_SCOPE.READING)
    const rock = loadStoredModelConfig('', true, MODEL_CONFIG_SCOPE.ROCK_KINGDOM)

    assert.equal(reading.endpoint, 'https://reader.example/chat/completions')
    assert.equal(reading.model, 'reader-model')
    assert.equal(reading.apiKey, 'reader-key')
    assert.equal(rock.providerId, 'zhipu')
    assert.equal(rock.apiKey, '')
    assert.equal(hasStoredModelConfig(MODEL_CONFIG_SCOPE.READING), true)
    assert.equal(hasStoredModelConfig(MODEL_CONFIG_SCOPE.ROCK_KINGDOM), false)
  } finally {
    restore()
  }
})

test('copying and saving another domain config creates an independent snapshot', () => {
  const restore = installBrowserStorage()
  try {
    const reading = saveStoredModelConfig({
      providerId: 'deepseek',
      endpoint: 'https://reader.example/chat/completions',
      model: 'reader-model',
      apiKey: 'reader-key',
    }, MODEL_CONFIG_SCOPE.READING)

    saveStoredModelConfig(reading, MODEL_CONFIG_SCOPE.ROCK_KINGDOM)
    saveStoredModelConfig({
      ...reading,
      endpoint: 'https://reader-new.example/chat/completions',
      model: 'reader-model-v2',
    }, MODEL_CONFIG_SCOPE.READING)

    const savedReading = loadStoredModelConfig('', true, MODEL_CONFIG_SCOPE.READING)
    const savedRock = loadStoredModelConfig('', true, MODEL_CONFIG_SCOPE.ROCK_KINGDOM)

    assert.equal(savedReading.model, 'reader-model-v2')
    assert.equal(savedRock.model, 'reader-model')
    assert.equal(savedRock.endpoint, 'https://reader.example/chat/completions')
    assert.equal(savedRock.apiKey, 'reader-key')
    assert.equal(hasStoredModelConfig(MODEL_CONFIG_SCOPE.ROCK_KINGDOM), true)
  } finally {
    restore()
  }
})
