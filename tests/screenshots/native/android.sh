#!/usr/bin/env bash
# Runs inside android-emulator-runner: installs the release-variant APK and captures catalogue and cart.
# Usage: android.sh <path/to/app.apk> <out-dir>
set -euo pipefail
apk="$1" out="$2"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"
adb wait-for-device
adb shell settings put global sysui_demo_allowed 1
demo(){ adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
statusbar(){
  demo enter
  demo clock -e hhmm 0941
  demo battery -e level 100 -e plugged false
  demo network -e wifi show -e level 4 -e fully true
  demo network -e mobile hide
  demo notifications -e visible false
  sleep 1
}
adb shell cmd uimode night no
adb install -r "$apk"
adb shell monkey -p io.wopee.demos.tazumo -c android.intent.category.LAUNCHER 1 >/dev/null
maestro test "$here/wait-catalogue.yaml"
statusbar
adb exec-out screencap -p > "$out/catalogue.png"
maestro test "$here/fill-cart.yaml"
statusbar
adb exec-out screencap -p > "$out/cart.png"
bash "$here/optimise.sh" "$out"
device="$(adb shell getprop ro.product.model | tr -d '\r') emulator"
os="Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"
bash "$here/provenance.sh" "$out/provenance.json" android "$device" "$os" "release-variant APK (JS bundle embedded) signed with the debug keystore, x86_64"
ls -l "$out"
