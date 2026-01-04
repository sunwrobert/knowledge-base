# Effect-TS Core Patterns

**Source**: `~/.local/repos/Effect-TS/effect`

## Directory Structure

```
packages/effect/src/     # Public API (180+ modules)
packages/effect/src/internal/  # Private implementations
packages/cli/examples/   # Complete example apps (naval-fate, minigit)
```

## Effect.gen - Generator Composition

Sequential effect composition using generators:

```typescript
const program = Effect.gen(function* () {
  const data = yield* fetchData
  yield* Effect.logInfo(`Processing: ${data}`)
  return yield* processData(data)
})
```

**Adapter interface** supports chained transformations:

```typescript
// Single effect
yield* effect

// Chained (up to 12+ functions)
yield* a, f, g, h, final
```

## Effect.fn - Named Traced Functions

Create named functions with automatic tracing:

```typescript
const processUser = Effect.fn("processUser")(function* (userId: string) {
  const user = yield* getUser(userId)
  return yield* processData(user)
})
```

## Pipe Composition

Fundamental transformation primitive:

```typescript
import { pipe } from "effect"

pipe(value, f, g, h)  // Basic transformation
pipe(Effect.succeed(5), Effect.map(n => n * 2))  // With Effects
pipe(context, Context.add(Tag, service))  // Context operations
```

## Context.Tag - Service Definition

```typescript
// Generic tag
const MyService = Context.GenericTag<MyService>("MyService")

// Class-based tag (preferred)
class Database extends Context.Tag("@app/Database")<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<unknown[]>
    readonly execute: (sql: string) => Effect.Effect<void>
  }
>() {}
```

## Context.Reference - Tags with Defaults

```typescript
class Config extends Context.Reference<Config>()("Config", {
  defaultValue: () => ({ timeout: 5000 })
}) {}
```

## Layer - Service Implementations

### Layer.succeed - Simple implementation

```typescript
const DatabaseLive = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([]),
  execute: (sql) => Effect.void
})
```

### Layer.effect - Effectful implementation

```typescript
const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const config = yield* Config
    const pool = yield* createPool(config)
    return Database.of({
      query: (sql) => pool.query(sql),
      execute: (sql) => pool.execute(sql)
    })
  })
)
```

### Layer.scoped - With resource cleanup

```typescript
const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      createPool(),
      (pool) => pool.close()
    )
    return Database.of({ query: pool.query })
  })
)
```

## Layer Composition

```typescript
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(configLayer)
)

const main = program.pipe(Effect.provide(appLayer))
```

## Data.TaggedError

```typescript
export const TaggedError = <Tag extends string>(tag: Tag) =>
  class extends Error {
    readonly _tag = tag
  }

// Usage
class ShipNotFoundError extends Data.TaggedError("ShipNotFoundError")<{
  readonly name: string
  readonly x: number
  readonly y: number
}> {
  toString(): string {
    return `Ship '${this.name}' not found at (${this.x}, ${this.y})`
  }
}
```

## Error Handling

### catchTag - Single error type

```typescript
program.pipe(
  Effect.catchTag("HttpError", (e) => Effect.succeed("recovered"))
)
```

### catchTags - Multiple error types

```typescript
program.pipe(
  Effect.catchTags({
    HttpError: () => Effect.succeed("http"),
    ValidationError: () => Effect.succeed("validation")
  })
)
```

## serviceFunctions - Extract Service Methods

```typescript
const { createShip, moveShip, shoot } = Effect.serviceFunctions(NavalFateStore)

// Now call directly without yield* service first
yield* createShip("Enterprise")
```

## Data Structures

### Data.Class - Structural Equality

```typescript
class Person extends Data.Class<{ name: string }> {}

const a = new Person({ name: "Mike" })
const b = new Person({ name: "Mike" })
Equal.equals(a, b) // true - structural equality
```

### Data.TaggedEnum - Discriminated Unions

```typescript
type HttpError = Data.TaggedEnum<{
  NotFound: {}
  InternalServerError: { reason: string }
}>

const { $is, $match, NotFound, InternalServerError } = Data.taggedEnum<HttpError>()

const error = NotFound()
const result = $match({
  NotFound: () => 0,
  InternalServerError: ({ reason }) => 1
})(error)
```

