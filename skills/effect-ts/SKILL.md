---
name: writing-effect-ts
description: Provides idiomatic patterns for Effect TypeScript - type-safe, composable, and resilient applications. Use when writing Effect code (Effect.gen, Effect.fn, pipes), working with services and layers, data modeling with Schema, error handling, configuration, or testing with @effect/vitest.
---

# Effect-TS

Idiomatic patterns for Effect TypeScript.

# Basics

Here are some guidelines for how to structure basic Effect code. How to express sequencing with `Effect.gen`, and when to name effectful functions with `Effect.fn`.

## Effect.gen

Just as `async/await` provides a sequential, readable way to work with `Promise` values (avoiding nested `.then()` chains), `Effect.gen` and `yield*` provide the same ergonomic benefits for `Effect` values.

```typescript
import { Effect } from "effect"

declare const fetchData: Effect.Effect<string>
declare const processData: (data: string) => Effect.Effect<string>

const program = Effect.gen(function* () {
  const data = yield* fetchData
  yield* Effect.logInfo(`Processing data: ${data}`)
  return yield* processData(data)
})
```

## Effect.fn

Use `Effect.fn` with generator functions for traced, named effects. `Effect.fn` traces where the function is called from, not just where it's defined:

```typescript
import { Effect } from "effect"

interface User {
  id: string
  name: string
}
declare const getUser: (userId: string) => Effect.Effect<User>
declare const processData: (user: User) => Effect.Effect<User>

const processUser = Effect.fn("processUser")(function* (userId: string) {
  yield* Effect.logInfo(`Processing user ${userId}`)
  const user = yield* getUser(userId)
  return yield* processData(user)
})
```

**Benefits:**

- Call-site tracing for each invocation
- Stack traces with location details
- Clean signatures

**Note:** `Effect.fn` automatically creates spans that integrate with telemetry systems.

## Pipe for Instrumentation

Use `.pipe()` to add cross-cutting concerns to Effect values. Common uses: timeouts, retries, logging, and annotations.

```typescript
import { Effect, Schedule } from "effect"

declare const fetchData: Effect.Effect<string>

const program = fetchData.pipe(
  Effect.timeout("5 seconds"),
  Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.compose(Schedule.recurs(3)))),
  Effect.tap((data) => Effect.logInfo(`Fetched: ${data}`)),
  Effect.withSpan("fetchData")
)
```

**Common instrumentation:**

- `Effect.timeout` - fail if effect takes too long
- `Effect.retry` - retry on failure with a schedule
- `Effect.tap` - run side effect without changing the value
- `Effect.withSpan` - add tracing span

## Retry and Timeout

For production code, combine retry and timeout to handle transient failures:

```typescript
import { Effect, Schedule } from "effect"

declare const callExternalApi: Effect.Effect<string>

// Retry with exponential backoff, max 3 attempts
const retryPolicy = Schedule.exponential("100 millis").pipe(
  Schedule.compose(Schedule.recurs(3))
)

const resilientCall = callExternalApi.pipe(
  // Timeout each individual attempt
  Effect.timeout("2 seconds"),
  // Retry failed attempts
  Effect.retry(retryPolicy),
  // Overall timeout for all attempts
  Effect.timeout("10 seconds")
)
```

**Schedule combinators:**

- `Schedule.exponential` - exponential backoff
- `Schedule.recurs` - limit number of retries
- `Schedule.spaced` - fixed delay between retries
- `Schedule.compose` - combine schedules (both must continue)

# Services & Layers

Effect's service pattern provides a deterministic way to organize your application through dependency injection. By defining services as `Context.Tag` classes and composing them into Layers, you create explicit dependency graphs that are type-safe, testable, and modular.

## What is a Service?

A service in Effect is defined using `Context.Tag` as a class that declares:

1. **A unique identifier** (e.g., `@app/Database`)
2. **An interface** that describes the service's methods

Services provide contracts without implementation. The actual behavior comes later through Layers.

```typescript
import { Context, Effect } from "effect"

class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {}

class Logger extends Context.Tag("@app/Logger")<
  Logger,
  {
    readonly log: (message: string) => Effect.Effect<void>
  }
>() {}
```

- **Tag identifiers must be unique**. Use `@path/to/ServiceName` prefix pattern
- **Service methods should have no dependencies (`R = never`)**. Dependencies are handled via Layer composition, not through method signatures
- **Use readonly properties**. Services should not expose mutable state directly

## What is a Layer?

A Layer is an implementation of a service. Layers handle:

1. **Setup/initialization**: Connecting to databases, reading config, etc.
2. **Dependency resolution**: Acquiring other services they need
3. **Resource lifecycle**: Cleanup happens automatically

```typescript
import { HttpClient, HttpClientResponse } from "@effect/platform"
import { Context, Effect, Layer, Schema } from "effect"

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {}

class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    id: UserId,
  }
) {}

class GenericUsersError extends Schema.TaggedError<GenericUsersError>()(
  "GenericUsersError",
  {
    id: UserId,
    error: Schema.Defect,
  }
) {}

const UsersError = Schema.Union(UserNotFoundError, GenericUsersError)
type UsersError = typeof UsersError.Type

class Analytics extends Context.Tag("@app/Analytics")<
  Analytics,
  {
    readonly track: (event: string, data: Record<string, unknown>) => Effect.Effect<void>
  }
>() {}

class Users extends Context.Tag("@app/Users")<
  Users,
  {
    readonly findById: (id: UserId) => Effect.Effect<User, UsersError>
    readonly all: () => Effect.Effect<readonly User[]>
  }
>() {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      // 1. yield* services you depend on
      const http = yield* HttpClient.HttpClient
      const analytics = yield* Analytics

      // 2. define the service methods with Effect.fn for call-site tracing
      const findById = Effect.fn("Users.findById")(function* (id: UserId) {
        yield* analytics.track("user.find", { id })
        const response = yield* http.get(`https://api.example.com/users/${id}`)
        return yield* HttpClientResponse.schemaBodyJson(User)(response)
      }).pipe(
        Effect.catchTag("ResponseError", (error) =>
          error.response.status === 404
            ? UserNotFoundError.make({ id })
            : GenericUsersError.make({ id, error })
        )
      )

      // Use Effect.fn even for nullary methods (thunks) to enable tracing
      const all = Effect.fn("Users.all")(function* () {
        const response = yield* http.get("https://api.example.com/users")
        return yield* HttpClientResponse.schemaBodyJson(Schema.Array(User))(response)
      })

      // 3. return the service
      return Users.of({ findById, all })
    })
  )
}
```

**Layer naming:** camelCase with `Layer` suffix: `layer`, `testLayer`, `postgresLayer`, `sqliteLayer`, etc.

## Service-Driven Development

Start by sketching leaf service tags (without implementations). This lets you write real TypeScript for higher-level orchestration services that type-checks even though the leaf services aren't runnable yet.

```typescript
import { Clock, Context, Effect, Layer, Schema } from "effect"

