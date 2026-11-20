# Tazumo, canonical system under test (SUT)

Version: `0.2.0`. Source of truth: [contract](../contracts/sut.json). Tracking: [#32](https://github.com/wopee-io-demos/tazumo/issues/32). Pin the contract `version` and the Tazumo commit you tested against.

Use Tazumo web, Android and iOS as the common application for Wopee demos. Its catalogue is synthetic, checkout is **disabled**, and order tracking is **not operational**. No dummy order should ever be reported as a real purchase.

## Test contract
- Web: run `pnpm dev:sut` (pins `http://127.0.0.1:4173`) or the GHCR package when it becomes published. `TAZUMO_BASE_URL` must resolve to a verified Tazumo instance; no public deployment is assumed.
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

## Native Appium selector contract

React Native `testID` is mapped differently across platforms. With Appium XCUITest, use **`accessibility id`** for iOS `testID` (usually the accessibility identifier/name). With Appium UiAutomator2, use **`id`** for Android `testID` (the view's `resource-id`). Android `accessibility id` targets the user-facing `accessibilityLabel` (content-desc), which is localized and **is not** the `sut-*` selector. `native.locatorStrategies` formalizes this requirement; consumers must verify locator attributes from a real Appium UI tree on both platforms. Do not replace localized accessible labels with synthetic IDs just to make tests pass.

### Stable local web SUT

From the Tazumo monorepo run `pnpm install && pnpm dev:sut`. This intentionally uses port 4173, matching the shared SUT contract and the Playwright E2E server config. `pnpm dev:web` is for general Vite development and may use a different default port. Hosted Wopee agents cannot reach a developer's `127.0.0.1`, so they require a separately deployed and accessible Tazumo instance.

## Contract structure

| Key | Meaning |
| --- | --- |
| `web.selectors`, `native.selectors` | Named, concrete IDs. Web values are CSS selectors on `data-testid`; native values are raw `testID`s for the `native.locatorStrategies`. |
| `web.selectorTemplates`, `native.selectorTemplates` | ID families with a placeholder: `{productId}` and `{merchantId}` from `fixtures` / `@tazumo/core`, `{category}` (`all`, `food`, `groceries`, `shops`, `gifts`) and `{language}` (`en`, `cs`, `de`). |
| `web.routes` | Hash routes: `#/`, `#/merchant/{merchantId}`, `#/product/{productId}` (ADR-0012). |
| `fixtures` | Synthetic products and merchants with stable IDs, names and prices. |
| `journeys` | Scenario outlines with the `platforms` they apply to. |

Match IDs exactly. Do not query by prefix: `sut-merchant-` also matches `sut-merchant-list` and `sut-merchant-detail`, and `sut-cart-` matches every cart control. Some IDs mean different elements per platform: web `sut-cart-empty` is the empty cart drawer, native `sut-cart-empty` is the empty cart screen; web `sut-checkout-disabled` is the cart drawer button, native `sut-checkout-disabled` is the inline mini-cart button and `sut-cart-checkout-disabled` the cart screen button.

## Versioning

The contract follows semantic versioning, enforced by `pnpm check:sut --base <ref>` in CI against the pull request's base branch:

- **Major**: an ID, template, route, fixture value, package/bundle ID or capability is removed or changed. Consumers need migration steps; list them here and update the downstream demos together.
- **Minor**: something is added (IDs, templates, routes, fixtures, journeys, fields).
- **Patch**: only prose changes (journey step wording, `isolation`).

An unchanged contract keeps its version. A major bump without a breaking change is rejected.

`pnpm check:sut` also scans every `.ts`/`.tsx` file under `apps/web/src` and `apps/mobile/src` and fails when a registered ID is missing from the platform's code, when a selector is not a `sut-*` test ID, when a template uses an unknown placeholder, when a route is not in the web code, or when fixtures differ from `@tazumo/core`. IDs in the code that are not registered yet are printed as a note. `tests/contract/sut-contract.test.mts` removes each registered ID from the sources in turn and asserts the check fails. `tests/e2e/sut-contract.spec.ts` runs the `merchant-detail-cart` journey in Chromium using only contract selectors and routes. Native IDs are verified statically; this repository has no Appium run against them.

## Changelog

### 0.2.0 (additive)
- Web discovery (#50, #63): merchant list and cards, merchant page, product page, cart line editing, not-found states, categories, `routes`, and `selectorTemplates`.
- Native screens (#45, #53): product detail screen (`sut-open-product-*`, `sut-detail-*`), cart screen (`sut-cart-screen*`, `sut-cart-line-*`, steppers, `sut-cart-checkout-disabled`) and header navigation (`sut-nav-back`, `sut-nav-cart`).
- `fixtures.merchants`, `merchantId` on the pizza fixture, `platforms` on every journey, journeys `merchant-detail-cart` and `native-detail-cart`.
- No ID from 0.1.0 was renamed or removed.

### 0.1.0
- Initial contract: search, cart, pizza product and add, language, palette, groceries category and disabled native checkout.
