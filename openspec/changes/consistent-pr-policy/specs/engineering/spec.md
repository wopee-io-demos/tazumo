## ADDED Requirements
### Requirement: Consistent organization issue-first PR workflow
Each demo repository SHALL provide a fresh-start entrypoint, issue status/ownership guidance and a linked PR template with test evidence, OpenSpec/ADR and resumable handoff.
#### Scenario: Independent agent starts without prior context
- **WHEN** a new agent opens any repository
- **THEN** they can discover unassigned Ready Issues, claim safely, create a linked PR and identify required checks and next action.
#### Scenario: Review or CI gate is blocked
- **WHEN** required approval or CI is unavailable
- **THEN** the PR stays unmerged, and the issue contains the exact blocker and handoff.
