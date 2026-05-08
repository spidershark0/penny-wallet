#!/usr/bin/env bash
# Switch demo-vault between mobile (430x932) and desktop (1400x900) modes.
# Usage: bash scripts/switch-mode.sh <mobile|desktop>
set -eu

VAULT=demo-vault
mode=${1:-}

case "$mode" in
  mobile)
    obsidian vault="$VAULT" dev:debug on
    obsidian vault="$VAULT" eval code="app.emulateMobile(true); require('electron').remote.getCurrentWindow().setSize(430, 932);"
    echo "switched to mobile (430x932)"
    ;;
  desktop)
    obsidian vault="$VAULT" dev:debug on
    obsidian vault="$VAULT" eval code="app.emulateMobile(false); require('electron').remote.getCurrentWindow().setSize(1400, 900);"
    echo "switched to desktop (1400x900)"
    ;;
  *)
    echo "usage: bash scripts/switch-mode.sh <mobile|desktop>" >&2
    exit 1
    ;;
esac
