# Lucas Barake Full-Stack Patterns

**Source**: `~/.local/repos/lucas-barake/effect-tanstack-start`, `~/.local/repos/lucas-barake/building-an-app-with-effect`, `~/.local/repos/lucas-barake/effect-monorepo`

## Project Structures

### effect-tanstack-start (Simple Full-stack)

```
src/
├── api/
│   ├── domain-rpc.ts      # RPC contract definition
│   ├── domain-api.ts      # HTTP API definition
│   ├── api-client.ts      # Client-side API client
│   └── todo-schema.ts     # Schemas and errors
├── routes/api/
│   ├── $.ts               # Catch-all API handler
│   └── -lib/
│       ├── todos-service.ts    # Service implementation
│       ├── todos-api-live.ts   # HTTP handler
│       └── todos-rpc-live.ts   # RPC handler
└── lib/
    └── atom-utils.ts      # Effect-Atom integration
```

### effect-monorepo (Enterprise)

```
packages/
├── domain/
│   ├── EntityIds.ts           # Branded IDs
│   ├── CustomHttpApiError.ts  # All HTTP errors
│   ├── ManualCache.ts         # Custom caching
│   └── styles-rpc.ts          # RPC contracts
├── database/
│   └── Database.ts            # Connection pool, transactions
├── server/
│   ├── server.ts              # Entry point
│   └── public/
│       ├── todos/
│       │   ├── todos-repository.ts
│       │   └── todos-live.ts
│       ├── middlewares/
│       │   └── auth-middleware-live.ts
│       └── sse/
│           └── sse-manager.ts
└── client/
```

## Service Definition (Effect.Service)

```typescript
export class TodosService extends Effect.Service<TodosService>()(
  "TodosService",
  {
    effect: Effect.gen(function* () {
      const todosRef = yield* Ref.make<Map<TodoId, Todo>>(new Map())

      const list = Effect.gen(function* () {
        const todos = yield* Ref.get(todosRef)
        return Array.from(todos.values())
      })

      const getById = (id: TodoId) =>
        Effect.gen(function* () {
          const todos = yield* Ref.get(todosRef)
          const todo = todos.get(id)
          if (!todo) return yield* new TodoNotFound({ id })
          return todo
        })

      const create = (title: string) =>
        Effect.gen(function* () {
          const id = TodoId.make(crypto.randomUUID())
          const todo: Todo = { id, title, completed: false }
          yield* Ref.update(todosRef, (todos) => new Map(todos).set(id, todo))
          return todo
        })

      const update = (id: TodoId, data: Partial<Todo>) =>
        Effect.gen(function* () {
          const existing = yield* getById(id)
          const updated = { ...existing, ...data }
          yield* Ref.update(todosRef, (todos) => new Map(todos).set(id, updated))
          return updated
        })

      const remove = (id: TodoId) =>
        Effect.gen(function* () {
          yield* getById(id)  // Throws if not found
          yield* Ref.update(todosRef, (todos) => {
            const next = new Map(todos)
            next.delete(id)
            return next
          })
        })

      return { list, getById, create, update, remove } as const
    }),
  },
) {}
```

## RPC Contract

```typescript
export const DomainRpc = RpcGroup.make("domain").pipe(
  RpcGroup.add(
    Rpc.effect("listTodos", {
      success: Schema.Array(TodoSchema),
    }),
  ),
  RpcGroup.add(
    Rpc.effect("createTodo", {
      payload: Schema.Struct({ title: Schema.String }),
      success: TodoSchema,
    }),
  ),
  RpcGroup.add(
    Rpc.effect("updateTodo", {
      payload: Schema.Struct({
        id: TodoId,
        title: Schema.optional(Schema.String),
        completed: Schema.optional(Schema.Boolean),
      }),
      success: TodoSchema,
      error: TodoNotFound,
    }),
  ),
  RpcGroup.add(
    Rpc.effect("deleteTodo", {
      payload: Schema.Struct({ id: TodoId }),
      success: Schema.Void,
      error: TodoNotFound,
    }),
  ),
)
```

## HTTP API Definition

