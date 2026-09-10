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

## Skills

| Skill                                                                                    | Purpose                                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [thermo-nuclear-code-quality-review](skills/thermo-nuclear-code-quality-review/SKILL.md) | Strict maintainability and structural review                         |
| [thermo-nuclear-review-fix-loop](skills/thermo-nuclear-review-fix-loop/SKILL.md)         | Repeat full reviews and fixes until clean; requires the review skill |
| [agent-browser](skills/agent-browser/SKILL.md)                                           | Browser automation through the installed agent-browser CLI           |
| [humanizer](skills/humanizer/SKILL.md)                                                   | Rewrite AI-sounding prose while preserving meaning                   |
| [i-have-adhd](skills/i-have-adhd/SKILL.md)                                               | Shape responses for ADHD readers                                     |
| [show-me](skills/show-me/SKILL.md)                                                       | Explain with diagrams and focused visual artifacts                   |
| [pr-merge-tracker](skills/pr-merge-tracker/SKILL.md)                                     | Rank PR readiness in the current or requested GitHub repository      |

Copy a skill directory into your agent's skill location, or symlink it from a local checkout. Install both thermo-nuclear skills together for the fix loop. The browser skill requires `agent-browser`; the PR tracker requires an authenticated `gh` CLI. Agent metadata is included where available. Humanizer's MIT license is preserved alongside the skill.

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
