# Tazumo acceptance matrix for all Wopee demos

Canonical source: `contracts/sut.json` v0.2.0. This is a **synthetic, non-transactional** marketplace SUT. Its real checkout and courier dispatch capabilities are disabled.

| Lifecycle | mobile-agent | mobile-demo | web-demo | web-demo-pw-cli |
| --- | --- | --- | --- | --- |
| Setup | Wopee MCP preflight, validate native app ID/driver and device | Appium 2 UiAutomator2 and XCUITest; install matching Tazumo debug builds | Wopee MCP `setup_check`, case/suite inventory, reachable target URL | Wopee MCP setup and Playwright CLI target preflight |
| Author | Observe native hierarchy, author an explicit case with stable `sut-*` IDs | Maintain declarative `cases/tazumo.json` with postconditions | Hosted Wopee agent creates/updates selected case | Wopee authors case; bind suite/case revision to CLI |
| Maintain | Reinspect locator, minimal repair, retain assertions | Synthetic broken locator fails, repaired locator passes on iOS and Android | Scoped Wopee case maintenance with before/after revision hash | Detect changed case hashes; deliberately break/repair fixture |
| Execute | Appium runs native case; correlate evidence to Wopee case | Capture native XML, screenshot, verdict, device details | Wopee hosted dispatch executes on reachable web URL | **Only Playwright CLI** executes browser; Wopee manages case |

## Standard journeys

1. Discovery: search `Piazza`; expect `Margherita pizza` and `Piazza Local`.
2. Cart: add a pizza, open cart, assert product and EUR 11.90 subtotal.
3. Negative commerce: checkout remains disabled. No payment or genuine order is made.
4. Filter: select `Groceries`; expect `Sourdough loaf` and no pizza in filtered results.
5. Localization: switch EN to CS and DE while retaining items, search and stable `sut-*` automation IDs.
6. Maintenance: rename an automation ID within a fixture, prove old test fails, repair one selector, retain case ID and all business postconditions.

## Setup and isolation

- Run `pnpm install && pnpm dev:sut` in Tazumo for `http://127.0.0.1:4173`.
- Set `TAZUMO_BASE_URL` to a separately reachable Tazumo deployment for **hosted** Wopee dispatch. Remote agents cannot visit localhost on a developer workstation.
- iOS uses `accessibility id` for RN `testID`; Android uses UiAutomator2 `id` / `resource-id`. Confirm against actual native XML.
- Reset app storage between independent native journeys; isolate browser contexts. No backend fixture-reset API is implemented.
- Current org GitHub Packages PR #30 provides a proposed web image and test kit, **not yet published**. Until actual publication, check out the Tazumo repository and build it locally.
- GitHub workflow pass and synthetic Appium replay are not evidence of successful real Wopee sessions or device tests.

## Evidence gate

A demo is complete only after showing setup logs, authored case ID, maintenance negative/positive run, actual execution result, screenshots, build/commit SHA, SUT contract version and a reproducible command. Keep coverage Issue #32 open until all four repos meet this gate.
