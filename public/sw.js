const STATIC_CACHE = 'tangerine-static-__BUILD_VERSION__'
const ENABLE_RUNTIME_CACHE = self.location.protocol === 'https:'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('tangerine-static-') && key !== STATIC_CACHE)
        .map((key) => caches.delete(key)),
    )),
  ]))
})

self.addEventListener('fetch', (event) => {
  if (!ENABLE_RUNTIME_CACHE || event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || url.pathname.includes('/presets/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          const copy = response.clone()
          await caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(event.request)),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => (
      cached
      || fetch(event.request).then(async (response) => {
        if (response.ok) {
          const copy = response.clone()
          await caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {})
        }
        return response
      })
    )),
  )
})
