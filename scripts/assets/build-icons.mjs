import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { writeFile, mkdir } from 'node:fs/promises'

// favicon.svg is the editable source for all app and desktop icon exports.
const source = new URL('../../public/favicon.svg', import.meta.url)
const output = new URL('../../public/icons/', import.meta.url)
await mkdir(output, { recursive: true })
for (const size of [180, 192, 512, 1024]) {
  await sharp(fileURLToPath(source)).resize(size, size)
    .png().toFile(fileURLToPath(new URL(`tangerine-tools-${size}.png`, output)))
}
const maskable = await sharp(fileURLToPath(source)).resize(400, 400).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ff8008' } })
  .composite([{ input: maskable, left: 56, top: 56 }]).png()
  .toFile(fileURLToPath(new URL('tangerine-tools-maskable.png', output)))
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = await Promise.all(sizes.map((size) => sharp(fileURLToPath(source)).resize(size, size).png().toBuffer()))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
images.forEach((data, index) => {
  const start = 6 + index * 16
  header[start] = header[start + 1] = sizes[index] === 256 ? 0 : sizes[index]
  header.writeUInt16LE(1, start + 4)
  header.writeUInt16LE(32, start + 6)
  header.writeUInt32LE(data.length, start + 8)
  header.writeUInt32LE(offset, start + 12)
  offset += data.length
})
await writeFile(new URL('tangerine-tools.ico', output), Buffer.concat([header, ...images]))
console.log('Exported app PNGs, maskable icon and seven-size Windows ICO.')
