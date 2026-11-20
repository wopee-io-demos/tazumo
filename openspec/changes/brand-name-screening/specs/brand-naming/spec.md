# Brand naming

## ADDED Requirements

### Requirement: Screening is recorded as preliminary evidence, never as clearance
The name screening record SHALL state its date, sources, exact queries, search strategies and observed results, and SHALL NOT state or imply that any name is cleared, available or registrable.

#### Scenario: Database could not be queried
- **WHEN** a trademark database blocks or fails an automated or browser query
- **THEN** the record says the result was not obtained and gives the manual query to repeat, instead of reporting zero conflicts

#### Scenario: Near matches found
- **WHEN** a fuzzy or phonetic search returns marks one or two letters away in Nice classes 9, 35, 39 or 43
- **THEN** each one is listed with its office, owner, classes, status and a link for the attorney to assess

### Requirement: Domain and handle observations are reproducible
The record SHALL give the method (DNS resolver, WHOIS or RDAP server, HTTP check) and the observed status for every domain and handle. An observation that cannot tell "free" from "blocked" SHALL be marked inconclusive.

#### Scenario: NXDOMAIN without registry confirmation
- **WHEN** DNS returns NXDOMAIN
- **THEN** the domain is reported as unregistered only if the registry WHOIS or RDAP also says so

### Requirement: Linguistic notes flag what needs native speakers
Pronunciation and meaning notes SHALL cover EN, CS, SK and DE, and SHALL mark every association not confirmed by a native speaker.

#### Scenario: Possible unfortunate meaning
- **WHEN** a name resembles a word with a negative or awkward meaning in a target language
- **THEN** the note names the word and its meaning and flags it for native-speaker confirmation
