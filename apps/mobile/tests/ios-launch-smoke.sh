#!/usr/bin/env bash
# Installs the simulator .app on the newest iOS 27.x and 26.x runtimes (or the newest available one), launches it and
# fails if the launched process dies or writes a crash report before the settle time ends. Checks native launch only:
# the Debug build has no embedded JS bundle. Each run uses its own simulators and deletes them.
# Usage: REQUIRE_IOS=27 ios-launch-smoke.sh <path/to/Tazumo.app> <out-dir> [settle-seconds]
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
    while read -r udid; do xcrun simctl shutdown "$udid" </dev/null 2>/dev/null || true; xcrun simctl delete "$udid" </dev/null || true; done
}
trap cleanup EXIT

echo "Built with SDK: $(/usr/libexec/PlistBuddy -c 'Print :DTSDKName' "$app/Info.plist" 2>/dev/null || echo unknown)"

runtimes="$(xcrun simctl list runtimes available -j | node -e "
  const r=JSON.parse(require('fs').readFileSync(0)).runtimes.filter(x=>x.platform==='iOS');
  r.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}));
  const pick=['27.','26.'].map(v=>r.find(x=>x.version.startsWith(v))).filter(Boolean);
  for(const x of (pick.length?pick:r.slice(0,1))){
    const t=(x.supportedDeviceTypes||[]).filter(t=>t.productFamily==='iPhone').pop();
    if(t)console.log(x.identifier+' '+t.identifier+' '+x.version);
  }")"
test -n "$runtimes" || { echo "No iOS simulator runtime available" >&2; exit 1; }
if [ -n "${REQUIRE_IOS:-}" ] && ! grep -q " ${REQUIRE_IOS}\." <<< "$runtimes"; then
  echo "Required iOS ${REQUIRE_IOS}.x simulator runtime is not installed" >&2
  exit 1
fi

failed=0
while read -r runtime devtype version <&3; do
  udid="$(xcrun simctl create "$prefix-$version" "$devtype" "$runtime")"
  xcrun simctl boot "$udid"
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl install "$udid" "$app"
  pid="$(xcrun simctl launch "$udid" "$bundle" | sed -n "s/^$bundle: //p")"
  sleep "$settle"
  xcrun simctl io "$udid" screenshot --type=png "$out/ios-$version.png" >/dev/null 2>&1 || true
  crash="$(grep -lE "\"pid\" ?: ?${pid:-none}[,}]" "$HOME/Library/Logs/DiagnosticReports"/Tazumo-*.ips 2>/dev/null | while read -r f; do [ "$f" -nt "$marker" ] && echo "$f"; done || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && [ -z "$crash" ]; then
    echo "iOS $version: pid $pid running after ${settle}s"
  else
    echo "iOS $version: pid ${pid:-unknown} not running after ${settle}s${crash:+, crash report $crash}" >&2
    [ -n "$crash" ] && cp "$crash" "$out/"
    failed=1
  fi
  xcrun simctl shutdown "$udid" || true
done 3<<< "$runtimes"
exit "$failed"