```typescript
export const DomainApi = HttpApi.make("domain").pipe(
  HttpApi.addGroup(
    HttpApiGroup.make("todos").pipe(
      HttpApiGroup.add(
        HttpApiEndpoint.get("list", "/").pipe(
          HttpApiEndpoint.addSuccess(Schema.Array(TodoSchema)),
        ),
      ),
      HttpApiGroup.add(
        HttpApiEndpoint.post("create", "/").pipe(
          HttpApiEndpoint.setPayload(Schema.Struct({ title: Schema.String })),
          HttpApiEndpoint.addSuccess(TodoSchema),
        ),
      ),
      HttpApiGroup.add(
        HttpApiEndpoint.patch("update", "/:id").pipe(
          HttpApiEndpoint.setPath(Schema.Struct({ id: TodoId })),
          HttpApiEndpoint.setPayload(Schema.Struct({
            title: Schema.optional(Schema.String),
            completed: Schema.optional(Schema.Boolean),
          })),
          HttpApiEndpoint.addSuccess(TodoSchema),
          HttpApiEndpoint.addError(TodoNotFound),
        ),
      ),
      HttpApiGroup.prefix("/todos"),
    ),
  ),
)
```

## Dual Protocol Handler (RPC + HTTP)

```typescript
// routes/api/$.ts
import { createAPIFileRoute } from "@tanstack/react-start/api"

const RpcLive = RpcServer.layer(DomainRpc, TodosRpcLive)
const HttpLive = HttpLayerRouter.addHttpApi(DomainApi).pipe(
  Layer.provide(TodosApiLive),
)

const AllRoutes = Layer.mergeAll(
  HttpLive,
  RpcLive.pipe(Layer.provide(RpcMiddlewareLive)),
)

const ServeLive = HttpLayerRouter.serve(AllRoutes)

// ManagedRuntime for server functions
let runtime: ManagedRuntime.ManagedRuntime<never, never> | null = null

const getRuntime = () => {
  if (runtime === null) {
    runtime = ManagedRuntime.make(
      ServeLive.pipe(Layer.provide(TodosService.Default))
    )
  }
  return runtime
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (runtime !== null) {
      Effect.runFork(runtime.dispose())
      runtime = null
    }
  })
}

export const APIRoute = createAPIFileRoute("/api/$")({
  GET: ({ request }) => getRuntime().runPromise(HttpLayerRouter.toWebHandler(request)),
  POST: ({ request }) => getRuntime().runPromise(HttpLayerRouter.toWebHandler(request)),
  PATCH: ({ request }) => getRuntime().runPromise(HttpLayerRouter.toWebHandler(request)),
  DELETE: ({ request }) => getRuntime().runPromise(HttpLayerRouter.toWebHandler(request)),
})
```

## Schema with HTTP Annotations

```typescript
export const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
export type TodoId = typeof TodoId.Type

export const TodoSchema = Schema.Struct({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
})
export type Todo = typeof TodoSchema.Type

export class TodoNotFound extends Schema.TaggedError<TodoNotFound>()(
  "TodoNotFound",
  { id: TodoId },
  HttpApiSchema.annotations({ status: 404 }),
) {}
```

## Comprehensive HTTP Errors

```typescript
// CustomHttpApiError.ts - All HTTP error types

// 4xx Client Errors
export class BadRequest extends S.TaggedError<BadRequest>()(
  "BadRequest",
  { message: S.optional(S.String) },
  HttpApiSchema.annotations({ status: 400 }),
) {}

export class Unauthorized extends S.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: S.optional(S.String) },
  HttpApiSchema.annotations({ status: 401 }),
) {}

export class Forbidden extends S.TaggedError<Forbidden>()(
  "Forbidden",
  { message: S.optional(S.String) },
  HttpApiSchema.annotations({ status: 403 }),
) {}

export class NotFound extends S.TaggedError<NotFound>()(
  "NotFound",
  { message: S.optional(S.String) },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// 5xx Server Errors
export class InternalServerError extends S.TaggedError<InternalServerError>()(
  "InternalServerError",
  { message: S.optional(S.String) },
  HttpApiSchema.annotations({ status: 500 }),
) {}

export class ServiceUnavailable extends S.TaggedError<ServiceUnavailable>()(
  "ServiceUnavailable",
  { message: S.optional(S.String) },
  HttpApiSchema.annotations({ status: 503 }),
) {}

// ~350 lines covering all HTTP status codes
```

