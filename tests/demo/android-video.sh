#!/usr/bin/env bash
# Usage: bash tests/demo/android-video.sh <app-release.apk> <out-dir>
# Installs the APK on the running emulator, records the screen while run-case.mjs drives the demo flow, and pulls the mp4.
set -euo pipefail
apk="$1"; out="$2"
here="$(cd "$(dirname "$0")" && pwd)"
app=io.wopee.demos.tazumo
mkdir -p "$out"
adb wait-for-device
adb install -r "$apk"
export MOBILECLI_DEVICE="$(adb devices | awk 'NR>1 && $2=="device"{print $1; exit}')"
test -n "$MOBILECLI_DEVICE"
mobilecli --version
mobilecli devices
adb shell settings put system screen_off_timeout 600000
adb shell monkey -p "$app" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 8
adb shell screenrecord --bit-rate 8000000 /sdcard/tazumo-flow.mp4 &
recorder=$!
sleep 2
status=0
DEMO_EXPECT_TEXT='Margherita pizza × 1|Subtotal €11.90|Checkout is disabled until payment and delivery integrations are ready.' \
  node "$here/run-case.mjs" "$here/flow-search-add-cart.json" android "$out" || status=$?
sleep 2.5
adb shell pkill -INT screenrecord || true
wait "$recorder" || true
sleep 2
adb pull /sdcard/tazumo-flow.mp4 "$out/tazumo-flow-android.mp4"
mobilecli screenshot --device "$MOBILECLI_DEVICE" --output "$out/final.png" >/dev/null || true
exit "$status"
