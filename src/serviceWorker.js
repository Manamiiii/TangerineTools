export function canRegisterWebServiceWorker(protocol) {
  return protocol === 'http:' || protocol === 'https:'
}

export function registerWebServiceWorker() {
  if (!canRegisterWebServiceWorker(window.location.protocol) || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=5').catch(error => {
      console.warn('Service worker registration failed', error)
    })
  })
}
