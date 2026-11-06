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

## Skills

`skills/` holds 94 skills. Link them at user scope so every agent (Claude Code, Codex, Cursor, Pi) picks them up. The loop skips any name that already exists, so an employer's internal version of a skill keeps precedence on a work machine:

```bash
mkdir -p ~/.agents/skills ~/.claude/skills
for d in "$HOME"/Repositories/knowledge-base/skills/*/; do
  n=$(basename "$d")
  [ -e ~/.agents/skills/"$n" ] || ln -s "${d%/}" ~/.agents/skills/"$n"
  [ -e ~/.claude/skills/"$n" ] || ln -s ../../.agents/skills/"$n" ~/.claude/skills/"$n"
done
```

- Skills with `metadata.github-repo` in their frontmatter are installed with `gh skill install <owner>/<repo> <path> --pin <sha> --dir skills` and stay byte-identical to that pin. Refresh them by reinstalling at a new pin, never by hand-editing. `.prettierignore` keeps the formatter off them.
- The rest are personal skills. `skill-sources.json` records the source of every skill.
- Start with `solar-mode` for the working style; it routes each step to the skill that owns it.

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
