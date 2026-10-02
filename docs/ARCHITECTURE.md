# Architecture

A small framework-free browser application calls a Worker API. The same Fetch handler runs in local Node development against a SQLite adapter. Build-time dependencies do not ship as browser or Worker runtime dependencies.

## Data model

- `stacks`: stable 96-bit URL-safe ID, unique sorted app-key, JSON array and creation time.
- `stack_apps`: indexed many-to-many projection for individual app totals and nearest matches.
- `picks`: one current stack per anonymous visitor hash, optional referral stack and timestamps.
- `rate_limits`: short-lived keyed counters. No raw IPs or cookie values.

Database batches are transactional. Counts are computed from the picks table rather than incremented in separate, race-prone operations. Pick changes therefore cannot leave a stale manually-maintained counter. SQL parameters are bound, not concatenated from submitted values.

## URLs

| Route | Purpose |
| --- | --- |
| `/` | Picker |
| `/s/:id` | Canonical combination page with server OG metadata |
| `/og/:id.png?v=1` | Public raster preview; views never vote |
| `/leaderboard` | Combination and individual-app leaderboards |
| `/apps/:appId` | Independent brand community page |
| `/?app=:appId` | Prefill a brand's slot |
| `/?from=:stackId` | Attribute a new picker visit to a source stack |
| `/api/picks` | Same-origin JSON POST; validate and save/move a pick |
| `/api/stacks/:id` | Public counts, rank and three-of-four neighbours |
| `/api/leaderboard?app=:appId` | Public aggregates, optionally brand-filtered |

## Raster preview pipeline

The build resolves trusted icon sources and rasterises them with Sharp. Font Awesome Brands is an attributed fallback, not a claim of first-party download. Text and icons are rasterised into a background and per-app RGB tiles, compressed into `.bin` static assets. No font files are copied into the repository or deployment.

The Worker reads the background and four tiles, decompresses them using platform APIs, places tiles in canonical app-ID order and encodes a valid PNG using native `CompressionStream`. This removes runtime image-library, browser-renderer, remote-font and untrusted-image-fetch dependencies. The PNG endpoint is independent of whether a human browser previously visited the combination.

## Boundaries and known limitations

- No browser extension, history access or automated measurement of actual tab frequency.
- No account, verified identity, LinkedIn API, auto-posting, arbitrary website search or live icon scraping.
- Catalogue search is over curated apps; a GitHub issue is the missing-app path.
- Cookie-based deduplication is approximate and can be bypassed with new cookies. Rate limits cannot defeat a determined distributed attacker.
- One active pick per browser is a product decision: changing a stack moves the vote, rather than allowing one browser to endorse many combinations.
- Leaderboard counts exclude expired picks after daily housekeeping; they are not lifetime unique users.
- Rankings share the same rank for ties on a result page. The leaderboard's row number is a display position with creation-time tie-breaking.
- Icons can fail or be small. Check the build provenance and the actual output before public promotion.
- The SHA-256 prefix is a URL identifier, not a security or identity guarantee. A conflicting stored key is rejected rather than silently merged.
- Cloudflare D1/Worker runtime, custom-domain routing and real LinkedIn fetches require deployment smoke testing beyond the Node adapter tests.
