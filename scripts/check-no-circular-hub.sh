#!/usr/bin/env bash
# scripts/check-no-circular-hub.sh
# Phase-8 madge guard — asserts hub/src/ has zero internal circular deps.
# The --exclude pattern filters out (a) any ../web/dist sibling sourcemap-derived
# walks and (b) any accidental import that resolved up out of hub/src/. Running
# from hub/ keeps madge's resolver scoped to the hub workspace.
set -euo pipefail

cd "$(dirname "$0")/.."
cd hub

output=$(npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/ 2>&1) || exit_code=$?
exit_code=${exit_code:-0}

if [ "$exit_code" -ne 0 ] || echo "$output" | grep -q '^[0-9]\+)'; then
    echo "❌ Phase-8 madge: circular dependency in hub/src/:" >&2
    echo "$output" >&2
    echo "Run: cd hub && npx madge --circular --extensions ts,tsx --exclude '(^\\.\\./|web/dist)' src/" >&2
    exit 1
fi

echo "✅ No circular dependencies in hub/src/ (madge)."
