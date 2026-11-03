import path from 'node:path'
import { realpath } from 'node:fs/promises'

export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:* http://[::1]:*; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"
export const WINDOW_PREFERENCES = Object.freeze({ sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false, webSecurity: true, webviewTag: false, allowRunningInsecureContent: false, spellcheck: false, safeDialogs: true })
const types = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.gz': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}))
const hasControl = value => [...value].some(character => character.charCodeAt(0) < 32)

export function isAppUrl(input, host) {
  try { const url = new URL(input); return url.protocol === 'app:' && url.host === host && !url.username && !url.password } catch { return false }
}

export function assetPath(root, input, host) {
  if (!isAppUrl(input, host)) return null
  // Inspect the raw path before URL normalization can hide dot segments.
  const raw = input.replace(/^app:\/\/[^/]+/, '').split(/[?#]/)[0] || '/'
  if (/%(?:2f|5c|25)/i.test(raw)) return null
  let pathname
  try { pathname = decodeURIComponent(raw) } catch { return null }
  const segments = pathname.split('/').filter(Boolean)
  if (segments.some(segment => segment === '..' || segment === '.' || /[\\:]/.test(segment) || hasControl(segment))) return null
  const relative = segments.join('/') || 'index.html'
  if (!['index.html', 'LICENSE', 'COPYRIGHT', 'THIRD_PARTY_NOTICES.txt', 'favicon.svg', 'manifest.webmanifest'].includes(relative)
    && !/^(assets|icons|presets|reader-ocr|ocr-runtime)\//.test(relative)) return null
  const target = path.resolve(root, relative)
  return target.startsWith(path.resolve(root) + path.sep) ? target : null
}

export function mimeType(target) {
  if (/^(LICENSE[^/\\]*|COPYRIGHT)$/.test(path.basename(target))) return 'text/plain; charset=utf-8'
  return types.get(path.extname(target).toLowerCase()) || null
}

export function navigationAllowed(input, host) {
  if (!isAppUrl(input, host)) return false
  const url = new URL(input)
  return ['/', '/index.html'].includes(url.pathname) && !url.search
}

export function externalUrl(input) {
  try {
    const url = new URL(input)
    return url.protocol === 'https:' && !url.username && !url.password && !/\s/.test(input) && !hasControl(input) ? url.href : null
  } catch { return null }
}

export function downloadAllowed(url, filename, host) {
  return url.startsWith(`blob:app://${host}/`) && /^[a-f0-9-]{36}$/i.test(url.slice(`blob:app://${host}/`.length))
    && /^[^/\\:]+\.json$/i.test(filename) && !hasControl(filename)
}

export function permissionAllowed(permission, contentsUrl, requestingOrigin, host, isMainFrame = true, loopbackConsent = false) {
  return (permission === 'persistent-storage' || (permission === 'loopback-network' && loopbackConsent))
    && isMainFrame && navigationAllowed(contentsUrl, host) && isAppUrl(requestingOrigin, host)
}

export function createAssetHandler(root, host, fetchFile) {
  return async request => {
    const headers = { 'Content-Security-Policy': CONTENT_SECURITY_POLICY, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }
    const failure = status => new Response(null, { status, headers })
    if (!['GET', 'HEAD'].includes(request.method)) return failure(405)
    const origin = request.headers.get('origin')
    if (origin && origin !== `app://${host}`) return failure(403)
    const target = assetPath(root, request.url, host)
    const type = target && mimeType(target)
    if (!type) return failure(404)
    try {
      const [actualRoot, actualTarget] = await Promise.all([realpath(root), realpath(target)])
      if (!actualTarget.startsWith(actualRoot + path.sep)) return failure(404)
      const response = await fetchFile(actualTarget, request.method)
      if (response.status !== 200) return failure(404)
      return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers: { ...headers, 'Content-Type': type } })
    } catch { return failure(404) }
  }
}
