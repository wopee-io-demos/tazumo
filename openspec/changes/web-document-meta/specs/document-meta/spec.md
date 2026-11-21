# Document metadata delta specification

## ADDED Requirements

### Requirement: Page titles
Each web route SHALL set `document.title` to `<page> · <brandName> (<demo>)`, localised for EN, CS and DE. The page part is the localised home title, the merchant or product name, or the localised "Not found". The title SHALL update on route and language changes.

#### Scenario: Merchant page
- **WHEN** a user opens `#/merchant/piazza-local` in English
- **THEN** the title is "Piazza Local · Tazumo (demo)"

#### Scenario: History navigation
- **WHEN** the user navigates back and forward between routes
- **THEN** the title matches the current route and is never empty

### Requirement: No indexing of the synthetic demo
The web build SHALL include a `noindex, nofollow` robots meta tag and a `robots.txt` that disallows all crawling, and SHALL NOT include JSON-LD, rating markup, Open Graph business data or a sitemap.

#### Scenario: Production build
- **WHEN** the web app is built
- **THEN** `index.html` has the robots meta tag, `robots.txt` disallows `/`, and no file contains structured business or rating data
