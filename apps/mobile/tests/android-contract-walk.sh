#!/usr/bin/env bash
# Runs on a booted emulator with the APK installed (for example after android-smoke.sh, inside the same
# reactivecircus/android-emulator-runner script): walk every native contract ID, then verify the report.
# Starts Appium only when none is listening on 127.0.0.1:4723.
# Usage: android-contract-walk.sh <contracts/sut.json> <outDir>  (use its own outDir, not the smoke one)
set -euo pipefail
contract="$1"
out="$2"
here="$(cd "$(dirname "$0")" && pwd -P)"
mkdir -p "$out"
if ! curl -fsS http://127.0.0.1:4723/status >/dev/null 2>&1; then
  appium --address 127.0.0.1 --port 4723 --log "$out/appium.log" --log-level info --log-no-colors &
  appium_pid=$!
  trap 'kill "$appium_pid" 2>/dev/null || true' EXIT
  for _ in $(seq 1 60); do
    curl -fsS http://127.0.0.1:4723/status >/dev/null 2>&1 && break
    sleep 2
  done
  curl -fsS http://127.0.0.1:4723/status >/dev/null
fi
rm -f "$out/report.json" "$out"/*.xml "$out"/*.png
node --experimental-strip-types "$here/contract-walk.mjs" "$contract" "$out"
node --experimental-strip-types "$here/verify-contract-walk.mjs" "$contract" "$out"
