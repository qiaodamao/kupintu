/**
 * 极简静态服务器：本地预览 out/ 产物
 * 用法：node scripts/serve.mjs [port]
 */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out')
const port = Number(process.argv[2] ?? 3222)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

http
  .createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
      if (!urlPath.endsWith('/')) urlPath += '/'
      let file = path.join(root, urlPath, 'index.html')
      const data = await readFile(file)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
      res.end(data)
    } catch {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        const file = path.join(root, urlPath)
        const data = await readFile(file)
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' })
        res.end(data)
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('404')
      }
    }
  })
  .listen(port, () => {
    console.log(`静态预览已启动: http://localhost:${port}/`)
  })
