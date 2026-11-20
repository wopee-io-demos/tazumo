# Issue board health

### Requirement: Read-only consistency checks
The agent coordination tooling SHALL evaluate live GitHub issue status labels, assignees, open/closed states and timestamps without modifying issue data.

#### Scenario: Conflicting ownership
- WHEN an issue is marked Ready but has an assignee
- THEN the tool reports a structural contradiction and exits unsuccessfully.

#### Scenario: Missing state
- WHEN no status label or multiple status labels are present
- THEN the tool reports the issue number and expected exactly-one status rule.

#### Scenario: Stale work
- WHEN an in-progress or review issue has not been updated for the configured period
- THEN the tool warns that the claim needs review without automatically removing its owner or changing its status.

### Requirement: Discoverable program context
The Tazumo repository SHALL provide a durable entry point with links to all five demo repositories and their live Issues, PRs and CI, including the canonical SUT/skills dependency order.
