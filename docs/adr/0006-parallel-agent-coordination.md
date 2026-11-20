# ADR-0006: GitHub Issues coordinate parallel agents

Status: Proposed
Date: 2026-11-20

## Context
Independent agents may start with no retained conversation context, and they may work concurrently on the same organization of repos. Chat-based progress is not a durable, atomic collaboration record. GitHub Projects and status label administration may not be exposed to every agent.

## Decision
Use GitHub Issues as the authoritative queue, one of six `status:*` labels and an assignee as the active ownership record, linked feature branches/PRs as implementation, OpenSpec as behavioral requirements, ADRs as architectural decisions, and CI + app-capture evidence as verifiable output. Provide a fresh-start guide and an idempotent `gh` CLI label bootstrap. Do not claim automatic status synchronization or atomic locking: agents must re-read after claiming and coordinate collisions. Allow proactive self/delegated review, but never bypass required checks or approvals.

## Consequences
Agents can safely identify ready tasks and resume blocked tasks, but must have GitHub permission and runner access to realize workflow transitions. For cross-repo SUT changes, merge the upstream contract before downstream consumers, and pin the exact version and commit. Status automation can be added later through GitHub Projects when verified.

## Revisit
If concurrent updates frequently collide, move to a GitHub Project with proper item ownership/field sync and an atomic claim service. This is not needed for the initial five-repository program.
