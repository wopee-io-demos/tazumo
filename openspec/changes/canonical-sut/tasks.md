# Canonical SUT integration tasks

Issue #32, PR #33.

- [x] Define SUT contract v0.1.0 including fixture IDs, web/native selectors, supported journeys and capability boundaries.
- [x] Add matching stable selectors to web and Expo native clients.
- [x] Add Playwright test for core SUT journey.
- [x] Add structural SUT contract checker to CI.
- [x] Document selectors, data isolation and privacy/checkout boundaries.
- [ ] Verify new branch CI checks green on a working runner.
- [ ] Verify Android emulator and iOS Simulator test ID exposure in the actual Appium XML.
- [ ] Validate cross-repo consumers and merge integration PRs.

- [x] Add a real disabled native checkout control and stable `sut-checkout-disabled` identifier, rather than relying on warning text alone.
- [ ] Validate the disabled state with Appium WebDriver `GET /element/{id}/enabled` on actual iOS/Android devices.

- [x] Specify iOS vs Android Appium locator strategies for React Native testIDs in SUT contract.
- [ ] Verify both strategies against genuine Appium Inspector native hierarchy (resource-id vs accessibility identifier).
