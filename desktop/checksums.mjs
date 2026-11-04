import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Data, NtExecutable, NtExecutableResource, Resource } from 'resedit'

const directory = path.resolve('artifacts/desktop/release')
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const identity = JSON.parse(await readFile('desktop/config.json', 'utf8'))
const name = `TangerineTools-${manifest.version}-win-x64-Setup.exe`
const setup = await readFile(path.join(directory, name))
const application = await readFile(path.join(directory, 'win-unpacked', identity.executableName + '.exe'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const ico = Data.IconFile.from(await readFile('public/icons/tangerine-tools.ico'))
const expected = ico.icons.map(({ data }) => hash(Buffer.from(data.bin))).sort()

function verifyIcon(bytes, filename) {
  const { entries } = NtExecutableResource.from(NtExecutable.from(bytes))
  const groups = Resource.IconGroupEntry.fromEntries(entries)
  assert.equal(groups.length, 1, filename + ' must have one application icon group')
  const actual = groups[0].icons.map(({ iconID }) => {
    const entry = entries.find(entry => entry.type === 3 && entry.id === iconID && entry.lang === groups[0].lang)
    assert.ok(entry, filename + ' missing icon resource')
    return hash(Buffer.from(entry.bin))
  }).sort()
  assert.deepEqual(actual, expected, filename + ' icon differs from project ICO')
}

verifyIcon(setup, name)
verifyIcon(application, identity.executableName)
const record = { file: name, bytes: setup.length, sha256: hash(setup) }
await writeFile(path.join(directory, 'SHA256SUMS.txt'), `${record.sha256}  ${name}\n`)
await writeFile(path.join(directory, 'artifacts.json'), JSON.stringify({
  version: manifest.version, artifacts: [record], verifiedIconSizes: ico.icons.map(({ data }) => data.width),
}, null, 2))
console.log(JSON.stringify(record))
