# ADR-0007: Tazumo as the canonical cross-platform SUT for Wopee demos

Status: Accepted as a development convention; device validation pending.
Date: 2026-11-20

## Context
Wopee web, Playwright CLI and native demonstration repos previously used unrelated Dronjo, RegioJet and Settings apps, resulting in inconsistent scenarios and hard-to-compare testing lifecycles.

## Decision
Use the standalone Tazumo marketplace (`wopee-io-demos/tazumo`) as the shared system under test. Keep a versioned `contracts/sut.json` machine-readable fixture/selector contract and semantic app interaction IDs. Shared scenarios cover setup, authoring, maintenance, and execution, with visible and genuinely disabled checkout. Keep product IDs and test IDs stable across languages and platforms. Do not couple the tests to CSS styling, translations, live geography or artificial courier timers.

The generic mobile-agent skills remain portable. The web-demo uses hosted Wopee agent for execution, web-demo-pw-cli uses Playwright CLI only for execution, and mobile-demo uses Appium for native execution. Wopee MCP owns project/suite/test definition authoring and maintenance where connected.

## Consequences
- No live commerce or delivery tracking is asserted.
- Until a test backend/reset endpoint exists, isolate browser context/native app state between attempts.
- A real web deployment and native app binaries are prerequisites for genuine end-to-end proofs.
- CI checks for contract drift in both apps and enforces semantic versioning against the base branch: removing or changing an ID is a major bump, adding one is minor (see [SUT-CONTRACT](../SUT-CONTRACT.md#versioning)). Update downstream cases together.
- Concrete pizza-specific keys stay for readability; ID families are published as `selectorTemplates` with fixture placeholders, rather than enumerating every product (rejected: unbounded contract growth) or publishing prefixes only (rejected: prefix queries collide, e.g. `sut-merchant-list`).
- Hosted browser dispatch cannot reach localhost without a tunnel/hosting setup. Signed iOS App Store builds are separate from Simulator artifacts.

Related issue #32 and OpenSpec `canonical-sut`.
