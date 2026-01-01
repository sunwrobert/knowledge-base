## Commands

```bash
bun install          # Install dependencies
bun run typecheck    # Type check with tsgo (native TS)
bun scripts/<file>   # Run utility scripts
```

## Architecture

This is a **canonical knowledge base** for agent skills, scripts, and shared instructions. Other projects reference this repo via pointer-style includes.

- `skills/` — Skill definitions (SKILL.md + optional scripts). Source of truth.
- `.claude/skills/` — Symlinks to `skills/` to activate them in Claude Code.
- `scripts/` — Portable, self-contained utility scripts (no external deps).
- `AGENTS.md` — Shared instructions; `CLAUDE.md` symlinks here.

### Skills Pattern

Skills in `skills/<name>/SKILL.md` are templates. Symlink to `.claude/skills/` to activate:

```bash
ln -s ../../skills/<name> .claude/skills/<name>
```

## Code Philosophy

- Functional > imperative; avoid mutation; prefer pure functions.
- Modular, reusable, concise; no god functions.
- Verifiable: lint, typecheck, test. CI must pass.
- Set up CI early; run all verifiable checks on every push.
- Public functions testable by default; inject deps.
- Types as documentation; make invalid states unrepresentable.
- Commits: Conventional Commits (feat|fix|refactor|build|ci|chore|docs|style|perf|test).

<!-- effect-solutions:start -->

## Effect Best Practices

**Before implementing Effect features**, run `effect-solutions list` and read the relevant guide.

Topics include: services and layers, data modeling, error handling, configuration, testing, HTTP clients, CLIs, observability, and project structure.

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`
Search here for real implementations when docs aren't enough.

<!-- effect-solutions:end -->
