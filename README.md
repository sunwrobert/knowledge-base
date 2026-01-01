# Knowledge Base

Canonical repository for agent skills, scripts, and shared instructions. Use this as the source of truth for all projects. This is a living document for how I like to build projects and write code.

## Structure

```
knowledge-base/
├── AGENTS.md              # Shared agent instructions (code philosophy, etc.)
├── CLAUDE.md -> AGENTS.md # Symlink for Claude Code compatibility
├── skills/                # Skill definitions (source of truth)
│   ├── bun/               # Bun runtime preferences
│   ├── effect-ts/         # Effect TypeScript patterns + setup
│   └── skill-author/      # How to write effective skills
├── scripts/               # Portable utility scripts
└── .claude/skills/        # Symlinks to active skills
```

## Syncing With Other Repos

- Treat this repo as the canonical mirror for shared skills and instructions.
- When editing skills or scripts here, sync changes to consuming repos.
- Keep files dependency-free and portable: scripts must run in isolation.

## Pointer-Style AGENTS.md

Consuming repos should use a pointer to this repo's instructions:

```markdown
READ ~/Repositories/knowledge-base/AGENTS.md BEFORE ANYTHING (skip if missing).

<!-- repo-specific rules below -->
```

This keeps instructions centralized. Edit once here; all repos inherit updates.

## Skills

Skills teach Claude specific capabilities. Each skill has a `SKILL.md` with frontmatter + instructions.

| Skill          | Description                        |
| -------------- | ---------------------------------- |
| `bun`          | Prefer Bun over Node.js, npm, vite |
| `effect-ts`    | Effect TypeScript setup + patterns |
| `skill-author` | Best practices for writing skills  |

### Activating Skills

Skills in `skills/` are the source of truth. Symlink them to `.claude/skills/` to activate:

```bash
ln -s ../../skills/<skill-name> .claude/skills/<skill-name>
```

## Scripts

Portable utility scripts. Run with Bun:

```bash
bun scripts/<script>.ts
```

Keep scripts self-contained with no external dependencies.

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
