## MODIFIED Requirements

### Requirement: Automated dependency updates
Dependabot SHALL propose grouped weekly npm and github-actions updates with open-PR limits. Patch and minor updates SHALL be grouped per ecosystem across all configured directories. Major version updates SHALL NOT be proposed automatically. Expo-pinned packages SHALL receive patch updates only.

#### Scenario: Weekly update run
- **WHEN** the weekly Dependabot run finds updates
- **THEN** at most 5 npm PRs and 3 github-actions PRs are open at once, grouped as configured

#### Scenario: Weekly run finds a major release
- **WHEN** the weekly run finds a new major version of an npm package or a GitHub Action
- **THEN** no pull request is opened for it

#### Scenario: Patch and minor releases in several workspaces
- **WHEN** patch or minor releases exist for packages in several workspace directories
- **THEN** they arrive in one pull request per group, not one per directory
