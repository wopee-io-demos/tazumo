# Design system

## ADDED Requirements

### Requirement: Accessible semantic colour themes
The brand package SHALL provide light and dark semantic colour themes for every palette. Every approved foreground/background pairing SHALL meet WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and UI components.

#### Scenario: Every pairing passes
- **WHEN** `pnpm test` runs
- **THEN** the contrast ratio of every pairing in `contrastPairings` is computed for every palette and mode, and the run fails if any ratio is below its threshold

#### Scenario: Untested colour role
- **WHEN** a colour role is added to a theme without appearing in any pairing
- **THEN** the test fails and names the role

#### Scenario: Palette without themes
- **WHEN** a palette exists without both a light and a dark theme
- **THEN** the test fails

### Requirement: Backward-compatible brand exports
The brand package SHALL keep `brandName`, `palettes`, `PaletteName`, `preferredPalette` and `mascot` with unchanged names and values.

#### Scenario: Legacy consumer
- **WHEN** an app reads `palettes.emerald.primary`
- **THEN** it receives `#087F62` and light themes reuse the legacy primary, accent, background (as `tint`) and ink (as `text`)

### Requirement: Independent name, palette and mascot
Brand configuration SHALL let name, palette and mascot change independently, and SHALL allow running without a mascot.

#### Scenario: Change one setting
- **WHEN** only the name, only the palette or only the mascot is overridden
- **THEN** the other two settings resolve exactly as in the default brand

#### Scenario: Invalid setting
- **WHEN** the name is blank or the palette or mascot is unknown
- **THEN** brand creation throws an error

### Requirement: Original, provenance-tracked brand assets
Brand artwork SHALL be original hand-authored vector art, with generated app-icon sizes for iOS and Android. Every asset SHALL be listed in `docs/brand/ASSET-PROVENANCE.md` with its author, method and licence.

#### Scenario: App icon export
- **WHEN** `export:icons` runs for a palette
- **THEN** it writes a 1024×1024 opaque iOS icon and Android adaptive foreground, background and monochrome layers, with the mark inside the adaptive safe zone

#### Scenario: Unverified photograph
- **WHEN** the licence of a photograph cannot be verified from its source page
- **THEN** the photograph is not committed
