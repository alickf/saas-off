# SaaS-Off

**Only four tabs. Choose wisely.**

If you could only keep four apps open, which would you choose? Pick your favourites, share your line-up and see which SaaS product leads the pack. No sign-up. Open source.

Production domain: **saas-off.com**. Runtime: **Cloudflare Workers + D1**. Domain registrar: **IONOS**. No KV, external shortener, LinkedIn API key or image service is required.

## The app

A searchable catalogue of 48 apps fills four slots. Every unordered combination has one short URL and a generated 1,200 × 630 PNG sharing card. Matching submissions reuse the page. One signed anonymous browser cookie has one active pick: repeats do not add votes, and changing the selection moves the pick.

The leaderboard opens on individual SaaS products, with a second view for combinations. Brand pages, three-out-of-four matches, LinkedIn link sharing, image download, copy-link and copy-caption actions are included. Views and preview crawlers never vote. Application code is MIT-licensed; brand assets retain their owners' rights.

## Local development

Requires Node.js 22.16+.

```sh
npm install
npm run dev
# http://localhost:8787
```

The local server uses SQLite and the real Fetch handler. It is not a production host or proof of Cloudflare CPU usage. For an offline build, run `SKIP_ICON_FETCH=1 npm run build`, then `npm start`. The leaderboard is not seeded with artificial votes.

## Deployment

Read [the launch checklist](docs/DEPLOYMENT.md) before deploying. `wrangler.jsonc` now targets the custom domain `saas-off.com`; its Cloudflare DNS zone must be active first. The D1 database ID remains a deliberate placeholder until a database is provisioned in your account.

```sh
npx wrangler login
npx wrangler d1 create saas-off
# Replace the database_id placeholder in wrangler.jsonc.
npm run db:remote
npx wrangler secret put COOKIE_SECRET
npm run deploy
```

Use a random secret of at least 32 characters. Never commit credentials. `SITE_URL` is configured as `https://saas-off.com`; the Node development server uses its local origin unless explicitly overridden. `npm run dev:worker` clears that variable for local Wrangler testing.

## Validation

```sh
npm run check
npm run build
npm test
npm run benchmark:og
npx playwright install chromium
npm run test:e2e
npx wrangler deploy --dry-run
```

The tests cover canonicalisation, idempotent submissions, moving picks, referrals, cookie signatures, CSRF, rate limits, rankings, OG output, cache isolation and expiry, production metadata and the retained H1 highlight. Browser tests exercise desktop and mobile flows. Consult the actual CI run for its result.

`benchmark:og` reports local process CPU and wall time, not Cloudflare invocation CPU. A **cold** production image must be checked against your account's runtime limits. Do not claim the app runs on the free plan merely because a build or warm cache request succeeds.

## Low-cost operation

D1 remains the source of truth for picks. Public leaderboard responses are edge-cached for 30 seconds; submissions are never cached. Immutable OG images use a versioned cache key and skip D1 and rendering on a cache hit. Neither cache is durable storage or a guarantee against cold requests.

## Brand assets

Sources are curated in `src/catalogue.js` and fetched only at build time, never from user-submitted URLs. Fallbacks are explicitly reported in `dist/icon-provenance.json`. Review the provenance and visual artwork before launch; initials and parent-company logos are not necessarily suitable app icons. `REFRESH_ICONS=1 npm run build` refreshes sources. See [BRAND-ASSETS.md](BRAND-ASSETS.md).

A fresh dependency installation currently creates a lockfile. CI retains it as an artifact; review and commit it before treating production builds as reproducible.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). The app's footer links to this repository. Missing apps can be suggested through the app-request issue template.
