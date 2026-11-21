# Self-hosted Nominatim (ADR-0023)

Geocoding for delivery addresses in SK, CZ, DE and AT runs on our own Nominatim, on an EU host. The API calls it through `NominatimGeocoder` in `@tazumo/address`. Nothing here is deployed yet: provisioning the host is an owner action tracked in #146.

Never use the public `nominatim.openstreetmap.org` for this: its usage policy forbids personal data, autocomplete and production traffic. `NominatimGeocoder` refuses that host.

## Files

- `compose.yaml` runs `mediagis/nominatim:5.3.3` (Nominatim 5.3.3, PostgreSQL 16), pinned by index digest. It uses the `address` import style, which holds everything down to house numbers but no POIs. It listens on `127.0.0.1` only, and has no flatnode file, because a flatnode file is meant for planet imports: on a country extract it would add a fixed 16 GB or more.
- `prepare-extract.sh` downloads the four Geofabrik extracts, checks their MD5 sums and merges them into `data/markets.osm.pbf`. The merge uses `osmium merge` in a digest-pinned `debian:trixie-slim` container.
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

`REGIONS` overrides the extract list. For a smoke test, use one small in-market region:

```bash
REGIONS="europe/germany/bremen" ./prepare-extract.sh
```

## Sizing

| | Value | Basis |
| --- | --- | --- |
| Downloads | DE 4.6 GB, CZ 0.91 GB, AT 0.78 GB, SK 0.33 GB: about 6.6 GB | Geofabrik, 2026-11-21 |
| Database | about 100–130 GB for the four countries with the `address` style | Extrapolated from community Germany imports of 99–108 GB (default style) and the official planet ratio of `address` to `full` (545 to 640 GB). **Unverified**: measure on the first import |
| Disk | 2 × 512 GB NVMe | Two databases during a blue/green re-import (about 260 GB), plus extracts and headroom |
| RAM | 64 GB | Import with `maintenance_work_mem` 10 GB and `shm_size` 8 GB; serving uses 10–30 GB (community report) |
| CPU | 6 cores or more | Import time scales with threads |
| Import time | about 12–18 h for all four on a Ryzen 5 3600 with NVMe | Community: Germany alone took 10 h on that CPU with 32 GB RAM. **Unverified** for the four-country extract |
| Germany share | about 70% of data and time | File sizes |

Verified locally on 2026-11-21 (Docker Desktop, 4 CPUs, 8 GB): `prepare-extract.sh` merged Bremen and Liechtenstein (24 MB), and the import with this compose file took 6.5 minutes and produced a 1.6 GB database. Small extracts are dominated by fixed overhead, so this does not scale linearly to the four-country import. The startup line `Control server error: [Errno 13] Permission denied: '/root/.gunicorn'` is harmless: the API serves normally.

## Updates

Geofabrik rebuilds extracts daily. A merged file has no single replication feed, and the stock image accepts only one `REPLICATION_URL`. So the cadence is a **monthly re-import, blue/green**:

1. Run `prepare-extract.sh` (one download per region; never in a loop, per Geofabrik's download etiquette).
2. Start a second project on another port with a fresh volume: `docker compose -p geocoding-next up -d` with `NOMINATIM_PORT=8081`.
3. When `/status` returns OK, point the API at the new port, then remove the old project and its volume.

Address data changes slowly, so a month is enough for delivery eligibility. Nominatim's per-region update scripts (`utils/import_multiple_regions.sh` and `update_database.sh`, see the Nominatim "Advanced installations" docs) can bring that down to daily updates later, but they need a custom image.

## Privacy

- Gunicorn starts without an access log, and Nominatim's query log (`NOMINATIM_LOG_FILE`) stays unset, so search parameters are not written to the container logs. Container logs are size-capped (3 × 10 MB).
- Keep the port on `127.0.0.1` or a private network between the API host and the geocoder. Never publish it to the internet.
- The client sends only street, postal code, city and country. It never sends `addressLine2` or instructions, and it logs only `redactAddress` output.
- The database holds only OpenStreetMap data, so it can be rebuilt from Geofabrik at any time and needs no backup.
- Attribution: show "© OpenStreetMap contributors" (ODbL) wherever results are used.

## Integration check

`packages/address/integration/nominatim.test.ts` runs `NominatimGeocoder` against a live instance when `NOMINATIM_URL` is set. Against a Bremen import:

```bash
NOMINATIM_URL=http://127.0.0.1:8080 node --experimental-strip-types --test packages/address/integration/*.test.ts
```
