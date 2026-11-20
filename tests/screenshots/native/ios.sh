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
xcrun simctl launch "$udid" io.wopee.demos.tazumo
maestro --device "$udid" test "$here/wait-catalogue.yaml"
xcrun simctl io "$udid" screenshot --type=png "$out/catalogue.png"
maestro --device "$udid" test "$here/fill-cart.yaml"
xcrun simctl io "$udid" screenshot --type=png "$out/cart.png"
device="$(xcrun simctl list devices -j | node -e "const d=JSON.parse(require('fs').readFileSync(0));for(const [r,l] of Object.entries(d.devices))for(const x of l)if(x.udid==='$udid')console.log(x.name+' ('+r.split('.').pop()+')')")"
bash "$here/provenance.sh" "$out/provenance.json" ios "$device simulator" "$(sw_vers -productName) $(sw_vers -productVersion), $(xcodebuild -version | tr '\n' ' ')" "Release iphonesimulator build (JS bundle embedded), unsigned"
ls -l "$out"
