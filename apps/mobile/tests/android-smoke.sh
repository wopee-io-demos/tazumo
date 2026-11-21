#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner: install the APK, start Appium, run the smoke case and the negative self-check.
# Usage: android-smoke.sh <apk> <outDir>
set -euo pipefail
apk="$1"
out="$2"
here="$(cd "$(dirname "$0")" && pwd -P)"
mkdir -p "$out/smoke" "$out/negative"

adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done'
# A slow hosted emulator often raises "Pixel Launcher isn't responding", and that dialog takes the UiAutomator focus.
adb shell settings put global hide_error_dialogs 1
sleep 30
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null || true
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

rm -f "$out/smoke/report.json" "$out/negative/report.json"
node "$here/run-case.mjs" "$here/android-smoke.case.json" "$out/smoke"
node "$here/verify-report.mjs" "$here/android-smoke.case.json" "$out/smoke"
STEP_TIMEOUT_MS=5000 node "$here/run-case.mjs" "$here/android-smoke.negative.case.json" "$out/negative" --expect-fail
node "$here/verify-report.mjs" "$here/android-smoke.negative.case.json" "$out/negative" --expect-fail
