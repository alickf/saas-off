# Brand assets and attribution

The MIT licence covers original SaaS-Off application code, not third-party brand names, marks or downloaded logos. Inclusion identifies the apps selected by participants; it does not claim affiliation, sponsorship, certification or endorsement.

## Sources

- First-party favicon or touch-icon URLs are recorded explicitly in `src/catalogue.js`.
- Build output `dist/icon-provenance.json` records whether each icon came from a fetched first-party URL, the local first-party cache or a fallback.
- Font Awesome Free Brands 6.7.2 provides fallback glyphs under CC BY 4.0. Source: https://fontawesome.com/ ; licence information: https://fontawesome.com/license/free . Trademark rights remain with their owners.
- The Netlify fallback path is from Simple Icons, https://github.com/simple-icons/simple-icons/blob/develop/icons/netlify.svg . Simple Icons distributes its collection under CC0 1.0; the underlying brand rights are not waived. The path is unchanged; an explicit brand-colour fill is applied.
- Where no suitable fallback glyph exists, a plain initial badge is generated. Such a badge is a placeholder, not a recreated or purported official logo.

## Before public launch

Review each owner's current asset and trademark rules. Prefer approved first-party artwork at useful resolution. Do not distort marks, add endorsement claims or assume public favicon access grants unrestricted promotional use. Replace incorrect parent-company fallback marks (for example a generic Google/Microsoft mark for a specific product) with the product's approved icon. Honour valid removal or correction requests.

No font files are included. Artwork is rasterised at build time using fonts available to the build environment.
