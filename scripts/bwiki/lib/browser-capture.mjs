// Browser access is supplied by the interactive browser tool, never a second client.
// Keep this module dependency-free so the same checks run in that tool and in tests.
export const BROWSER_CAPTURE_FORMAT = 'nrc-browser-dom-v1'
const CHUNK_SIZE = 50000

function assertExpected(expected) {
  if (!expected || !/^[\w][\w.-]*$/.test(expected.version ?? '') || !/^pet_\d+$/.test(expected.sourceId ?? '')) throw new Error('Invalid capture identity/version')
  const url = new URL(expected.sourceUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'wiki.biligame.com' || !url.pathname.startsWith('/nrc/') || url.username || url.password || url.search || url.hash) throw new Error('Invalid capture URL')
}

function assertMetadata(meta, expected) {
  if (meta?.sourceId !== expected.sourceId || meta?.sourceUrl !== expected.sourceUrl || meta?.rootCount !== 1) throw new Error('Browser target identity mismatch; stop without navigating or retrying')
  if (meta.ready !== true || !Number.isSafeInteger(meta.characters) || meta.characters < 1 || meta.characters > 10000000) throw new Error('Browser detail is not ready')
}

export async function captureBrowserDetail({ expected, readMetadata, readChunk, pause }) {
  assertExpected(expected)
  const before = await readMetadata()
  assertMetadata(before, expected)
  // Check settled DOM twice, then read twice: length alone misses same-size changes.
  await pause(2000)
  const settled = await readMetadata()
  assertMetadata(settled, expected)
  if (settled.characters !== before.characters) throw new Error('Browser DOM changed while settling; discard capture')
  async function readPass() {
    const parts = []
    for (let start = 0; start < before.characters; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, before.characters)
      const part = await readChunk(start, end)
      if (typeof part !== 'string' || part.length !== end - start || part.includes('[Truncated]')) throw new Error('Incomplete browser chunk; discard capture')
      parts.push(part)
    }
    const after = await readMetadata()
    assertMetadata(after, expected)
    if (after.characters !== before.characters) throw new Error('Browser DOM changed during capture')
    return parts.join('')
  }
  const html = await readPass()
  if (await readPass() !== html) throw new Error('Browser DOM changed between reads; discard capture')
  if (!html.startsWith('<div') || !html.endsWith('</div>')) throw new Error('Incomplete browser detail root')
  return { format: BROWSER_CAPTURE_FORMAT, ...expected, capturedAt: new Date().toISOString(), characters: html.length, chunkSize: CHUNK_SIZE, verifiedPasses: 2, html }
}

export function validateBrowserCapture(record, expected) {
  assertExpected(expected)
  if (record?.format !== BROWSER_CAPTURE_FORMAT || record.version !== expected.version || record.sourceId !== expected.sourceId || record.sourceUrl !== expected.sourceUrl) throw new Error('Browser capture identity/version mismatch')
  if (record.verifiedPasses !== 2 || record.chunkSize !== CHUNK_SIZE || !Number.isFinite(Date.parse(record.capturedAt)) || typeof record.html !== 'string' || record.characters !== record.html.length || record.html.includes('[Truncated]') || !record.html.startsWith('<div') || !record.html.endsWith('</div>')) throw new Error('Invalid/incomplete browser capture')
  return record
}
