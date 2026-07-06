self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Intentionally no custom response/cache handling.
  // The browser performs normal network requests so new GitHub Pages builds are
  // not kept stale by a runtime cache, and IndexedDB user data is untouched.
})
