#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner: install the APK, start Appium, run the smoke case and the negative self-check.
# Usage: android-smoke.sh <apk> <outDir>
set -euo pipefail
apk="$1"
out="$2"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out/smoke" "$out/negative"

adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done'
adb install -r -g "$apk"
adb shell getprop ro.build.version.release > "$out/android-version.txt"

appium --address 127.0.0.1 --port 4723 --log "$out/appium.log" --log-level info --log-no-colors &
appium_pid=$!
trap 'kill "$appium_pid" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:4723/status >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1:4723/status >/dev/null

node "$here/run-case.mjs" "$here/android-smoke.case.json" "$out/smoke"
STEP_TIMEOUT_MS=5000 node "$here/run-case.mjs" "$here/android-smoke.negative.case.json" "$out/negative" --expect-fail
