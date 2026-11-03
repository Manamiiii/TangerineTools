import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const directory = path.resolve('artifacts/desktop/release')
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const names = (await readdir(directory)).filter(name => name === `TangerineTools-${manifest.version}-win-x64-Setup.exe`)
if (names.length !== 1) throw new Error('Build the current Windows installer before generating checksums.')
const records = []
for (const name of names) {
  const bytes = await readFile(path.join(directory, name))
  records.push({ file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
await writeFile(path.join(directory, 'SHA256SUMS.txt'), records.map(record => `${record.sha256}  ${record.file}`).join('\n') + '\n')
await writeFile(path.join(directory, 'artifacts.json'), JSON.stringify({ version: manifest.version, artifacts: records }, null, 2))
console.log(JSON.stringify(records))
