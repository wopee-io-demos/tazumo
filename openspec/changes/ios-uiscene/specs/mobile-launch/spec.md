# Mobile launch delta specification

## ADDED Requirements

### Requirement: The iOS app launches on current iOS releases
The iOS app SHALL adopt the UIScene life cycle and SHALL keep running after launch on the newest iOS 27.x and 26.x simulators when built with the current Xcode.

#### Scenario: Launch on iOS 27
- **WHEN** CI installs and launches the simulator build on an iOS 27 simulator
- **THEN** the app process is still running after 20 seconds and no Tazumo crash report is written

#### Scenario: Launch crash fails the pull request
- **WHEN** a change makes the app crash or exit at launch
- **THEN** the iOS launch smoke fails the `iOS simulator build` job