// Branded types for IDs
const RegistrationId = Schema.String.pipe(Schema.brand("RegistrationId"))
type RegistrationId = typeof RegistrationId.Type

const EventId = Schema.String.pipe(Schema.brand("EventId"))
type EventId = typeof EventId.Type

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

const TicketId = Schema.String.pipe(Schema.brand("TicketId"))
type TicketId = typeof TicketId.Type

// Domain models
class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {}

class Registration extends Schema.Class<Registration>("Registration")({
  id: RegistrationId,
  eventId: EventId,
  userId: UserId,
  ticketId: TicketId,
  registeredAt: Schema.Date,
}) {}

class Ticket extends Schema.Class<Ticket>("Ticket")({
  id: TicketId,
  eventId: EventId,
  code: Schema.String,
}) {}

// Leaf services: contracts only
class Users extends Context.Tag("@app/Users")<
  Users,
  {
    readonly findById: (id: UserId) => Effect.Effect<User>
  }
>() {}

class Tickets extends Context.Tag("@app/Tickets")<
  Tickets,
  {
    readonly issue: (eventId: EventId, userId: UserId) => Effect.Effect<Ticket>
    readonly validate: (ticketId: TicketId) => Effect.Effect<boolean>
  }
>() {}

class Emails extends Context.Tag("@app/Emails")<
  Emails,
  {
    readonly send: (to: string, subject: string, body: string) => Effect.Effect<void>
  }
>() {}

// Higher-level service: orchestrates leaf services
class Events extends Context.Tag("@app/Events")<
  Events,
  {
    readonly register: (eventId: EventId, userId: UserId) => Effect.Effect<Registration>
  }
>() {
  static readonly layer = Layer.effect(
    Events,
    Effect.gen(function* () {
      const users = yield* Users
      const tickets = yield* Tickets
      const emails = yield* Emails

      const register = Effect.fn("Events.register")(
        function* (eventId: EventId, userId: UserId) {
          const user = yield* users.findById(userId)
          const ticket = yield* tickets.issue(eventId, userId)
          const now = yield* Clock.currentTimeMillis

          const registration = Registration.make({
            id: RegistrationId.make(Schema.randomUUID()),
            eventId,
            userId,
            ticketId: ticket.id,
            registeredAt: new Date(now),
          })

          yield* emails.send(
            user.email,
            "Event Registration Confirmed",
            `Your ticket code: ${ticket.code}`
          )

          return registration
        }
      )

      return Events.of({ register })
    })
  )
}
```

> **Note:** This code won't run yet since Users, Tickets, and Emails lack implementations. But Events orchestration logic is real TypeScript that compiles and lets you model dependencies before writing production layers.

Benefits:

- Leaf service contracts are explicit. Users, Tickets, and Emails return typed data (no parsing needed).
- Higher-level orchestration (Events) coordinates multiple services cleanly.
- Type-checks immediately even though leaf services aren't implemented yet.
- Adding production implementations later doesn't change Events code.

See [Testing with Vitest](./09-testing.md) for a complete worked example testing this `Events` service with test layers.

## Test Implementations

When designing with services first, create lightweight test implementations. Use `Effect.sync` or `Effect.succeed` when your test doesn't need async operations or effects.

```typescript
import { Console, Context, Effect, Layer } from "effect"

class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {
  static readonly testLayer = Layer.sync(Database, () => {
    let records: Record<string, unknown> = {
      "user-1": { id: "user-1", name: "Alice" },
      "user-2": { id: "user-2", name: "Bob" },
    }

    const query = (sql: string) => Effect.succeed(Object.values(records))
    const execute = (sql: string) => Console.log(`Test execute: ${sql}`)

    return Database.of({ query, execute })
  })
}

class Cache extends Context.Tag("@app/Cache")<
  Cache,
  {
    readonly get: (key: string) => Effect.Effect<string | null>
    readonly set: (key: string, value: string) => Effect.Effect<void>
  }
>() {
  static readonly testLayer = Layer.sync(Cache, () => {
    const store = new Map<string, string>()

    const get = (key: string) => Effect.succeed(store.get(key) ?? null)
    const set = (key: string, value: string) => Effect.sync(() => void store.set(key, value))

    return Cache.of({ get, set })
  })
}
```

## Providing Layers to Effects

Use `Effect.provide` once at the top of your application to supply all dependencies. Avoid scattering `provide` calls throughout your codebase.

```typescript
import { Context, Effect, Layer } from "effect"

class Config extends Context.Tag("@app/Config")<Config, { readonly apiKey: string }>() {}
class Logger extends Context.Tag("@app/Logger")<Logger, { readonly info: (msg: string) => Effect.Effect<void> }>() {}
class Database extends Context.Tag("@app/Database")<Database, { readonly query: () => Effect.Effect<void> }>() {}
class UserService extends Context.Tag("@app/UserService")<UserService, { readonly getUser: () => Effect.Effect<void> }>() {}

