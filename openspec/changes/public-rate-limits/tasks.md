# Tasks

- [x] Per-route `config.rateLimit` tiers (`public`, `health`, `authenticated`), enforced by the `onRoute` hook. Startup fails on a missing or contradictory tier.
- [x] Default limits:
  - public: 300 requests per 60 s per IP;
  - health: 1,200 requests per 60 s per IP;
  - authenticated: IP 300 and principal 120 per 60 s.
- [x] Tests (`test/rate-limit.test.ts`):
  - public routes return 429 with `Retry-After` and reset after the window;
  - health has a separate budget;
  - every registered route, including HEAD routes, is limited;
  - startup fails on a missing or wrong tier;
  - removing the public limiter makes the suite fail (mutation check).
- [x] CodeQL exclusion of `js/missing-rate-limiting` removed.
- [x] Contract `0.6.0-draft`: 429 on the public operations.
- [x] `CodeQL PR analysis` on PR #129 head a26ceae: [0 findings](https://github.com/wopee-io-demos/tazumo/actions/runs/44876711030). [API integration](https://github.com/wopee-io-demos/tazumo/actions/runs/44876711061): 100/100. Merged as 5b672a1.
