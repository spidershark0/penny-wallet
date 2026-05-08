#!/usr/bin/env bash
# Acceptance checks for visual refactor batch 1 + light theme variables.
# Run from repo root: bash scripts/check-styles.sh
set -u

CSS=styles.css
fail=0
pass() { echo "  ok  $*"; }
fail() { echo "  FAIL  $*"; fail=$((fail+1)); }

echo "== checking $CSS =="

# 1. No hardcoded semantic colors outside token blocks.
# Token blocks are allowed to define palette/shadow values. Transparent overlay
# backgrounds are allowed outside token blocks because they are structural UI
# effects, not type/category semantics.
hex_outside=$(awk '
  /^:root[[:space:]]*\{/ || /^\.theme-light[[:space:]]*\{/ { intokens=1; next }
  intokens && /^\}/ { intokens=0; next }
  !intokens
' "$CSS" \
  | grep -E '#[0-9a-fA-F]{6}|rgba?\([0-9]' \
  | grep -vE 'rgba\(0, 0, 0, (0|0\.35)\)' || true)
if [ -z "$hex_outside" ]; then
  pass "no hardcoded semantic colors outside token blocks"
else
  fail "hardcoded semantic colors found outside token blocks:"
  echo "$hex_outside" | sed 's/^/      /'
fi

# 2. Light theme overrides exist and derive from base variables
light_block=$(awk '/^\.theme-light[[:space:]]*\{/{flag=1} flag{print} flag && /^\}/{flag=0; exit}' "$CSS")
if [ -n "$light_block" ]; then
  pass ".theme-light block exists"
else
  fail ".theme-light block missing"
fi

for token in income expense bank cash credit transfer payment; do
  echo "$light_block" | grep -q -- "--pw-${token}:.*var(--pw-${token}-base)" \
    && pass ".theme-light --pw-${token} derives from --pw-${token}-base" \
    || fail ".theme-light --pw-${token} missing base-derived override"
done

for token in income expense bank credit transfer payment; do
  echo "$light_block" | grep -q -- "--pw-${token}-tint:.*var(--background-primary)" \
    && pass ".theme-light --pw-${token}-tint uses background-primary" \
    || fail ".theme-light --pw-${token}-tint missing background-primary"
done

# 3. .pw-metric-value has tabular-nums + size>=28 + weight>=600
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

# 4. .pw-card has box-shadow
card_block=$(awk '/^\.pw-card[[:space:]]*\{/{flag=1} flag{print} flag && /^\}/{flag=0; exit}' "$CSS")
echo "$card_block" | grep -q 'box-shadow:' \
  && pass ".pw-card has box-shadow" \
  || fail ".pw-card missing box-shadow"

# 5. .pw-card-title has neither text-transform nor letter-spacing
title_block=$(awk '/^\.pw-card-title[[:space:]]*\{/{flag=1} flag{print} flag && /^\}/{flag=0; exit}' "$CSS")
if echo "$title_block" | grep -qE 'text-transform|letter-spacing'; then
  fail ".pw-card-title still has text-transform or letter-spacing"
else
  pass ".pw-card-title clean (no uppercase / letter-spacing)"
fi

# 6. .pw-action-btn defined exactly once
count=$(grep -cE '^\.pw-action-btn[[:space:]]*\{' "$CSS")
if [ "$count" -eq 1 ]; then
  pass ".pw-action-btn defined once"
else
  fail ".pw-action-btn defined $count times (expected 1)"
fi

# 7. :focus-visible rules exist for required selectors
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
