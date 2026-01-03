---
name: writing-effect-ts
description: Provides idiomatic patterns for Effect TypeScript. Use when writing Effect code (Effect.gen, Effect.fn, pipes), working with services and layers, data modeling with Schema, error handling, configuration, or testing with @effect/vitest.
---

# Effect-TS

**Reference**: `effect-solutions show <topic>` for detailed examples. Effect source at `~/.local/share/effect-solutions/effect` for deeper reference.

## Basics

### Effect.gen - sequencing

```typescript
const program = Effect.gen(function* () {
  const data = yield* fetchData
  yield* Effect.logInfo(`Processing: ${data}`)
  return yield* processData(data)
})
```

### Effect.fn - traced functions

```typescript
const processUser = Effect.fn("processUser")(function* (userId: string) {
  const user = yield* getUser(userId)
  return yield* processData(user)
})
```

### Pipe - instrumentation

```typescript
const program = fetchData.pipe(
  Effect.timeout("5 seconds"),
  Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.compose(Schedule.recurs(3)))),
  Effect.tap((data) => Effect.logInfo(`Fetched: ${data}`)),
  Effect.withSpan("fetchData")
)
```

## Services & Layers

### Service definition

```typescript
class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {}
```

Rules:

- Tag identifiers unique (`@path/ServiceName`)
- Methods have no deps (`R = never`)
- Use `readonly`

### Layer implementation

```typescript
class Users extends Context.Tag("@app/Users")<
  Users,
  { readonly findById: (id: UserId) => Effect.Effect<User, UsersError> }
>() {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient

      const findById = Effect.fn("Users.findById")(function* (id: UserId) {
        const response = yield* http.get(`/users/${id}`)
        return yield* HttpClientResponse.schemaBodyJson(User)(response)
      })

      return Users.of({ findById })
    })
  )
}
```

### Test layer

```typescript
class Database extends Context.Tag("@app/Database")<Database, {...}>() {
  static readonly testLayer = Layer.sync(Database, () => {
    const store = new Map()
    return Database.of({
      query: (sql) => Effect.succeed([...store.values()]),
      execute: (sql) => Effect.sync(() => void store.clear())
    })
  })
}
```

### Provide once at top

```typescript
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(configLayer)
)
const main = program.pipe(Effect.provide(appLayer))
```

### Layer memoization

Store parameterized layers in constants:

```typescript
// Bad: creates two pools
Layer.provide(Postgres.layer({ poolSize: 10 }))
Layer.provide(Postgres.layer({ poolSize: 10 }))

// Good: single pool
const postgresLayer = Postgres.layer({ poolSize: 10 })
Layer.provide(postgresLayer)
```

## Data Modeling

### Schema.Class - records

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {}
```

### Schema.TaggedClass - variants

```typescript
class Success extends Schema.TaggedClass<Success>()("Success", {
  value: Schema.Number,
}) {}

class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}

const Result = Schema.Union(Success, Failure)

Match.valueTags(result, {
  Success: ({ value }) => `Got: ${value}`,
  Failure: ({ error }) => `Error: ${error}`
})
```

### Branded types

Brand all domain primitives:

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
const PostId = Schema.String.pipe(Schema.brand("PostId"))
const Email = Schema.String.pipe(Schema.brand("Email"))
const Port = Schema.Int.pipe(Schema.between(1, 65535), Schema.brand("Port"))
```

### JSON parsing

```typescript
const MoveFromJson = Schema.parseJson(Move)
const move = yield* Schema.decodeUnknown(MoveFromJson)(jsonString)
const json = yield* Schema.encode(MoveFromJson)(move)
```

## Error Handling

### Schema.TaggedError

```typescript
class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  { resource: Schema.String, id: Schema.String }
) {}
```

Yieldable - no `Effect.fail()` needed:

```typescript
return status === 404 ? NotFoundError.make({ id }) : Effect.die(error)
```

### catchTag / catchTags

```typescript
program.pipe(Effect.catchTag("HttpError", (e) => Effect.succeed("recovered")))

program.pipe(Effect.catchTags({
  HttpError: () => Effect.succeed("http"),
  ValidationError: () => Effect.succeed("validation")
}))
```

### Errors vs defects

- **Typed errors**: domain failures caller can handle (validation, not found, denied)
- **Defects**: unrecoverable bugs, invariant violations

```typescript
const config = yield* loadConfig.pipe(Effect.orDie)
```

### Schema.Defect - wrap unknown

```typescript
class ApiError extends Schema.TaggedError<ApiError>()(
  "ApiError",
  { endpoint: Schema.String, error: Schema.Defect }
) {}
```

## Config

### Basic

```typescript
const apiKey = yield* Config.redacted("API_KEY")
const port = yield* Config.integer("PORT")
```

### Config service pattern

```typescript
class ApiConfig extends Context.Tag("@app/ApiConfig")<
  ApiConfig,
  { readonly apiKey: Redacted.Redacted; readonly baseUrl: string }
>() {
  static readonly layer = Layer.effect(
    ApiConfig,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("API_KEY")
      const baseUrl = yield* Config.string("API_BASE_URL").pipe(
        Config.orElse(() => Config.succeed("https://api.example.com"))
      )
      return ApiConfig.of({ apiKey, baseUrl })
    })
  )
}
```

### Schema.Config - validation

```typescript
const Port = Schema.Int.pipe(Schema.between(1, 65535), Schema.brand("Port"))
const port = yield* Schema.Config("PORT", Port)
```

### Primitives

```typescript
Config.string("VAR")
Config.integer("PORT")
Config.boolean("DEBUG")
Config.redacted("SECRET")  // hidden in logs
Config.url("URL")
Config.duration("TIMEOUT")
Config.array(Config.string(), "TAGS")
```

## Testing

### Setup

```bash
bun add -D vitest @effect/vitest
```

```typescript
// vitest.config.ts
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } })
```

### Basic test

```typescript
import { describe, expect, it } from "@effect/vitest"

describe("Calculator", () => {
  it.effect("adds numbers", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed(1 + 1)
      expect(result).toBe(2)
    })
  )
})
```

### Variants

- `it.effect()` - Effect tests (most common)
- `it.scoped()` - scoped resources, auto cleanup
- `it.live()` - real clock (no TestClock)

### TestClock

```typescript
it.effect("time test", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.delay(Effect.succeed("done"), "10 seconds").pipe(Effect.fork)
    yield* TestClock.adjust("10 seconds")
    expect(yield* Fiber.join(fiber)).toBe("done")
  })
)
```

### Provide layers

```typescript
const testLayer = Events.layer.pipe(
  Layer.provideMerge(Users.testLayer),
  Layer.provideMerge(Tickets.testLayer)
)

it.effect("test", () =>
  Effect.gen(function* () {
    const events = yield* Events
    // ...
  }).pipe(Effect.provide(testLayer))
)
```

### Modifiers

```typescript
it.effect.skip("disabled", () => ...)
it.effect.only("focus", () => ...)
it.effect.fails("expected fail", () => ...)
```
