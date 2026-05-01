#!/usr/bin/env bash
# Acceptance checks for visual refactor batch 1.
# Run from repo root: bash scripts/check-styles.sh
set -u

CSS=styles.css
fail=0
pass() { echo "  ok  $*"; }
fail() { echo "  FAIL  $*"; fail=$((fail+1)); }

echo "== checking $CSS =="

# 1. No hardcoded hex/rgba outside :root block
hex_outside=$(awk '/^:root[[:space:]]*\{/{inroot=1; next} inroot && /^\}/{inroot=0; next} !inroot' "$CSS" \
  | grep -E '#[0-9a-fA-F]{6}|rgba?\([0-9]' || true)
if [ -z "$hex_outside" ]; then
  pass "no hex/rgba outside :root"
else
  fail "hex/rgba found outside :root:"
  echo "$hex_outside" | sed 's/^/      /'
fi

# 2. .pw-metric-value has tabular-nums + size>=28 + weight>=600
mv_block=$(awk '/^\.pw-metric-value[[:space:]]*\{/{flag=1} flag{print} flag && /^\}/{flag=0; exit}' "$CSS")
echo "$mv_block" | grep -q 'font-variant-numeric:[[:space:]]*tabular-nums' \
  && pass ".pw-metric-value has tabular-nums" \
  || fail ".pw-metric-value missing tabular-nums"

mv_size=$(echo "$mv_block" | grep -oE 'font-size:[[:space:]]*[0-9]+' | grep -oE '[0-9]+')
if [ -n "$mv_size" ] && [ "$mv_size" -ge 28 ]; then
  pass ".pw-metric-value font-size $mv_size >= 28"
else
  fail ".pw-metric-value font-size $mv_size < 28"
fi

mv_weight=$(echo "$mv_block" | grep -oE 'font-weight:[[:space:]]*[0-9]+' | grep -oE '[0-9]+')
if [ -n "$mv_weight" ] && [ "$mv_weight" -ge 600 ]; then
  pass ".pw-metric-value font-weight $mv_weight >= 600"
else
  fail ".pw-metric-value font-weight $mv_weight < 600"
fi

# 3. .pw-card has box-shadow
card_block=$(awk '/^\.pw-card[[:space:]]*\{/{flag=1} flag{print} flag && /^\}/{flag=0; exit}' "$CSS")
echo "$card_block" | grep -q 'box-shadow:' \
  && pass ".pw-card has box-shadow" \
  || fail ".pw-card missing box-shadow"

# 4. .pw-card-title has neither text-transform nor letter-spacing
title_block=$(awk '/^\.pw-card-title[[:space:]]*\{/{flag=1} flag{print} flag && /^\}/{flag=0; exit}' "$CSS")
if echo "$title_block" | grep -qE 'text-transform|letter-spacing'; then
  fail ".pw-card-title still has text-transform or letter-spacing"
else
  pass ".pw-card-title clean (no uppercase / letter-spacing)"
fi

# 5. .pw-action-btn defined exactly once
count=$(grep -cE '^\.pw-action-btn[[:space:]]*\{' "$CSS")
if [ "$count" -eq 1 ]; then
  pass ".pw-action-btn defined once"
else
  fail ".pw-action-btn defined $count times (expected 1)"
fi

# 6. :focus-visible rules exist for required selectors
for sel in pw-action-btn pw-nav-btn pw-pill pw-range-btn pw-txn-btn pw-cat-toggle; do
  if grep -qE "\.${sel}:focus-visible" "$CSS"; then
    pass ":focus-visible exists for .${sel}"
  else
    fail ":focus-visible missing for .${sel}"
  fi
done

echo ""
if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "$fail check(s) failed."
  exit 1
fi