declare const configLayer: Layer.Layer<Config>
declare const loggerLayer: Layer.Layer<Logger>
declare const databaseLayer: Layer.Layer<Database>
declare const userServiceLayer: Layer.Layer<UserService, never, Database>

// Compose all layers into a single app layer
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(loggerLayer),
  Layer.provideMerge(configLayer)
)

// Your program uses services freely
const program = Effect.gen(function* () {
  const users = yield* UserService
  const logger = yield* Logger
  yield* logger.info("Starting...")
  yield* users.getUser()
})

// Provide once at the entry point
const main = program.pipe(Effect.provide(appLayer))

Effect.runPromise(main)
```

**Why provide once at the top?**

- Clear dependency graph: all wiring in one place
- Easier testing: swap `appLayer` for `testLayer`
- No hidden dependencies: effects declare what they need via types
- Simpler refactoring: change wiring without touching business logic

## Layer Memoization

Effect automatically memoizes layers by reference identity. When the same layer instance appears multiple times in your dependency graph, it's constructed only once.

This matters especially for resource-intensive layers like database connection pools. Duplicating a pool means wasted connections and potential connection limit issues:

```typescript
import { Layer } from "effect"
import { Context, Effect } from "effect"

class SqlClient extends Context.Tag("@app/SqlClient")<SqlClient, { readonly query: (sql: string) => Effect.Effect<unknown[]> }>() {}

class Postgres {
  static layer(_: { readonly url: string; readonly poolSize: number }): Layer.Layer<SqlClient> {
    return Layer.succeed(SqlClient, { query: () => Effect.succeed([]) })
  }
}

class UserRepo extends Context.Tag("@app/UserRepo")<UserRepo, {}>() {
  static readonly layer: Layer.Layer<UserRepo, never, SqlClient> = Layer.succeed(UserRepo, {})
}

class OrderRepo extends Context.Tag("@app/OrderRepo")<OrderRepo, {}>() {
  static readonly layer: Layer.Layer<OrderRepo, never, SqlClient> = Layer.succeed(OrderRepo, {})
}

// Bad: calling the constructor twice creates two connection pools
const badAppLayer = Layer.merge(
  UserRepo.layer.pipe(
    Layer.provide(Postgres.layer({ url: "postgres://localhost/mydb", poolSize: 10 }))
  ),
  OrderRepo.layer.pipe(
    Layer.provide(Postgres.layer({ url: "postgres://localhost/mydb", poolSize: 10 })) // Different reference!
  )
)
// Creates TWO connection pools (20 connections total). Could hit server limits.
```

**The fix:** Store the layer in a constant first:

```typescript
import { Layer } from "effect"
import { Context, Effect } from "effect"

class SqlClient extends Context.Tag("@app/SqlClient")<SqlClient, { readonly query: (sql: string) => Effect.Effect<unknown[]> }>() {}

class Postgres {
  static layer(_: { readonly url: string; readonly poolSize: number }): Layer.Layer<SqlClient> {
    return Layer.succeed(SqlClient, { query: () => Effect.succeed([]) })
  }
}

class UserRepo extends Context.Tag("@app/UserRepo")<UserRepo, {}>() {
  static readonly layer: Layer.Layer<UserRepo, never, SqlClient> = Layer.succeed(UserRepo, {})
}

class OrderRepo extends Context.Tag("@app/OrderRepo")<OrderRepo, {}>() {
  static readonly layer: Layer.Layer<OrderRepo, never, SqlClient> = Layer.succeed(OrderRepo, {})
}

// Good: store the layer in a constant
const postgresLayer = Postgres.layer({ url: "postgres://localhost/mydb", poolSize: 10 })

const goodAppLayer = Layer.merge(
  UserRepo.layer.pipe(Layer.provide(postgresLayer)),
  OrderRepo.layer.pipe(Layer.provide(postgresLayer)) // Same reference!
)
// Single connection pool (10 connections) shared by both repos
```

**The rule:** When using parameterized layer constructors, always store the result in a module-level constant before using it in multiple places.

## A Note on Effect.Service

Effect also provides [`Effect.Service`](https://effect.website/blog/releases/effect/39/#effectservice), which bundles a Tag and default Layer together. It's useful when you have an obvious default implementation.

We focus on `Context.Tag` here because it supports service-driven development: sketching interfaces before implementations. A future Effect version aims to combine both approaches.

# Data Modeling

TypeScript's built-in tools for modeling data are limited. Effect's `Schema` library provides a robust alternative with runtime validation, serialization, and type safety built in.

## Why Schema?

- **Single source of truth**: define once, get TypeScript types + runtime validation + JSON serialization + auto-generated tooling.
- **Parse safely**: validate HTTP/CLI/config data with detailed errors—catch bad data before it crashes your app.
- **Rich domain types**: branded primitives prevent confusion; classes add methods and behavior.
- **Ecosystem integration**: use the same schema everywhere—RPC, HttpApi, CLI, frontend, backend.

## Foundations

All representable data is composed of two primitives:

- **Records** (AND): a `User` has a name AND an email AND a createdAt
- **Variants** (OR): a `Result` is a Success OR a Failure

If you come from a functional programming background, records are product types and variants are sum types.

Schema gives you tools for both, plus runtime validation and serialization.

## Records (AND Types)

Use `Schema.Class` for composite data models with multiple fields:

```typescript
import { Schema } from "effect"

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

export class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
  createdAt: Schema.Date,
}) {
  // Add custom getters and methods to extend functionality
  get displayName() {
    return `${this.name} (${this.email})`
  }
}

// Usage
const user = User.make({
  id: UserId.make("user-123"),
  name: "Alice",
  email: "alice@example.com",
  createdAt: new Date(),
})

console.log(user.displayName) // "Alice (alice@example.com)"
```

## Variants (OR Types)

Use `Schema.Literal` for simple string or number alternatives:

```typescript
import { Schema } from "effect"

