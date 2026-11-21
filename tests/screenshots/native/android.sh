#!/usr/bin/env bash
# Runs inside android-emulator-runner: installs the release-variant APK and captures catalogue, product screen, inline basket and cart screen.
# Usage: android.sh <path/to/app.apk> <out-dir>
set -euo pipefail
apk="$1" out="$2"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"
adb wait-for-device
adb shell settings put global sysui_demo_allowed 1
adb shell settings put global sysui_tuner_demo_on 1
demo(){ adb shell am broadcast -a com.android.systemui.demo -e command "$@" | tr -d '\r' | tail -1; }
statusbar(){
  demo enter
  demo clock -e hhmm 0941
  demo battery -e level 100 -e plugged false
  demo network -e wifi show -e level 4 -e fully true
  demo network -e mobile hide
  demo notifications -e visible false
  sleep 2
}
adb shell cmd uimode night no
adb install -r "$apk"
shoot(){ statusbar; adb exec-out screencap -p > "$out/$1.png"; }
flow(){ maestro test "$here/$1.yaml"; }
capture(){
  adb shell am force-stop io.wopee.demos.tazumo
  adb shell monkey -p io.wopee.demos.tazumo -c android.intent.category.LAUNCHER 1 >/dev/null
  flow wait-catalogue && shoot catalogue &&
  flow product-detail && shoot product &&
  flow back-to-catalogue &&
  flow fill-cart && shoot cart &&
  flow cart-screen && shoot cart-screen
}
capture || { echo "Capture attempt 1 failed; relaunching the app for one retry" >&2; rm -f "$out"/*.png; capture; }
bash "$here/optimise.sh" "$out"
device="$(adb shell getprop ro.product.model | tr -d '\r') emulator"
os="Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"
bash "$here/provenance.sh" "$out/provenance.json" android "$device" "$os" "JDK $(java -version 2>&1 | head -1 | cut -d\" -f2), Gradle wrapper, emulator image google_apis x86_64" "release-variant APK (JS bundle embedded) signed with the debug keystore, x86_64"
ls -l "$out"
