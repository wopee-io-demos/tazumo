# Parallel agent issue lifecycle and fresh-start continuity

## Why
Multiple agents must be able to find an unclaimed issue, pick it up safely, build/test independently and resume another agent's work without relying on private conversations.

## Scope
- Shared issue lifecycle and claim/handoff practices.
- An issue template, reproducible GitHub CLI helpers and fresh-start docs.
- README and AGENTS.md pointers, with OpenSpec/ADR as separate change/decision records.

## Non-goals
No background agent scheduler, automatic GitHub Project synchronization, runner provisioning or unverified app execution.
