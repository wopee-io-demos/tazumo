# Tazumo, canonical system under test (SUT)

Version: `0.1.0`. Source of truth: [contract](../contracts/sut.json). Tracking: [#32](https://github.com/wopee-io-demos/tazumo/issues/32).

Use Tazumo web, Android and iOS as the common application for Wopee demos. Its catalogue is synthetic, checkout is **disabled**, and order tracking is **not operational**. No dummy order should ever be reported as a real purchase.

## Test contract
- Web: run `pnpm dev:web` or the GHCR package when it becomes published. `TAZUMO_BASE_URL` must resolve to a verified Tazumo instance; no public deployment is assumed.
- Mobile: `io.wopee.demos.tazumo` for both Android package and iOS bundle ID; install matching debug APK or Simulator .app from the actual CI artifacts. Keep English locale for stable native identifiers and localized assertion values.
- Use `sut-*` test IDs as the stable automation API; keep user-visible accessibility labels localized. Product keys come from `packages/core/src/index.ts`, not rendered card order.
- Because no backend fixture reset exists, isolate browser contexts and clear native app state between independent tests. Demo tests can use local, deterministic fixture prices and sample products, not merchant availability claims.

## Four lifecycle demos
1. **Set up:** build/install, verify expected app/bundle and fixture version, select a dedicated Wopee project if connected.
2. **Author:** search `Piazza`, verify `Margherita pizza`, add it to the cart, assert checkout remains disabled. Record explicit postconditions.
3. **Maintain:** deliberately change one display label or selector in a fixture, prove failure, repair only that locator while keeping the same assertions and case identity.
4. **Execute:** hosted Wopee agent for web-demo; Wopee plus Playwright CLI for web-demo-pw-cli; native Appium for mobile-demo. Preserve screenshot, result status, and reproducible run metadata.

## Governance
Downstream repos `mobile-agent`, `mobile-demo`, `web-demo`, `web-demo-pw-cli` must pin this contract version and be updated when changing `sut-*` identifiers. Changing IDs requires migration steps and negative tests. Real payment/dispatch cannot be tested until implemented; do not fake success.
