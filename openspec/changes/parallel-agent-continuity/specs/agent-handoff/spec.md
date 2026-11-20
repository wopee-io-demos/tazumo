## ADDED Requirements

### Requirement: Discoverable issue lifecycle

Every active implementation issue SHALL expose exactly one lifecycle status (backlog, ready, in-progress, in-review, blocked or done), an explicit claim owner where applicable, and links to its implementing PR, OpenSpec change and dependencies.

#### Scenario: A fresh agent selects a task

- **WHEN** an agent starts without earlier conversation context
- **THEN** the agent can discover unclaimed, actionable work from GitHub Issues and read acceptance criteria, dependencies and the next step before claiming it.

### Requirement: Resumable handoff

An interrupted implementation SHALL retain a durable checkpoint containing its branch, last pushed commit, observed tests and failures, outstanding work and exactly one actionable next step.

#### Scenario: Work is interrupted

- **WHEN** an agent cannot finish the task
- **THEN** it records the checkpoint and any external blocker on the originating issue so another agent can resume without prior chat history.

### Requirement: Verified pull-request delivery

Changes SHALL follow an issue-linked PR with recorded evidence, respect required checks and approvals, and publish their merge SHA and final issue status only after actual acceptance.

#### Scenario: CI or reviewer is unavailable

- **WHEN** a PR is blocked by an unavailable runner, a failing test or required review
- **THEN** the issue remains blocked or in-review with the precise reason, and the agent does not claim successful delivery.

### Requirement: Concurrent agents avoid conflicting ownership

Agents SHALL verify issue status, assignee and existing PRs before claiming a task and SHALL coordinate concurrent claims rather than overwriting another agent's branch.

#### Scenario: Two agents select the same issue

- **WHEN** two agents try to claim one ready task
- **THEN** both recheck the live owner and only one proceeds, while the other releases its claim and selects a different ready issue.
