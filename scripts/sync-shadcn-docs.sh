#!/bin/bash

# Sync shadcn UI component documentation from shadcn.com

set -e

DOCS_DIR="docs/plans/ui"
SHADCN_URL="https://ui.shadcn.com/docs/components"
PARALLEL_JOBS=10

mkdir -p "$DOCS_DIR"

# Function to fetch a single component
fetch_component() {
  local name="$1"
  local docs_dir="$2"
  local base_url="$3"

  if curl -sf "${base_url}/${name}.md" -o "${docs_dir}/${name}.md" 2>/dev/null; then
    echo "✓ $name"
  else
    cat > "${docs_dir}/${name}.md" << EOF
# ${name}

Custom component - no shadcn documentation available.

See: \`apps/web/src/components/ui/${name}.tsx\`
EOF
    echo "⊘ $name (custom)"
  fi
}

export -f fetch_component
export DOCS_DIR SHADCN_URL

# Get component names from existing UI files
components=$(ls apps/web/src/components/ui/*.tsx 2>/dev/null | xargs -n1 basename | sed 's/\.tsx$//')
count=$(echo "$components" | wc -w | tr -d ' ')

echo "Syncing $count shadcn docs to $DOCS_DIR (${PARALLEL_JOBS} parallel)..."
echo ""

# Fetch in parallel
echo "$components" | xargs -P "$PARALLEL_JOBS" -I {} bash -c 'fetch_component "$@"' _ {} "$DOCS_DIR" "$SHADCN_URL"

echo ""
echo "Done!"
