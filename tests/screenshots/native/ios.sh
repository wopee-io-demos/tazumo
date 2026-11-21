#!/usr/bin/env bash
# Boots an iOS simulator, installs the Release simulator build and captures catalogue and cart.
# Usage: ios.sh <path/to/Tazumo.app> <udid> <out-dir>
set -euo pipefail
app="$1" udid="$2" out="$3"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"
xcrun simctl bootstatus "$udid" -b
xcrun simctl ui "$udid" appearance light
xcrun simctl status_bar "$udid" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
xcrun simctl install "$udid" "$app"
shoot(){ xcrun simctl io "$udid" screenshot --type=png "$out/$1.png"; }
flow(){ maestro --device "$udid" test "$here/$1.yaml"; }
capture(){
  xcrun simctl terminate "$udid" io.wopee.demos.tazumo 2>/dev/null || true
  xcrun simctl launch "$udid" io.wopee.demos.tazumo
  flow wait-catalogue && shoot catalogue &&
  flow fill-cart && shoot cart
}
capture || { echo "Capture attempt 1 failed; relaunching the app for one retry" >&2; rm -f "$out"/*.png; capture; }
bash "$here/optimise.sh" "$out"
device="$(xcrun simctl list devices -j | node -e "const [u]=process.argv.slice(1);const d=JSON.parse(require('fs').readFileSync(0)).devices;for(const [r,l] of Object.entries(d))for(const x of l)if(x.udid===u)console.log(x.name+' simulator, '+r.split('.').pop().replace(/^iOS-(\\d+)-(\\d+)$/,'iOS \$1.\$2'))" "$udid")"
xcode="$(xcodebuild -version | paste -sd ' ' -), SDK $(xcrun --sdk iphonesimulator --show-sdk-version), host $(sw_vers -productName) $(sw_vers -productVersion)"
bash "$here/provenance.sh" "$out/provenance.json" ios "$device" "$xcode" "Release iphonesimulator build (JS bundle embedded), unsigned"
ls -l "$out"
