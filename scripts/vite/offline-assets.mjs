import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const worker = require.resolve('tesseract.js/dist/worker.min.js')
const coreDirectory = path.dirname(require.resolve('tesseract.js-core'))
const runtime = new Map([['worker.min.js', worker]])
for (const variant of ['', '-simd', '-relaxedsimd']) {
  for (const extension of ['wasm.js', 'wasm']) {
    const name = `tesseract-core${variant}-lstm.${extension}`
    runtime.set(name, path.join(coreDirectory, name))
  }
}
runtime.set('LICENSE-tesseract-core', path.join(coreDirectory, 'LICENSE'))
runtime.set('LICENSE-tesseract-js', path.join(path.dirname(worker), '../LICENSE.md'))

export function offlineAssets() {
  let outputDirectory
  let build = false
  return {
    name: 'tangerine-offline-assets',
    configResolved(config) { outputDirectory = path.resolve(config.root, config.build.outDir); build = config.command === 'build' },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname
        if (!pathname.startsWith('/ocr-runtime/')) return next()
        const file = runtime.get(pathname.slice('/ocr-runtime/'.length))
        if (!file) { res.statusCode = 404; res.end(); return }
        try {
          res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/javascript')
          res.end(await readFile(file))
        } catch (error) { next(error) }
      })
    },
    async generateBundle() {
      for (const [name, file] of runtime) {
        this.emitFile({ type: 'asset', fileName: `ocr-runtime/${name}`, source: await readFile(file) })
      }
    },
    async closeBundle() {
      // 所有静态产物（包括 public 模板）共同决定缓存版本。
      if (!build) return
      const hash = createHash('sha256')
      async function visit(directory) {
        const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
        for (const entry of entries) {
          const file = path.join(directory, entry.name)
          if (entry.isDirectory()) await visit(file)
          else if (file !== path.join(outputDirectory, 'sw.js')) {
            hash.update(path.relative(outputDirectory, file).replaceAll('\\', '/'))
            hash.update(await readFile(file))
          }
        }
      }
      await visit(outputDirectory)
      const target = path.join(outputDirectory, 'sw.js')
      const source = await readFile(target, 'utf8')
      hash.update(source)
      await writeFile(target, source.replace('__BUILD_VERSION__', hash.digest('hex').slice(0, 20)))
    },
  }
}
