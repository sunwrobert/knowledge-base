# Knowledge Base Agent Instructions

Canonical repository for agent skills, scripts, and shared instructions. This is the source of truth for coding standards.

## Commands

```bash
# Setup
bun install                    # Install dependencies

# Verification (run before completing work)
bun run check                  # Lint with ultracite (type-aware)
bun run check-types            # Typecheck with tsgo (native TS)
bun run test:unit              # Run all unit tests

# Fixing
bun run fix                    # Auto-fix lint/format issues

# Running scripts
bun scripts/<file>.ts          # Run utility scripts

# Single test file
bun run test:unit <path>       # e.g., bun run test:unit scripts/repo-docs/utils.test.ts
```

## Architecture

```
knowledge-base/
├── skills/                    # Skill definitions (source of truth)
│   └── <skill>/SKILL.md       # Skill instructions + optional refs/scripts
├── .claude/skills/            # Symlinks to skills/ (activates them)
├── scripts/                   # Utility scripts (run from repo root)
├── AGENTS.md                  # Shared agent instructions
└── CLAUDE.md -> AGENTS.md     # Symlink for Claude Code
```

### Skills Pattern

Skills in `skills/<name>/SKILL.md` are templates. Symlink to activate:

```bash
ln -s ../../skills/<skill> .claude/skills/<skill>
```

## Code Style

### Formatting (oxfmt)

- **Line width**: 80 characters
- **Indent**: 2 spaces (no tabs)
- **Quotes**: Double quotes (`"`)
- **Semicolons**: Always
- **Trailing commas**: ES5 style
- **Bracket spacing**: Yes (`{ foo }`)
- **Arrow parens**: Always (`(x) => x`)

### Imports

- Sorted alphabetically, case-insensitive
- Newlines between import groups
- Use named imports, avoid namespace imports (`import * as`)
- Avoid barrel files (index re-exports)

```typescript
import { Args, Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import * as FileSystem from "@effect/platform/FileSystem";
import { Array as Arr, Effect, Option } from "effect";

import { formatOutput, parseRepoParts } from "./utils";
```

### Types

- **Strict mode enabled**: All strict flags on
- **No `any`**: Use `unknown` when type is genuinely unknown
- **No type assertions**: Prefer type narrowing over `as`
- **No suppression comments**: Never use `@ts-ignore`, `@ts-expect-error`
- **Readonly by default**: Use `readonly` for object properties
- **Explicit return types**: Optional but encouraged for public APIs

```typescript
// Types as documentation - make invalid states unrepresentable
export type RepoParts = {
  readonly org: string;
  readonly repo: string;
};

// Use const assertions for literals
const config = { mode: "production" } as const;
```

### Naming

- **Functions/variables**: camelCase
- **Types/Classes**: PascalCase
- **Constants**: camelCase (not SCREAMING_CASE)
- **Files**: kebab-case for scripts, camelCase for modules

### Error Handling

**In Effect code**: Always use `Data.TaggedError`:

```typescript
class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string;
}> {}

// Use with Effect.fail
Effect.fail(new NotFoundError({ id: "123" }));

// Handle with catchTag
Effect.catchTag("NotFoundError", (e) => Effect.succeed(null));
```

**In plain TypeScript**: Throw Error objects with descriptive messages.

### Functions

- **Functional**: Prefer pure functions, avoid mutation
- **Small**: No god functions, single responsibility
- **Arrow functions**: For callbacks and short functions
- **Early returns**: Reduce nesting with guard clauses

```typescript
// Pure, small, focused
export const stripGitSuffix = (value: string): string =>
  value.endsWith(".git") ? value.slice(0, -4) : value;

// Early return pattern
export const parseRepoParts = (raw: string): Option.Option<RepoParts> => {
  const segments = extractPath(raw).split("/").filter(Boolean);
  if (segments.length < 2) return Option.none();
  // ...
};
```

### Testing (Vitest)

- **File naming**: `*.test.ts` adjacent to source
- **Structure**: `describe` for grouping, `it` for cases
- **No `.only`/`.skip`** in committed code
- **Async**: Use async/await, not done callbacks

```typescript
import { describe, expect, it } from "vitest";
import { stripGitSuffix } from "./utils";

describe("stripGitSuffix", () => {
  it("removes .git suffix", () => {
    expect(stripGitSuffix("repo.git")).toBe("repo");
  });

  it("leaves strings without .git unchanged", () => {
    expect(stripGitSuffix("repo")).toBe("repo");
  });
});
```

## Code Philosophy

1. **Functional > imperative**: Avoid mutation, prefer pure functions
2. **Types as documentation**: Make invalid states unrepresentable
3. **Modular**: Reusable, focused functions with injected deps
4. **Verifiable**: Lint, typecheck, test. CI must pass.
5. **Effect-TS**: Use for services, typed errors, and composition

## Commit Messages

Use Conventional Commits: `type(scope): description`

| Type       | When                                |
| ---------- | ----------------------------------- |
| `feat`     | New functionality                   |
| `fix`      | Bug fix                             |
| `refactor` | Restructure without behavior change |
| `docs`     | Documentation only                  |
| `test`     | Adding/updating tests               |
| `chore`    | Maintenance (deps, config)          |

Rules:

- Lowercase type and description
- No period at end
- Imperative mood ("add" not "added")
- No AI disclaimers or co-author tags

```
feat: add user authentication
fix(api): handle null response
refactor: extract validation module
```

## Effect-TS Guidelines

Before implementing Effect features, consult `effect-solutions list`.

**Effect Source Reference**: `~/.local/share/effect-solutions/effect`

Core patterns:

- **TaggedError**: Always use for typed errors
- **Services**: Use `Context.Tag` for dependency injection
- **Layers**: Compose services with `Layer.succeed`, `Layer.effect`
- **Pipes**: Use `pipe` for composition

```typescript
import { Context, Effect, Layer, Data } from "effect";

// Service definition
class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown[]> }
>() {}

// Layer implementation
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([]),
});

// Typed error
class DbError extends Data.TaggedError("DbError")<{
  readonly message: string;
}> {}
```

## Pre-commit Hooks

Lefthook runs `bun fix` on staged files before commit. Files are auto-formatted and re-staged.

## CI Pipeline

On push/PR to main:

1. Install deps (`bun install --frozen-lockfile`)
2. Lint (`bun run check`)
3. Typecheck (`bun run check-types`)
4. Test (`bun run test:unit`)

**All checks must pass before work is considered complete.**
