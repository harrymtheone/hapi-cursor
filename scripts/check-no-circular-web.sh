#!/usr/bin/env bash
# scripts/check-no-circular-web.sh
# Phase-9 madge guard — asserts web/src/ has zero internal circular deps.
# The --exclude pattern filters out (a) any ../ sibling sourcemap-derived
# walks and (b) the web/dist mermaid bundle that otherwise reports 60+
# bundler-only cycles. Running from web/ keeps madge's resolver scoped to
# the web workspace.
set -euo pipefail

cd "$(dirname "$0")/.."
cd web

output=$(npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/ 2>&1) || exit_code=$?
exit_code=${exit_code:-0}

if [ "$exit_code" -ne 0 ] || echo "$output" | grep -q '^[0-9]\+)'; then
    echo "❌ Phase-9 madge: circular dependency in web/src/:" >&2
    echo "$output" >&2
    echo "Run: cd web && npx madge --circular --extensions ts,tsx --exclude '(^\\.\\./|web/dist)' src/" >&2
    exit 1
fi

echo "✅ No circular dependencies in web/src/ (madge)."
