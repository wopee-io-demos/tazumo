# Delivery address

## ADDED Requirements

### Requirement: Market address validation
The system SHALL accept a delivery address only for a supported market (SK, CZ, DE, AT) whose country code matches the market, with the required fields `countryCode`, `postalCode`, `addressLine1` and `city`, no fields outside the `DeliveryAddress` contract, and the postal format of the market: SK and CZ `NNN NN`, DE `NNNNN`, AT `NNNN`.

#### Scenario: Valid address
- WHEN a well-formed address is validated for its market
- THEN the result is `ok` with the normalized address, and diacritics are unchanged.

#### Scenario: Invalid address
- WHEN the postal code has the wrong format for the market, the country is unsupported or differs from the market, `city` or `addressLine1` is missing or blank, a field is over its length limit, a field is unknown or not a string, or a field contains control characters or invisible format characters (zero-width, bidirectional, soft hyphen, blank fillers) (instructions may contain tab and line breaks)
- THEN the result lists one error per problem, each with the field path and a code, and nothing is geocoded.

### Requirement: Idempotent normalization
The system SHALL normalize addresses by trimming and collapsing whitespace, applying Unicode NFC, upper-casing the country code and formatting the postal code, so that normalizing twice gives the same result as normalizing once.

#### Scenario: Messy input
- WHEN `" sk "`, `"81101"` and `"  Fiktívna  7 "` are normalized
- THEN they become `"SK"`, `"811 01"` and `"Fiktívna 7"`, and normalizing again changes nothing.

### Requirement: Provider-neutral geocoding
The system SHALL resolve addresses through a `Geocoder` port that returns a point with its precision, `not_found`, or `unavailable` for provider errors, which is never reported as `not_found`. The fixture geocoder, exported only from the `testing` entry point, SHALL resolve only its fictional fixture addresses and SHALL return `not_found` for any other address, never a guess. Tests SHALL NOT call any network service.

#### Scenario: Fixture inside and outside a zone
- WHEN the fictional SK "inside" and "outside" fixtures are resolved and checked against the synthetic merchant zone
- THEN the first is deliverable and the second is `outside_zone`, with the same points on every call.

#### Scenario: Unknown address
- WHEN any address that is not a fixture is geocoded
- THEN the result is `not_found`.

### Requirement: Address redaction for logs
The system SHALL provide a log form of an address that contains only the country code and the first two postal digits.

#### Scenario: Random addresses
- WHEN thousands of generated addresses are redacted
- THEN no output contains the street, the house number, the city or the instructions, and the output does not change when those fields change.

### Requirement: Self-hosted Nominatim adapter
The system SHALL provide a `NominatimGeocoder` for a configured self-hosted base URL (ADR-0023) that sends one structured search per address with only street, city, postal code and the address's own market as `countrycodes`, `format=jsonv2` and `limit=1`, under a strict timeout and a generic User-Agent without personal data. It SHALL refuse the public `nominatim.openstreetmap.org`, base URLs with credentials, a query or a fragment, and non-http schemes.

#### Scenario: Recorded answers
- WHEN the instance answers with a house-level, street-level or postcode-level result for the requested country
- THEN the result is `found` with `address`, `street` or `postal_code` precision and the returned coordinates.

#### Scenario: No usable match
- WHEN the answer is empty, coarser than a postcode or for another country, or the address is outside the four markets
- THEN the result is `not_found`, and for an unsupported country no request is sent.

#### Scenario: Provider failure
- WHEN the request times out, fails on the network, is redirected, returns a non-2xx status, a non-JSON or oversized body, or malformed coordinates
- THEN the result is `unavailable`, never `not_found`.

#### Scenario: Logging
- WHEN the adapter reports an outcome to its log hook
- THEN the entry holds only the outcome, a reason, the HTTP status, the duration and `redactAddress` output.
