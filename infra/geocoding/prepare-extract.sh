#!/usr/bin/env bash
# Downloads the Geofabrik extracts for the Tazumo markets, verifies their MD5 sums and merges them
# into $NOMINATIM_DATA_DIR/markets.osm.pbf for compose.yaml. Run it once per import, not on a schedule loop.
# KEEP_EXISTING=1 reuses extracts already on disk without contacting the server (used by CI with a weekly cache).
# EXTRACT_URLS replaces the Geofabrik list with explicit .osm.pbf URLs that publish a .md5 next to them (CI uses a
# download.openstreetmap.fr extract because GitHub-hosted runners cannot reach download.geofabrik.de).
set -euo pipefail

REGIONS=${REGIONS:-"europe/slovakia europe/czech-republic europe/germany europe/austria"}
DATA_DIR=${NOMINATIM_DATA_DIR:-"$(dirname "$0")/data"}
GEOFABRIK=${GEOFABRIK_BASE:-https://download.geofabrik.de}
OSMIUM_IMAGE=debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
export OSMIUM_VERSION=1.18.0-1
USER_AGENT="tazumo-geocoding-import/1 (self-hosted Nominatim; +https://github.com/wopee-io-demos/tazumo)"

md5of() { if command -v md5sum >/dev/null; then md5sum "$1" | cut -d' ' -f1; else md5 -q "$1"; fi; }

mkdir -p "$DATA_DIR/extracts"
DATA_DIR=$(cd "$DATA_DIR" && pwd)
urls=()
if [ -n "${EXTRACT_URLS:-}" ]; then
  for url in $EXTRACT_URLS; do
    [[ $url =~ ^https://[A-Za-z0-9.-]+/[A-Za-z0-9/_.-]+\.osm\.pbf$ && $url != *..* ]] || { echo "Invalid extract URL: $url" >&2; exit 1; }
    urls+=("$url")
  done
else
  for region in $REGIONS; do
    [[ $region =~ ^[a-z0-9-]+(/[a-z0-9-]+)*$ ]] || { echo "Invalid region: $region" >&2; exit 1; }
    urls+=("$GEOFABRIK/$region/${region##*/}-latest.osm.pbf")
  done
fi

files=()
for url in "${urls[@]}"; do
  name=${url##*/}
  name=${name%.osm.pbf}
  name=${name%-latest}
  target="$DATA_DIR/extracts/$name.osm.pbf"
  files+=("/data/extracts/$name.osm.pbf")
  if [ "${KEEP_EXISTING:-0}" = 1 ] && [ -s "$target" ]; then
    echo "Keeping $target"
    continue
  fi
  echo "Fetching $url"
  curl -fsSL --retry 3 -A "$USER_AGENT" -o "$target.md5" "$url.md5"
  expected=$(cut -d' ' -f1 "$target.md5")
  if [ -f "$target" ] && [ "$(md5of "$target")" = "$expected" ]; then
    echo "  already current"
  else
    curl -fSL --retry 3 -A "$USER_AGENT" -o "$target.part" "$url"
    [ "$(md5of "$target.part")" = "$expected" ] || { echo "MD5 mismatch for $name" >&2; rm -f "$target.part"; exit 1; }
    mv "$target.part" "$target"
  fi
done

if [ ${#files[@]} -eq 1 ]; then
  cp "$DATA_DIR/extracts/${files[0]##*/}" "$DATA_DIR/markets.osm.pbf"
else
  docker run --rm -e DEBIAN_FRONTEND=noninteractive -e OSMIUM_VERSION -v "$DATA_DIR:/data" "$OSMIUM_IMAGE" sh -c \
    'apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends "osmium-tool=$OSMIUM_VERSION" >/dev/null && osmium merge --overwrite -o /data/markets.osm.pbf "$@"' \
    merge "${files[@]}"
fi
ls -lh "$DATA_DIR/markets.osm.pbf"