## Repository Pattern

```typescript
export class TodosRepository extends Effect.Service<TodosRepository>()(
  "TodosRepository",
  {
    effect: Effect.gen(function* () {
      const database = yield* Database

      const create = (title: string) =>
        database.use((db) =>
          db.insert(todos).values({ title }).returning()
        ).pipe(
          Effect.map((rows) => rows[0]),
          Effect.withSpan("TodosRepository.create"),
        )

      const findById = (id: TodoId) =>
        database.use((db) =>
          db.select().from(todos).where(eq(todos.id, id))
        ).pipe(
          Effect.flatMap((rows) =>
            rows.length === 0
              ? Effect.fail(new TodoNotFound({ id }))
              : Effect.succeed(rows[0])
          ),
          Effect.withSpan("TodosRepository.findById"),
        )

      const update = (id: TodoId, data: Partial<Todo>) =>
        database.use((db) =>
          db.update(todos).set(data).where(eq(todos.id, id)).returning()
        ).pipe(
          Effect.flatMap((rows) =>
            rows.length === 0
              ? Effect.fail(new TodoNotFound({ id }))
              : Effect.succeed(rows[0])
          ),
          Effect.withSpan("TodosRepository.update"),
        )

      return { create, findById, update, delete: remove } as const
    }),
  },
) {}
```

## Database Service

```typescript
export class Database extends Context.Tag("Database")<
  Database,
  {
    use: <A>(
      fn: (db: DrizzleClient) => Promise<A>
    ) => Effect.Effect<A, DatabaseError>
  }
>() {
  static provide = <A, E, R>(effect: Effect.Effect<A, E, R | Database>) =>
    Effect.provide(effect, DatabaseLive)
}

const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => new Pool({ connectionString: process.env.DATABASE_URL })),
      (pool) => Effect.promise(() => pool.end())
    )

    const db = drizzle(pool)

    return {
      use: (fn) =>
        Effect.tryPromise({
          try: () => fn(db),
          catch: (error) => {
            if (error instanceof DatabaseError) {
              // Map PostgreSQL error codes
              if (error.code === "23505") {
                return new UniqueViolation({ message: error.message })
              }
            }
            return new DatabaseError({ cause: error })
          },
        }),
    }
  }),
)
```

## Authentication Middleware

```typescript
export const AuthMiddlewareLive = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    return {
      bearer: (token) =>
        Effect.gen(function* () {
          const decoded = yield* verifyToken(token).pipe(
            Effect.mapError(() => new Unauthorized({ message: "Invalid token" }))
          )

          return CurrentUserSchema.make({
            userId: decoded.sub,
            email: decoded.email,
            permissions: decoded.permissions,
          })
        }),
    }
  }),
)
```

## SSE Manager

```typescript
export class SseManager extends Effect.Service<SseManager>()(
  "SseManager",
  {
    effect: Effect.gen(function* () {
      const connectionsRef = yield* Ref.make(MutableHashMap.empty<string, Connection>())

      const connect = (userId: string) =>
        Effect.gen(function* () {
          const queue = yield* Queue.unbounded<ServerSentEvent>()
          const connection: Connection = { userId, queue }

          yield* Ref.update(connectionsRef, (map) => {
            MutableHashMap.set(map, userId, connection)
            return map
          })

          return {
            stream: Stream.fromQueue(queue).pipe(
              Stream.map((event) => ServerSentEvent.encode(event)),
            ),
            close: Effect.gen(function* () {
              yield* Ref.update(connectionsRef, (map) => {
                MutableHashMap.remove(map, userId)
                return map
              })
              yield* Queue.shutdown(queue)
            }),
          }
        })

      const broadcast = (event: ServerSentEvent) =>
        Effect.gen(function* () {
          const connections = yield* Ref.get(connectionsRef)
          yield* Effect.forEach(
            MutableHashMap.values(connections),
            (conn) => Queue.offer(conn.queue, event),
            { concurrency: "unbounded" }
          )
        })

      const sendTo = (userId: string, event: ServerSentEvent) =>
        Effect.gen(function* () {
          const connections = yield* Ref.get(connectionsRef)
          const connection = MutableHashMap.get(connections, userId)
          if (Option.isSome(connection)) {
            yield* Queue.offer(connection.value.queue, event)
          }
        })

      return { connect, broadcast, sendTo } as const
    }),
  },
) {}
```

