# Cross-repository agent navigation and board audit

## Problem
Parallel workers can start without previous conversation context. Existing issue labels and handoffs are useful but a missing organization index and contradictory states can lead to duplicated work.

## Change
- Add a central repository map linking the five demo repos, Issues, PRs, and Actions.
- Add an explicitly read-only Issue audit to expose structural contradictions and stale-claim heuristics.
- Keep live Issues the authority; docs are navigation only. Do not auto-claim, close or resolve jobs.

## Tracking
Issue #42, ADR-0006; complements existing parallel-agent continuity and engineering governance #40.

## Acceptance
- Audit flags missing/duplicate statuses, inconsistent open/closed state and ownership violations.
- Staleness is warning only, not automatic expiry.
- Stdlib tests prove checks; failing job remains a blocker rather than fabricated success.
