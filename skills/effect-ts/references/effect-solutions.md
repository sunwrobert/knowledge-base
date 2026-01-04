# Effect Solutions Patterns

**Source**: `~/.local/repos/kitlangton/effect-solutions`

## Overview

Curated Effect-TS patterns and best practices, organized by topic.

## Effect.gen - Sequential Composition

```typescript
const program = Effect.gen(function* () {
  const data = yield* fetchData
  yield* Effect.logInfo(`Processing: ${data}`)
  return yield* processData(data)
})
```

## Effect.fn - Named Traced Functions

```typescript
const processUser = Effect.fn("processUser")(function* (userId: string) {
  yield* Effect.logInfo(`Processing user ${userId}`)
  const user = yield* getUser(userId)
  return yield* processData(user)
})

// With second argument for cross-cutting concerns
const processUser = Effect.fn("processUser", {
  timeout: "5 seconds",
  retry: Schedule.exponential("100 millis"),
})(function* (userId: string) {
  // ...
})
```

## Pipe - Instrumentation

```typescript
const program = fetchData.pipe(
  Effect.timeout("5 seconds"),
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.compose(Schedule.recurs(3))
    )
  ),
  Effect.tap((data) => Effect.logInfo(`Fetched: ${data}`)),
  Effect.withSpan("fetchData")
)
```

## Service Definition

```typescript
class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {}
```

**Rules:**

- Tag identifiers unique (`@path/ServiceName`)
- Methods have no deps (`R = never`)
- Use `readonly`

## Layer Implementation

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

## Test Layer

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

## Layer Composition

```typescript
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(configLayer)
)

const main = program.pipe(Effect.provide(appLayer))
```

## Layer Memoization

Store parameterized layers in constants:

```typescript
// Bad: creates two pools
Layer.provide(Postgres.layer({ poolSize: 10 }))
Layer.provide(Postgres.layer({ poolSize: 10 }))

// Good: single pool
const postgresLayer = Postgres.layer({ poolSize: 10 })
Layer.provide(postgresLayer)
```

## Schema.TaggedError

```typescript
class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String,
    id: Schema.String,
  }
) {}

// Yieldable - no Effect.fail() needed
return status === 404
  ? NotFoundError.make({ resource: "user", id })
  : Effect.die(error)
```

## Error Recovery

```typescript
// Single tag
program.pipe(
  Effect.catchTag("HttpError", (e) => Effect.succeed("recovered"))
)

// Multiple tags
program.pipe(
  Effect.catchTags({
    HttpError: () => Effect.succeed("http"),
    ValidationError: () => Effect.succeed("validation")
  })
)

// All errors
program.pipe(
  Effect.catchAll((e) => Effect.succeed("recovered"))
)
```

## Typed Errors vs Defects

- **Typed errors**: Domain failures caller can handle (validation, not found)
- **Defects**: Unrecoverable bugs, invariant violations

```typescript
const config = yield* loadConfig.pipe(Effect.orDie)
```

## Schema.Defect - Wrap Unknown

```typescript
class ApiError extends Schema.TaggedError<ApiError>()(
  "ApiError",
  {
    endpoint: Schema.String,
    error: Schema.Defect
  }
) {}
```

## Branded Types

