# API rate limits

## ADDED Requirements

### Requirement: Every route is rate limited
Every API route SHALL declare a rate-limit tier. Anonymous routes SHALL be limited per client IP and stay anonymous. The service SHALL refuse to start with a route that declares no tier, or a tier that contradicts the contract's authentication requirement.

#### Scenario: Public client over the limit
- WHEN one client IP exceeds the public limit on a discovery route
- THEN it receives 429 with `Retry-After`, other clients are unaffected, and it is served again after the window.

#### Scenario: Health probes
- WHEN discovery traffic from a client IP is rate limited
- THEN `/health` from the same IP keeps working within its own, higher limit.

#### Scenario: Route without a limit
- WHEN a route without a rate-limit tier is registered
- THEN application startup fails.
