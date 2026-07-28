import {
  inferReadingModelProvider,
  normalizeReadingModelProvider,
  READING_MODEL_PROVIDER,
  READING_MODEL_PROVIDERS,
  readingModelApiKeyStorageKey,
  readingModelProfileStorageKey,
  readingModelProviderDefaults,
} from './modelProviders.js'

export const MODEL_STORAGE_KEYS = {
  provider: 'readerModelProvider',
  endpoint: 'readerModelEndpoint',
  model: 'readerModelName',
  apiKey: 'readerModelApiKey',
}

export const MODEL_CONFIG_SCOPE = Object.freeze({
  READING: 'reading',
  ROCK_KINGDOM: 'rock-kingdom',
})

export const MODEL_CONFIG_CHANGED_EVENT = 'tangerine:model-config-changed'

function normalizeModelConfigScope(scope) {
  return scope === MODEL_CONFIG_SCOPE.ROCK_KINGDOM
    ? MODEL_CONFIG_SCOPE.ROCK_KINGDOM
    : MODEL_CONFIG_SCOPE.READING
}

function scopedProviderStorageKey(scope) {
  return normalizeModelConfigScope(scope) === MODEL_CONFIG_SCOPE.ROCK_KINGDOM
    ? 'rockKingdomModelProvider'
    : MODEL_STORAGE_KEYS.provider
}

function scopedProfileStorageKey(scope, providerId, field) {
  if (normalizeModelConfigScope(scope) === MODEL_CONFIG_SCOPE.READING) {
    return readingModelProfileStorageKey(providerId, field)
  }
  return `rockKingdomModelProfile:${normalizeReadingModelProvider(providerId)}:${field}`
}

function scopedApiKeyStorageKey(scope, providerId) {
  if (normalizeModelConfigScope(scope) === MODEL_CONFIG_SCOPE.READING) {
    return readingModelApiKeyStorageKey(providerId)
  }
  return `rockKingdomModelApiKey:${normalizeReadingModelProvider(providerId)}`
}

export function loadStoredModelConfig(
  providerId = '',
  allowLegacy = true,
  scope = MODEL_CONFIG_SCOPE.READING,
) {
  const normalizedScope = normalizeModelConfigScope(scope)
  const useReadingLegacy = allowLegacy && normalizedScope === MODEL_CONFIG_SCOPE.READING
  const legacyEndpoint = useReadingLegacy
    ? window.localStorage.getItem(MODEL_STORAGE_KEYS.endpoint) || ''
    : ''
  const storedProviderId = window.localStorage.getItem(
    scopedProviderStorageKey(normalizedScope),
  ) || ''
  const selectedProviderId = providerId
    ? normalizeReadingModelProvider(providerId)
    : storedProviderId
      ? normalizeReadingModelProvider(storedProviderId)
      : legacyEndpoint
        ? inferReadingModelProvider(legacyEndpoint)
        : READING_MODEL_PROVIDER.ZHIPU
  const defaults = readingModelProviderDefaults(selectedProviderId)
  const legacyMatchesProvider = inferReadingModelProvider(legacyEndpoint) === selectedProviderId
  return {
    ...defaults,
    endpoint: window.localStorage.getItem(
      scopedProfileStorageKey(normalizedScope, selectedProviderId, 'endpoint'),
    ) || (useReadingLegacy && legacyMatchesProvider ? legacyEndpoint : '') || defaults.endpoint,
    model: window.localStorage.getItem(
      scopedProfileStorageKey(normalizedScope, selectedProviderId, 'model'),
    ) || (useReadingLegacy && legacyMatchesProvider
      ? window.localStorage.getItem(MODEL_STORAGE_KEYS.model) || ''
      : '') || defaults.model,
    apiKey: window.sessionStorage.getItem(
      scopedApiKeyStorageKey(normalizedScope, selectedProviderId),
    ) || (useReadingLegacy && legacyMatchesProvider
      ? window.sessionStorage.getItem(MODEL_STORAGE_KEYS.apiKey) || ''
      : ''),
  }
}

export function saveStoredModelConfig(
  nextConfig,
  scope = MODEL_CONFIG_SCOPE.READING,
) {
  const normalizedScope = normalizeModelConfigScope(scope)
  const providerId = normalizeReadingModelProvider(nextConfig.providerId)
  const provider = READING_MODEL_PROVIDERS[providerId]
  const normalized = {
    providerId,
    endpoint: nextConfig.endpoint.trim(),
    model: nextConfig.model.trim(),
    apiKey: nextConfig.apiKey.trim(),
    temperature: provider.temperature,
  }
  window.localStorage.setItem(scopedProviderStorageKey(normalizedScope), providerId)
  window.localStorage.setItem(
    scopedProfileStorageKey(normalizedScope, providerId, 'endpoint'),
    normalized.endpoint,
  )
  window.localStorage.setItem(
    scopedProfileStorageKey(normalizedScope, providerId, 'model'),
    normalized.model,
  )
  if (normalizedScope === MODEL_CONFIG_SCOPE.READING) {
    if (normalized.endpoint) {
      window.localStorage.setItem(MODEL_STORAGE_KEYS.endpoint, normalized.endpoint)
    } else {
      window.localStorage.removeItem(MODEL_STORAGE_KEYS.endpoint)
    }
    if (normalized.model) {
      window.localStorage.setItem(MODEL_STORAGE_KEYS.model, normalized.model)
    } else {
      window.localStorage.removeItem(MODEL_STORAGE_KEYS.model)
    }
  }
  if (normalized.apiKey) {
    window.sessionStorage.setItem(
      scopedApiKeyStorageKey(normalizedScope, providerId),
      normalized.apiKey,
    )
    if (normalizedScope === MODEL_CONFIG_SCOPE.READING) {
      window.sessionStorage.setItem(MODEL_STORAGE_KEYS.apiKey, normalized.apiKey)
    }
  } else {
    window.sessionStorage.removeItem(scopedApiKeyStorageKey(normalizedScope, providerId))
    if (normalizedScope === MODEL_CONFIG_SCOPE.READING) {
      window.sessionStorage.removeItem(MODEL_STORAGE_KEYS.apiKey)
    }
  }
  window.dispatchEvent(new CustomEvent(MODEL_CONFIG_CHANGED_EVENT, {
    detail: { scope: normalizedScope, config: normalized },
  }))
  return normalized
}

export function hasStoredModelConfig(scope = MODEL_CONFIG_SCOPE.READING) {
  const normalizedScope = normalizeModelConfigScope(scope)
  if (window.localStorage.getItem(scopedProviderStorageKey(normalizedScope))) return true
  return normalizedScope === MODEL_CONFIG_SCOPE.READING
    && Boolean(window.localStorage.getItem(MODEL_STORAGE_KEYS.endpoint))
}

export function modelConfigIsComplete(config = {}) {
  return Boolean(config.endpoint?.trim() && config.model?.trim() && config.apiKey?.trim())
}
