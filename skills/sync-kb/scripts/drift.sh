#!/usr/bin/env bash
# Prints the agent-plugins diff since `base` for every non-pinned skill in this repo.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd -P)"
skills="$(dirname "$here")"
up="${AGENT_PLUGINS_DIR:-$HOME/.cache/sync-kb/agent-plugins}"
if [ -d "$up/.git" ]; then
  git -C "$up" fetch -q origin main && git -C "$up" checkout -q --detach origin/main
else
  gh repo clone OpenRouterTeam/agent-plugins "$up" -- -q
fi
base="$(cat "$here/base")"
echo "base $base"
echo "head $(git -C "$up" rev-parse HEAD)"
for dir in "$skills"/*/; do
  name="$(basename "$dir")"
  [ -d "$up/skills/$name" ] || continue
  grep -q '^  github-repo:' "$dir/SKILL.md" && continue
  git -C "$up" diff --quiet "$base" HEAD -- "skills/$name" && continue
  echo "=== $name"
  git -C "$up" --no-pager diff "$base" HEAD -- "skills/$name"
done
