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
mobilecli --version
# mobilecli names an emulator by its AVD, not by the adb serial.
export MOBILECLI_DEVICE="$(mobilecli devices | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8")).data.devices.find(x=>x.platform==="android"&&x.state==="online");if(d)console.log(d.id)')"
test -n "$MOBILECLI_DEVICE"
echo "mobilecli device: $MOBILECLI_DEVICE"
adb shell settings put system screen_off_timeout 600000
# A cold software-rendered emulator can raise "Pixel Launcher isn't responding" over the app; let it settle and suppress such dialogs.
adb shell settings put global hide_error_dialogs 1
sleep 20
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null || true
adb shell monkey -p "$app" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 8
adb shell screenrecord --time-limit 180 --bit-rate 8000000 /sdcard/tazumo-flow.mp4 &
recorder=$!
sleep 2
status=0
started=$SECONDS
DEMO_EXPECT_TEXT='Margherita pizza × 1|Subtotal €11.90|Checkout is disabled until payment and delivery integrations are ready.' \
  node "$here/run-case.mjs" "$here/flow-search-add-cart.json" android "$out" || status=$?
node -e 'process.exit(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).outcome==="passed"?0:1)' "$out/report.json" || status=1
if (( SECONDS - started > 170 )); then echo "The flow took longer than the 180 s screenrecord limit allows" >&2; status=1; fi
sleep 2.5
adb shell pkill -INT screenrecord || true
wait "$recorder" || true
sleep 2
adb pull /sdcard/tazumo-flow.mp4 "$out/tazumo-flow-android.mp4"
mobilecli screenshot --device "$MOBILECLI_DEVICE" --output "$out/final.png" >/dev/null || true
exit "$status"
