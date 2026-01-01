---
name: effect-ts
description: Work with Effect TypeScript - a powerful library for type-safe, composable, and resilient applications. Use when writing Effect code, setting up Effect in a project, or when the user mentions Effect, pipes, services, layers, or functional TypeScript patterns.
---

# Effect TypeScript

## Quick check: Is Effect set up?

Run this to assess the project:

```bash
ls -la package.json tsconfig.json 2>/dev/null && grep -l "effect" package.json 2>/dev/null
```

**If Effect is in dependencies**: Ready to work with Effect.

**If Effect is NOT set up and user wants to set it up**: Read [references/setup.md](references/setup.md) in full and follow the guide step-by-step.

## Best practices

Before implementing Effect features, run `effect-solutions list` and read the relevant guide.

Topics include: services and layers, data modeling, error handling, configuration, testing, HTTP clients, CLIs, observability, and project structure.

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`
Search here for real implementations when docs aren't enough.

## Core patterns

### Pipes and composition

```typescript
import { Effect, pipe } from 'effect';

const program = pipe(
  Effect.succeed(1),
  Effect.map((n) => n + 1),
  Effect.flatMap((n) => Effect.succeed(n * 2))
);
```

### Services and Layers

```typescript
import { Context, Effect, Layer } from 'effect';

class Database extends Context.Tag('Database')<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown[]> }
>() {}

const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([]),
});
```

### Error handling

```typescript
import { Effect, Data } from 'effect';

class NotFoundError extends Data.TaggedError('NotFoundError')<{
  readonly id: string;
}> {}

const findUser = (id: string) => Effect.fail(new NotFoundError({ id }));
```

## Schema (built-in since Effect 3.10)

```typescript
import { Schema } from 'effect';

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  age: Schema.Number,
});

type User = typeof User.Type;
```

Note: `@effect/schema` is deprecated. Use `effect/Schema` instead.
