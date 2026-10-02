import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cachedLeaderboard } from '../src/cache.js';
import { handle } from '../src/worker.js';
import { localDatabase } from '../scripts/db.mjs';
import { combination } from '../src/domain.js';

function cacheFixture() {
  let now = 0;
  const entries = new Map();
  return {
    advance: seconds => { now += seconds; },
    entries,
    async match(key) { const entry = entries.get(key.url); return entry && now < entry.expires ? entry.response.clone() : undefined; },
    async put(key, response) {
      const ttl = Number(response.headers.get('cache-control').match(/(?:s-maxage|max-age)=(\d+)/)?.[1] || 0);
      // Shared caches honour s-maxage in preference to browser max-age.
      const shared = response.headers.get('cache-control').match(/s-maxage=(\d+)/);
      entries.set(key.url, { response: response.clone(), expires: now + (shared ? Number(shared[1]) : ttl) });
    }
  };
}
const origin = 'https://saas-off.com';
const request = (suffix = '') => new Request(origin + '/api/leaderboard' + suffix);

test('leaderboard cache expires after 30 seconds and never sets a cookie', async () => {
  const cache = cacheFixture(); let calls = 0;
  const load = async () => ({ picks: ++calls });
  const first = await cachedLeaderboard(request(), cache, null, null, load);
  assert.equal((await first.json()).picks, 1);
  assert.equal(first.headers.get('set-cookie'), null);
  assert.match(first.headers.get('cache-control'), /s-maxage=30/);
  cache.advance(29);
  assert.equal((await (await cachedLeaderboard(request(), cache, null, null, load)).json()).picks, 1);
  cache.advance(1);
  assert.equal((await (await cachedLeaderboard(request(), cache, null, null, load)).json()).picks, 2);
});
test('referrals and cookies do not create leaderboard cache variants', async () => {
  const cache = cacheFixture(); let calls = 0;
  const load = async () => ({ calls: ++calls });
  await cachedLeaderboard(request('?from=one'), cache, null, null, load);
  await cachedLeaderboard(new Request(origin + '/api/leaderboard?junk=two', { headers: { cookie: 'private=value' } }), cache, null, null, load);
  assert.equal(calls, 1); assert.equal(cache.entries.size, 1);
  for (const key of cache.entries.keys()) { assert.ok(!key.includes('from')); assert.ok(!key.includes('private')); }
});
test('brand rankings have isolated cache keys and unknown brands fail closed', async () => {
  const cache = cacheFixture(); let calls = 0;
  const load = async () => ({ calls: ++calls });
  await cachedLeaderboard(request(), cache, null, null, load);
  await cachedLeaderboard(request('?app=netlify'), cache, null, 'netlify', load);
  assert.equal(cache.entries.size, 2);
  await assert.rejects(() => cachedLeaderboard(request('?app=bad'), cache, null, 'bad', load), { status: 404 });
  assert.equal(calls, 2);
});
test('failed loads and cache outages cannot poison or break the leaderboard', async () => {
  const cache = cacheFixture();
  await assert.rejects(() => cachedLeaderboard(request(), cache, null, null, async () => { throw new Error('database offline'); }));
  assert.equal(cache.entries.size, 0);
  const broken = { async match() { throw new Error('unavailable'); }, async put() { throw new Error('unavailable'); } };
  const response = await cachedLeaderboard(request(), broken, null, null, async () => ({ ok: true }));
  assert.deepEqual(await response.json(), { ok: true });
});
test('production metadata uses saas-off.com and the new challenge copy', async t => {
  const DB = localDatabase(); t.after(() => DB.close());
  const ASSETS = { async fetch() { return new Response(await fs.readFile(path.resolve(import.meta.dirname, '../public/index.html'))); } };
  const response = await handle(new Request('https://preview.workers.dev/'), { DB, ASSETS, SITE_URL: origin });
  const html = await response.text();
  assert.match(html, /Only four tabs\. Choose wisely/);
  assert.match(html, /canonical" href="https:\/\/saas-off\.com\//);
  assert.match(html, /which SaaS product leads the pack/);
  assert.doesNotMatch(html, /preview\.workers\.dev/);
});
test('a warm versioned image does not read D1 or render again', async () => {
  const cache = cacheFixture();
  const { id } = await combination(['jira', 'figma', 'github', 'netlify']);
  const key = new Request(`${origin}/og/${id}.png?v=2`);
  await cache.put(key, new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } }));
  const env = { IMAGE_CACHE: cache, DB: { prepare() { throw new Error('unexpected database read'); } }, ASSETS: { fetch() { throw new Error('unexpected image render'); } } };
  const response = await handle(new Request(`${origin}/og/${id}.png?tracking=ignored`), env);
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await response.arrayBuffer()).byteLength, 4);
});
test('the established H1 highlight and account-free picker remain in the UI', async () => {
  const js = await fs.readFile(path.resolve(import.meta.dirname, '../public/app.js'), 'utf8');
  const css = await fs.readFile(path.resolve(import.meta.dirname, '../public/styles.css'), 'utf8');
  assert.match(js, /Only four tabs\.<br><span class="highlight">Choose wisely\./);
  assert.match(js, /Lock in my four/);
  assert.match(js, /type = brandMode \? 'stacks' : 'apps'/);
  assert.match(css, /background:linear-gradient\(transparent 68%,var\(--lime\) 68%/);
});
