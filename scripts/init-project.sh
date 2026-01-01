#!/usr/bin/env bash
# Initialize a new project with Claude Code settings and skills from knowledge-base.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/sunwrobert/knowledge-base/main/scripts/init-project.sh | bash
#   ./scripts/init-project.sh [target-directory]

set -euo pipefail

REPO="sunwrobert/knowledge-base"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

SKILLS=(
  bun
  conventional-commits
  effect-ts
  interview-spec
  project-starter
  ultracite
)

TARGET_DIR="${1:-.}"

echo "Initializing Claude Code settings in: ${TARGET_DIR}"

mkdir -p "${TARGET_DIR}/.claude/skills"

echo "Fetching settings.json..."
curl -fsSL "${BASE_URL}/.claude/settings.json" -o "${TARGET_DIR}/.claude/settings.json"

for skill in "${SKILLS[@]}"; do
  echo "Fetching skill: ${skill}..."
  mkdir -p "${TARGET_DIR}/.claude/skills/${skill}"
  curl -fsSL "${BASE_URL}/skills/${skill}/SKILL.md" -o "${TARGET_DIR}/.claude/skills/${skill}/SKILL.md"
done

echo ""
echo "Done! Initialized:"
echo "  .claude/settings.json"
for skill in "${SKILLS[@]}"; do
  echo "  .claude/skills/${skill}/SKILL.md"
done