## Request - Batched Operations

```typescript
class GetUser extends Request.Class<GetUser, User, UserNotFound, { id: string }> {}

const resolver = RequestResolver.makeBatched((requests: Array<GetUser>) =>
  Effect.gen(function* () {
    const users = yield* fetchUsers(requests.map(r => r.id))
    return requests.map(r => users.find(u => u.id === r.id) ?? new UserNotFound())
  })
)

const getUser = (id: string) => Effect.request(new GetUser({ id }), resolver)
```

## Complete Example: Naval Fate CLI

```typescript
// Domain model
class Ship extends Schema.Class<Ship>("Ship")({
  name: Schema.String,
  x: Schema.Number,
  y: Schema.Number,
  status: Schema.Literal("sailing", "destroyed")
}) {
  static readonly create = (name: string) =>
    new Ship({ name, x: 0, y: 0, status: "sailing" })

  move(x: number, y: number): Ship {
    return new Ship({ ...this, x, y })
  }
}

// Service interface
interface NavalFateStore {
  createShip(name: string): Effect.Effect<Ship, ShipExistsError>
  moveShip(name: string, x: number, y: number): Effect.Effect<Ship, ShipNotFoundError>
}

const NavalFateStore = Context.GenericTag<NavalFateStore>("NavalFateStore")

// Layer implementation
const NavalFateStoreLive = Layer.effect(
  NavalFateStore,
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore

    const createShip = Effect.fn("createShip")(function* (name: string) {
      const existing = yield* store.get(name)
      if (Option.isSome(existing)) {
        return yield* new ShipExistsError({ name })
      }
      const ship = Ship.create(name)
      yield* store.set(name, ship)
      return ship
    })

    return NavalFateStore.of({ createShip, moveShip: ... })
  })
)

// CLI command
const newShipCommand = Command.make("new", { name: Args.text({ name: "name" }) }, ({ name }) =>
  Effect.gen(function* () {
    yield* createShip(name)
    yield* Console.log(`Created ship: '${name}'`)
  })
)

// Run with layers
Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(MainLayer),
  NodeRuntime.runMain
)
```

## Request Batching with Cache Control

```typescript
// Access and manipulate request cache
const cache = yield* FiberRef.get(FiberRef.currentRequestCache)
yield* cache.invalidateAll

// Batch requests made in parallel
const names = yield* Effect.zip(getAllUserNames, getAllUserNames, {
  concurrent: true,
  batching: true
})

// Control caching per-operation
yield* Effect.withRequestCaching(false)
yield* Effect.withRequestBatching(true)

// Cache warming
yield* Effect.cacheRequestResult(GetAllIds({}), Exit.succeed(userIds))
```

## Tagged Request Resolver

```typescript
// Discriminated resolver for different request types
const UserResolverTagged = Resolver.fromEffectTagged<UserRequest>()({
  GetAllIds: (reqs) => handleGetAllIds(reqs),
  GetNameById: (reqs) => handleGetNameById(reqs)
})

// With batch size limit
const resolver = Resolver.makeBatched((requests) => ...)
  .pipe(Resolver.batchN(15))
```

## Stream GroupBy

```typescript
const result = yield* pipe(
  Stream.fromIterable(words),
  Stream.groupByKey(identity, { bufferSize: 8192 }),
  GroupBy.evaluate((key, stream) =>
    pipe(
      Stream.runCollect(stream),
      Effect.map((leftover) => [key, leftover.length] as const),
      Stream.fromEffect
    )
  ),
  GroupBy.first(2),  // Limit to first 2 groups
  Stream.runCollect
)
```

## Stream Partition

```typescript
const { evens, odds } = yield* pipe(
  Stream.range(0, 5),
  Stream.partition((n) => n % 2 === 0, { bufferSize: 1 }),
  Effect.flatMap(([odds, evens]) =>
    Effect.all({
      evens: Stream.runCollect(evens),
      odds: Stream.runCollect(odds)
    })
  ),
  Effect.scoped
)
```

