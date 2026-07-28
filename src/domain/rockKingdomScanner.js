export const ROCK_APPEARANCE_OPTIONS = [
  { value: 'none', label: '无', color: '#94a3b8' },
  { value: 'shiny', label: '异色', color: '#db2777' },
  { value: 'colorful', label: '炫彩', color: '#7c3aed' },
  { value: 'shiny-colorful', label: '异色炫彩', color: '#c026d3' },
  { value: 'bw-colorful', label: '黑白炫彩', color: '#475569' },
  { value: 'bw-shiny-colorful', label: '黑白异色炫彩', color: '#334155' },
  { value: 's1-colorful', label: 'S1 炫彩', color: '#0ea5e9' },
  { value: 's1-shiny-colorful', label: 'S1 异色炫彩', color: '#0284c7' },
  { value: 's2-colorful', label: 'S2 炫彩', color: '#e11d48' },
  { value: 's2-shiny-colorful', label: 'S2 异色炫彩', color: '#be123c' },
  { value: 's3-colorful', label: 'S3 炫彩', color: '#10b981' },
  { value: 's3-shiny-colorful', label: 'S3 异色炫彩', color: '#059669' },
]

export const ROCK_SCANNER_CROP_PROFILE = {
  // 根据用户提供的 1280 × 576 总览图标定。坐标使用比例，允许等比例缩放。
  name: { label: '名称', x: 0.688, y: 0.105, width: 0.19, height: 0.105 },
  bloodline: { label: '血脉', x: 0.855, y: 0.17, width: 0.115, height: 0.095 },
  nature: { label: '性格', x: 0.72, y: 0.72, width: 0.14, height: 0.105 },
  specialty: { label: '特长', x: 0.855, y: 0.72, width: 0.115, height: 0.105 },
  appearance: { label: '外观', x: 0.895, y: 0.62, width: 0.075, height: 0.12 },
}

export function appearanceFlags(value) {
  const normalized = String(value || 'none')
  return {
    shiny: normalized === 'shiny' || normalized.includes('shiny-colorful') ? 'yes' : 'no',
    colorful: normalized.includes('colorful') ? 'yes' : 'no',
  }
}

export function valuesWithAppearance(values = {}) {
  return {
    ...values,
    ...appearanceFlags(values.appearance),
  }
}

export function normalizeScanText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]/gu, '')
}

function editDistance(left, right) {
  const a = [...left]
  const b = [...right]
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[b.length]
}

function candidateSearchTerms(candidate) {
  const label = String(candidate.label || '')
  const baseLabel = label.split(/[（(]/)[0].trim()
  const terms = [baseLabel, label, ...(candidate.aliases || [])]
  if (baseLabel.endsWith('系')) terms.push(baseLabel.slice(0, -1))
  return [...new Set(terms.map(normalizeScanText).filter(Boolean))]
}

export function bestScanMatch(rawText, candidates = [], minimumScore = 0.48) {
  const source = normalizeScanText(rawText)
  if (!source) return null
  let best = null
  for (const candidate of candidates) {
    for (const term of candidateSearchTerms(candidate)) {
      const contains = source.includes(term) || term.includes(source)
      const distance = editDistance(source, term)
      const score = contains
        ? Math.min(1, 0.82 + Math.min(source.length, term.length) / Math.max(source.length, term.length) * 0.18)
        : 1 - distance / Math.max(source.length, term.length)
      if (!best || score > best.score) best = { ...candidate, score, term }
    }
  }
  return best && best.score >= minimumScore ? best : null
}

export function catalogNameCandidates(rows = [], fields = []) {
  const nameField = fields.find((field) => field.key === 'name' && field.type === 'text')
    || fields.find((field) => field.type === 'text')
  if (!nameField) return []
  return rows
    .map((row) => ({
      value: row.id,
      label: String(row.values?.[nameField.key] || '').trim(),
    }))
    .filter((candidate) => candidate.label)
}

export function scannerOptionCandidates(field) {
  return (field?.options || []).map((option) => ({
    value: option.value,
    label: option.label,
  }))
}
