#!/usr/bin/env bash
# Installs the simulator .app on the newest iOS 27.x and 26.x runtimes (or the newest available one), launches it and
# fails if it crashes or is not running after the settle time. Each run uses its own simulators and deletes them.
# Usage: ios-launch-smoke.sh <path/to/Tazumo.app> <out-dir> [settle-seconds]
set -euo pipefail
app="$1"
out="$2"
settle="${3:-20}"
bundle="io.wopee.demos.tazumo"
prefix="tazumo-launch-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
mkdir -p "$out"
marker="$out/.start"
touch "$marker"

cleanup() {
  xcrun simctl list devices -j | node -e "const p=process.argv[1];for(const l of Object.values(JSON.parse(require('fs').readFileSync(0)).devices))for(const d of l)if(d.name.startsWith(p))console.log(d.udid)" "$prefix" |
    while read -r udid; do xcrun simctl shutdown "$udid" 2>/dev/null || true; xcrun simctl delete "$udid" || true; done
}
trap cleanup EXIT

runtimes="$(xcrun simctl list runtimes available -j | node -e "
  const r=JSON.parse(require('fs').readFileSync(0)).runtimes.filter(x=>x.platform==='iOS');
  r.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}));
  const pick=['27.','26.'].map(v=>r.find(x=>x.version.startsWith(v))).filter(Boolean);
  for(const x of (pick.length?pick:r.slice(0,1))){
    const t=(x.supportedDeviceTypes||[]).filter(t=>t.productFamily==='iPhone').pop();
    if(t)console.log(x.identifier+' '+t.identifier+' '+x.version);
  }")"
test -n "$runtimes" || { echo "No iOS simulator runtime available" >&2; exit 1; }

failed=0
while read -r runtime devtype version; do
  name="$prefix-$version"
  udid="$(xcrun simctl create "$name" "$devtype" "$runtime")"
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl install "$udid" "$app"
  xcrun simctl launch "$udid" "$bundle" >/dev/null
  sleep "$settle"
  xcrun simctl io "$udid" screenshot --type=png "$out/ios-$version.png" >/dev/null 2>&1 || true
  if xcrun simctl spawn "$udid" launchctl list | grep -q "UIKitApplication:$bundle"; then
    echo "iOS $version: running after ${settle}s"
  else
    echo "iOS $version: NOT running after ${settle}s" >&2
    failed=1
  fi
  xcrun simctl shutdown "$udid" || true
done <<< "$runtimes"

crashes="$(find "$HOME/Library/Logs/DiagnosticReports" -maxdepth 1 -name 'Tazumo-*.ips' -newer "$marker" 2>/dev/null || true)"
if [ -n "$crashes" ]; then
  echo "Crash reports written during the launch smoke:" >&2
  echo "$crashes" >&2
  while read -r f; do cp "$f" "$out/"; done <<< "$crashes"
  failed=1
fi
exit "$failed"