## Fiber Inheritance

```typescript
const fiberRef = yield* FiberRef.make(initial)
const child = yield* FiberRef.set(fiberRef, update).pipe(Effect.fork)

// Inherit local state from child fiber
yield* pipe(child, Fiber.inheritAll)
const result = yield* FiberRef.get(fiberRef) // Has child's update
```

## STM - Software Transactional Memory

```typescript
const transfer = (
  receiver: TRef.TRef<number>,
  sender: TRef.TRef<number>,
  amount: number
): Effect.Effect<number> =>
  pipe(
    TRef.get(sender),
    STM.tap((balance) => STM.check(() => balance >= amount)),
    STM.tap(() => TRef.update(receiver, (n) => n + amount)),
    STM.tap(() => TRef.update(sender, (n) => n - amount)),
    STM.zipRight(TRef.get(receiver)),
    STM.commit
  )
```

## SubscriptionRef - Reactive State

```typescript
const subscriptionRef = yield* SubscriptionRef.make(0)

// Subscribe to changes as Stream
const subscriber = yield* pipe(
  subscriptionRef.changes,
  Stream.take(3),
  Stream.runCollect,
  Effect.fork
)

yield* SubscriptionRef.update(subscriptionRef, (n) => n + 1)
```

## Schedule Composition

```typescript
// Union (OR) - either schedule triggers
const mondayOrWednesday = monday.pipe(Schedule.union(wednesday))

// Intersect (AND) - both must trigger
const alsoWednesday = mondayOrWednesday.pipe(Schedule.intersect(wednesdayOrFriday))

// Reset after inactivity
const schedule = Schedule.recurs(5).pipe(Schedule.resetAfter("5 seconds"))
```

## Pool with Scope

```typescript
const count = yield* Ref.make(0)
const get = Effect.acquireRelease(
  Ref.updateAndGet(count, (n) => n + 1),
  () => Ref.update(count, (n) => n - 1)
)

const scope = yield* Scope.make()
yield* Scope.extend(Pool.make({ acquire: get, size: 10 }), scope)
yield* Scope.close(scope, Exit.succeed(void 0))
```

## Concurrent Finalizers

```typescript
yield* pipe(
  Effect.addFinalizer(() => cleanupA),
  Effect.zipRight(Effect.addFinalizer(() => cleanupB), {
    concurrent: true,
    concurrentFinalizers: true
  }),
  Effect.scoped
)
```

## Match - Exhaustive Pattern Matching

```typescript
const match = M.type<string | number>().pipe(
  M.when(M.number, (n) => `number: ${n}`),
  M.when(M.string, (s) => `string: ${s}`),
  M.exhaustive
)

// Tagged matching
const match2 = pipe(
  M.type<{ _tag: "A"; a: number } | { _tag: "B"; b: number }>(),
  M.when({ _tag: "A" }, (_) => _.a),
  M.when({ _tag: "B" }, (_) => _.b),
  M.exhaustive
)
```

## Experimental: Machine Actor Model

```typescript
class SendEmail extends Request.TaggedClass("SendEmail")<void, SendError, { email: string }> {}
class Shutdown extends Request.TaggedClass("Shutdown")<void, never, {}>() {}

const mailer = Machine.makeWith<List.List<SendEmail>>()((_, previous) =>
  Effect.gen(function*() {
    const state = previous ?? List.empty()
    return Machine.procedures.make(state).pipe(
      Machine.procedures.add<SendEmail>()("SendEmail", (ctx) =>
        Effect.as([void 0, List.append(ctx.state, ctx.request)])
      ),
      Machine.procedures.add<Shutdown>()("Shutdown", () =>
        Effect.interrupt
      )
    )
  })
).pipe(Machine.retry(Schedule.forever))
```

## Experimental: Rate Limiter

```typescript
const consume = limiter.consume({
  algorithm: "token-bucket",
  onExceeded: "delay",  // Block and wait
  window: "10 seconds",
  limit: 5,
  key: "user-123"
})
// Returns { delay, limit, remaining, resetAfter }
```
