import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import {
  READING_MAP_DEFAULT_VIEW,
  readingMapTileSources,
} from '../map/mapConfig.js'

const PLACE_COLORS = {
  real: '#2563eb',
  prototype: '#7c3aed',
  approximate: '#d97706',
  fictional: '#64748b',
}

function markerStyle(place, active = false) {
  const color = PLACE_COLORS[place.placeKind] || PLACE_COLORS.real
  return {
    color: active ? '#111827' : '#ffffff',
    fillColor: color,
    fillOpacity: 0.92,
    opacity: 1,
    weight: active ? 3 : 2,
    radius: active ? 10 : 8,
  }
}

export function ReadingGeoMap({
  places,
  selectedPlaceId,
  onSelectPlace,
  providerId,
  tiandituToken,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const tileLayersRef = useRef([])
  const markerLayerRef = useRef(null)
  const markersRef = useRef(new Map())
  const onSelectPlaceRef = useRef(onSelectPlace)
  const [tileState, setTileState] = useState('loading')
  const spatialPlaces = useMemo(
    () => places.filter((place) => (
      Number.isFinite(place.geometry?.latitude)
      && Number.isFinite(place.geometry?.longitude)
    )),
    [places],
  )

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace
  }, [onSelectPlace])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined

    const map = L.map(containerRef.current, {
      attributionControl: true,
      minZoom: 2,
      zoomControl: true,
    }).setView(READING_MAP_DEFAULT_VIEW.center, READING_MAP_DEFAULT_VIEW.zoom)
    const markerLayer = L.layerGroup().addTo(map)

    mapRef.current = map
    markerLayerRef.current = markerLayer

    const resizeFrame = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(resizeFrame)
      markersRef.current.clear()
      tileLayersRef.current = []
      markerLayerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined

    for (const layer of tileLayersRef.current) layer.remove()
    tileLayersRef.current = []
    const sources = readingMapTileSources(providerId, tiandituToken)
    if (sources.length === 0) {
      setTileState('missing-key')
      return undefined
    }

    setTileState('loading')
    let loadedLayerCount = 0
    let hasTileError = false
    const layers = sources.map((source) => {
      const layer = L.tileLayer(source.url, source.options)
      layer.on('load', () => {
        loadedLayerCount += 1
        if (loadedLayerCount === sources.length && !hasTileError) setTileState('ready')
      })
      layer.on('tileerror', () => {
        hasTileError = true
        setTileState('error')
      })
      return layer.addTo(map)
    })
    tileLayersRef.current = layers

    return () => {
      for (const layer of layers) layer.remove()
      if (tileLayersRef.current === layers) tileLayersRef.current = []
    }
  }, [providerId, tiandituToken])

  useEffect(() => {
    const map = mapRef.current
    const markerLayer = markerLayerRef.current
    if (!map || !markerLayer) return

    markerLayer.clearLayers()
    markersRef.current.clear()
    map.invalidateSize({ animate: false })

    for (const place of spatialPlaces) {
      const { latitude, longitude, type, radiusKm } = place.geometry
      const marker = type === 'area'
        ? L.circle([latitude, longitude], {
            ...markerStyle(place),
            radius: radiusKm * 1000,
          })
        : L.circleMarker(
            [latitude, longitude],
            markerStyle(place),
          )
      marker
        .bindTooltip(place.name, {
          className: 'reader-map-tooltip',
          direction: 'top',
          offset: [0, -8],
          permanent: true,
        })
        .on('click', () => onSelectPlaceRef.current(place.id))
        .addTo(markerLayer)
      markersRef.current.set(place.id, marker)
    }

    if (spatialPlaces.length === 0) {
      map.setView(READING_MAP_DEFAULT_VIEW.center, READING_MAP_DEFAULT_VIEW.zoom)
    } else if (spatialPlaces.length === 1) {
      const [place] = spatialPlaces
      map.setView([place.geometry.latitude, place.geometry.longitude], 10)
    } else {
      const bounds = L.latLngBounds(
        spatialPlaces.map((place) => [place.geometry.latitude, place.geometry.longitude]),
      )
      map.fitBounds(bounds, { maxZoom: 10, padding: [36, 36] })
    }
  }, [spatialPlaces])

  useEffect(() => {
    if (!selectedPlaceId) return
    for (const place of spatialPlaces) {
      const marker = markersRef.current.get(place.id)
      if (!marker) continue
      marker.setStyle(markerStyle(place, place.id === selectedPlaceId))
      if (place.id === selectedPlaceId) marker.bringToFront()
    }
    const selectedPlace = spatialPlaces.find((place) => place.id === selectedPlaceId)
    if (selectedPlace && mapRef.current) {
      mapRef.current.panTo([
        selectedPlace.geometry.latitude,
        selectedPlace.geometry.longitude,
      ])
    }
  }, [selectedPlaceId, spatialPlaces])

  return (
    <div className="reader-interactive-map">
      <div
        className="reader-leaflet-map"
        ref={containerRef}
        aria-label="已读地点互动地图"
      />
      {tileState === 'loading' && (
        <span className="reader-map-network-state">正在加载地图底图…</span>
      )}
      {tileState === 'error' && (
        <span className="reader-map-network-state error">
          底图暂时不可用；可切换网络，地点标记仍按经纬度显示。
        </span>
      )}
      {tileState === 'missing-key' && (
        <span className="reader-map-network-state error">
          请填写天地图浏览器端 Key；Key 只保存在当前浏览器。
        </span>
      )}
      <div className="reader-map-legend" aria-label="地点类型图例">
        <span><i className="real" />真实地点</span>
        <span><i className="prototype" />原型地点</span>
        <span><i className="approximate" />模糊区域</span>
      </div>
    </div>
  )
}
