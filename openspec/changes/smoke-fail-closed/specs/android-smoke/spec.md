# Android smoke delta specification

## ADDED Requirements

### Requirement: Smoke executor fails closed
The Android smoke executor and its calling script SHALL report success only when `report.json` exists, belongs to the executed case, and shows every case step completed (more than zero). A negative case SHALL succeed only when it failed on its last step.

#### Scenario: Checkout path with a space or a symlink
- **WHEN** the executor is run from a directory whose path contains a space, or through a symlinked directory
- **THEN** it executes the case and writes a report covering every step, or prints usage and exits non-zero

#### Scenario: Zero-step or missing report
- **WHEN** a run leaves no `report.json`, or a report with zero or fewer completed steps than the case defines
- **THEN** the verification step exits non-zero and the CI job fails
