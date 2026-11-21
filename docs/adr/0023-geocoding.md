# ADR-0023: Geocoding provider for delivery addresses

Status: **Proposed.** The recommendation needs a host and running cost, so the decision belongs to the repository owner.
Date: 2026-11-20
Tracking: issue #94, `@tazumo/address`, ADR-0019 (merchant delivery zones, PR #76)

## Context

A customer enters a delivery address in SK, CZ, DE or AT. `@tazumo/address` validates and normalizes it, and a geocoder turns it into a point that `checkDelivery` compares with merchant zones. A home address is personal data (GDPR Art. 4(1)), so the choice of geocoder decides who receives it, where, and for how long.

Requirements, in priority order:
1. **Privacy:** addresses are never logged in clear (`redactAddress` gives country plus two postal digits). A provider must not keep or reuse them beyond the request, and our own cache must have a retention limit.
2. **EU residency:** processing in the EU/EEA, with as little non-EU legal exposure as possible.
3. **Storing results:** we want to cache address-to-point results per order and per saved address, so the licence must allow it.
4. **Cost and limits:** close to zero at demo scale, no per-keystroke billing surprises, and a CI that never calls a live service.
5. **Coverage:** house-number precision for SK, CZ, DE and AT.

Facts were checked on vendor pages on 2026-11-20, except where a cell says **unverified**. Prices and terms change; re-check them before any contract.

## Options

| | Public Nominatim (OSMF) | Self-hosted Nominatim (EU host) | Self-hosted Photon or Pelias (EU host) | Mapbox Geocoding v6 | Google Geocoding API | HERE Geocoding & Search v7 |
| --- | --- | --- | --- | --- | --- | --- |
| **Who receives the address, where** | OSMF (UK charity), on donated servers; its privacy policy says personal data is stored in the UK and NL | Only us, on an EU host we choose | Only us, on an EU host we choose | Mapbox, Inc. (US). Personal data processed in AWS US; no EU-only option per its legal FAQ | Google (US). No EU processing option found | HERE Global B.V. (Eindhoven, NL). GDPR applied worldwide, SCCs for transfers; an EU-only processing region was not found (**unverified**) |
| **Non-EU legal exposure** | Low (UK has an adequacy decision) | Only what the host brings; none with an EU-owned host | Same as self-hosted Nominatim | CLOUD Act / FISA; transfers under DPF or SCCs | CLOUD Act / FISA; transfers under DPF or SCCs | Low: EU company, but sub-processors must be checked |
| **Pricing** | Free | Infrastructure and operations only | Infrastructure and operations only | Temporary: 100k/month free, then $0.75 to $0.45 per 1k. Permanent (storable): $5.00 per 1k, no free tier | 10k events/month free, then $5.00 per 1k falling to $0.38 at volume | Geocode and autocomplete: 30k/month free, then about €0.70 per 1k |
| **Rate limits** | 1 request/s per application across all users; bulk discouraged; no autocomplete | Ours | Ours | 1,000 requests/min default; every keystroke counts | Per-project QPM quota set in Cloud console (default not published) | Limited plan: 5 RPS, 1,000/day; paid-plan limits not disclosed, 429 on excess |
| **Storing and caching results** | Required by the usage policy ("results must be cached on your side") | Allowed. The OSMF Geocoding Guideline treats single results as insubstantial extracts; share-alike applies only to a substantial derivative database. ODbL attribution required | Same ODbL position for OSM-derived results. Pelias also imports OpenAddresses, whose per-source licences vary (some share-alike) | **Temporary results may not be cached.** Permanent results may be stored indefinitely. Results only with a Mapbox map | Global terms: lat/lng up to 30 days, `place_id` indefinitely. Separate EEA terms apply from 8 July 2025 for EEA billing addresses; their Geocoding caching and map-use clauses are **unverified** (the clause text could not be confirmed) | By default no storage beyond 30 days; indefinite storage needs a paid permanent-geocoding licence (**unverified**: from a HERE KB page that could not be rendered) |
| **Privacy fit** | **Ruled out:** the policy says "do not submit personal data", and OSMF may analyse queries; no log retention stated | Best: we control logs and retention | Best: we control logs and retention | Weak: US processing, temporary results cannot be cached, so every lookup sends the address again | Weak: US processing with no EU option; the address goes to Google on every uncached lookup | Acceptable with a DPA; 30-day storage limit fits a short cache only |
| **Autocomplete** | Banned | No (structured and free-text search only) | Yes (Photon search-as-you-type, Pelias `/v1/autocomplete`) | Yes | Separate Places API | Yes |
| **House-number coverage (SK, CZ, DE, AT)** | OSM: good in DE and AT; near-complete in CZ through the nationwide RÚIAN address import; SK must be measured in the spike (**unverified**) | Same OSM data | Same OSM data; Pelias can add OpenAddresses sources | Commercial data, generally complete | Commercial data, generally complete | Commercial data, generally complete |
| **Licence of the software** | n/a | GPL (v3 Python code, v2 rest) | Photon Apache 2.0; Pelias MIT | Proprietary | Proprietary | Proprietary |
| **Ops burden** | None, but no SLA and the policy can change without notice | Medium: PostgreSQL import, updates, monitoring. A full planet needs 128 GB RAM and 1 TB NVMe; a SK+CZ+DE+AT extract needs far less (size it in a spike) | Photon: one Java service on OpenSearch, imports ready-made dumps. Pelias: several services plus Elasticsearch and libpostal (3 GB RAM alone) | Low | Low | Low |
| **CI** | Must not be called from CI | Not called from CI either: the `FixtureGeocoder` covers tests | Same | Same | Same | Same |

