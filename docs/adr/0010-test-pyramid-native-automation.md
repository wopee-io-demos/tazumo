# ADR-0010: Test pyramid and native smoke automation

Status: Proposed
Date: 2026-11-20
Issue: [#9](https://github.com/wopee-io-demos/tazumo/issues/9)

## Context

Tazumo is the canonical system under test for five demo repositories. Its own pull requests need fast, honest gates, and its evidence must not blur fixture checks, browser runs and native device runs. Issue #9 also asks for iOS simulator and Android emulator smoke paths and names Detox or Maestro. The organization already automates native apps with Appium: the `wopee-mobile-*` Agent Skills in [mobile-agent](https://github.com/wopee-io-demos/mobile-agent) and the XCUITest/UiAutomator2 runners in [mobile-demo](https://github.com/wopee-io-demos/mobile-demo). [mobile-agent#11](https://github.com/wopee-io-demos/mobile-agent/issues/11) is adding [mobile-next/mobilecli](https://github.com/mobile-next/mobilecli) as a second device backend for the same case format.

## Decision

### Test pyramid

| Layer | Tool | Gate | Evidence class |
| --- | --- | --- | --- |
| Unit | `node --test` in `packages/core` | every PR (`pnpm test`) | fixture/unit |
| Contract | Ajv (JSON Schema 2020-12) on `contracts/openapi.json`, `tests/contract` | every PR (`pnpm test`) | fixture/unit |
| Browser E2E, accessibility, failure scenarios | Playwright Chromium + `@axe-core/playwright`, `tests/e2e` | every PR (`pnpm test:e2e`), report uploaded on every run by `test-evidence.yml` | browser |
| Native smoke | Appium (see below) on the CI-built Android debug APK and iOS Simulator app | PRs that touch `apps/mobile` or `packages/*`, once implemented | native simulator/emulator |
| Agentic and hosted runs | Wopee web and mobile agents in the downstream demo repos | downstream, not a Tazumo merge gate | hosted |

Most checks live at the bottom. Browser E2E covers each user journey once, plus failure scenarios and accessibility. Native smoke stays a handful of paths (launch, search, add to cart, open cart, checkout disabled), because the shared domain logic is already covered below it.

Accessibility gate: serious and critical axe violations fail. Known violations are allowed only through `tests/e2e/a11y-baseline.json`, where each entry names a scan, a rule, a node limit and a tracking issue. The baseline only shrinks.

### Native smoke automation

Use the organization's **backend-neutral case format from mobile-agent with Appium as the CI executor**. Cases address elements by the `sut-*` identifiers from the SUT contract (iOS `accessibility id`, Android `id`), never by localized labels. mobilecli may run the same cases locally once mobile-agent#11 has merged with real simulator evidence. Native smoke is not implemented in this ADR's change. The native app owner implements it in a later slice.

## Alternatives

| Option | For | Against |
| --- | --- | --- |
| **Appium (chosen)** | Already used by mobile-agent and mobile-demo, so there is one case format, one locator contract and one `report.json` evidence shape. Drives the unmodified APK and Simulator app. Wopee mobile agents use the same stack. | Heavier setup: Appium server, drivers, WebDriverAgent build on iOS. Slower than gray-box tools. |
| Detox | Gray-box synchronization with React Native, less flakiness, JavaScript tests next to the app. | Needs an instrumented build and an Expo config plugin with prebuild changes to `apps/mobile`. Tests couple to the app's JS internals and no other demo repo can reuse them. No real iOS device support. |
| Maestro | Simple YAML flows, quick to author, works with Expo builds, uses `testID`. | A third flow format next to the mobile-agent cases and Playwright, so cases would be duplicated and drift. Adds a Java dependency. Nothing else in the organization consumes it. |
| mobile-next mobilecli | One binary for iOS and Android, no Appium server or WebDriverAgent build step, compact UI tree that suits agents. Runs mobile-agent cases unchanged. | Backend is still in progress (mobile-agent#11). Licensed FSL-1.1-ALv2, so it must not be bundled into a hosted Wopee service until each release turns Apache-2.0. Running it on the operator's or customer's own machine is allowed. |

## Consequences

- Tazumo native smoke cases can also run in mobile-demo, and a backend switch does not rewrite cases.
- CI native smoke needs an Android emulator job (Linux with KVM) and a macOS simulator job. Both are slow, so they run on mobile-relevant changes rather than on every PR.
- `ci.yml` and `test-evidence.yml` both run Playwright until they are consolidated. The duplicate costs about one extra E2E run per PR.

## Revisit

- Appium native smoke stays flaky after retries on more than one run in ten: evaluate Maestro or Detox for the Tazumo-only smoke and keep Appium for the cross-repo demos.
- mobile-agent#11 merges with simulator evidence: allow mobilecli as the local default for agent authoring.