const Status = Schema.Literal("pending", "active", "completed")
type Status = typeof Status.Type // "pending" | "active" | "completed"
```

For structured variants with fields, combine `Schema.TaggedClass` with `Schema.Union`:

```typescript
import { Match, Schema } from "effect"

// Define variants with a tag field
export class Success extends Schema.TaggedClass<Success>()("Success", {
  value: Schema.Number,
}) {}

export class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}

// Create the union
export const Result = Schema.Union(Success, Failure)
export type Result = typeof Result.Type

// Pattern match with Match.valueTags
const success = Success.make({ value: 42 })
const failure = Failure.make({ error: "oops" })

Match.valueTags(success, {
  Success: ({ value }) => `Got: ${value}`,
  Failure: ({ error }) => `Error: ${error}`
}) // "Got: 42"

Match.valueTags(failure, {
  Success: ({ value }) => `Got: ${value}`,
  Failure: ({ error }) => `Error: ${error}`
}) // "Error: oops"
```

**Benefits:**

- Type-safe exhaustive matching
- Compiler ensures all cases handled
- No possibility of invalid states

## Branded Types

Use branded types to prevent mixing values that have the same underlying type. **In a well-designed domain model, nearly all primitives should be branded**. Not just IDs, but emails, URLs, timestamps, slugs, counts, percentages, and any value with semantic meaning.

```typescript
import { Schema } from "effect"

// IDs - prevent mixing different entity IDs
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const PostId = Schema.String.pipe(Schema.brand("PostId"))
export type PostId = typeof PostId.Type

// Domain primitives - create a rich type system
export const Email = Schema.String.pipe(Schema.brand("Email"))
export type Email = typeof Email.Type

export const Port = Schema.Int.pipe(Schema.between(1, 65535), Schema.brand("Port"))
export type Port = typeof Port.Type

// Usage - impossible to mix types
const userId = UserId.make("user-123")
const postId = PostId.make("post-456")
const email = Email.make("alice@example.com")

function getUser(id: UserId) { return id }
function sendEmail(to: Email) { return to }

// This works
getUser(userId)
sendEmail(email)

// All of these produce type errors
// getUser(postId) // Can't pass PostId where UserId expected
// sendEmail(slug) // Can't pass Slug where Email expected
// const bad: UserId = "raw-string" // Can't assign raw string to branded type
```

## JSON Encoding & Decoding

Use `Schema.parseJson` to parse JSON strings and validate them with your schema in one step. This combines `JSON.parse` + `Schema.decodeUnknown` for decoding, and `JSON.stringify` + `Schema.encode` for encoding:

```typescript
import { Effect, Schema } from "effect"

const Row = Schema.Literal("A", "B", "C", "D", "E", "F", "G", "H")
const Column = Schema.Literal("1", "2", "3", "4", "5", "6", "7", "8")

class Position extends Schema.Class<Position>("Position")({
  row: Row,
  column: Column,
}) {}

class Move extends Schema.Class<Move>("Move")({
  from: Position,
  to: Position,
}) {}

// parseJson combines JSON.parse + schema decoding
// MoveFromJson is a schema that takes a JSON string and returns a Move
const MoveFromJson = Schema.parseJson(Move)

const program = Effect.gen(function* () {
  // Parse and validate JSON string in one step
  // Use MoveFromJson (not Move) to decode from JSON string
  const jsonString = '{"from":{"row":"A","column":"1"},"to":{"row":"B","column":"2"}}'
  const move = yield* Schema.decodeUnknown(MoveFromJson)(jsonString)

  yield* Effect.log("Decoded move", move)

  // Encode to JSON string in one step (typed as string)
  // Use MoveFromJson (not Move) to encode to JSON string
  const json = yield* Schema.encode(MoveFromJson)(move)
  return json
})
```

# Error Handling

Effect provides structured error handling with Schema integration for serializable, type-safe errors.

## Schema.TaggedError

Define domain errors with `Schema.TaggedError`:

```typescript
import { Schema } from "effect"

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

const AppError = Schema.Union(ValidationError, NotFoundError)
type AppError = typeof AppError.Type

// Usage
const error = ValidationError.make({
  field: "email",
  message: "Invalid format",
})
```

**Benefits:**

- Serializable (can send over network/save to DB)
- Type-safe
- Built-in `_tag` for pattern matching
- Custom methods via class
- Sensible default `message` when you don't declare one

**Note:** `Schema.TaggedError` creates yieldable errors that can be used directly without `Effect.fail()`:

```typescript
// Good: Yieldable errors can be used directly
return error.response.status === 404
  ? UserNotFoundError.make({ id })
  : Effect.die(error)

// Redundant: no need to wrap with Effect.fail
return error.response.status === 404
  ? Effect.fail(UserNotFoundError.make({ id }))
  : Effect.die(error)
```

## Recovering from Errors

Effect provides several functions for recovering from errors. Use these to handle errors and continue program execution.

### catchAll

Handle all errors by providing a fallback effect:

```typescript
import { Effect, Schema } from "effect"

class HttpError extends Schema.TaggedError<HttpError>()(
  "HttpError",
  {
    statusCode: Schema.Number,
    message: Schema.String,
  }
) {}

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}

declare const program: Effect.Effect<string, HttpError | ValidationError>

const recovered: Effect.Effect<string, never> = program.pipe(
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Effect.logError("Error occurred", error)
      return `Recovered from ${error.name}`
    })
  )
)
```

### catchTag

Handle specific errors by their `_tag`.

```typescript
import { Effect, Schema } from "effect"

class HttpError extends Schema.TaggedError<HttpError>()(
  "HttpError",
  {
    statusCode: Schema.Number,
    message: Schema.String,
  }
) {}

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}

const program: Effect.Effect<string, HttpError | ValidationError> =
  HttpError.make({
    statusCode: 500,
    message: "Internal server error",
  })

