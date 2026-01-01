---
name: repo-docs
description: Clone and sync documentation repos to ~/.local/repos for local reference. Use when the user wants to clone a repo for offline access, sync external documentation, or reference third-party source code locally.
---

# repo-docs

Clone and sync documentation repositories to `~/.local/repos` for local reference.

## Usage

```bash
# Clone a repo (or pull if already exists)
bun scripts/repo-docs/repo-docs.ts <url>

# Sync all repos in ~/.local/repos
bun scripts/repo-docs/repo-docs.ts --sync-all
```

## Examples

```bash
# Clone Effect-TS for reference
bun scripts/repo-docs/repo-docs.ts https://github.com/Effect-TS/effect

# Clone multiple repos
bun scripts/repo-docs/repo-docs.ts https://github.com/anthropics/anthropic-sdk-typescript
bun scripts/repo-docs/repo-docs.ts https://github.com/anthropics/courses

# Update all cloned repos
bun scripts/repo-docs/repo-docs.ts --sync-all
```

## Behavior

- **Target directory**: `~/.local/repos/{org}/{repo}`
- **Shallow clones**: Uses `--depth 1` for speed
- **Auto-pull**: If repo exists, pulls instead of failing
- **Parallel sync**: `--sync-all` runs pulls concurrently
