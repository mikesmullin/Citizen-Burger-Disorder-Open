// server.mjs — dev server for the CBD museum, run with Bun:
//
//   bun server.mjs            # port 8765 (matches the old python3 -m http.server)
//   bun server.mjs 9000       # custom port
//
// Serves ./public with caching disabled on every response, so edited JS
// modules are never served stale from the browser's heuristic cache.

import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stat } from 'node:fs/promises'

const root = normalize(join(fileURLToPath(new URL('.', import.meta.url)), 'public'))
const port = Number(process.argv[2] || 8765)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

function noCacheHeaders() {
  const h = new Headers()
  h.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  h.set('Pragma', 'no-cache')
  h.set('Expires', '0')
  return h
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    let pathname
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }
    if (pathname === '/') pathname = '/index.html'

    const filePath = normalize(join(root, pathname))
    if (filePath !== root && !filePath.startsWith(root + '/')) {
      return new Response('Forbidden', { status: 403 })
    }

    let target = filePath
    const st = await stat(filePath).catch(() => null)
    if (st?.isDirectory()) target = join(filePath, 'index.html')

    const file = Bun.file(target)
    if (!(await file.exists())) {
      return new Response('Not found', { status: 404 })
    }

    const headers = noCacheHeaders()
    headers.set('Content-Type', MIME[extname(target).toLowerCase()] ?? 'application/octet-stream')
    return new Response(file, { status: 200, headers })
  },
})

console.log(`CBD serving ${root} at http://127.0.0.1:${port}/ (no-cache)`)
