#!/usr/bin/env bash
# Prints web=<bool> and native=<bool>: which captures a change needs.
# Usage: scope.sh <base-sha>; an empty base (push to main, dispatch) selects both.
set -euo pipefail
base="${1:-}"
if [[ -z "$base" ]]; then echo web=true; echo native=true; exit 0; fi
files="$(git diff --name-only "$base"...HEAD)" || { echo web=true; echo native=true; exit 0; }
shared='^(\.github/workflows/screenshots\.yml|tests/screenshots/scope\.sh)$'
web=false native=false
grep -Eq "$shared|^apps/web/|^scripts/capture-web-screenshots\.sh$|^tests/screenshots/[^/]+\.ts$" <<<"$files" && web=true
grep -Eq "$shared|^apps/mobile/|^tests/screenshots/native/" <<<"$files" && native=true
echo "web=$web"
echo "native=$native"
