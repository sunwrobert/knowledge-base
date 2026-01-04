# TeamWarp API Patterns

**Source**: `~/.local/repos/TeamWarp/effect-api-example`

## Project Structure

```
apps/server/src/
├── main.ts                    # Entry point with layer composition
├── api/groups/                # Endpoint implementations (Live)
└── db/                        # Database layer

packages/api/src/definition/
├── WarpApi.ts                 # Main API composition
├── groups/                    # Endpoint schemas (no implementation)
├── middleware/                # Middleware definitions
└── Pagination.ts              # Shared utilities

packages/shared/src/           # Branded types, validation schemas
```

## API Definition (Schema-first)

### Main API

```typescript
export class WarpApi extends HttpApi.make('WarpApi')
  .add(Groups.HealthGroup)
  .add(Groups.EmployeesGroup)
  .prefix('/v1')
{}
```

### Simple Group

```typescript
export const HealthGroup = HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('healthCheck', '/health').addSuccess(
    S.Struct({
      status: S.Literal('ok'),
      timestamp: S.DateTimeUtc,
      version: S.String,
    }),
  ),
)
```

### Complex Group with Errors & Middleware

```typescript
// Query parameters with schema composition
const ListEmployeesUrlParamsSchema = S.Struct({
  ...Pagination.ApiQueryParams(EmployeeTagSchema).fields,
  types: S.optional(S.Array(EmployeeTypeSchema)),
})

// Tagged error with HTTP status
export class EmployeeNotFoundError extends S.TaggedError<EmployeeNotFoundError>()(
  'EmployeeNotFoundError',
  {
    id: EmployeeTagSchema,
    message: S.String,
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// Group with endpoints, errors, middleware
export const EmployeesGroup = HttpApiGroup.make('Employees')
  .add(
    HttpApiEndpoint.get('list', '/')
      .setUrlParams(ListEmployeesUrlParamsSchema)
      .addSuccess(Pagination.ApiResponse(PublicEmployeeSchema)),
  )
  .add(
    HttpApiEndpoint.get('get', '/:id')
      .setPath(S.Struct({ id: EmployeeTagSchema }))
      .addSuccess(PublicEmployeeSchema)
      .addError(EmployeeNotFoundError, { status: 404 }),
  )
  .addError(HttpApiError.InternalServerError, { status: 500 })
  .middleware(ApiKeyAuthMiddleware)
  .prefix('/employees')
```

## Branded Types

```typescript
// Branded integer ID
export const EmployeeIdSchema = S.Number.pipe(
  S.int(),
  S.brand("EmployeeId")
)
export type EmployeeId = typeof EmployeeIdSchema.Type

// Branded string with prefix validation
export const EmployeeTagSchema = S.String.pipe(
  S.startsWith('emp_'),
  S.annotations({
    title: 'EmployeeTag',
    description: 'Unique identifier (e.g., emp_abc123)',
    examples: ['emp_abc123'],
  }),
  S.brand('EmployeeTag'),
)
export type EmployeeTag = typeof EmployeeTagSchema.Type

// Enum literals
export const EmployeeTypeSchema = S.Literal('full_time', 'hourly')

// Email with regex validation
export const EmailSchema = S.String.pipe(
  S.pattern(/^(?!\.)(?!.*\.\.)([a-z0-9_'+\-\.]*)[a-z0-9_'+\-]@([a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/i),
  S.annotations({ title: 'Email', examples: ['user@example.com'] }),
  S.brand('Email'),
)
```

## Generic Pagination

```typescript
// Response wrapper
export const ApiResponse = <A extends { id: string }, I, R>(
  dataSchema: S.Schema<A, I, R>
) =>
  S.Struct({
    hasMore: S.Boolean,
    data: S.Array(dataSchema),
  })

// Query parameters with defaults
export const ApiQueryParams = <A extends string, I, R>(
  idSchema: S.Schema<A, I, R>,
  limit = { default: 50, max: 250, min: 1 }
) =>
  S.Struct({
    limit: S.optional(
      S.NumberFromString.pipe(
        S.int(),
        S.greaterThanOrEqualTo(limit.min),
        S.lessThanOrEqualTo(limit.max)
      )
    ).pipe(S.withDecodingDefault(() => limit.default)),
    afterId: S.optional(idSchema),
    beforeId: S.optional(idSchema),
  })
```

## Handler Implementation

```typescript
export const EmployeesGroupLive = HttpApiBuilder.group(
  WarpApi,
  'Employees',
  (handlers) =>
    handlers
      .handle('list', ({ urlParams: { types, limit, afterId, beforeId } }) =>
        Effect.gen(function* () {
          const drizzle = yield* PgDrizzle.PgDrizzle

          const filters: SQL[] = []
          if (types?.length) filters.push(inArray(employees.type, types))
          if (afterId) filters.push(gt(employees.tag, afterId))
          if (beforeId) filters.push(lt(employees.tag, beforeId))

          const results = yield* drizzle
            .select()
            .from(employees)
            .where(filters.length > 0 ? and(...filters) : undefined)
            .orderBy(asc(employees.tag))
            .limit(limit + 1)
            .pipe(
              Effect.catchAll((e) =>
                Effect.gen(function* () {
                  yield* Effect.logError('Failed to list employees: ', e)
                  return yield* Effect.fail(new HttpApiError.InternalServerError())
                }),
              ),
            )

          const hasMore = results.length > limit
          const pageData = results.slice(0, limit)

          return {
            hasMore,
            data: pageData.map(dbEmployeeToPublicEmployee),
          }
        }),
      )
      .handle('get', ({ path: { id } }) =>
        Effect.gen(function* () {
          const drizzle = yield* PgDrizzle.PgDrizzle
          const results = yield* drizzle
            .select()
            .from(employees)
            .where(eq(employees.tag, id))

          if (results.length === 0) {
            return yield* Effect.fail(
              new EmployeeNotFoundError({ id, message: `Employee not found: ${id}` }),
            )
          }

          return dbEmployeeToPublicEmployee(results[0])
        }),
      ),
)
```

