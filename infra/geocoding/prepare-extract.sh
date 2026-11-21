#!/usr/bin/env bash
# Downloads the Geofabrik extracts for the Tazumo markets, verifies their MD5 sums and merges them
# into $NOMINATIM_DATA_DIR/markets.osm.pbf for compose.yaml. Run it once per import, not on a schedule loop.
set -euo pipefail

REGIONS=${REGIONS:-"europe/slovakia europe/czech-republic europe/germany europe/austria"}
DATA_DIR=${NOMINATIM_DATA_DIR:-"$(dirname "$0")/data"}
GEOFABRIK=${GEOFABRIK_BASE:-https://download.geofabrik.de}
OSMIUM_IMAGE=debian:trixie-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2
USER_AGENT="tazumo-geocoding-import/1 (self-hosted Nominatim; +https://github.com/wopee-io-demos/tazumo)"

md5of() { if command -v md5sum >/dev/null; then md5sum "$1" | cut -d' ' -f1; else md5 -q "$1"; fi; }

mkdir -p "$DATA_DIR/extracts"
DATA_DIR=$(cd "$DATA_DIR" && pwd)
files=()
for region in $REGIONS; do
  name=${region##*/}
  url="$GEOFABRIK/$region/$name-latest.osm.pbf"
  target="$DATA_DIR/extracts/$name.osm.pbf"
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
  files+=("/data/extracts/$name.osm.pbf")
done

if [ ${#files[@]} -eq 1 ]; then
  cp "$DATA_DIR/extracts/${files[0]##*/}" "$DATA_DIR/markets.osm.pbf"
else
  docker run --rm -e DEBIAN_FRONTEND=noninteractive -v "$DATA_DIR:/data" "$OSMIUM_IMAGE" sh -c \
    "apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends osmium-tool >/dev/null && osmium merge --overwrite -o /data/markets.osm.pbf $(printf '%s ' "${files[@]}")"
fi
ls -lh "$DATA_DIR/markets.osm.pbf"