const recovered: Effect.Effect<string, ValidationError> = program.pipe(
  Effect.catchTag("HttpError", (error) =>
    Effect.gen(function* () {
      yield* Effect.logWarning(`HTTP ${error.statusCode}: ${error.message}`)
      return "Recovered from HttpError"
    })
  )
)
```

### catchTags

Handle multiple error types at once.

```typescript
import { Effect, Schema } from "effect"

class HttpError extends Schema.TaggedError<HttpError>()(
  "HttpError",
  {
    statusCode: Schema.Number,
    message: Schema.String,
  }
) {}

class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}

const program: Effect.Effect<string, HttpError | ValidationError> =
  HttpError.make({
    statusCode: 500,
    message: "Internal server error",
  })

const recovered: Effect.Effect<string, never> = program.pipe(
  Effect.catchTags({
    HttpError: () => Effect.succeed("Recovered from HttpError"),
    ValidationError: () => Effect.succeed("Recovered from ValidationError")
  })
)
```

## Expected Errors vs Defects

Effect tracks errors in the type system (`Effect<A, E, R>`) so callers know what can go wrong and can recover. But tracking only matters if recovery is possible. When there's no sensible way to recover, use a defect instead: it terminates the fiber and you handle it once at the system boundary (logging, crash reporting, graceful shutdown).

**Use typed errors** for domain failures the caller can handle: validation errors, "not found", permission denied, rate limits.

**Use defects** for unrecoverable situations: bugs and invariant violations.

```typescript
import { Effect } from "effect"

declare const loadConfig: Effect.Effect<{ port: number }, Error>

// At app entry: if config fails, nothing can proceed
const main = Effect.gen(function* () {
  const config = yield* loadConfig.pipe(Effect.orDie)
  yield* Effect.log(`Starting on port ${config.port}`)
})
```

**When to catch defects:** Almost never. Only at system boundaries for logging/diagnostics. Use `Effect.exit` to inspect or `Effect.catchAllDefect` if you must recover (e.g., plugin sandboxing).

## Schema.Defect - Wrapping Unknown Errors

Use `Schema.Defect` to wrap unknown errors from external libraries.

```typescript
import { Schema, Effect } from "effect"

class ApiError extends Schema.TaggedError<ApiError>()(
  "ApiError",
  {
    endpoint: Schema.String,
    statusCode: Schema.Number,
    // Wrap the underlying error from fetch/axios/etc
    error: Schema.Defect,
  }
) {}

// Usage - catching errors from external libraries
const fetchUser = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`).then((r: Response) => r.json()),
    catch: (error) => ApiError.make({
      endpoint: `/api/users/${id}`,
      statusCode: 500,
      error
    })
  })
```

**Schema.Defect handles:**

- JavaScript `Error` instances → `{ name, message }` objects
- Any unknown value → string representation
- Serializable for network/storage

**Use for:**

- Wrapping errors from external libraries (fetch, axios, etc)
- Network boundaries (API errors)
- Persisting errors to DB
- Logging systems

# Config

Effect's `Config` module provides type-safe configuration loading with validation, defaults, and transformations.

## How Config Works

By default, Effect loads config from **environment variables**. However, you can provide different config sources using `ConfigProvider`:

- **Production:** Load from environment variables (default)
- **Tests:** Load from in-memory maps
- **Development:** Load from JSON files or hardcoded values

This is controlled via `Layer.setConfigProvider`.

## Basic Usage

By default, `Config` reads from environment variables:

```typescript
import { Config, Effect } from "effect"

const program = Effect.gen(function* () {
  // Reads from process.env.API_KEY and process.env.PORT
  const apiKey = yield* Config.redacted("API_KEY")
  const port = yield* Config.integer("PORT")

  console.log(`Starting server on port ${port}`)
  // apiKey is redacted in logs
})

// Run with default provider (environment variables)
Effect.runPromise(program)
```

You can override the default provider for tests or different environments:

```typescript
import { Config, ConfigProvider, Effect, Layer } from "effect"

const program = Effect.gen(function* () {
  const apiKey = yield* Config.redacted("API_KEY")
  const port = yield* Config.integer("PORT")
  console.log(`Starting server on port ${port}`)
})

// Use a different config source
const testConfigProvider = ConfigProvider.fromMap(
  new Map([
    ["API_KEY", "test-key-123"],
    ["PORT", "3000"],
  ])
)

// Apply the provider
const TestConfigLayer = Layer.setConfigProvider(testConfigProvider)

// Run with test config
Effect.runPromise(program.pipe(Effect.provide(TestConfigLayer)))
```

## Recommended Pattern: Config Layers

**Best practice:** Create a config service with a `layer` export:

```typescript
import { Config, Context, Effect, Layer, Redacted } from "effect"

class ApiConfig extends Context.Tag("@app/ApiConfig")<
  ApiConfig,
  {
    readonly apiKey: Redacted.Redacted
    readonly baseUrl: string
    readonly timeout: number
  }
>() {
  static readonly layer = Layer.effect(
    ApiConfig,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("API_KEY")
      const baseUrl = yield* Config.string("API_BASE_URL").pipe(
        Config.orElse(() => Config.succeed("https://api.example.com"))
      )
      const timeout = yield* Config.integer("API_TIMEOUT").pipe(
        Config.orElse(() => Config.succeed(30000))
      )

      return ApiConfig.of({ apiKey, baseUrl, timeout })
    })
  )

  // For tests - hardcoded values
  static readonly testLayer = Layer.succeed(
    ApiConfig,
    ApiConfig.of({
      apiKey: Redacted.make("test-key"),
      baseUrl: "https://test.example.com",
      timeout: 5000,
    })
  )
}
```

**Why this pattern?**

- Separates config loading from business logic
- Easy to swap implementations (layer vs testLayer)
- Config errors caught early at layer composition
- Type-safe throughout your app

## Config Primitives

