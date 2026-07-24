import {
  READING_MAP_PROVIDER,
  normalizeReadingMapProvider,
} from './mapConfig.js'

const resultCache = new Map()
let nextInternationalRequestAt = 0

function normalizedQuery(query) {
  return typeof query === 'string' ? query.normalize('NFKC').trim() : ''
}

function finiteCoordinate(value, minimum, maximum) {
  const coordinate = Number(value)
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null
}

function normalizedResult({ id, label, latitude, longitude, providerId }) {
  const normalizedLatitude = finiteCoordinate(latitude, -90, 90)
  const normalizedLongitude = finiteCoordinate(longitude, -180, 180)
  if (!label || normalizedLatitude === null || normalizedLongitude === null) return null
  return {
    id: String(id || `${providerId}:${normalizedLatitude}:${normalizedLongitude}`),
    label: String(label),
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    providerId,
  }
}

export function normalizeNominatimResults(payload) {
  if (!Array.isArray(payload)) return []
  return payload
    .map((item) => normalizedResult({
      id: item?.place_id,
      label: item?.display_name,
      latitude: item?.lat,
      longitude: item?.lon,
      providerId: READING_MAP_PROVIDER.INTERNATIONAL,
    }))
    .filter(Boolean)
}

export function normalizeTiandituResults(payload) {
  const rawResults = Array.isArray(payload?.pois)
    ? payload.pois
    : Array.isArray(payload?.area)
      ? payload.area
      : payload?.area
        ? [payload.area]
        : []
  return rawResults
    .map((item) => {
      const [longitude, latitude] = String(item?.lonlat || '').split(',')
      const addressParts = [
        item?.name,
        item?.address || item?.eaddress,
        item?.province,
        item?.city,
        item?.county,
      ].filter(Boolean)
      return normalizedResult({
        id: item?.hotPointID || item?.adminCode,
        label: [...new Set(addressParts)].join(' · '),
        latitude,
        longitude,
        providerId: READING_MAP_PROVIDER.DOMESTIC,
      })
    })
    .filter(Boolean)
}

async function waitForInternationalRateLimit() {
  const waitMs = Math.max(0, nextInternationalRequestAt - Date.now())
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs))
  nextInternationalRequestAt = Date.now() + 1000
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
    },
  })
  if (!response.ok) throw new Error(`地图服务请求失败（${response.status}）`)
  return response.json()
}

export async function searchReadingPlaces({
  providerId,
  query,
  tiandituToken = '',
  fetchImpl = globalThis.fetch,
}) {
  const searchQuery = normalizedQuery(query)
  if (!searchQuery) throw new Error('请输入地图搜索词')
  if (searchQuery.length > 120) throw new Error('地图搜索词不能超过 120 个字符')
  if (typeof fetchImpl !== 'function') throw new Error('当前环境无法访问地图搜索服务')

  const provider = normalizeReadingMapProvider(providerId)
  const token = tiandituToken.trim()
  if (provider === READING_MAP_PROVIDER.DOMESTIC && !token) {
    throw new Error('国内地图搜索需要先填写天地图浏览器端 Key')
  }
  const cacheKey = `${provider}:${token}:${searchQuery.toLocaleLowerCase()}`
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey)

  let results
  if (provider === READING_MAP_PROVIDER.DOMESTIC) {
    const postStr = JSON.stringify({
      keyWord: searchQuery,
      level: 8,
      mapBound: '-180,-90,180,90',
      queryType: 7,
      start: 0,
      count: 5,
      show: 2,
    })
    const url = `https://api.tianditu.gov.cn/v2/search?postStr=${encodeURIComponent(postStr)}&type=query&tk=${encodeURIComponent(token)}`
    results = normalizeTiandituResults(await fetchJson(url, fetchImpl))
  } else {
    await waitForInternationalRateLimit()
    const parameters = new URLSearchParams({
      q: searchQuery,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
    })
    const url = `https://nominatim.openstreetmap.org/search?${parameters}`
    results = normalizeNominatimResults(await fetchJson(url, fetchImpl))
  }
  resultCache.set(cacheKey, results)
  return results
}
