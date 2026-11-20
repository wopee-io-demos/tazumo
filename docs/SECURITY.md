# Dependency security

## 2026-11-20 high-severity advisories
Initial PR security run 44772710082 identified four high advisories from PostCSS (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849) and image-size (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr). Two transitive override constraints were added in root package.json: postcss ^8.5.18 and image-size ^2.0.3.

This is a proposed dependency remediation. CI audit, JS bundles and native builds MUST pass after dependency overrides before any merge. Track a future Expo SDK upgrade and lockfile in #14. Avoid ignoring high/critical advisories to obtain a green check.