```typescript
import { Config } from "effect"

// Strings
Config.string("MY_VAR")

// Numbers
Config.number("PORT")
Config.integer("MAX_RETRIES")

// Booleans
Config.boolean("DEBUG")

// Sensitive values (redacted in logs)
Config.redacted("API_KEY")

// URLs
Config.url("API_URL")

// Durations
Config.duration("TIMEOUT")

// Arrays (comma-separated values in env vars)
Config.array(Config.string(), "TAGS")
```

## Defaults and Fallbacks

```typescript
import { Config, Effect } from "effect"

const program = Effect.gen(function* () {
  // With orElse
  const port = yield* Config.integer("PORT").pipe(
    Config.orElse(() => Config.succeed(3000))
  )

  // Optional values
  const optionalKey = yield* Config.option(Config.string("OPTIONAL_KEY"))
  // Returns Option<string>

  return { port, optionalKey }
})
```

## Validation with Schema

**Recommended:** Use `Schema.Config` for validation instead of `Config.mapOrFail`:

```typescript
import { Config, Effect, Schema } from "effect"

// Define schemas with built-in validation
const Port = Schema.Int.pipe(Schema.between(1, 65535))
const Environment = Schema.Literal("development", "staging", "production")

const program = Effect.gen(function* () {
  // Schema handles validation automatically
  const port = yield* Schema.Config("PORT", Port)
  const env = yield* Schema.Config("ENV", Environment)

  return { port, env }
})
```

**Schema.Config benefits:**

- Automatic type inference from schema
- Rich validation errors with schema messages
- Reusable schemas across config and runtime validation
- Full Schema transformation power (brands, transforms, refinements)

**Example with branded types:**

```typescript
import { Effect, Schema } from "effect"

const Port = Schema.Int.pipe(
  Schema.between(1, 65535),
  Schema.brand("Port")
)
type Port = typeof Port.Type

const program = Effect.gen(function* () {
  const port = yield* Schema.Config("PORT", Port)
  // port is branded as Port, preventing misuse
  return port
})
```

## Manual Validation (Alternative)

You can use `Config.mapOrFail` if you need custom validation without Schema:

```typescript
import { Config, ConfigError, Effect } from "effect"

const program = Effect.gen(function* () {
  const port = yield* Config.integer("PORT").pipe(
    Config.mapOrFail((p) =>
      p > 0 && p < 65536
        ? Effect.succeed(p)
        : Effect.fail(ConfigError.InvalidData([], "Port must be 1-65535"))
    )
  )

  return port
})
```

## Config Providers

Override where config is loaded from using `Layer.setConfigProvider`:

```typescript
import { ConfigProvider, Layer } from "effect"

const TestConfigLayer = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["API_KEY", "test-key"],
      ["PORT", "3000"],
    ])
  )
)

const JsonConfigLayer = Layer.setConfigProvider(
  ConfigProvider.fromJson({
    API_KEY: "prod-key",
    PORT: 8080,
  })
)

const PrefixedConfigLayer = Layer.setConfigProvider(
  ConfigProvider.fromEnv().pipe(
    ConfigProvider.nested("APP") // Reads APP_API_KEY, APP_PORT, etc.
  )
)

// Usage: provide whichever layer matches the environment
Effect.runPromise(program.pipe(Effect.provide(TestConfigLayer)))
```

## Usage in Tests

**Best practice:** Just provide a layer with test values directly. No need for `ConfigProvider.fromMap`:

```typescript
import { Config, Context, Effect, Layer, Redacted } from "effect"

class ApiConfig extends Context.Tag("@app/ApiConfig")<
  ApiConfig,
  {
    readonly apiKey: Redacted.Redacted
    readonly baseUrl: string
  }
>() {
  static readonly layer = Layer.effect(
    ApiConfig,
    Effect.gen(function* () {
      const apiKey = yield* Config.redacted("API_KEY")
      const baseUrl = yield* Config.string("API_BASE_URL")
      return ApiConfig.of({ apiKey, baseUrl })
    })
  )
}

const program = Effect.gen(function* () {
  const config = yield* ApiConfig
  console.log(config.baseUrl)
})

// Production: reads from environment variables
Effect.runPromise(program.pipe(Effect.provide(ApiConfig.layer)))

// Tests: inline test values as needed
Effect.runPromise(
  program.pipe(
    Effect.provide(
      Layer.succeed(ApiConfig, {
        apiKey: Redacted.make("test-key"),
        baseUrl: "https://test.example.com"
      })
    )
  )
)

// Different test with different values
Effect.runPromise(
  program.pipe(
    Effect.provide(
      Layer.succeed(ApiConfig, {
        apiKey: Redacted.make("another-key"),
        baseUrl: "https://staging.example.com"
      })
    )
  )
)
```

**Why this works:**

- Your production code depends on `ApiConfig` service, not on `Config` primitives
- In tests, provide values directly with `Layer.succeed()`
- No need to mock environment variables or config providers
- Each test can use different values without predefined test layers

## Using Redacted for Secrets

Always use `Config.redacted()` for sensitive values:

```typescript
import { Config, Effect, Redacted } from "effect"

const program = Effect.gen(function* () {
  const apiKey = yield* Config.redacted("API_KEY")

  // Use Redacted.value() to extract
  const headers = {
    Authorization: `Bearer ${Redacted.value(apiKey)}`
  }

  // Redacted values are hidden in logs
  console.log(apiKey) // Output: <redacted>

  return headers
})
```

## Best Practices

1. **Always validate:** Use `mapOrFail` for critical config values
2. **Use defaults wisely:** Provide sensible defaults for non-critical settings
3. **Redact secrets:** Use `Config.redacted()` for tokens, passwords, API keys
4. **Group related config:** Use `Config.nested()` for prefixed environment variables
5. **Type safety:** Let Effect infer types from your Config declarations
6. **Layer composition:** Create config layers with `Layer.effect()` and static `layer` properties

## Example: Database Config Layer

