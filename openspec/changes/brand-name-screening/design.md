# Design: preliminary name screening

- **Record, not verdict.** One dated Markdown page (`docs/brand/NAME-SCREENING.md`) holds the raw observations: queries, counts, registry responses and HTTP statuses. Interpretation is limited to flagging near marks and language risks for an attorney and native speakers.
- **Sources.** Free public sources only: EUIPO eSearch plus, WIPO Global Brand Database and TMview for trade marks; registry WHOIS/RDAP plus DNS for domains; unauthenticated profile URLs and the Bluesky API for handles. Each search page is loaded once per query in a normal browser, with no scraping or bypassing of bot protection. A blocked result is recorded as **not obtained**.
- **Wording rules.** Domains say "no registration observed", never "available" or "free". Marks say "near mark observed", never "conflict" or "clear". Private individuals who own marks are not named; register numbers or links are given instead.
- **No ADR.** No architectural or contract decision is made, and name independence is already covered by ADR-0002.
