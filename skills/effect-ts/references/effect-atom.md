# Effect-Atom Patterns

**Source**: `~/.local/repos/tim-smart/effect-atom`

## Overview

Reactive state management for Effect with SSR/hydration support.

```
packages/atom/src/
├── Atom.ts          # Core atom definitions
├── Registry.ts      # Registry interface & context
├── Result.ts        # Initial/Success/Failure type
├── Hydration.ts     # SSR dehydration/hydration
└── AtomRef.ts       # Imperative reference API

packages/atom-react/src/
├── Hooks.ts         # React hooks (useAtom, useAtomValue)
├── ReactHydration.ts # HydrationBoundary component
└── RegistryContext.ts # React context provider
```

## Atom Interface

```typescript
export interface Atom<A> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly keepAlive: boolean
  readonly lazy: boolean
  readonly read: (get: Context) => A
  readonly refresh?: (f: <A>(atom: Atom<A>) => void) => void
  readonly label?: readonly [name: string, stack: string]
  readonly idleTTL?: number
}
```

## Context Protocol

```typescript
export interface Context {
  <A>(atom: Atom<A>): A  // Callable
  get<A>(this: Context, atom: Atom<A>): A
  result<A, E>(this: Context, atom: Atom<Result.Result<A, E>>, options?: {
    readonly suspendOnWaiting?: boolean
  }): Effect.Effect<A, E>
  subscribe<A>(this: Context, atom: Atom<A>, f: (_: A) => void, options?: {
    readonly immediate?: boolean
  }): void
  stream<A>(this: Context, atom: Atom<A>): Stream.Stream<A>
  readonly registry: Registry.Registry
}
```

## Creating Atoms

### Readable Atom

```typescript
const countAtom = Atom.readable((get) => {
  return get(baseAtom) * 2
})
```

### Writable Atom

```typescript
const countAtom = Atom.writable(
  (get) => get(baseAtom),
  (ctx, value: number) => {
    ctx.set(baseAtom, value)
  }
)
```

### State Atom (shorthand for writable)

```typescript
const countAtom = Atom.state(0)
```

### Effect Atom

```typescript
const userAtom = Atom.effect((get) =>
  Effect.gen(function* () {
    const id = get(userIdAtom)
    return yield* fetchUser(id)
  })
)
```

### Family (parameterized atoms)

```typescript
const userFamily = Atom.family((id: string) =>
  Atom.effect((get) => fetchUser(id))
)

// Usage
const user = get(userFamily("user-123"))
```

## Result Type

Three-state result for async atoms:

```typescript
export type Result<A, E = never> =
  | Initial<A, E>
  | Success<A, E>
  | Failure<A, E>

export interface Initial<A, E = never> {
  readonly _tag: "Initial"
}

export interface Success<A, E = never> {
  readonly _tag: "Success"
  readonly value: A
  readonly timestamp: number
}

export interface Failure<A, E = never> {
  readonly _tag: "Failure"
  readonly cause: Cause.Cause<E>
  readonly previousSuccess: Option.Option<Success<A, E>>
}
```

### Waiting State

```typescript
// Mark result as waiting (refetching)
const waitingResult = Result.waiting(result)
result.waiting // true

// Check states
Result.isInitial(result)
Result.isSuccess(result)
Result.isFailure(result)
```

### Result Builder Pattern

```typescript
Result.builder(result)
  .onWaiting((r) => "Loading...")
  .onInitial((r) => "Not started")
  .onSuccess((value, r) => `Got: ${value}`)
  .onFailure((cause, r) => `Error: ${cause}`)
  .orElse(() => "Unknown state")
```

## AtomRuntime - Service Integration

```typescript
const runtime = Atom.context({ memoMap: Layer.MemoMap.make() })

// Create runtime from layer
const appRuntime = runtime(AppLayer)

// Create atoms that use services
const userAtom = appRuntime.atom((get) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getCurrentUser()
  })
)

// Create traced functions
const fetchUser = appRuntime.fn("fetchUser")((id: string) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.getById(id)
  })
)
```

## Function Atoms

Atoms that accept arguments:

```typescript
const searchAtom = Atom.fn((query: string, get: FnContext) =>
  Effect.gen(function* () {
    const api = yield* SearchApi
    return yield* api.search(query)
  })
)

// Usage
registry.set(searchAtom, "search term")

// Reset
registry.set(searchAtom, Atom.Reset)

// Interrupt
registry.set(searchAtom, Atom.Interrupt)
```

## Registry

