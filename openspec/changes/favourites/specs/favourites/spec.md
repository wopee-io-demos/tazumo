# Favourites delta specification

## ADDED Requirements

### Requirement: Favourite toggle
The web app SHALL offer a favourite toggle for each merchant on its card and its page. The toggle is a button with `aria-pressed`, a localized "Add <merchant> to favourites" / "Remove <merchant> from favourites" label and the id `sut-favourite-<merchantId>`.

#### Scenario: Slug ids
- **WHEN** a user favourites `piazza-local`
- **THEN** the toggle is pressed, and the id is stored as the string `piazza-local`

### Requirement: Favourites filter
A Favourites filter next to the category filter SHALL narrow products and merchants to favourite merchants, combined with category and search. When the filter is on and no favourites exist, an empty state with a reset control SHALL be shown.

#### Scenario: Filter with no favourites
- **WHEN** the filter is on and there are no favourites
- **THEN** the merchant empty state explains how to add favourites, and the reset control turns the filter off

### Requirement: Device-local persistence
Favourites SHALL persist in the browser across reloads and sync across open tabs. Corrupted or foreign content and ids of merchants that no longer exist SHALL be ignored without errors. If storage is unavailable, favourites SHALL work in memory without an error message.

#### Scenario: Another tab changes favourites
- **WHEN** a favourite is toggled in one tab
- **THEN** the other open tab shows the same state without a reload
