#!/usr/bin/env bash
# Installs a pinned Maestro CLI release after verifying its sha256.
set -euo pipefail
version="${MAESTRO_VERSION:?}" sum="${MAESTRO_SHA256:?}"
dir="$HOME/.maestro-cli"
curl -fsSL -o "$RUNNER_TEMP/maestro.zip" "https://github.com/mobile-dev-inc/maestro/releases/download/cli-$version/maestro.zip"
echo "$sum  $RUNNER_TEMP/maestro.zip" | shasum -a 256 -c -
rm -rf "$dir" && mkdir -p "$dir"
unzip -q "$RUNNER_TEMP/maestro.zip" -d "$dir"
echo "$dir/maestro/bin" >> "$GITHUB_PATH"
