# Self-hosted Nominatim (ADR-0023)

Geocoding for delivery addresses in SK, CZ, DE and AT runs on our own Nominatim, on an EU host. The API calls it through `NominatimGeocoder` in `@tazumo/address`. Nothing here is deployed yet: provisioning the host is an owner action tracked in #146.

Never use the public `nominatim.openstreetmap.org` for this: its usage policy forbids personal data, autocomplete and production traffic. `NominatimGeocoder` refuses that host.

## Files

- `compose.yaml` runs `mediagis/nominatim:5.3.3` (Nominatim 5.3.3, PostgreSQL 16), pinned by index digest. It uses the `address` import style, which holds everything down to house numbers but no POIs, and `FREEZE`, which drops the tables only needed for incremental updates (we re-import instead). It listens on `127.0.0.1` only, and has no flatnode file, because a flatnode file is meant for planet imports: on a country extract it would add a fixed 16 GB or more.
- `prepare-extract.sh` downloads the four Geofabrik extracts, checks their MD5 sums and merges them into `data/markets.osm.pbf`. The merge uses `osmium merge` in a digest-pinned `debian:trixie-slim` container.
- `postgres-privacy.conf` stops PostgreSQL from logging statement text, which would contain searched addresses, into the log the image tails to stdout.
- `.env.example` lists the settings. Copy it to `.env`, which is never committed, and set `NOMINATIM_PASSWORD`.

## Run

```bash
cd infra/geocoding
cp .env.example .env              # set NOMINATIM_PASSWORD and the memory settings
./prepare-extract.sh              # about 6.6 GB of downloads
docker compose up -d              # first start imports, then serves on 127.0.0.1:8080
docker compose logs -f nominatim  # wait for "Nominatim is ready to accept requests"
curl -fsS http://127.0.0.1:8080/status
```

Options:
- `REGIONS` overrides the extract list with Geofabrik paths such as `europe/germany/bremen`.
- `EXTRACT_URLS` replaces Geofabrik with explicit `.osm.pbf` URLs that publish a `.md5` next to them.
- `KEEP_EXISTING=1` reuses extracts already on disk without contacting the server.

For a smoke test, use one small in-market region, the same one CI uses:

```bash
EXTRACT_URLS=https://download.openstreetmap.fr/extracts/europe/austria/wien.osm.pbf ./prepare-extract.sh
```

`osmium-tool` is pinned to the Debian trixie version (`1.18.0-1`). When Debian replaces it with a point release, the merge fails loudly at install. Then update `OSMIUM_VERSION` in the script.

## Sizing

| | Value | Basis |
| --- | --- | --- |
| Downloads | DE 4.6 GB, CZ 0.91 GB, AT 0.78 GB, SK 0.33 GB: about 6.6 GB | Geofabrik, 2026-11-21 |
| Database | about 60–90 GB serving (frozen), up to about 130 GB during the import | Community Germany imports reached 99–108 GB (default style, not frozen); the official planet ratio of `address` to `full` is 545 to 640 GB; `FREEZE` cut the local test database from 679 MB to 303 MB. **Unverified**: measure on the first import |
| Disk | 2 × 512 GB NVMe in RAID 1 (about 476 GB usable) | Peak during a blue/green re-import: the serving database, the new one plus its temporary import tables (osm2pgsql middle, dropped by `FREEZE` at the end), and about 13 GB of extracts. Tight at the upper estimate: if the first import measures above about 150 GB, use RAID 0 (the data is rebuildable) or a larger disk |
| RAM | 64 GB | Import with `maintenance_work_mem` 10 GB and `shm_size` 8 GB; serving uses 10–30 GB (community report) |
| CPU | 6 cores or more | Import time scales with threads |
| Import time | about 12–18 h for all four on a Ryzen 5 3600 with NVMe | Community: Germany alone took 10 h on that CPU with 32 GB RAM. **Unverified** for the four-country extract |
| Germany share | about 70% of data and time | File sizes |

Verified locally on 2026-11-21 (Docker Desktop, 4 CPUs, 8 GB): `prepare-extract.sh` merged Bremen and Liechtenstein (24 MB), and the import with this compose file took 5.6 minutes. `pg_database_size` was 303 MB with `FREEZE` (679 MB without). The Vienna extract (51 MB, the CI smoke region) took 9.4 minutes and gave 467 MB. PostgreSQL ran with `log_min_error_statement = panic`, and neither the container log nor `/var/log` contained any searched street. Small extracts are dominated by fixed overhead, so this does not scale linearly to the four-country import. The startup line `Control server error: [Errno 13] Permission denied: '/root/.gunicorn'` is harmless: the API serves normally.

## Updates

Geofabrik rebuilds extracts daily. A merged file has no single replication feed, and the stock image accepts only one `REPLICATION_URL`. So the cadence is a **monthly re-import, blue/green**:

1. Run `prepare-extract.sh` (one download per region; never in a loop, per Geofabrik's download etiquette).
2. Start a second project on another port with a fresh volume: `docker compose -p geocoding-next up -d` with `NOMINATIM_PORT=8081`.
3. When `/status` returns OK, point the API at the new port, then remove the old project and its volume.

Address data changes slowly, so a month is enough for delivery eligibility. Nominatim's per-region update scripts (`utils/import_multiple_regions.sh` and `update_database.sh`, see the Nominatim "Advanced installations" docs) can bring that down to daily updates later, but they need a custom image.

## Privacy

- Gunicorn starts without an access log, and Nominatim's query log (`NOMINATIM_LOG_FILE`) stays unset, so search parameters are not written to the container logs. Container logs are size-capped (3 × 10 MB).
- Docker-published ports bypass `ufw`/iptables input rules, so the bind address is the real control. Keep the port on `127.0.0.1` or a private network between the API host and the geocoder. Never publish it to the internet.
- The client sends only street, postal code, city and country. It never sends `addressLine2` or instructions, and it logs only `redactAddress` output.
- The database holds only OpenStreetMap data, so it can be rebuilt from Geofabrik at any time and needs no backup.
- Attribution: show "© OpenStreetMap contributors" (ODbL) wherever results are used.

## Integration check

`packages/address/integration/nominatim.test.ts` runs `NominatimGeocoder` against a live instance with the Vienna extract when `NOMINATIM_URL` is set. The CI job `.github/workflows/geocoding-integration.yml` imports that extract on a GitHub-hosted runner, runs these tests, and fails if a searched street appears in the container log or in `/var/log`. `download.geofabrik.de` refuses connections from GitHub-hosted runners, so CI downloads from the OSM France mirror once a week (cached). Run it by hand with:

```bash
NOMINATIM_URL=http://127.0.0.1:8080 node --experimental-strip-types --test packages/address/integration/*.test.ts
```
