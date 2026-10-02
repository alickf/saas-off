import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { localDatabase } from './db.mjs';
import { handle } from '../src/worker.js';
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
await fs.mkdir(path.join(root, '.data'), { recursive: true });
const port = Number(process.env.PORT || 8787);
const db = localDatabase(process.env.DB_PATH || path.join(root, '.data', 'saas-off.sqlite'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.bin': 'application/octet-stream', '.json': 'application/json' };
export const assets = {
  async fetch(request) {
    let file;
    try { file = path.resolve(dist, '.' + decodeURIComponent(new URL(request.url).pathname)); } catch { return new Response('Not found', { status: 404 }); }
    if (!file.startsWith(dist + path.sep)) return new Response('Not found', { status: 404 });
    try { const data = await fs.readFile(file); return new Response(data, { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } }); }
    catch { return new Response('Not found', { status: 404 }); }
  }
};
const env = { DB: db, ASSETS: assets, COOKIE_SECRET: process.env.COOKIE_SECRET || 'local-development-only-secret-at-least-32-characters', SITE_URL: process.env.SITE_URL };
const server = createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    // Do not trust a developer-supplied forwarding header in the local adapter.
    headers.set('CF-Connecting-IP', req.socket.remoteAddress || '127.0.0.1');
    const options = { method: req.method, headers };
    if (!['GET', 'HEAD'].includes(req.method)) { options.body = Readable.toWeb(req); options.duplex = 'half'; }
    const request = new Request(`http://localhost:${port}${req.url}`, options);
    const response = await handle(request, env, { waitUntil: promise => promise.catch(console.error) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
  } catch { res.writeHead(500); res.end('Local server error'); }
});
server.listen(port, '0.0.0.0', () => console.log(`SaaS-Off local server: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
