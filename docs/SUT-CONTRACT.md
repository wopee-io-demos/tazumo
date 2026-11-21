# Tazumo, canonical system under test (SUT)

Version: `0.3.0`. Source of truth: [contract](../contracts/sut.json). Tracking: [#32](https://github.com/wopee-io-demos/tazumo/issues/32). Pin the contract `version` and the Tazumo commit you tested against.

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
| `web.storage`, `web.urlParameters` | Browser state that survives reloads (`localStorage` keys, their format and defaults) and URL parameters the web app reads (`?lang=`). |
| `fixtures` | Synthetic products and merchants with stable IDs, names and prices. |
| `journeys` | Scenario outlines with the `platforms` they apply to. |

Match IDs exactly. Do not query by prefix: `sut-merchant-` also matches `sut-merchant-list` and `sut-merchant-detail`, and `sut-cart-` matches every cart control.

Web and native differ in places; do not share one locator table across platforms:

| Purpose | Web | Native |
| --- | --- | --- |
| Product page / screen root | `detailProduct` (`sut-detail-product`) | `detailScreen` (`sut-detail-screen`); title text `detailTitle` |
| Quantity on the detail page | `selectorTemplates.detailQuantity` (`sut-detail-quantity-{productId}`), number only, after the first add | `selectors.detailQuantity` (`sut-detail-quantity`), text "In cart: N" |
| Add on the detail page | `sut-add-{productId}` | `detailAdd` (`sut-detail-add`) |
| Subtotal | `cartSubtotal` contains the amount only | `cartSubtotal` contains "Subtotal" and the amount |
| Empty cart | `cartEmpty` in the cart drawer | `cartEmpty` on the cart screen |
| Disabled checkout | `checkoutDisabled` in the cart drawer | `checkoutDisabled` in the inline mini-cart, `cartCheckoutDisabled` on the cart screen |
| Open the cart | `cartOpen` opens the drawer | `cartOpen` toggles the inline mini-cart; `cartScreenOpen` and `navCart` open the cart screen |

Assert on contains-text for amounts, not on the whole element text.

Web `language` (`sut-language`) is the header language select on every route (#81). A `?lang=` URL parameter sets the language and stores it in `localStorage` (`tazumo.language`), so start each independent test in a fresh browser context.

Web favourites (#95): `selectorTemplates.favourite` (`sut-favourite-{merchantId}`) is a toggle button with `aria-pressed` on merchant cards and on the merchant page. `favouritesFilter` (`sut-favourites-filter`) is a toggle that narrows products and merchants to favourites. Favourites persist on the device in `localStorage` (`tazumo.favourites`, a JSON array of merchant IDs) and sync across tabs. `web.storage` and `web.urlParameters` list the persisted keys and the `?lang=` parameter. A fresh browser context resets both.

## Versioning

The contract version is checked by `pnpm check:sut --base <ref>`. CI compares a pull request with its base branch and a push to `main` with the previous `main` commit. The new version must be exactly the next one for the kind of change:

- **Major**: an ID, template, route, fixture value, package/bundle ID, capability or other field is removed or changed. This applies below 1.0.0 too, which is stricter than SemVer's 0.x rule: the first breaking change goes to 1.0.0. List migration steps here and update the downstream demos together.
- **Minor**: something is added (IDs, templates, routes, fixtures, journeys, fields).
- **Patch**: only prose changes (journey step wording, `isolation`, `repo`).
- **None**: an unchanged contract keeps its version.

Reordering arrays of IDs or values (for example `platforms`) is not a change. The push check runs after a merge and cannot block it; concurrent pull requests that each bump to the same version are caught only if branches must be up to date with `main` before merging. A force-push to `main` can make the previous commit unfetchable, which fails the push check.

## How the check works

`pnpm check:sut` parses every `.ts`/`.tsx` file under `apps/web/src` and `apps/mobile/src` with the TypeScript compiler. It reads only the platform's test-ID attribute: `data-testid` on web, `testID` on native. Values can be string or template literals, conditionals, or a prop of the enclosing component whose string values come from JSX call sites of that component (such as `<QuantityStepper testIdPrefix="sut-cart">`). Module constants are not resolved. Placeholder names in templates are not inferred from the code (`${p.id}` is just a placeholder), so a template with the wrong placeholder name is caught only at runtime: on web by the e2e coverage test, on native not yet. Comments, other attributes and strings elsewhere do not count. The check fails when:

- a registered ID or template is not rendered by that platform's code;
- a concrete ID matches a template only with a value outside that placeholder's fixture domain;
- a selector is not a `sut-*` test ID, or a template uses an unknown placeholder;
- a route is missing from the web code;
- fixtures differ from `@tazumo/core`, or IDs are duplicated;
- a checkout control is not disabled.

IDs that are in the code but not registered are printed as a note. `tests/contract/sut-contract.test.mts` covers the checker with mutations: it removes each registered ID's attribute, comments an element out, moves an ID to another attribute or the wrong platform's prop, and re-enables checkout, plus semantic-version cases. `tests/e2e/sut-contract.spec.ts` runs the `merchant-detail-cart` journey in Chromium using only contract selectors and routes, and asserts that every web selector and template is visible in at least one app state. Native IDs are verified statically only; there is no Appium run against them in this repository.

## Changelog

### 0.3.0 (additive)
- Web favourites (#95, #130): `favouritesFilter`, `favouritePiazza`, `selectorTemplates.favourite`, journey `favourites-filter`.
- `web.storage` (`tazumo.language`, `tazumo.favourites`) and `web.urlParameters` (`lang`, #81).
- No ID from 0.2.0 was renamed or removed.

### 0.2.0 (additive)
- Web discovery (#50, #63): merchant list and cards, merchant page, product page, cart line editing, not-found states, categories, `routes`, and `selectorTemplates`.
- Native screens (#45, #53): product detail screen (`sut-open-product-*`, `sut-detail-*`), cart screen (`sut-cart-screen*`, `sut-cart-line-*`, steppers, `sut-cart-checkout-disabled`) and header navigation (`sut-nav-back`, `sut-nav-cart`).
- `fixtures.merchants`, `merchantId` on the pizza fixture, `platforms` on every journey, journeys `merchant-detail-cart` and `native-detail-cart`.
- No ID from 0.1.0 was renamed or removed.

### 0.1.0
- Initial contract: search, cart, pizza product and add, language, palette, groceries category and disabled native checkout.
