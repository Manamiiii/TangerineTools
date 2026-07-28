import { useEffect, useState } from 'react'
import {
  hasStoredModelConfig,
  loadStoredModelConfig,
  MODEL_CONFIG_SCOPE,
  MODEL_CONFIG_CHANGED_EVENT,
  saveStoredModelConfig,
} from './modelConfig.js'

export function useModelConfig(scope = MODEL_CONFIG_SCOPE.READING) {
  const otherScope = scope === MODEL_CONFIG_SCOPE.ROCK_KINGDOM
    ? MODEL_CONFIG_SCOPE.READING
    : MODEL_CONFIG_SCOPE.ROCK_KINGDOM
  const [modelConfig, setModelConfig] = useState(
    () => loadStoredModelConfig('', true, scope),
  )
  const [, setConfigRevision] = useState(0)

  useEffect(() => {
    const handleChange = (event) => {
      if (event.detail?.scope === scope) {
        setModelConfig(event.detail.config || loadStoredModelConfig('', true, scope))
      }
      setConfigRevision((current) => current + 1)
    }
    window.addEventListener(MODEL_CONFIG_CHANGED_EVENT, handleChange)
    return () => window.removeEventListener(MODEL_CONFIG_CHANGED_EVENT, handleChange)
  }, [scope])

  return {
    modelConfig,
    loadProvider: (providerId) => loadStoredModelConfig(providerId, false, scope),
    canCopyOtherConfig: hasStoredModelConfig(otherScope),
    loadOtherConfig: () => loadStoredModelConfig('', true, otherScope),
    saveModelConfig: (nextConfig) => {
      const saved = saveStoredModelConfig(nextConfig, scope)
      setModelConfig(saved)
      return saved
    },
  }
}
