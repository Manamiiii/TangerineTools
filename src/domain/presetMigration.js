function isEmptyPresetValue(value) {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clonePresetValue(value) {
  if (value == null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

export async function hashPresetValue(value) {
  if (!globalThis.crypto?.subtle) return ''
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function mergeVersionedPresetValues({
  existingValues = {},
  presetValues = {},
  fieldPatches = [],
  isInvalidValue = () => false,
}) {
  const nextValues = { ...existingValues }
  const patchByKey = new Map(fieldPatches.map((patch) => [patch.key, patch]))
  let changed = false

  for (const [key, presetValue] of Object.entries(presetValues)) {
    const currentValue = nextValues[key]
    if (valuesEqual(currentValue, presetValue)) continue

    const shouldRepair = isEmptyPresetValue(currentValue) || isInvalidValue(key, currentValue)
    const candidateHashes = patchByKey.get(key)?.acceptedHashes
    const acceptedHashes = Array.isArray(candidateHashes) ? candidateHashes : []
    let matchesOldOfficialValue = false
    if (!shouldRepair && acceptedHashes.length > 0) {
      const currentHash = await hashPresetValue(currentValue)
      matchesOldOfficialValue = Boolean(currentHash) && acceptedHashes.includes(currentHash)
    }

    if (matchesOldOfficialValue || (shouldRepair && !isEmptyPresetValue(presetValue))) {
      nextValues[key] = clonePresetValue(presetValue)
      changed = true
    }
  }

  return changed ? nextValues : existingValues
}