Brand all domain primitives:

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
const PostId = Schema.String.pipe(Schema.brand("PostId"))
const Email = Schema.String.pipe(Schema.brand("Email"))
const Port = Schema.Int.pipe(
  Schema.between(1, 65535),
  Schema.brand("Port")
)
```

## Schema.Class - Records

```typescript
const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {
  get displayName() {
    return `${this.name} (${this.email})`
  }
}
```

## Schema.TaggedClass - Variants

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

## JSON Parsing

```typescript
const MoveFromJson = Schema.parseJson(Move)
const move = yield* Schema.decodeUnknown(MoveFromJson)(jsonString)
const json = yield* Schema.encode(MoveFromJson)(move)
```

## Config Primitives

```typescript
Config.string("VAR")
Config.integer("PORT")
Config.boolean("DEBUG")
Config.redacted("SECRET")  // hidden in logs
Config.url("URL")
Config.duration("TIMEOUT")
Config.array(Config.string(), "TAGS")
```

## Config Service Pattern

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

## Schema.Config - Validation

```typescript
const Port = Schema.Int.pipe(Schema.between(1, 65535), Schema.brand("Port"))
const port = yield* Schema.Config("PORT", Port)
```

## Testing Setup

```bash
bun add -D vitest @effect/vitest
```

```typescript
// vitest.config.ts
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } })
```

## Basic Test

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

## Test Variants

- `it.effect()` - Effect tests (most common)
- `it.scoped()` - Scoped resources, auto cleanup
- `it.live()` - Real clock (no TestClock)

## TestClock

```typescript
it.effect("time test", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.delay(Effect.succeed("done"), "10 seconds").pipe(Effect.fork)
    yield* TestClock.adjust("10 seconds")
    expect(yield* Fiber.join(fiber)).toBe("done")
  })
)
```

## Per-Test Layers

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

## Test Modifiers

```typescript
it.effect.skip("disabled", () => ...)
it.effect.only("focus", () => ...)
it.effect.fails("expected fail", () => ...)
```

## Service `use` Pattern

For wrapping Promise-based libraries:

```typescript
class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  effect: Effect.gen(function* () {
    const use = <A>(
      fn: (fs: typeof nodeFs, signal: AbortSignal) => Promise<A>
    ): Effect.Effect<A, FileSystemError> =>
      Effect.tryPromise({
        try: (signal) => fn(nodeFs, signal),
        catch: (cause) => new FileSystemError({ cause }),
      })

    return { use } as const
  }),
}) {}

// Usage
const content = yield* fileSystem.use((fs, signal) =>
  fs.readFile("config.json", { encoding: "utf-8", signal })
)
```

## Real Service Example

```typescript
export class BrowserService extends Context.Tag("@cli/BrowserService")<
  BrowserService,
  {
    readonly open: (url: string) => Effect.Effect<void, BrowserOpenError>
  }
>() {
  // Production layer
  static readonly layer = Layer.sync(BrowserService, () => {
    const open = Effect.fn("BrowserService.open")((url: string) =>
      Effect.try({
        try: () => {
          const platform = process.platform
          const command =
            platform === "darwin" ? ["open", url] :
            platform === "win32" ? ["cmd", "/c", "start", "", url] :
            ["xdg-open", url]
          spawn(command, { stdout: "ignore", stderr: "ignore" })
        },
        catch: (error) => BrowserOpenError.make({ url, cause: error }),
      })
    )
    return BrowserService.of({ open })
  })

  // Test layer
  static readonly testLayer = Layer.sync(BrowserService, () => {
    const urls: string[] = []
    const open = Effect.fn("BrowserService.open.test")((url: string) =>
      Effect.sync(() => { urls.push(url) })
    )
    return BrowserService.of({ open })
  })

  // No-op layer
  static readonly noopLayer = Layer.sync(BrowserService, () => {
    const open = Effect.fn("BrowserService.open.noop")(
      (_url: string) => Effect.void
    )
    return BrowserService.of({ open })
  })
}
```

## CLI Entry Pattern

```typescript
const MainLayer = UpdateNotifier.layer.pipe(
  Layer.provide(UpdateNotifierConfig.layer),
  Layer.merge(IssueService.layer.pipe(Layer.provide(BrowserService.layer))),
  Layer.provideMerge(BunContext.layer),
)

if (import.meta.main) {
  pipe(
    Effect.gen(function* () {
      const notifier = yield* UpdateNotifier
      yield* notifier.check(CLI_NAME, CLI_VERSION)
      yield* runCli(process.argv)
    }),
    Effect.provide(MainLayer),
    Effect.tapErrorCause((cause) => Console.error(pc.red(`Error: ${cause}`))),
    Effect.catchAll(() => Effect.sync(() => process.exit(1))),
    BunRuntime.runMain,
  )
}
```

## Service `use` Pattern

For wrapping Promise-based libraries (Prisma, Drizzle, AWS SDK):

```typescript
class FileSystem extends Effect.Service<FileSystem>()("FileSystem", {
  effect: Effect.gen(function* () {
    const use = <A>(
      fn: (fs: typeof nodeFs, signal: AbortSignal) => Promise<A>
    ): Effect.Effect<A, FileSystemError> =>
      Effect.tryPromise({
        try: (signal) => fn(nodeFs, signal),
        catch: (cause) => new FileSystemError({ cause }),
      })

    return { use } as const
  }),
}) {}

// Usage
const content = yield* fileSystem.use((fs, signal) =>
  fs.readFile("config.json", { encoding: "utf-8", signal })
)
```

## Real Service Example with Layer Variants

```typescript
export class BrowserService extends Context.Tag("@cli/BrowserService")<
  BrowserService,
  {
    readonly open: (url: string) => Effect.Effect<void, BrowserOpenError>
  }