```typescript
// Create registry
const registry = Registry.make({
  scheduleTask: (f) => scheduler.scheduleTask(f, 0),
  defaultIdleTTL: 400,  // Auto-dispose after idle
})

// Get atom value
const value = registry.get(myAtom)

// Set writable atom
registry.set(myAtom, newValue)

// Subscribe to changes
const unsubscribe = registry.subscribe(myAtom, (value) => {
  console.log("New value:", value)
})

// Invalidate (trigger refresh)
registry.invalidate(myAtom)

// Dispose registry
registry.dispose()
```

### Registry Layer

```typescript
export const layerOptions = (options?: {
  readonly scheduleTask?: (f: () => void) => void
  readonly defaultIdleTTL?: number
}): Layer.Layer<AtomRegistry> =>
  Layer.scoped(
    AtomRegistry,
    Effect.gen(function* () {
      const scope = yield* Effect.scope
      const registry = internal.make(options)
      yield* Scope.addFinalizer(scope, Effect.sync(() => registry.dispose()))
      return registry
    })
  )
```

## SSR Hydration

### Server-side Dehydration

```typescript
const dehydrated = Hydration.dehydrate(registry, {
  encodeInitialAs: "promise"  // "ignore" | "promise" | "value-only"
})

// Returns Array<DehydratedAtom>
// {
//   key: string,
//   value: encoded,
//   dehydratedAt: timestamp,
//   resultPromise?: Promise<unknown>
// }
```

### Client-side Hydration

```typescript
Hydration.hydrate(registry, dehydratedAtoms)
```

### Serializable Atoms

Mark atoms for hydration:

```typescript
const userAtom = Atom.effect((get) => fetchUser()).pipe(
  Atom.serializable({
    key: "currentUser",
    schema: UserSchema
  })
)
```

## React Integration

### Registry Provider

```typescript
import { RegistryProvider } from "@effect-atom/atom-react"

function App() {
  return (
    <RegistryProvider
      initialValues={[[countAtom, 0]]}
      defaultIdleTTL={400}
    >
      <MyComponent />
    </RegistryProvider>
  )
}
```

### useAtom Hook

```typescript
const [value, setValue] = useAtom(countAtom)

// With mode
const [value, setValue] = useAtom(countAtom, { mode: "promise" })
```

### useAtomValue Hook

```typescript
const value = useAtomValue(countAtom)
```

### useAtomSuspense Hook

```typescript
// Suspends until result is Success
const result = useAtomSuspense(asyncAtom, {
  suspendOnWaiting: true,
  includeFailure: false
})
```

### HydrationBoundary

```typescript
import { HydrationBoundary } from "@effect-atom/atom-react"

function App({ dehydratedState }) {
  return (
    <RegistryProvider>
      <HydrationBoundary state={dehydratedState}>
        <MyComponent />
      </HydrationBoundary>
    </RegistryProvider>
  )
}
```

## useSyncExternalStore Integration

Internal implementation for React 18+:

```typescript
function useStore<A>(registry: Registry, atom: Atom<A>): A {
  const store = makeStore(registry, atom)
  return React.useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    store.getServerSnapshot
  )
}

function makeStore<A>(registry: Registry, atom: Atom<A>): AtomStore<A> {
  return {
    subscribe: (f) => registry.subscribe(atom, f),
    snapshot: () => registry.get(atom),
    getServerSnapshot: () => registry.get(atom)
  }
}
```

## AtomRef - Mutable References

Imperative reference with structural equality:

```typescript
const ref = AtomRef.make({ count: 0, name: "test" })

// Get value
ref.value // { count: 0, name: "test" }

// Set value (notifies if changed)
ref.set({ count: 1, name: "test" })

// Update
ref.update((v) => ({ ...v, count: v.count + 1 }))

// Property lens
const countRef = ref.prop("count")
countRef.set(5)

// Subscribe
ref.subscribe((value) => console.log(value))
```

### Equality-based Notifications

```typescript
// Only notifies if value actually changed
ref.set({ count: 0, name: "test" })  // No notification (equal)
ref.set({ count: 1, name: "test" })  // Notification (changed)
```

## Batch Updates

```typescript
Atom.batch(() => {
  registry.set(atomA, 1)
  registry.set(atomB, 2)
  registry.set(atomC, 3)
})
// Single re-render after all updates
```

## Server Value Override

Different values for SSR vs client:

```typescript
const timeAtom = Atom.state(Date.now()).pipe(
  Atom.withServerValue((get) => 0)  // Always 0 on server
)
```

## Optimistic Updates

```typescript
const atom = Atom.make(() => i)
const optimisticAtom = atom.pipe(Atom.optimistic)

const fn = optimisticAtom.pipe(
  Atom.optimisticFn({
    reducer: (_current, update: number) => update,
    fn: Atom.fn(Effect.fnUntraced(function*() {
      yield* latch.await
    }))
  })
)

// Optimistic phase: optimistic value shown but true value unchanged
r.set(fn, 1)
expect(r.get(optimisticAtom)).toEqual(1)  // Optimistic
expect(r.get(atom)).toEqual(0)             // True value

// Commit phase: true value is now used
latch.unsafeOpen()
expect(r.get(optimisticAtom)).toEqual(2)  // From server
```

