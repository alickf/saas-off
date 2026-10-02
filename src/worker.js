import { APPS, APP_MAP, EXAMPLE_IDS } from './catalogue.js';
import { combination, HttpError, isStackId, escapeHtml as esc, publicApp, base64url } from './domain.js';
import { socialImage } from './png.js';
import { cachedLeaderboard } from './cache.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const all = async stmt => (await stmt.all()).results || [];
const readStack = (db, id) => db.prepare('SELECT s.*, (SELECT COUNT(*) FROM picks p WHERE p.stack_id=s.id) AS picks FROM stacks s WHERE s.id=?').bind(id).first();
function serialise(row) {
  return { id: row.id, apps: JSON.parse(row.apps_json).map(id => publicApp(APP_MAP.get(id))), picks: row.picks, createdAt: row.created_at };
}
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
function timingEqual(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function identity(request, secret) {
  const raw = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('so_visitor='))?.slice(11);
  if (raw && /^[a-f0-9-]{36}\.[0-9]{10}\.[A-Za-z0-9_-]{43}$/.test(raw)) {
    const [id, issued, signature] = raw.split('.');
    const age = Math.floor(Date.now() / 1000) - Number(issued);
    if (age >= 0 && age < 60 * 60 * 24 * 180 && timingEqual(await hmac(secret, `${id}.${issued}`), signature)) {
      return { hash: await hmac(secret, `visitor:${id}`), cookie: null };
    }
  }
  const id = crypto.randomUUID();
  const issued = Math.floor(Date.now() / 1000);
  const signature = await hmac(secret, `${id}.${issued}`);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return { hash: await hmac(secret, `visitor:${id}`), cookie: `so_visitor=${id}.${issued}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${secure}` };
}
async function bodyJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A request body is required.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Invalid JSON.'); }
}
async function rateLimit(request, env) {
  const now = Math.floor(Date.now() / 1000);
  const minute = Math.floor(now / 60);
  // CF-Connecting-IP is supplied by Cloudflare, not a browser-controlled header in production.
  // No raw IP address is persisted. Salt changes daily and buckets expire after 10 minutes.
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = await hmac(env.COOKIE_SECRET, `rate:${Math.floor(now / 86400)}:${minute}:${ip}`);
  const accepted = await env.DB.prepare(`INSERT INTO rate_limits(bucket,requests,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET requests=requests+1 WHERE requests<20 RETURNING requests`).bind(bucket, now + 600).first();
  if (!accepted) throw new HttpError(429, 'Too many picks in a short time. Please try again in a minute.');
}
async function submit(request, env) {
  if (!env.COOKIE_SECRET || env.COOKIE_SECRET.length < 32) throw new HttpError(503, 'The app is not configured for submissions yet.');
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) throw new HttpError(403, 'Submissions must come from this site.');
  const input = await bodyJson(request);
  const stack = await combination(input.apps);
  await rateLimit(request, env);
  const visitor = await identity(request, env.COOKIE_SECRET);
  const old = await env.DB.prepare('SELECT stack_id FROM picks WHERE visitor_hash=?').bind(visitor.hash).first();
  let source = null;
  if (isStackId(input.from) && input.from !== stack.id && await readStack(env.DB, input.from)) source = input.from;
  const existing = await env.DB.prepare('SELECT combination_key FROM stacks WHERE id=?').bind(stack.id).first();
  if (existing && existing.combination_key !== stack.key) throw new HttpError(409, 'This combination could not be saved. Please report this issue.');
  // D1 batch is transactional. One active pick per signed browser cookie; changing it moves the pick.
  const statements = [env.DB.prepare('INSERT INTO stacks(id,combination_key,apps_json) VALUES(?,?,?) ON CONFLICT(combination_key) DO NOTHING').bind(stack.id, stack.key, JSON.stringify(stack.apps))];
  for (const app of stack.apps) statements.push(env.DB.prepare('INSERT OR IGNORE INTO stack_apps(stack_id,app_id) VALUES(?,?)').bind(stack.id, app));
  statements.push(env.DB.prepare(`INSERT INTO picks(visitor_hash,stack_id,source_stack_id) VALUES(?,?,?)
    ON CONFLICT(visitor_hash) DO UPDATE SET stack_id=excluded.stack_id,
    source_stack_id=COALESCE(picks.source_stack_id,excluded.source_stack_id),updated_at=unixepoch()`)
    .bind(visitor.hash, stack.id, source));
  await env.DB.batch(statements);
  const saved = await readStack(env.DB, stack.id);
  return json({ ...serialise(saved), unchanged: old?.stack_id === stack.id, moved: Boolean(old && old.stack_id !== stack.id) }, 200, visitor.cookie ? { 'set-cookie': visitor.cookie } : {});
}
async function stackDetails(db, id) {
  if (!isStackId(id)) throw new HttpError(404, 'That stack does not exist.');
  const row = await readStack(db, id);
  if (!row) throw new HttpError(404, 'That stack does not exist.');
  const ids = JSON.parse(row.apps_json);
  const neighbours = await all(db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM picks p WHERE p.stack_id=s.id) AS picks
    FROM stacks s JOIN stack_apps a ON a.stack_id=s.id
    WHERE a.app_id IN (?,?,?,?) AND s.id<>? AND EXISTS(SELECT 1 FROM picks p WHERE p.stack_id=s.id)
    GROUP BY s.id HAVING COUNT(*)=3 ORDER BY picks DESC,s.created_at ASC LIMIT 6`).bind(...ids, id));
  const rank = row.picks > 0 ? await db.prepare(`SELECT COUNT(*)+1 AS rank FROM
    (SELECT stack_id, COUNT(*) AS n FROM picks GROUP BY stack_id HAVING n>?)`).bind(row.picks).first() : { rank: null };
  return { ...serialise(row), rank: rank.rank, neighbours: neighbours.map(serialise) };
}
async function leaderboard(db, appId) {
  if (appId && !APP_MAP.has(appId)) throw new HttpError(404, 'App not found.');
  const filter = appId ? 'WHERE EXISTS(SELECT 1 FROM stack_apps sa WHERE sa.stack_id=s.id AND sa.app_id=?)' : '';
  const statement = db.prepare(`SELECT s.*,COUNT(p.visitor_hash) AS picks FROM stacks s
    JOIN picks p ON p.stack_id=s.id ${filter} GROUP BY s.id ORDER BY picks DESC,s.created_at ASC LIMIT 30`);
  const stacks = await all(appId ? statement.bind(appId) : statement);
  const apps = await all(db.prepare(`SELECT sa.app_id AS id,COUNT(p.visitor_hash) AS picks FROM stack_apps sa
    JOIN picks p ON p.stack_id=sa.stack_id GROUP BY sa.app_id ORDER BY picks DESC,sa.app_id ASC LIMIT 48`));
  const stats = await db.prepare('SELECT COUNT(*) AS picks,COUNT(DISTINCT stack_id) AS combinations FROM picks').first();
  return { stacks: stacks.map(serialise), apps: apps.map(a => ({ ...publicApp(APP_MAP.get(a.id)), picks: a.picks })), stats };
}
function originFor(request, env) {
  if (!env.SITE_URL) return new URL(request.url).origin;
  const value = new URL(env.SITE_URL);
  if (value.protocol !== 'https:') throw new Error('SITE_URL must be an HTTPS origin.');
  return value.origin;
}
async function page(request, env, path) {
  let title = 'SaaS-Off — Only four tabs. Choose wisely.';
  let description = 'If you could only keep four apps open, which would you choose? Pick your favourites, share your line-up and see which SaaS product leads the pack. No sign-up.';
  let initial = null; let status = 200;
  const origin = originFor(request, env);
  let image = `${origin}/og/default.png`;
  let canonicalPath = path;
  if (path.startsWith('/s/')) {
    try { initial = await stackDetails(env.DB, path.slice(3)); }
    catch (error) { if (!(error instanceof HttpError)) throw error; status = error.status; initial = { error: error.message }; }
    if (status === 200) {
      const names = initial.apps.map(a => a.name).join(' + ');
      title = `${names} — SaaS-Off`;
      description = `These are my four. ${names}. Only four tabs. Which apps make the cut? Pick your four — no sign-up.`;
      image = `${origin}/og/${initial.id}.png?v=2`;
    }
  } else if (path.startsWith('/apps/')) {
    const app = APP_MAP.get(path.slice(6));
    if (!app) { status = 404; initial = { error: 'App not found.' }; }
    else { initial = { app: publicApp(app) }; title = `${app.name}: did we make your four? — SaaS-Off`; description = `Explore stacks containing ${app.name}, then choose the other three apps in yours.`; }
  } else if (path === '/leaderboard') title = 'The leaderboard — SaaS-Off';
  else if (path === '/about') title = 'About the experiment — SaaS-Off';
  else if (path === '/privacy') title = 'Privacy — SaaS-Off';
  else if (path !== '/') { status = 404; initial = { error: 'Page not found.' }; }
  if (status !== 200) title = 'Page not found — SaaS-Off';
  const shell = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
  if (!shell.ok) throw new Error('App build is missing.');
  const seo = `<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(origin + canonicalPath)}">
    <meta property="og:type" content="website"><meta property="og:site_name" content="SaaS-Off"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(origin + canonicalPath)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(initial?.apps ? initial.apps.map(a => a.name).join(', ') + ' — my four everyday apps' : 'SaaS-Off. Only four tabs. Choose wisely.')}"><meta name="twitter:card" content="summary_large_image">${status !== 200 ? '<meta name="robots" content="noindex">' : ''}`;
  const bootstrap = JSON.stringify(initial).replaceAll('<', '\\u003c');
  const html = (await shell.text()).replace('<!--SEO-->', seo).replace('<!--INITIAL-->', `<script id="initial-data" type="application/json">${bootstrap}</script>`);
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function route(request, env, ctx) {
  const url = new URL(request.url); const path = url.pathname;
  if (request.method === 'POST' && path === '/api/picks') return submit(request, env);
  if (!['GET', 'HEAD'].includes(request.method)) throw new HttpError(405, 'Method not allowed.');
  if (path === '/api/catalogue') return json(APPS.map(publicApp));
  if (path === '/api/leaderboard') return cachedLeaderboard(request, env.IMAGE_CACHE, ctx, url.searchParams.get('app'), () => leaderboard(env.DB, url.searchParams.get('app')));
  if (path.startsWith('/api/stacks/')) return json(await stackDetails(env.DB, path.slice(12)));
  if (path.startsWith('/api/')) throw new HttpError(404, 'Endpoint not found.');
  if (path.startsWith('/og/')) {
    const id = path.slice(4).replace(/\.png$/, '');
    if (!path.endsWith('.png')) throw new HttpError(404, 'Image not found.');
    if (id !== 'default' && !isStackId(id)) throw new HttpError(404, 'Image not found.');
    // Immutable artwork does not need a database read on a cache hit.
    // Ignore arbitrary query strings/cookies; bump the version whenever the art changes.
    const cacheKey = new Request(`${url.origin}/og/${id}.png?v=2`);
    const cache = env.IMAGE_CACHE;
    let cached;
    try { cached = cache ? await cache.match(cacheKey) : null; } catch { /* Cache is optional. */ }
    if (cached) return cached;
    let ids = [...EXAMPLE_IDS].sort();
    if (id !== 'default') {
      const row = await env.DB.prepare('SELECT apps_json FROM stacks WHERE id=?').bind(id).first();
      if (!row) throw new HttpError(404, 'Image not found.');
      ids = JSON.parse(row.apps_json);
    }
    const bytes = await socialImage(ids, env.ASSETS, url.origin);
    const response = new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400', 'content-disposition': `inline; filename="saas-off-${id}.png"` } });
    if (cache) {
      const write = cache.put(cacheKey, response.clone()).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(write); else await write;
    }
    return response;
  }
  if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /\nDisallow: /api/\n', { headers: { 'content-type': 'text/plain' } });
  if (path.includes('.') && !path.startsWith('/s/') && !path.startsWith('/apps/')) return env.ASSETS.fetch(request);
  return page(request, env, path);
}
export async function handle(request, env, ctx) {
  let response;
  try { response = await route(request, env, ctx); }
  catch (error) {
    const known = error instanceof HttpError;
    // Do not log cookies, raw requests, IP addresses or request bodies.
    if (!known) console.error('SaaS-Off request failed:', error?.message || 'Unknown error');
    response = json({ error: known ? error.message : 'Something went wrong. Please try again.' }, known ? error.status : 500,
      error?.status === 429 ? { 'retry-after': '60' } : {});
  }
  const secured = new Response(request.method === 'HEAD' ? null : response.body, response);
  for (const [name, value] of Object.entries(SECURITY)) secured.headers.set(name, value);
  return secured;
}
export default {
  fetch(request, env, ctx) {
    return handle(request, { ...env, IMAGE_CACHE: caches.default }, ctx);
  },
  async scheduled(_event, env) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),
      // A pick expires with the 180-day cookie lifetime: disclose this on the leaderboard.
      env.DB.prepare('DELETE FROM picks WHERE updated_at<?').bind(now - 15552000)
    ]);
  }
};
