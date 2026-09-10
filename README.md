# Knowledge Base

Canonical repository for agent skills, scripts, and shared instructions. Use this as the source of truth for all projects. This is a living document for how I like to build projects and write code.

## Structure

```
knowledge-base/
├── AGENTS.md              # Shared agent instructions (code philosophy, etc.)
├── CLAUDE.md -> AGENTS.md # Symlink for Claude Code compatibility
├── scripts/               # Utility scripts
└── skills/                # Portable agent skills
```

## Syncing With Other Repos

- Treat this repo as the canonical mirror for shared scripts and instructions.
- When editing instructions or scripts here, sync changes to consuming repos.
- Scripts are designed to run from this repo's root (not portable to other projects).

## Pointer-Style AGENTS.md

Consuming repos should use a pointer to this repo's instructions:

```markdown
READ ~/Repositories/knowledge-base/AGENTS.md BEFORE ANYTHING (skip if missing).

<!-- repo-specific rules below -->
```

This keeps instructions centralized. Edit once here; all repos inherit updates.

## Scripts

Utility scripts meant to be run from this repo's root:

```bash
bun scripts/<script>.ts
```

Scripts may depend on this repo's dependencies and structure. They are not portable.

## Setup

```bash
bun install
```

### TypeScript

Uses `tsgo` (native TypeScript) for fast typechecking:

```bash
bun run typecheck
```

Effect Language Service is configured for enhanced diagnostics.
