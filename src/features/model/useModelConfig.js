import { useEffect, useState } from 'react'
import {
  loadStoredModelConfig,
  MODEL_CONFIG_CHANGED_EVENT,
  saveStoredModelConfig,
} from './modelConfig.js'

export function useModelConfig() {
  const [modelConfig, setModelConfig] = useState(() => loadStoredModelConfig())

  useEffect(() => {
    const handleChange = (event) => setModelConfig(event.detail || loadStoredModelConfig())
    window.addEventListener(MODEL_CONFIG_CHANGED_EVENT, handleChange)
    return () => window.removeEventListener(MODEL_CONFIG_CHANGED_EVENT, handleChange)
  }, [])

  return {
    modelConfig,
    loadProvider: (providerId) => loadStoredModelConfig(providerId, false),
    saveModelConfig: (nextConfig) => {
      const saved = saveStoredModelConfig(nextConfig)
      setModelConfig(saved)
      return saved
    },
  }
}
