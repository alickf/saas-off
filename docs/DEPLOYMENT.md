# Deployment and launch checklist

## 1. Cloudflare database and Worker

This implementation uses one Cloudflare Worker with static assets and one D1 database. No Supabase, external image-rendering service, URL shortener, analytics account or LinkedIn API key is required.

1. Install Node 22.16+ and run `npm install`.
2. Run `npx wrangler login`.
3. Run `npx wrangler d1 create saas-off`.
4. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.jsonc` with the returned ID. Database IDs are not credentials.
5. Run `npm run db:remote` to apply the migration.
6. Generate a random secret, for example `openssl rand -base64 48`. Set it with `npx wrangler secret put COOKIE_SECRET`; do not paste it into a tracked file.
7. Run `npm run build`. Review `dist/icon-provenance.json` and the visual icons. Resolve unacceptable initial/parent-brand fallbacks before a public launch.
8. Run `npm test`, `npx wrangler deploy --dry-run` and `npm run test:e2e`.
9. Run `npm run deploy` and test the returned `workers.dev` URL.

For Cloudflare-runtime local testing, create `.dev.vars` (ignored by Git) containing a local-only `COOKIE_SECRET`, then run `npm run dev:worker`. The Node development server uses a known development-only secret and must not be used as the public deployment.

## 2. Your £1 IONOS domain

IONOS is the registrar, not the runtime host. Do not buy an IONOS hosting package just for this app.

Cloudflare Workers custom domains require the hostname to belong to an active Cloudflare zone in the same account. Add the domain to Cloudflare, preserve any existing DNS records, then change its authoritative nameservers at IONOS to the pair Cloudflare supplies. For a brand-new unused domain this has fewer moving parts. Changing nameservers on an existing domain can affect other services; review their records first.

In the Worker's **Settings → Domains & Routes**, add the custom domain. Test HTTPS and the complete picker flow. Set the Worker's plain-text variable `SITE_URL` to the final HTTPS origin. Keep one canonical host; configure a redirect for the alternate `www` or apex host as appropriate.

Do not point a naked DNS CNAME at `workers.dev` and assume that establishes a supported custom domain. Use Cloudflare's custom-domain setup.

No domain name is hard-coded in the application, so the exact IONOS purchase can be chosen independently.

## 3. Production smoke test

- Submit four apps, copy the result URL and open it in a second browser.
- Choose the same four in a different order. Confirm the URL is identical and the count increases once for the second browser.
- Repeat in one browser; the count must not increase. Change one app; the original pick must move.
- Inspect the first HTML response for `og:image`, `og:url` and the exact four names.
- Open the OG image directly. It must return `image/png`, 1,200 × 630 dimensions, and four correct logos/names without live counts.
- Test the canonical URL in LinkedIn's Post Inspector before announcing the site. A network-accessible Worker is required for this; localhost previews do not prove LinkedIn can fetch the deployed image.
- Verify the daily maintenance trigger, D1 availability, rate limits, unknown-route 404s and mobile layout.
- Retain a database backup/export before later schema changes. Never reset a live database to apply a migration.

## 4. Budget and scaling

Do not assume that a low-cost domain makes runtime usage free or unlimited. Review the current Workers and D1 allowances for your account, configure billing/usage alerts, and load-test a **cold** image request as well as cached image requests before a wider campaign. PNG composition consumes CPU; dynamic counts also read D1.

The edge image cache is an optimisation, not durable image storage. Cold requests can re-render from the static trusted artwork. At larger scale, consider durable image storage, stronger abuse controls, cached aggregate reads and explicit campaign attribution. CAPTCHA/Turnstile is deliberately not in the initial flow. Do not present its current abuse controls as bot-proof.

## References

- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://www.linkedin.com/post-inspector/
