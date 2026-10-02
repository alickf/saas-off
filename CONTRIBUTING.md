# Contributing

Open an issue before changing the core product contract: exactly four distinct apps, order independence, no sign-up and one canonical page per combination.

For a new app, add its immutable ID, name, category, aliases and approved first-party icon sources to `src/catalogue.js`. Never rename a published ID; changing it splits existing combinations. Do not add user-supplied URL fetching to the public API.

Run `npm run build`, `npm run check`, `npm test` and `npm run test:e2e`. Review desktop/mobile output and the OG PNG. Do not seed real deployments with fake votes, commit secrets or include copyrighted assets without checking their permitted use.

Send a pull request against `main`. Keep schema migrations additive and document operational changes. See `SECURITY.md` for vulnerability reporting.
