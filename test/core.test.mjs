import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalise, combination, isStackId } from '../src/domain.js';
import { APPS } from '../src/catalogue.js';
import { encodePng, placeTile } from '../src/png.js';
import { handle } from '../src/worker.js';
import { localDatabase } from '../scripts/db.mjs';
const ids = ['jira', 'figma', 'github', 'netlify'];
const origin = 'https://saas-off.test';
function fixture(t) {
  const DB = localDatabase(); t.after(() => DB.close());
  return { DB, COOKIE_SECRET: 'test-secret-that-is-not-used-in-production-1234567890', ASSETS: { async fetch(request) {
    const name = new URL(request.url).pathname;
    const file = path.resolve(import.meta.dirname, '../dist', '.' + name);
    const body = await fs.readFile(file);
    return new Response(body, { headers: { 'content-type': name.endsWith('.bin') ? 'application/octet-stream' : 'text/html; charset=utf-8' } });
  } } };
}
function post(apps, cookie, from, options = {}) {
  return new Request(origin + '/api/picks', { method: 'POST', headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie } : {}), ...options.headers }, body: JSON.stringify({ apps, from }) });
}
function cookieFrom(response) { return response.headers.get('set-cookie')?.split(';')[0]; }
function permutations(input) { return input.length ? input.flatMap((value, i) => permutations(input.filter((_, j) => j !== i)).map(rest => [value, ...rest])) : [[]]; }
function decodePng(bytes) {
  const data = Buffer.from(bytes); const width = data.readUInt32BE(16), height = data.readUInt32BE(20);
  const chunks = []; let pos = 8;
  while (pos < data.length) { const size = data.readUInt32BE(pos); if (data.toString('ascii', pos + 4, pos + 8) === 'IDAT') chunks.push(data.subarray(pos + 8, pos + 8 + size)); pos += size + 12; }
  return { width, height, raw: inflateSync(Buffer.concat(chunks)) };
}

