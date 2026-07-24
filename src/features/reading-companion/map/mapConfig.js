export const READING_MAP_DEFAULT_VIEW = Object.freeze({
  center: [33.67, -84.39],
  zoom: 9,
})

export const READING_MAP_TILE_SOURCE = Object.freeze({
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: Object.freeze({
    minZoom: 2,
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  }),
})
