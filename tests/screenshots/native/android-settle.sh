#!/usr/bin/env bash
# Prepares a freshly booted hosted emulator so system ANR dialogs ("Pixel Launcher isn't responding") do not take the UI focus.
# Usage: android-settle.sh boot   (once, after boot)
#        android-settle.sh close  (before each flow or relaunch)
set -euo pipefail
close(){ adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null || true; }
case "${1:-}" in
  boot)
    adb wait-for-device
    adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done'
    adb shell settings put global hide_error_dialogs 1
    sleep "${ANDROID_SETTLE_SECONDS:-30}"
    close
    ;;
  close) close ;;
  *) echo "usage: android-settle.sh boot|close" >&2; exit 2 ;;
esac
