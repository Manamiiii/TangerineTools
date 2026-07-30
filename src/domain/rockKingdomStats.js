const STAT_KEYS = ['hp', 'patk', 'matk', 'pdef', 'mdef', 'spd']

export const MAX_CULTIVATION_LEVEL = 60
export const MAX_CULTIVATION_STARS = 5
export const MAX_INDIVIDUAL_DISPLAY_VALUE = 10

function normalizedIndividualDisplayValue(value) {
  return Math.max(0, Math.min(MAX_INDIVIDUAL_DISPLAY_VALUE, Number(value) || 0))
}

export function cultivationNatureModifier(statKey, nature = null, stars = MAX_CULTIVATION_STARS) {
  const normalizedStars = Math.max(0, Math.min(MAX_CULTIVATION_STARS, Number(stars) || 0))
  if (statKey === nature?.raise) return Number((1.1 + normalizedStars * 0.02).toFixed(2))
  if (statKey === nature?.lower) return 0.9
  return 1
}

export function calculateCultivatedStat(
  baseValue,
  statKey,
  {
    level = MAX_CULTIVATION_LEVEL,
    stars = MAX_CULTIVATION_STARS,
    individualDisplayValue = 0,
    natureModifier = 1,
  } = {},
) {
  const base = Number(baseValue) || 0
  if (base <= 0 || !STAT_KEYS.includes(statKey)) return 0
  const normalizedLevel = Math.max(1, Math.min(MAX_CULTIVATION_LEVEL, Number(level) || 1))
  const normalizedStars = Math.max(0, Math.min(MAX_CULTIVATION_STARS, Number(stars) || 0))
  const individual = normalizedIndividualDisplayValue(individualDisplayValue)
    * (normalizedStars + 1)
  const isHp = statKey === 'hp'
  const growth = 0.5 + normalizedLevel / (isHp ? 50 : 100)
  const scaled = Math.round(
    (base + individual / 2) * growth +
    (isHp ? normalizedLevel + 10 : 10),
  )
  return Math.round(
    scaled * Number(natureModifier || 1) +
    normalizedStars * (isHp ? 20 : 10),
  )
}