## Database Layer

```typescript
const PgLive = Layer.scopedContext(
  Effect.gen(function* () {
    const host = yield* Config.string('DB_HOST')
    const port = yield* Config.number('DB_PORT')
    const database = yield* Config.string('DB_NAME')
    const password = yield* Config.redacted('DB_PASSWORD')
    const username = yield* Config.string('DB_USERNAME')

    const client = yield* PgClient.make({
      password,
      host,
      port,
      database,
      username,
    })

    return Context.make(PgClient.PgClient, client)
      .pipe(Context.add(Client.SqlClient, client))
  }),
).pipe(Layer.provide(Reactivity.layer))

const DrizzleLive = PgDrizzle.layerWithConfig({
  casing: 'snake_case',
}).pipe(Layer.provide(PgLive))

export const layer = Layer.mergeAll(PgLive, DrizzleLive)
```

## Middleware

### Definition

```typescript
export class ApiKeyUnauthorized extends S.TaggedError<ApiKeyUnauthorized>()(
  'ApiKeyUnauthorized',
  { message: S.String },
  HttpApiSchema.annotations({ status: 401 }),
) {}

export class ApiKeyAuthMiddleware extends HttpApiMiddleware.Tag<ApiKeyAuthMiddleware>()(
  'ApiKeyAuthMiddleware',
  {
    provides: HttpApiSecurity.apiKey({
      key: 'x-api-key',
      in: 'header',
    }),
    failure: ApiKeyUnauthorized,
  },
) {}
```

### Implementation

```typescript
export const ApiKeyAuthMiddlewareLive = Layer.effect(
  ApiKeyAuthMiddleware,
  Effect.gen(function* () {
    return {
      apiKey: (apiKey) =>
        Effect.gen(function* () {
          const apiKeyValue = Redacted.value(apiKey)

          if (!apiKeyValue) {
            yield* Effect.logWarning('No API key provided')
            return yield* Effect.fail(
              new ApiKeyUnauthorized({ message: 'API key is required' }),
            )
          }

          return { apiKeyId: apiKeyValue }
        }),
    }
  }),
)
```

## Server Entry Point

```typescript
const ApiImplementationLive = HttpGroupsLive.pipe(
  Layer.provide(SqlLive.layer)
)

const HttpApiRoutes = HttpLayerRouter.addHttpApi(WarpApi).pipe(
  Layer.provide(ApiImplementationLive),
)

const DocsRoute = HttpApiScalar.layerHttpLayerRouter({
  api: WarpApi,
  path: '/docs',
})

const OpenApiJsonRoute = HttpLayerRouter.add(
  'GET',
  '/docs/openapi.json',
  HttpServerResponse.json(OpenApi.fromApi(WarpApi)),
).pipe(Layer.provide(HttpLayerRouter.layer))

const AllRoutes = Layer.mergeAll(
  HttpApiRoutes,
  DocsRoute,
  OpenApiJsonRoute,
).pipe(Layer.provide(HttpLayerRouter.cors()))

const OTELNodeSdk = NodeSdk.layer(() => ({
  resource: { serviceName: 'warp-api' },
  spanProcessor: new BatchSpanProcessor(new ConsoleSpanExporter())
}))

const ServerLive = HttpLayerRouter.serve(AllRoutes).pipe(
  Layer.provide(BunHttpServer.layer({ port: 9277 })),
  Layer.provide(OTELNodeSdk)
)

BunRuntime.runMain(Layer.launch(ServerLive))
```

## Type-safe Client

```typescript
const client = yield* HttpApiClient.make(WarpApi, {
  baseUrl,
  transformClient: HttpClient.mapRequest((req) =>
    HttpClientRequest.setHeader(req, 'x-api-key', apiKey),
  ),
}).pipe(Effect.provideService(HttpClient.HttpClient, httpClient))

// Type-safe calls
const page1 = yield* client.Employees.list({ urlParams: { limit: 10 } })
const employee = yield* client.Employees.get({ path: { id: 'emp_123' } })
```

## Drizzle Schema Integration

```typescript
// Use Schema literals for enum
export const employeeTypeEnum = pgEnum('employee_type', EmployeeTypeSchema.literals)

// Type-safe columns with branded types
export const employees = pgTable('employees', {
  id: integer().$type<EmployeeId>().primaryKey().generatedAlwaysAsIdentity(),
  tag: varchar().$default(() => generateTag()).$type<EmployeeTag>().notNull().unique(),
  email: varchar().$type<EmailString>().notNull().unique(),
  type: employeeTypeEnum().notNull(),
})

// Row mapping
type DbEmployee = typeof employees.$inferSelect

function dbEmployeeToPublicEmployee(emp: DbEmployee): PublicEmployee {
  return PublicEmployeeSchema.make({
    id: emp.tag,
    email: emp.email,
    type: emp.type,
    createdAt: DateTime.unsafeFromDate(emp.createdAt),
  })
}
```