### With Failure Rollback

```typescript
const fn = optimisticAtom.pipe(
  Atom.optimisticFn({
    reducer: (_, value) => value,
    fn: Atom.fn<number>()(Effect.fnUntraced(function*() {
      yield* Effect.fail("error")
    }))
  })
)

r.set(fn, 1)
expect(r.get(optimisticAtom)).toEqual(1)  // Optimistic

// On failure, rollback to true value
latch.unsafeOpen()
expect(r.get(optimisticAtom)).toEqual(0)  // Rolled back
```

## Stream Atoms

```typescript
const count = Atom.make(
  Stream.range(0, 2).pipe(
    Stream.tap(() => Effect.sleep(50))
  )
)

let result = r.get(count)
assert(result.waiting)

await vitest.advanceTimersByTimeAsync(50)
result = r.get(count)
assert.deepEqual(result.value, 0)  // First value from stream
```

## Pull Pattern (Pagination)

```typescript
const count = Atom.pull(
  Stream.range(0, 1, 1).pipe(
    Stream.tap(() => Effect.sleep(50))
  )
)

result = r.get(count)
assert.deepEqual(result.value, { done: false, items: [0] })

// Pull next batch
r.set(count, void 0)
result = r.get(count)
assert.deepEqual(result.value, { done: false, items: [0, 1] })

// Final pull
r.set(count, void 0)
assert.deepEqual(result.value, { done: true, items: [0, 1] })
```

## Concurrent Async

```typescript
const count = Atom.fn((_: number) => {
  const latch = Effect.unsafeMakeLatch()
  latches.push(latch)
  return latch.await
}, { concurrent: true })

// Multiple concurrent fibers tracked
r.set(count, 1)
r.set(count, 1)
r.set(count, 1)
assert.strictEqual(latches.length, 3)  // 3 concurrent fibers
```

## KeyValueStore Persistence

```typescript
const persistedAtom = Atom.kvs({
  runtime: appRuntime,
  key: "settings",
  schema: SettingsSchema,
  defaultValue: () => defaultSettings
})

// Reads from KeyValueStore on init, writes on set
```

## URL Search Parameter Persistence

```typescript
const filterAtom = Atom.searchParam("filter", {
  schema: Schema.Literal("all", "active", "completed")
})

// Syncs with URL ?filter=all
// Debounced updates to avoid URL spam
```

## Window Focus Refresh

```typescript
const dataAtom = Atom.make(() => fetchData()).pipe(
  Atom.refreshOnWindowFocus
)
// Automatically refreshes when window regains focus
```

## Idle TTL (Time To Live)

```typescript
const state = Atom.make(0).pipe(Atom.setIdleTTL(10000))  // 10s TTL

r.set(state, 10)
await vitest.advanceTimersByTimeAsync(10000)
expect(r.get(state)).toEqual(0)  // Disposed, back to initial
```

## Transform Middleware

```typescript
// Debounce middleware pattern
export const debounce = <A>(self: Atom<A>, duration: DurationInput): Atom<A> =>
  Atom.transform(self, function(get) {
    let timeout: number | undefined
    let value = get.once(self)

    get.subscribe(self, function(val) {
      value = val
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => get.setSelf(value), millis)
    })

    get.addFinalizer(() => { if (timeout) clearTimeout(timeout) })
    return value
  })
```

## Complete Example

```typescript
// Schema for serialization
const TodoSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  completed: Schema.Boolean
})

// Atoms
const todosAtom = Atom.effect((get) =>
  Effect.gen(function* () {
    const api = yield* TodoApi
    return yield* api.list()
  })
).pipe(
  Atom.serializable({
    key: "todos",
    schema: Schema.Array(TodoSchema)
  })
)

const filteredTodosAtom = Atom.readable((get) => {
  const todos = get(todosAtom)
  const filter = get(filterAtom)

  return Result.map(todos, (items) =>
    items.filter(todo =>
      filter === "all" ? true :
      filter === "completed" ? todo.completed :
      !todo.completed
    )
  )
})

// React component
function TodoList() {
  const result = useAtomValue(filteredTodosAtom)

  return Result.builder(result)
    .onWaiting(() => <Spinner />)
    .onInitial(() => <div>Loading...</div>)
    .onSuccess((todos) => (
      <ul>
        {todos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
      </ul>
    ))
    .onFailure((cause) => <Error cause={cause} />)
    .render()
}
```