## Manual Cache

```typescript
export class ManualCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number }>()
  private stats = { hits: 0, misses: 0 }

  constructor(
    private readonly options: {
      maxSize: number
      ttlMs: number
    }
  ) {}

  get(key: K): Option.Option<V> {
    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.misses++
      return Option.none()
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      return Option.none()
    }
    this.stats.hits++
    return Option.some(entry.value)
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.options.maxSize) {
      // LRU eviction
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.options.ttlMs,
    })
  }

  invalidate(key: K): void {
    this.cache.delete(key)
  }
}
```

## API Client

```typescript
export const ApiClient = Effect.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient

  // RPC client
  const rpcClient = RpcClient.make(DomainRpc, {
    fetch: (request) =>
      httpClient.execute(
        HttpClientRequest.post("/api/rpc").pipe(
          HttpClientRequest.setBody(request.body),
        )
      ),
  })

  // HTTP client
  const httpApiClient = yield* HttpApiClient.make(DomainApi, {
    baseUrl: "/api",
    transformClient: HttpClient.filterStatusOk,
  })

  return {
    rpc: rpcClient,
    http: httpApiClient,
  } as const
})
```

## Effect-Atom Integration

```typescript
import { Atom } from "@effect-atom/atom"
import { Schema } from "effect"

export const createSerializableAtom = <A, I>(
  key: string,
  schema: Schema.Schema<A, I>,
  initial: A
) =>
  Atom.state(initial).pipe(
    Atom.serializable({ key, schema })
  )

// Usage
const todosAtom = createSerializableAtom(
  "todos",
  Schema.Array(TodoSchema),
  []
)
```

## Server Entry Point

```typescript
const MainLayer = Layer.mergeAll(
  TodosLive,
  AuthMiddlewareLive,
  SseManager.Default,
).pipe(
  Layer.provide(TodosRepository.Default),
  Layer.provide(DatabaseLive),
)

const ServerLive = HttpLayerRouter.serve(AllRoutes).pipe(
  Layer.provide(MainLayer),
  Layer.provide(NodeHttpServer.layer({ port: 3000 })),
)

Effect.gen(function* () {
  yield* Effect.logInfo("Starting server...")
  yield* Layer.launch(ServerLive)
}).pipe(
  Effect.retry({
    while: (e) => e._tag === "DatabaseConnectionError",
    schedule: Schedule.exponential("1 second").pipe(
      Schedule.compose(Schedule.recurs(5))
    ),
  }),
  NodeRuntime.runMain,
)
```

## Schema Utilities

```typescript
// Duration from seconds
export const DurationFromSeconds = Schema.transform(
  Schema.Number,
  Schema.DurationFromMillis,
  {
    decode: (seconds) => seconds * 1000,
    encode: (millis) => millis / 1000,
  }
)

// Email validation
export const Email = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.brand("Email")
)

// URL validation
export const URLString = Schema.String.pipe(
  Schema.filter((s) => {
    try {
      new URL(s)
      return true
    } catch {
      return false
    }
  }),
  Schema.brand("URLString")
)

// Fallible array (logs errors, returns valid items)
export const FallibleArray = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.Array(Schema.Unknown).pipe(
    Schema.transform(
      Schema.Array(schema),
      {
        decode: (items) =>
          items.flatMap((item) => {
            const result = Schema.decodeUnknownEither(schema)(item)
            if (Either.isLeft(result)) {
              console.warn("Failed to decode item:", result.left)
              return []
            }
            return [result.right]
          }),
        encode: (items) => items,
      }
    )
  )
```