test('all 24 permutations resolve to exactly one stable combination ID', async () => {
  const results = await Promise.all(permutations(ids).map(combination));
  assert.equal(new Set(results.map(r => r.id)).size, 1); assert.equal(new Set(results.map(r => r.key)).size, 1);
  assert.ok(isStackId(results[0].id)); assert.deepEqual(ids, ['jira','figma','github','netlify']);
});
test('only four distinct catalogue IDs are accepted', () => {
  for (const value of [null, 'jira', [], ids.slice(0, 3), [...ids, 'slack'], ['jira','jira','figma','github'], ['jira','figma','github','unknown'], ['jira','figma','github',{ id:'netlify' }]]) assert.throws(() => normalise(value));
  assert.equal(new Set(APPS.map(a => a.id)).size, APPS.length);
});
test('two different browsers picking the same four reuse the page and count twice', async t => {
  const env = fixture(t);
  const first = await handle(post(ids), env); const a = await first.json();
  const second = await handle(post([...ids].reverse()), env); const b = await second.json();
  assert.equal(first.status, 200); assert.equal(a.id, b.id); assert.equal(b.picks, 2);
  assert.notEqual(cookieFrom(first), cookieFrom(second)); assert.match(cookieFrom(first), /^so_visitor=/);
  assert.match(first.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/); assert.match(first.headers.get('set-cookie'), /Secure/);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM stacks').first()).n, 1);
});
test('repeat and concurrent submissions from a browser do not inflate counts', async t => {
  const env = fixture(t); const first = await handle(post(ids), env); const cookie = cookieFrom(first);
  const repeats = await Promise.all(Array.from({ length: 8 }, () => handle(post([...ids].reverse(), cookie), env)));
  for (const result of repeats) { const data = await result.json(); assert.equal(data.picks, 1); assert.equal(data.unchanged, true); assert.equal(result.headers.get('set-cookie'), null); }
});
test('changing four apps moves rather than adds the browser pick', async t => {
  const env = fixture(t); const first = await handle(post(ids), env); const cookie = cookieFrom(first); const a = await first.json();
  const second = await handle(post(['jira','figma','github','cloudflare'], cookie), env); const b = await second.json();
  assert.equal(b.moved, true); assert.equal(b.picks, 1); assert.notEqual(b.id, a.id);
  const old = await handle(new Request(origin + '/api/stacks/' + a.id), env);
  assert.equal((await old.json()).picks, 0);
  const board = await (await handle(new Request(origin + '/api/leaderboard'), env)).json();
  assert.equal(board.stats.picks, 1); assert.equal(board.stats.combinations, 1); assert.equal(board.apps.length, 4);
});
test('views, HEAD requests and sharing crawlers do not create picks', async t => {
  const env = fixture(t); const response = await handle(post(ids), env); const stack = await response.json();
  for (const method of ['GET','HEAD']) {
    const page = await handle(new Request(origin + '/s/' + stack.id + '?from=anything', { method, headers: { 'user-agent': 'LinkedInBot' } }), env);
    assert.equal(page.status, 200); assert.equal(page.headers.get('set-cookie'), null);
    const text = await page.text();
    if (method === 'HEAD') assert.equal(text, '');
    else { assert.match(text, /property="og:image"/); assert.match(text, new RegExp(`/og/${stack.id}.png`)); assert.match(text, /width" content="1200/); assert.ok(!text.includes('<!--SEO-->')); assert.ok(!text.includes('so_visitor')); assert.ok(!text.includes('?from=anything')); }
  }
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM picks').first()).n, 1);
});
test('nearest matches have exactly three apps in common', async t => {
  const env = fixture(t); const base = await (await handle(post(ids), env)).json();
  const match = await (await handle(post(['jira','figma','github','cloudflare']), env)).json();
  await handle(post(['jira','figma','slack','notion']), env);
  const details = await (await handle(new Request(origin + '/api/stacks/' + base.id), env)).json();
  assert.deepEqual(details.neighbours.map(n => n.id), [match.id]);
});
test('brand filtering only includes combinations containing that app', async t => {
  const env = fixture(t); await handle(post(ids), env); await handle(post(['jira','slack','github','cloudflare']), env);
  const board = await (await handle(new Request(origin + '/api/leaderboard?app=netlify'), env)).json();
  assert.equal(board.stacks.length, 1); assert.ok(board.stacks[0].apps.some(a => a.id === 'netlify'));
});
test('referral source is retained separately and cannot create a duplicate combination', async t => {
  const env = fixture(t); const base = await (await handle(post(ids), env)).json();
  await handle(post(['jira','figma','github','cloudflare'], null, base.id), env);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM picks WHERE source_stack_id=?').bind(base.id).first()).n, 1);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM stacks').first()).n, 2);
});
test('invalid, oversized and cross-origin submissions are rejected', async t => {
  const env = fixture(t);
  assert.equal((await handle(post(['jira','jira','figma','github']), env)).status, 400);
  assert.equal((await handle(post(ids, null, null, { headers: { origin: 'https://evil.test' } }), env)).status, 403);
  assert.equal((await handle(new Request(origin + '/api/picks', { method:'POST', headers:{ origin, 'content-type':'application/json' }, body: 'x'.repeat(5000) }), env)).status, 413);
  assert.equal((await handle(new Request(origin + '/api/picks', { method:'POST', headers:{ origin, 'content-type':'text/plain' }, body:'{}' }), env)).status, 415);
  assert.equal((await handle(post(ids), { ...env, COOKIE_SECRET: '' })).status, 503);
});
test('forged cookie signatures cannot claim an existing browser identity', async t => {
  const env = fixture(t); const first = await handle(post(ids), env); const cookie = cookieFrom(first);
  const forged = cookie.slice(0, -3) + 'BAD';
  const response = await handle(post(ids, forged), env);
  assert.ok(response.headers.get('set-cookie')); assert.equal((await response.json()).picks, 2);
});
test('rate limit blocks excessive submissions without storing raw IPs', async t => {
  const env = fixture(t);
  for (let n = 0; n < 20; n++) assert.equal((await handle(post(ids), env)).status, 200);
  const response = await handle(post(ids), env); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60');
  const bucket = await env.DB.prepare('SELECT * FROM rate_limits').first(); assert.match(bucket.bucket, /^[A-Za-z0-9_-]{43}$/);
});
test('unknown pages and stacks are real 404s with noindex', async t => {
  const env = fixture(t);
  const response = await handle(new Request(origin + '/s/AAAAAAAAAAAAAAAA'), env); assert.equal(response.status, 404); assert.match(await response.text(), /noindex/);
  assert.equal((await handle(new Request(origin + '/api/stacks/bad'), env)).status, 404);
  assert.equal((await handle(new Request(origin + '/api/no-such-route'), env)).status, 404);
});
test('security headers cover pages and API responses', async t => {
  const env = fixture(t); const response = await handle(new Request(origin + '/'), env);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
});
test('PNG encoder roundtrips pixels and dimensions', async () => {
  const pixels = new Uint8Array([255,0,0, 0,255,0, 0,0,255, 255,255,255]);
  const png = await encodePng(pixels, 2, 2); const decoded = decodePng(png);
  assert.equal(decoded.width, 2); assert.equal(decoded.height, 2);
  assert.deepEqual([...decoded.raw], [0,255,0,0,0,255,0,0,0,0,255,255,255,255]);
  await assert.rejects(() => encodePng(pixels, 3, 3));
});
test('tile compositor places app artwork in the canonical slot', () => {
  const base = new Uint8Array(1200 * 630 * 3); const tile = new Uint8Array(252 * 224 * 3).fill(123);
  placeTile(base, tile, 2); assert.equal(base[((280 * 1200) + 612) * 3], 123); assert.equal(base[0], 0);
});
test('OG endpoint returns a real 1200 × 630 PNG with no new picks', async t => {
  const env = fixture(t); const stack = await (await handle(post(ids), env)).json();
  const response = await handle(new Request(origin + `/og/${stack.id}.png?v=1`), env);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
  const png = decodePng(await response.arrayBuffer()); assert.equal(png.width, 1200); assert.equal(png.height, 630);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM picks').first()).n, 1);
});