```typescript
import { Context, Effect, Layer, Redacted, Schema } from "effect"

const Port = Schema.Int.pipe(Schema.between(1, 65535))

class DatabaseConfig extends Context.Tag("@app/DatabaseConfig")<
  DatabaseConfig,
  {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly password: Redacted.Redacted
  }
>() {
  static readonly layer = Layer.effect(
    DatabaseConfig,
    Effect.gen(function* () {
      const host = yield* Schema.Config("DB_HOST", Schema.String)
      const port = yield* Schema.Config("DB_PORT", Port)
      const database = yield* Schema.Config("DB_NAME", Schema.String)
      const password = yield* Schema.Config("DB_PASSWORD", Schema.Redacted(Schema.String))

      return DatabaseConfig.of({ host, port, database, password })
    })
  )
}
```

# Testing

`@effect/vitest` provides enhanced testing support for Effect code. It handles Effect execution, scoped resources, layers, and provides detailed fiber failure reporting.

## Why @effect/vitest?

- **Native Effect support**: Run Effect programs directly in tests with `it.effect()`
- **Automatic cleanup**: `it.scoped()` manages resource lifecycles
- **Test services**: Use TestClock, TestRandom for deterministic tests
- **Better errors**: Full fiber dumps with causes, spans, and logs
- **Layer support**: Provide dependencies to tests with `Effect.provide()`

## Install

```bash
bun add -D vitest @effect/vitest
```

## Setup

Update your test script to use vitest (not `bun test`):

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create a `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
})
```

## Basic Testing

Import test functions and assertions from `@effect/vitest`:

```typescript
import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"

describe("Calculator", () => {
  // Sync test - regular function
  it("creates instances", () => {
    const result = 1 + 1
    expect(result).toBe(2)
  })

  // Effect test - returns Effect
  it.effect("adds numbers", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed(1 + 1)
      expect(result).toBe(2)
    })
  )
})
```

## Test Function Variants

### it.effect()

For tests that return Effect values (most common):

```typescript
it.effect("processes data", () =>
  Effect.gen(function* () {
    const result = yield* processData("input")
    expect(result).toBe("expected")
  })
)
```

### it.scoped()

For tests using scoped resources. The scope closes automatically when the test ends, triggering cleanup finalizers:

```typescript
import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect } from "effect"

it.scoped("temp directory is cleaned up", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    // makeTempDirectoryScoped creates a directory that's deleted when scope closes
    const tempDir = yield* fs.makeTempDirectoryScoped()

    // Use the temp directory
    yield* fs.writeFileString(`${tempDir}/test.txt`, "hello")
    const exists = yield* fs.exists(`${tempDir}/test.txt`)
    expect(exists).toBe(true)

    // When test ends, scope closes and tempDir is deleted
  }).pipe(Effect.provide(NodeFileSystem.layer))
)
```

### it.live()

For tests using real time (no TestClock). Use when you need actual delays or real clock behavior:

```typescript
import { Clock, Effect } from "effect"

// it.effect provides TestContext - clock starts at 0
it.effect("test clock starts at zero", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    expect(now).toBe(0)
  })
)

// it.live uses real system clock
it.live("real clock", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    expect(now).toBeGreaterThan(0) // Actual system time
  })
)
```

### Using TestClock

`it.effect` automatically provides TestContext with TestClock. Use `TestClock.adjust` to simulate time:

```typescript
import { Effect, Fiber, TestClock } from "effect"

it.effect("time-based test", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.delay(Effect.succeed("done"), "10 seconds").pipe(
      Effect.fork
    )
    yield* TestClock.adjust("10 seconds")
    const result = yield* Fiber.join(fiber)
    expect(result).toBe("done")
  })
)
```

## Providing Layers

Use `Effect.provide()` inline for test-specific layers:

```typescript
import { Context, Effect, Layer } from "effect"

class Database extends Context.Tag("Database")<
  Database,
  { query: (sql: string) => Effect.Effect<string[]> }
>() {}

const testDatabase = Layer.succeed(Database, {
  query: (_sql) => Effect.succeed(["mock", "data"])
})

it.effect("queries database", () =>
  Effect.gen(function* () {
    const db = yield* Database
    const results = yield* db.query("SELECT * FROM users")
    expect(results.length).toBe(2)
  }).pipe(Effect.provide(testDatabase))
)
```

## Test Modifiers

### Skipping Tests

Use `it.effect.skip` to temporarily disable a test:

```typescript
it.effect.skip("temporarily disabled", () =>
  Effect.gen(function* () {
    // This test won't run
  })
)
```

### Running a Single Test

Use `it.effect.only` to run just one test:

```typescript
it.effect.only("focus on this test", () =>
  Effect.gen(function* () {
    // Only this test runs
  })
)
```

### Expecting Tests to Fail

Use `it.effect.fails` to assert that a test should fail. Useful for documenting known issues:

```typescript
it.effect.fails("known bug", () =>
  Effect.gen(function* () {
    // This test is expected to fail
    expect(1 + 1).toBe(3)
  })
)
```

## Logging

By default, `it.effect` suppresses log output. To enable logging:

```typescript
import { Logger } from "effect"

// Option 1: Provide a logger
it.effect("with logging", () =>
  Effect.gen(function* () {
    yield* Effect.log("This will be shown")
  }).pipe(Effect.provide(Logger.pretty))
)

// Option 2: Use it.live (logging enabled by default)
it.live("live with logging", () =>
  Effect.gen(function* () {
    yield* Effect.log("This will be shown")
  })
)
```

## Worked Example: Testing a Service

Here's a complete example testing the `Events` service from the [Services & Layers](./05-services-and-layers.md) guide. The service orchestrates `Users`, `Tickets`, and `Emails` to register users for events.

First, define domain types and services with test layers built-in:

