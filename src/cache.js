import { APP_MAP } from './catalogue.js';
import { HttpError } from './domain.js';

/** Public rankings only. Picks and browser-specific responses must never be cached.
 * Reads may lag by 30 seconds; voting still commits transactionally in D1.
 */
export async function cachedLeaderboard(request, cache, ctx, appId, load) {
  if (appId && !APP_MAP.has(appId)) throw new HttpError(404, 'App not found.');
  const url = new URL(request.url);
  // Only a validated catalogue ID may vary the key; referrals, cookies and junk
  // query parameters cannot create unbounded cache variants.
  const key = new Request(`${url.origin}/api/leaderboard?app=${appId || 'all'}&v=1`);
  try {
    const hit = cache ? await cache.match(key) : null;
    if (hit) return hit;
  } catch { /* A cache miss/outage must not break the leaderboard. */ }
  const response = new Response(JSON.stringify(await load()), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=30' }
  });
  if (cache) {
    const write = cache.put(key, response.clone()).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(write); else await write;
  }
  return response;
}
