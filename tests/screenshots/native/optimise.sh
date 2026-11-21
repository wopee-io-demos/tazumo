#!/usr/bin/env bash
# Quantises every PNG in <dir> with pngquant and fails if one exceeds 300 KB.
set -euo pipefail
for f in "$1"/*.png; do
  pngquant --quality 80-95 --speed 1 --strip --force --skip-if-larger --output "$f" "$f" || { rc=$?; [[ $rc == 98 || $rc == 99 ]]; }
  size="$(wc -c < "$f")"
  (( size <= ${SCREENSHOT_MAX_BYTES:-307200} )) || { echo "$(basename "$f") is $size bytes" >&2; exit 1; }
done