```typescript
import { Clock, Context, Effect, Layer, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"

// Domain types
const RegistrationId = Schema.String.pipe(Schema.brand("RegistrationId"))
type RegistrationId = typeof RegistrationId.Type

const EventId = Schema.String.pipe(Schema.brand("EventId"))
type EventId = typeof EventId.Type

const UserId = Schema.String.pipe(Schema.brand("UserId"))
type UserId = typeof UserId.Type

const TicketId = Schema.String.pipe(Schema.brand("TicketId"))
type TicketId = typeof TicketId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {}

class Registration extends Schema.Class<Registration>("Registration")({
  id: RegistrationId,
  eventId: EventId,
  userId: UserId,
  ticketId: TicketId,
  registeredAt: Schema.Date,
}) {}

class Ticket extends Schema.Class<Ticket>("Ticket")({
  id: TicketId,
  eventId: EventId,
  code: Schema.String,
}) {}

class Email extends Schema.Class<Email>("Email")({
  to: Schema.String,
  subject: Schema.String,
  body: Schema.String,
}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {
  id: UserId,
}) {}

// Users service with test layer that has create + findById
class Users extends Context.Tag("@app/Users")<
  Users,
  {
    readonly create: (user: User) => Effect.Effect<void>
    readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound>
  }
>() {
  // Mutable state is fine in tests - JS is single-threaded
  static readonly testLayer = Layer.sync(Users, () => {
    const store = new Map<UserId, User>()

    const create = (user: User) => Effect.sync(() => void store.set(user.id, user))

    const findById = (id: UserId) =>
      Effect.fromNullable(store.get(id)).pipe(
        Effect.orElseFail(() => UserNotFound.make({ id }))
      )

    return Users.of({ create, findById })
  })
}

// Tickets service with test layer
class Tickets extends Context.Tag("@app/Tickets")<
  Tickets,
  { readonly issue: (eventId: EventId, userId: UserId) => Effect.Effect<Ticket> }
>() {
  static readonly testLayer = Layer.sync(Tickets, () => {
    let counter = 0

    const issue = (eventId: EventId, _userId: UserId) =>
      Effect.sync(() =>
        Ticket.make({
          id: TicketId.make(`ticket-${counter++}`),
          eventId,
          code: `CODE-${counter}`,
        })
      )

    return Tickets.of({ issue })
  })
}

// Emails service with test layer that tracks sent emails
class Emails extends Context.Tag("@app/Emails")<
  Emails,
  {
    readonly send: (email: Email) => Effect.Effect<void>
    readonly sent: Effect.Effect<ReadonlyArray<Email>>
  }
>() {
  static readonly testLayer = Layer.sync(Emails, () => {
    const emails: Array<Email> = []

    const send = (email: Email) => Effect.sync(() => void emails.push(email))

    const sent = Effect.sync(() => emails)

    return Emails.of({ send, sent })
  })
}
```

The Events service orchestrates the leaf services:

```typescript
class Events extends Context.Tag("@app/Events")<
  Events,
  { readonly register: (eventId: EventId, userId: UserId) => Effect.Effect<Registration, UserNotFound> }
>() {
  static readonly layer = Layer.effect(
    Events,
    Effect.gen(function* () {
      const users = yield* Users
      const tickets = yield* Tickets
      const emails = yield* Emails

      const register = Effect.fn("Events.register")(
        function* (eventId: EventId, userId: UserId) {
          const user = yield* users.findById(userId)
          const ticket = yield* tickets.issue(eventId, userId)
          const now = yield* Clock.currentTimeMillis

          const registration = Registration.make({
            id: RegistrationId.make(crypto.randomUUID()),
            eventId,
            userId,
            ticketId: ticket.id,
            registeredAt: new Date(now),
          })

          yield* emails.send(
            Email.make({
              to: user.email,
              subject: "Event Registration Confirmed",
              body: `Your ticket code: ${ticket.code}`,
            })
          )

          return registration
        }
      )

      return Events.of({ register })
    })
  )
}
```

Compose test layers and write tests:

```typescript
// provideMerge exposes leaf services in tests for setup/assertions
const testLayer = Events.layer.pipe(
  Layer.provideMerge(Users.testLayer),
  Layer.provideMerge(Tickets.testLayer),
  Layer.provideMerge(Emails.testLayer)
)

describe("Events.register", () => {
  it.effect("creates registration with correct data", () =>
    Effect.gen(function* () {
      const users = yield* Users
      const events = yield* Events

      // Arrange: create a user
      const user = User.make({
        id: UserId.make("user-123"),
        name: "Alice",
        email: "alice@example.com",
      })
      yield* users.create(user)

      // Act
      const eventId = EventId.make("event-789")
      const registration = yield* events.register(eventId, user.id)

      // Assert
      expect(registration.eventId).toBe(eventId)
      expect(registration.userId).toBe(user.id)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect("sends confirmation email with ticket code", () =>
    Effect.gen(function* () {
      const users = yield* Users
      const events = yield* Events
      const emails = yield* Emails

      // Arrange
      const user = User.make({
        id: UserId.make("user-456"),
        name: "Bob",
        email: "bob@example.com",
      })
      yield* users.create(user)

      // Act
      yield* events.register(EventId.make("event-789"), user.id)

      // Assert: check sent emails
      const sentEmails = yield* emails.sent
      expect(sentEmails).toHaveLength(1)
      expect(sentEmails[0].to).toBe("bob@example.com")
      expect(sentEmails[0].subject).toBe("Event Registration Confirmed")
      expect(sentEmails[0].body).toContain("CODE-")
    }).pipe(Effect.provide(testLayer))
  )
})
```

## Running Tests

Run tests with vitest:

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Run specific file
bunx vitest run tests/user.test.ts

# Run tests matching pattern
bunx vitest run -t "UserService"
```

## Next Steps

- Use [TestClock](https://effect.website/docs/guides/testing/test-clock) for time-dependent tests
- Use [TestRandom](https://effect.website/docs/guides/testing/test-random) for deterministic randomness
- See [Testing documentation](https://effect.website/docs/guides/testing/introduction) for advanced patterns
