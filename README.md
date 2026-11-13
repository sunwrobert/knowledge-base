# Knowledge Base

Canonical repository for agent skills, scripts, and shared instructions. Use this as the source of truth for all projects. This is a living document for how I like to build projects and write code.

## Structure

```
knowledge-base/
├── skills/<skill>/                  # Every skill, as real files
├── plugins/solar/                   # The solar plugin: solar-mode and all it needs
├── .claude-plugin/marketplace.json  # Catalog for Claude Code and Codex
├── .devin-plugin/plugin.json        # Meta-plugin for Devin
├── docs/AGENTS.md                   # Shared agent instructions (code philosophy, etc.)
├── scripts/                         # Utility scripts
└── setup/                           # New Mac setup: Brewfile, dotfiles, setup.sh
```

The repo follows the [Agent Plugins](https://agent-plugins.org) format, so Devin, Claude Code, Codex and Cursor read the same files. Contributor rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## The solar plugin

`plugins/solar` is the working style as one installable unit. `solar-mode` is its entry point, and the plugin holds every skill `solar-mode` routes to, directly or through another skill: 53 of the 74 skills here. `bun run validate` fails when a skill in the plugin links to one outside it.

**Claude Code**

```
/plugin marketplace add sunwrobert/knowledge-base
/plugin install solar@knowledge-base
```

**Codex**: `codex plugin marketplace add https://github.com/sunwrobert/knowledge-base.git`.

**Devin**: Customize > Plugins > Add plugin > From repository > `sunwrobert/knowledge-base`, or `devin plugins install sunwrobert/knowledge-base#plugins/solar`.

**Cursor**: install `plugins/solar` as an Agent Plugin.

## All skills

`skills/` holds 74 skills, 21 of them outside the solar plugin. Link them at user scope so every agent (Claude Code, Codex, Cursor, Pi) picks them up. The loop skips any name that already exists, so an employer's internal version of a skill keeps precedence on a work machine:

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

## Syncing With Other Repos

- Treat this repo as the canonical mirror for shared scripts and instructions.
- When editing instructions or scripts here, sync changes to consuming repos.
- Scripts are designed to run from this repo's root (not portable to other projects).

## Pointer-style AGENTS.md

Consuming repos should use a pointer to this repo's instructions:

```markdown
READ ~/Repositories/knowledge-base/docs/AGENTS.md BEFORE ANYTHING (skip if missing).

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
