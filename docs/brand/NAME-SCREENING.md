# Brand-name screening: Tazumo, Zupomi, Zopiku

> **Preliminary screening, not legal clearance.** This page records what a few public sources showed on 2026-11-20 between 21:11 and 21:23 CET. It is not a trademark search report, a legal opinion or a statement that any name is available, registrable or free to use. No name has been cleared. **Formal name clearance is still open** (see [Next step](#next-step-formal-clearance)).

Issue: [#6](https://github.com/wopee-io-demos/tazumo/issues/6). Name, palette and mascot stay independent ([ADR-0002](../adr/0002-brand-independent-tokens.md)), so changing the name later does not touch colours, the fox or domain data.

## Summary

| | Tazumo | Zupomi | Zopiku |
| --- | --- | --- | --- |
| Identical mark found (EUIPO, WIPO) | none found | none found | none found |
| Near marks to show an attorney | **Takumo** (DE, classes 9, 35, registered) | **MUPOMI** (DE, class 9, pending) | none in the EU; only Asian *KOPIKU* marks (classes 30, 35, 43) |
| .com | **registered by a third party** (2025, has mail) | **registered by a third party** (2026, parked) | not registered |
| .eu, .cz, .sk, .de | not registered | not registered | not registered |
| Language flags | German reads "Tatsumo" | Czech "zapomni" (forget)? *needs native check* | Czech/Slovak "zopakuj" (repeat) *needs native check* |

"Not registered" means that the registry WHOIS or RDAP reported the domain as free or not found at that time. It is not a reservation.

## 1. Trademark databases

Classes of interest (Nice, 12th edition): **9** (apps, software), **35** (online retail and marketplace services), **39** (delivery and transport), **43** (food and drink services).

Method: each public search page was loaded in an ordinary headless Chromium browser, once per query, as a person would use it. No API was scraped and no bot protection was bypassed. A query that did not render is recorded as **not obtained**, never as "no conflicts".

### 1.1 EUIPO eSearch plus (EU trade marks)

Query: basic search on the word, all trade-mark types. URL pattern: `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/<name>`

| Name | Date (CET) | Trade marks | Designs | Owners | Link |
| --- | --- | --- | --- | --- | --- |
| Tazumo | 2026-11-20 21:14 | 0 | 0 | 0 | [search](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/tazumo) |
| Zupomi | 2026-11-20 21:14 | 0 | 0 | 0 | [search](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/zupomi) |
| Zopiku | 2026-11-20 21:14 | 0 | 0 | 0 | [search](https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/zopiku) |

The basic search matches the word itself only. It does not cover similar spellings, so it says nothing about confusingly similar EU marks. The WIPO fuzzy and phonetic searches below include EUIPO data.

### 1.2 TMview (EUIPO plus national offices, including CZ, SK, DE)

**Not obtained.** On 2026-11-20 at 21:14 CET, the results page (`https://www.tmdn.org/tmview/#/tmview/results?page=1&pageSize=30&criteria=C&basicSearch=<name>`) stayed on a loading screen behind the site's bot protection, for all three names. To repeat by hand, open [TMview](https://www.tmdn.org/tmview/), search each name, then filter Nice classes 9, 35, 39 and 43 and offices EM, CZ, SK, DE and WO.

### 1.3 WIPO Global Brand Database (90 sources, including EUIPO, DPMA, ÚPV CZ, ÚPV SK and Madrid)

Form: [branddb.wipo.int, Brand name](https://branddb.wipo.int/en/similarname), all classes unless stated. WIPO showed a banner that day about "technical issues related to our anti-scraping and anti-bot protections", and some queries did not complete.

All queries ran on 2026-11-20 between 21:16 and 21:23 CET, across all offices and classes. Result counts are as WIPO displayed them.

| Name | Embedded (contains) | Exact expression | Fuzzy (spelled like) | Phonetic (sounds like) | Stemming |
| --- | --- | --- | --- | --- | --- |
| Tazumo | 0 | 0 | 763 | 9,658 | 1 (TAZUMARA) |
| Zupomi | 0 | 0 | 729 | 6,664 | 0 |
| Zopiku | 0 | 0 | 1,145 | 43,359 | not obtained (timed out) |

**Not obtained:** the class filter (Nice 9, 35, 39, 43) could not be applied through the form, because the field did not respond. Instead, the records rendered on the first results page of each fuzzy and phonetic search (8 per page, most relevant first) were reviewed by hand, and the class filter was applied to those. An attorney's search must apply the class filter across all results.

Near marks among the reviewed results. Rows in **bold** are in classes 9, 35, 39 or 43 and are registered or pending in Europe:

| Query | Mark | Office | Owner | Classes | Status |
| --- | --- | --- | --- | --- | --- |
| tazumo | **Takumo** | Germany (DPMA) | Kahrmann, Tim Bastian | 9, 25, 35, 42 | Registered (2022-10-27) |
| tazumo | TAXUMO | Philippines | Taxumo Inc | 35, 42, 45 | Application ended (2019) |
| tazumo | TAZAMO | France | Martin-Croust Patrick | 16, 41, 42 | Expired (2007) |
| tazumo | TAZAMO | Malawi | The British Petroleum Company plc | 3 | Registered (1986) |
| tazumo | NAZUMO | Japan | Kawashima Kogyo | 13 | Expired (2010) |
| tazumo | TACUMO | USA | Tian Long Yu | 28 | Registered (2026) |
| tazumo (stemming) | TAZUMARA | Cuba | Bayer Intellectual Property GmbH | 5, 10 | Expired (2013) |
| zupomi | **MUPOMI** | Germany (DPMA) | Seedorf, Johannes Klaus | 9, 25, 41 | Pending (filed 2026-10-15) |
| zupomi | **ZUHOMI** | Malaysia | Leong Kam Choong t/a Yummy Trading | 43 | Application ended (2011) |
| zupomi | ZUHOMI | Malaysia | Leong Kam Choong t/a Yummy Trading | 30 | Registered (2010) |
| zupomi | ZUOMI | Zambia | L & A Logistics Limited | 30 | Registered (2026) |
| zupomi | ZUYOMI | USA | Longfeng Lin | 25 | Registered (2026) |
| zupomi | KUROMI | Brazil | Sanrio Company, Limited | 18, 35, 42 | Registered (2022) |
| tazumo (phonetic) | TASUMO | Japan | not shown | 9, 35, 42 | Application ended |
| tazumo (phonetic) | Tatsuma | Malaysia | Lee Wei Lun t/a Enonext Auto Supply | 7, 12, 35 | Pending (2025-12-30) |
| zupomi (phonetic) | スポメ (Supome) | Japan | memory K.K. | 35, 38, 41, 45 | Registered (2026-06-23) |
| zopiku | KOPIKU, KOPIMU KOPIKU MUKU, KOPIKU KOPIMU + LUKISAN | Indonesia (several), Malaysia | several owners | 30, 32, 35, 43 | Mostly ended; one KOPIKU registered (2023, class 30) |
| zopiku (phonetic) | SAPIKU.ID | Indonesia | Eko Junirianto | 9 | Registered (2020) |

Saved result links (WIPO may need the form to be resubmitted if a link opens empty):

- Tazumo: [fuzzy](https://branddb.wipo.int/en/similarname/results?sort=score%20desc&start=0&rows=30&asStructure=%7B%22_id%22%3A%22a394%22%2C%22boolean%22%3A%22AND%22%2C%22bricks%22%3A%5B%7B%22_id%22%3A%22a395%22%2C%22key%22%3A%22brandName%22%2C%22value%22%3A%22tazumo%22%2C%22strategy%22%3A%22Fuzzy%22%7D%5D%7D&fg=_void_) · [phonetic](https://branddb.wipo.int/en/similarname/results?sort=score%20desc&start=0&rows=30&asStructure=%7B%22_id%22%3A%22d084%22%2C%22boolean%22%3A%22AND%22%2C%22bricks%22%3A%5B%7B%22_id%22%3A%22d085%22%2C%22key%22%3A%22brandName%22%2C%22value%22%3A%22tazumo%22%2C%22strategy%22%3A%22Phonetic%22%7D%5D%7D&fg=_void_)
- Zupomi: [fuzzy](https://branddb.wipo.int/en/similarname/results?sort=score%20desc&start=0&rows=30&asStructure=%7B%22_id%22%3A%22e2ef%22%2C%22boolean%22%3A%22AND%22%2C%22bricks%22%3A%5B%7B%22_id%22%3A%22e2f0%22%2C%22key%22%3A%22brandName%22%2C%22value%22%3A%22zupomi%22%2C%22strategy%22%3A%22Fuzzy%22%7D%5D%7D&fg=_void_) · [phonetic](https://branddb.wipo.int/en/similarname/results?sort=score%20desc&start=0&rows=30&asStructure=%7B%22_id%22%3A%22d5a9%22%2C%22boolean%22%3A%22AND%22%2C%22bricks%22%3A%5B%7B%22_id%22%3A%22d5aa%22%2C%22key%22%3A%22brandName%22%2C%22value%22%3A%22zupomi%22%2C%22strategy%22%3A%22Phonetic%22%7D%5D%7D&fg=_void_)
- Zopiku: [fuzzy](https://branddb.wipo.int/en/similarname/results?sort=score%20desc&start=0&rows=30&asStructure=%7B%22_id%22%3A%22ff95%22%2C%22boolean%22%3A%22AND%22%2C%22bricks%22%3A%5B%7B%22_id%22%3A%22ff96%22%2C%22key%22%3A%22brandName%22%2C%22value%22%3A%22zopiku%22%2C%22strategy%22%3A%22Fuzzy%22%7D%5D%7D&fg=_void_) · [phonetic](https://branddb.wipo.int/en/similarname/results?sort=score%20desc&start=0&rows=30&asStructure=%7B%22_id%22%3A%2287d9%22%2C%22boolean%22%3A%22AND%22%2C%22bricks%22%3A%5B%7B%22_id%22%3A%2287da%22%2C%22key%22%3A%22brandName%22%2C%22value%22%3A%22zopiku%22%2C%22strategy%22%3A%22Phonetic%22%7D%5D%7D&fg=_void_)

Register numbers as WIPO showed them: Takumo DPMA `302022218163`; MUPOMI DPMA `3020262577997`. Look them up in [DPMAregister](https://register.dpma.de/DPMAregister/marke/einsteiger).

Reading the results (a non-lawyer's notes for the attorney, not conclusions):
- **Takumo** differs from Tazumo by one consonant, is registered in Germany and covers classes 9 and 35. It is the closest live conflict risk found for Tazumo.
- **MUPOMI** differs from Zupomi by one letter, was filed in Germany in October 2026 and covers class 9. It is pending, so it may still change.
- Zopiku's nearest marks are *kopiku* (Indonesian/Malay for "my coffee") marks in South-East Asia. None was found in the EU.
- The fuzzy and phonetic result counts are large because those strategies match loosely across all classes and offices. Only the top-ranked rendered records were reviewed, which is a small sample.

## 2. Domains

Method: `dig @1.1.1.1` for NS and A records, then the registry WHOIS or RDAP (`whois.verisign-grs.com` and `rdap.verisign.com` for .com, `whois.eu`, `whois.nic.cz` and `rdap.nic.cz` for .cz, `whois.sk-nic.sk`, `whois.denic.de`). As a control, `rdap.nic.cz/domain/seznam.cz` returned 200 while each name returned 404. Checked 2026-11-20 at 21:11 CET.

| Domain | DNS | Registry says | Observation |
| --- | --- | --- | --- |
| tazumo.com | NOERROR, Cloudflare NS, no A record | Registered 2025-02-05, expires 2027-02-05, registrar Cloudflare | No website; MX points to Fastmail and SPF is set, so the domain is used for e-mail |
| tazumo.eu | NXDOMAIN | `Status: AVAILABLE` | |
| tazumo.cz | NXDOMAIN | RDAP 404 (not found) | |
| tazumo.sk | NXDOMAIN | `Domain not found.` | |
| tazumo.de | NXDOMAIN | `Status: free` | |
| zupomi.com | NOERROR, Namecheap NS | Registered 2026-05-18, expires 2027-05-18, registrar NameCheap | Parked page: "has been recently registered with namecheap.com" |
| zupomi.eu | NXDOMAIN | `Status: AVAILABLE` | |
| zupomi.cz | NXDOMAIN | RDAP 404 (not found) | |
| zupomi.sk | NXDOMAIN | `Domain not found.` | |
| zupomi.de | NXDOMAIN | `Status: free` | |
| zopiku.com | NXDOMAIN | `No match for domain "ZOPIKU.COM".` / RDAP 404 | |
| zopiku.eu | NXDOMAIN | `Status: AVAILABLE` | |
| zopiku.cz | NXDOMAIN | RDAP 404 (not found) | |
| zopiku.sk | NXDOMAIN | `Domain not found.` | |
| zopiku.de | NXDOMAIN | `Status: free` | |

Nothing was registered or reserved. Availability can change at any moment.

## 3. Social handles

Method: one unauthenticated HTTPS request per profile URL, plus the Bluesky public API (`com.atproto.identity.resolveHandle`, with `bsky.app` as a resolving control). Most networks return the same login wall or app shell whether or not a profile exists, so their status codes are **inconclusive**.

| Platform | Tazumo | Zupomi | Zopiku | Reliability |
| --- | --- | --- | --- | --- |
| GitHub (`github.com/<name>`) | 404, no user or org | 404 | 404 | Reliable (control `github.com/torvalds` = 200) |
| Bluesky (`<name>.bsky.social`) | does not resolve | does not resolve | does not resolve | Reliable for the default domain only |
| X (`x.com/<name>`) | 200 | 404 | 404 | Inconclusive: X serves a shell; 200 for Tazumo may mean the handle exists |
| Instagram, TikTok | 200 | 200 | 200 | Inconclusive (app shell for every path) |
| YouTube (`@name`) | 302 | 302 | 302 | Inconclusive (consent redirect; a control handle also returned 302) |
| LinkedIn company, Facebook | 403 / 400 | 403 / 400 | 403 / 400 | Inconclusive (login wall) |

A human should confirm handles while logged in to each network before relying on them.

## 4. Pronunciation and meaning (EN, CS, SK, DE)

These notes were written by a non-native analyst. **Every item marked ⚑ needs a native speaker's confirmation.** Plan a short spoken test with 5 or more native speakers per language: hear the name, write it down, say what it reminds them of.

Czech and Slovak always stress the first syllable. German reads **z as /ts/**, which changes all three names.

### Tazumo
| Lang | Likely reading | Notes |
| --- | --- | --- |
| EN | ta-ZOO-moh /təˈzuːmoʊ/ | Easy to spell from hearing. Sounds Japanese-like. Spanish *zumo* means juice (neutral, food-adjacent). |
| CS | TA-zu-mo | No common Czech word found. ⚑ |
| SK | TA-zu-mo | Close to *ťažko* ("hard, heavy") only distantly; probably not noticed. ⚑ |
| DE | TA-tsu-mo | Heard as "Tatsumo". Spelling it back from hearing may give "Tatsumo". No negative meaning found. ⚑ |

### Zupomi
| Lang | Likely reading | Notes |
| --- | --- | --- |
| EN | zoo-POH-mee | Neutral. Polish *zupa* means soup, a pleasant food association in Central Europe. |
| CS | ZU-po-mi | May echo *zapomenout / zapomeň* ("to forget / forget!"), an unhelpful association for a shopping app. Also *župa* (historic region). ⚑ |
| SK | ZU-po-mi | Slovak "forget" is *zabudnúť*, so the Czech echo is weaker. *Župa* is also a historic region. ⚑ |
| DE | TSU-po-mi | *zu* means "closed" or "to", read as a separate syllable. No negative meaning found. ⚑ |

### Zopiku
| Lang | Likely reading | Notes |
| --- | --- | --- |
| EN | zoh-PEE-koo | Neutral. Easy to say, less easy to spell from hearing ("Zopicu", "Zopeeku"). |
| CS | ZO-pi-ku | Echoes *zopakuj* ("repeat!"), which could suit re-ordering. The syllable *pi-* is close to the vulgar Czech/Slovak root *píč-* only through a stretch; native speakers should judge whether anyone hears it. ⚑ |
| SK | ZO-pi-ku | Same *zopakuj* echo ("repeat!") and the same check as Czech. ⚑ |
| DE | TSO-pi-ku | Near *Zopf* (braid, also a bread). No negative meaning found. ⚑ |

## 5. Status of the #6 acceptance criteria

| Criterion | Status | Evidence |
| --- | --- | --- |
| Formal name clearance | **Open** | Only this preliminary screening exists. See the next step. |
| Domain/handles verified | Partly | Domains: section 2 (registry-confirmed snapshot). Handles: GitHub and Bluesky are reliable; the others need a logged-in human check. |
| European pronunciation tests | Partly | Desk notes only (section 4). Native-speaker tests are not done. |
| Accessible brand tokens | Done in PR [#44](https://github.com/wopee-io-demos/tazumo/pull/44) | Light and dark themes for every palette; the WCAG 2.2 contrast test in `pnpm test` covers 184 pairing checks; ADR-0011. |
| Original icon and mascot assets | Done in PR [#44](https://github.com/wopee-io-demos/tazumo/pull/44) (not cleared) | Hand-written SVG fox mark and mascot, iOS and Android icon exports, and `docs/brand/ASSET-PROVENANCE.md`. Not searched as a figurative mark. |

## Next step: formal clearance

For a human (the repository owner) to arrange, since an agent cannot do this:

1. Pick at most two candidates. Based on this page, Zopiku has the fewest observed conflicts (free .com, no identical marks) but has open language checks. Tazumo needs an assessment of **Takumo** (DE, classes 9 and 35), and its .com is held by a third party.
2. Engage a **European trademark attorney** for a full clearance search: identical and similar word marks at EUIPO, DPMA, ÚPV CZ, ÚPV SK and WIPO Madrid designations for the EU, in Nice classes 9, 35, 39 and 43; company-name and common-law use in CZ, SK and DE; and a figurative search for the fox mark.
3. Run the native-speaker tests in section 4.
4. Only after a positive opinion: file the mark (EUTM), then register the .com (or a fallback such as .eu) and the handles.

Until then, the name in the apps stays provisional and must not be presented as a trade mark.

## Reproduce

```sh
for n in tazumo zupomi zopiku; do for t in com eu cz sk de; do dig +short NS $n.$t @1.1.1.1; done; done
whois -h whois.verisign-grs.com tazumo.com
whois -h whois.eu tazumo.eu
curl -s -o /dev/null -w '%{http_code}\n' https://rdap.nic.cz/domain/tazumo.cz
whois -h whois.sk-nic.sk tazumo.sk
whois -h whois.denic.de -- "-T dn tazumo.de"
curl -s "https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=tazumo.bsky.social"
```

Search the trademark databases by hand with the queries in section 1.
