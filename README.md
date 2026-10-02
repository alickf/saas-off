# SaaS-Off

**Four tabs. Show your stack.**

Pick the four browser-based apps you practically live in. Share the resulting card, find matching combinations and explore the leaderboard. No sign-up. Open source.

## What is built

- Searchable, categorised catalogue of 48 apps and a responsive four-slot picker.
- Order-independent combinations: all 24 permutations resolve to the same short URL.
- Persistent combination and individual-app leaderboards, plus three-out-of-four neighbours.
- One active pick per signed anonymous browser cookie. Repeats are idempotent; changes move the pick.
- Server-rendered Open Graph metadata and real 1,200 × 630 PNG previews.
- LinkedIn link sharing, image download, copy-link and editable-caption copy.
- Brand landing pages and one-slot-prefilled campaign links.
- Optional source-stack attribution without splitting the canonical page.
- MIT-licensed code, GitHub footer, app-request issue form and CI tests.

This is an initial implementation, not a deployed service. No production account, database, domain or secret has been provisioned by this repository.

## Run locally

Requires Node.js 22.16 or later. Sharp is a **build-time** dependency; the application and Worker have no third-party runtime JavaScript dependencies.

```sh
npm install
npm run dev
# http://localhost:8787
```

The local Node server uses an on-disk SQLite database at `.data/saas-off.sqlite`. It runs the same request handler as the Worker, using a small D1-compatible database adapter. This is not a replacement for a real Workers-runtime deployment test.

For a network-independent build:

```sh
SKIP_ICON_FETCH=1 npm run build
npm start
```

Local data is deliberately not seeded with fake users or votes. The leaderboard starts empty. The default social preview uses Jira, Figma, GitHub and Netlify as an illustration, without adding any picks.

## Deploy

The target is **Cloudflare Workers + D1**, not IONOS hosting. IONOS can remain the domain registrar. See [deployment instructions](docs/DEPLOYMENT.md), including the database, secret and domain configuration.

```sh
npx wrangler login
npx wrangler d1 create saas-off
# Set the returned database_id in wrangler.jsonc.
npm run db:remote
npx wrangler secret put COOKIE_SECRET
npm run deploy
```

Supply a random secret of at least 32 characters. Never commit a real secret. `SITE_URL` is optional: without it, canonical URLs use the incoming request's origin. Once the final domain exists, configure an HTTPS `SITE_URL` for consistent canonical links.

## Quality checks

```sh
npm run check
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

The Node tests cover canonicalisation, concurrent repeat submissions, moving picks, referrals, CSRF checks, cookie signatures, rate limits, server-rendered metadata, real 404s, nearest matches and PNG encoding. Playwright covers the complete desktop/mobile flow. GitHub Actions also performs a Wrangler dry run. CI outcomes are visible on the PR; committed tests are not themselves a claim that CI has passed.

The first network-enabled dependency installation creates `package-lock.json`. Review and commit it before relying on reproducible production builds; CI retains its generated lockfile as an artifact until one is checked in.

## Icons, not a public URL fetcher

Icon sources are explicitly curated in `src/catalogue.js`. The build tries first-party icon URLs, caches successful assets and rasterises everything into same-origin PNGs. It can read common PNG-backed and 32-bit ICO files. Larger available icon sources are preferred where configured.

If a source is unavailable, the build uses a Font Awesome Brands glyph, the attributed Netlify fallback, or a visibly recognisable initial badge. It does not silently pretend that every favicon was fetched. Review `dist/icon-provenance.json` before launch, replace low-quality/misleading fallbacks, and consult the owners' brand rules. See [brand asset notes](BRAND-ASSETS.md).

```sh
REFRESH_ICONS=1 npm run build
```

There is no runtime endpoint that fetches user-supplied domains, URLs, images or fonts. There is no third-party favicon hotlinking or browser-history access.

## How sharing works

Sorted, immutable app IDs form a unique combination key. A 96-bit SHA-256 prefix gives the 16-character URL-safe ID; the database also enforces unique keys and rejects any detected ID collision. `/s/:id` is the canonical short page. No URL-shortener service is involved.

The server supplies OG tags in the first HTML response. `/og/:id.png?v=1` combines pre-rasterised trusted app tiles and a stable background into a PNG using native compression. Fonts and images are not fetched remotely at runtime, and dynamic counts are excluded from the artwork. Shared previews still depend on the receiving platform's fetch and cache behaviour.

The LinkedIn button opens a **link post**, not a native uploaded image post, and does not prefill the LinkedIn composer text. Use Copy caption and Save image for that alternative. There is no LinkedIn login, OAuth, posting API or scraping.

## Counts and privacy

An anonymous signed cookie records one active browser pick. It is not a verified human identity: clearing cookies, using another browser, automated traffic or distributed abuse can create additional picks. Do not label the totals “unique users” or market share.

Counts cover active picks from the last 180 days, with daily expiry housekeeping. New visitors do not get a cookie until they submit. An IP-derived keyed rate bucket limits submission frequency; raw IP addresses are not stored by the app. The host can have separate infrastructure-level data processing.

## Project structure

```text
public/         Responsive browser UI and static shell
src/            Catalogue, combination rules, Worker handler and PNG compositor
scripts/        Build-time icons/artwork and local SQLite development adapter
migrations/     D1 schema
test/          Unit/integration and Playwright browser tests
docs/          Deployment and architecture notes
```

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Application code is MIT-licensed; brand assets are not included in that grant.