>() {
  // Production layer
  static readonly layer = Layer.sync(BrowserService, () => {
    const open = Effect.fn("BrowserService.open")((url: string) =>
      Effect.try({
        try: () => {
          const platform = process.platform
          const command =
            platform === "darwin" ? ["open", url] :
            platform === "win32" ? ["cmd", "/c", "start", "", url] :
            ["xdg-open", url]
          spawn(command, { stdout: "ignore", stderr: "ignore" })
        },
        catch: (error) => BrowserOpenError.make({ url, cause: error }),
      })
    )
    return BrowserService.of({ open })
  })

  // Test layer (captures calls)
  static readonly testLayer = Layer.sync(BrowserService, () => {
    const urls: string[] = []
    const open = Effect.fn("BrowserService.open.test")((url: string) =>
      Effect.sync(() => { urls.push(url) })
    )
    return BrowserService.of({ open })
  })

  // No-op layer (disabled feature)
  static readonly noopLayer = Layer.sync(BrowserService, () => {
    const open = Effect.fn("BrowserService.open.noop")(
      (_url: string) => Effect.void
    )
    return BrowserService.of({ open })
  })
}
```

## Config Service with Internal Effects

```typescript
export class UpdateNotifier extends Context.Tag("@cli/UpdateNotifier")<
  UpdateNotifier,
  {
    readonly check: (pkgName: string, version: string) => Effect.Effect<void>
  }
>() {
  static readonly layer = Layer.effect(
    UpdateNotifier,
    Effect.gen(function* () {
      const config = yield* UpdateNotifierConfig

      // Named internal effects for tracing
      const readCache = Effect.fn("UpdateNotifier.readCache")(
        (file: string) =>
          Effect.tryPromise({
            try: () => readFile(file, "utf8"),
            catch: () => null,
          })
      )

      const fetchLatest = Effect.fn("UpdateNotifier.fetchLatest")(
        (pkgName: string) =>
          Effect.tryPromise({
            try: async () => {
              const controller = new AbortController()
              setTimeout(() => controller.abort(), config.timeout)
              const res = await fetch(
                `https://registry.npmjs.org/${pkgName}/latest`,
                { signal: controller.signal }
              )
              return res.ok ? Option.some((await res.json()).version) : Option.none()
            },
            catch: () => Option.none<string>(),
          })
      )

      const check = Effect.fn("UpdateNotifier.check")(
        (pkgName: string, currentVersion: string) =>
          Effect.gen(function* () {
            if (config.isCi) return
            const cache = yield* readCache(cachePath(pkgName))
            // ... check logic
          })
      )

      return UpdateNotifier.of({ check })
    }),
  )

  static readonly testLayer = Layer.succeed(
    UpdateNotifier,
    UpdateNotifier.of({ check: () => Effect.void }),
  )
}
```

## CLI Entry Pattern

```typescript
const MainLayer = UpdateNotifier.layer.pipe(
  Layer.provide(UpdateNotifierConfig.layer),
  Layer.merge(IssueService.layer.pipe(Layer.provide(BrowserService.layer))),
  Layer.provideMerge(BunContext.layer),
)

if (import.meta.main) {
  pipe(
    Effect.gen(function* () {
      const notifier = yield* UpdateNotifier
      yield* notifier.check(CLI_NAME, CLI_VERSION)
      yield* runCli(process.argv)
    }),
    Effect.provide(MainLayer),
    Effect.tapErrorCause((cause) => Console.error(pc.red(`Error: ${cause}`))),
    Effect.catchAll(() => Effect.sync(() => process.exit(1))),
    BunRuntime.runMain,
  )
}
```

## Best Practices Summary

1. **Service-Driven Development**: Define contracts first, implement later
2. **Dependency Injection**: Use Context.Tag + Layer, provide once at top
3. **Layer Memoization**: Store parameterized layers in constants
4. **Typed Errors**: Use Schema.TaggedError for domain errors
5. **Brand Everything**: IDs, emails, URLs, counts - all primitives
6. **Per-Test Layers**: Fresh layer in each test, prevent state leakage
7. **Three Layer Variants**: .layer (prod), .testLayer (test), .noopLayer (disabled)
8. **Service `use` Pattern**: Wrap Promise-based libraries for Effect integration
