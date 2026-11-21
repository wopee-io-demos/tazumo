## ADDED Requirements

### Requirement: Pinned workflow actions
Every action referenced by a workflow SHALL be pinned to a full 40-character commit SHA followed by a comment naming its version.

#### Scenario: Tag reference added
- **WHEN** a workflow step uses an action by tag or branch, such as `actions/checkout@v7`
- **THEN** review rejects it and asks for the commit SHA with a version comment

#### Scenario: Dependabot update
- **WHEN** Dependabot raises a minor or patch update of a pinned action
- **THEN** it updates the SHA and the version comment together
