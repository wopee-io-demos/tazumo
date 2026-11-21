# Localization delta specification

## ADDED Requirements

### Requirement: Language switcher on every route
The web app SHALL show a labelled language control for EN, CS and DE in the page header on the home, merchant and product routes. Changing it SHALL re-render UI copy and prices for that language and set the document `lang` attribute.

#### Scenario: Switch on a detail page
- **WHEN** a user selects Deutsch on a product page
- **THEN** the price is formatted for German, the header shows German copy and `html[lang]` is `de`

#### Scenario: Screen reader names
- **WHEN** a screen reader lists the options
- **THEN** each option is named in its own language with a matching `lang` attribute

### Requirement: Persistent language choice
The selected language SHALL persist across reloads in the same browser. Missing, unknown or unreadable stored values SHALL fall back to English without errors.

#### Scenario: Reload keeps the language
- **WHEN** a user selects Čeština and reloads the page
- **THEN** the page renders in Czech

#### Scenario: Query parameter reset
- **WHEN** a page is opened with `?lang=en` while another language is stored
- **THEN** the page renders in English and English is stored

#### Scenario: Storage blocked
- **WHEN** `localStorage` throws
- **THEN** the page renders in English and the switcher still changes the language for the session