Two more options from issue #94:

- **Postal-code centroid table.** A static table of postal-code centroids (for example derived from OSM boundaries or a national open-data set) with no external calls at all. Free, private and offline, but a centroid can be several kilometres from the door, so addresses near a zone edge would be judged wrongly, and DE/AT postal areas vary a lot in size. Useful as a fallback when a geocoder returns `not_found`, not as the primary answer.
- **No geocoding.** Merchants declare the postal codes they serve and eligibility becomes a set lookup. Simplest and fully private, but it discards the radius semantics of ADR-0019 and `checkDelivery`, which would have to be redesigned.

## Recommendation

**Self-hosted Nominatim on an EU-owned host, with a SK+CZ+DE+AT OpenStreetMap extract, behind the `Geocoder` port.**

- It is the only option that meets the privacy and residency requirements without a processor agreement: the address never leaves infrastructure we control, and we set log retention ourselves.
- Our input is already structured and validated, which suits Nominatim's structured search (street, city, postal code, country).
- Caching results is permitted under ODbL as individual, insubstantial extracts, provided the app shows "© OpenStreetMap contributors" attribution.
- No per-request price, so autocomplete or retries cannot create surprise bills.

Photon alone would cover search-as-you-type, but its strength is free-text prefix search; our validated input is structured, and Nominatim's structured query matches it directly. If slice 2 needs autocomplete, Photon can be imported from the same Nominatim database as a second, smaller service; that is a separate decision. OSM house-number coverage in SK must be measured in the spike: if it is too thin, that argues for HERE. If the owner prefers no operations work, the fallback is **HERE** (EU company, the lowest price, 30k free lookups per month), accepting a DPA review and a cache limited to 30 days. Mapbox and Google are not recommended: US processing with no EU option, Mapbox forbids caching its free-tier results, and Google's 30-day caching limit plus its price make every repeat lookup a paid transfer of the address. Public Nominatim is ruled out by its own usage policy.

**Owner decision needed:** a host and its monthly cost (a VM sized for the four-country import, plus backups), or a HERE account. Until then, the demo and CI use `FixtureGeocoder`, which resolves only fictional fixture addresses and returns `not_found` for everything else.

## Consequences

- `@tazumo/address` defines `Geocoder.geocode(address) → found(point, precision) | not_found | unavailable`. `unavailable` (timeouts, 429, provider errors) is never reported as `not_found`, and `precision` leaves room for a street or postal-centroid fallback. Providers sit behind it and receive only validated, normalized addresses.
- Tests never touch the network: `FixtureGeocoder` (exported from `@tazumo/address/testing`, not the main entry) and test doubles implement the port.
- Rules for any real adapter:
  - Never log the address or the provider's response body. Log `redactAddress` output and the status only.
  - Cache key: an HMAC of the normalized address, never the clear text. Cache value: point and precision only. Retention: 30 days or the life of the order it belongs to, whichever is shorter.
  - Self-hosted: disable or rotate web-server query logs (at most 7 days), and keep the geocoder off the public internet (API-to-geocoder only).
  - Show OSM attribution wherever results are used.
- Eligibility uses the `checkDelivery` semantics of `@tazumo/merchant-ops`. A local copy lives in `@tazumo/address` until PR #76 merges; a drift test compares both.
- Out of scope here: deploying a live geocoder, a saved address book, maps and routing.

## Sources (retrieved 2026-11-20)

- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/ ; OSMF privacy policy: https://osmfoundation.org/wiki/Privacy_Policy
- OSMF Geocoding Guideline: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Geocoding_-_Guideline
- Nominatim installation requirements: https://nominatim.org/release-docs/latest/admin/Installation/ ; licence: https://github.com/osm-search/Nominatim
- Photon: https://github.com/komoot/photon ; Pelias: https://github.com/pelias/pelias , https://github.com/pelias/documentation/blob/master/data-sources.md
- Mapbox: https://docs.mapbox.com/api/search/geocoding/ , https://www.mapbox.com/pricing , https://www.mapbox.com/legal/legal-faq
- Google: https://developers.google.com/maps/billing-and-pricing/pricing , https://developers.google.com/maps/documentation/geocoding/policies , https://cloud.google.com/terms/maps-platform/eea (EEA terms; clause text not confirmed)
- HERE: https://www.here.com/pricing/supplemental-pricing , https://www.here.com/get-started/pricing/limited-plan-restrictions , https://docs.here.com/here-kb/docs/permanent-geocoding-overview-licensing-and-usage-rules , https://www.here.com/en-gb/terms/imprint-impressum
