# Alchemy AWS Patterns

**Source**: `~/.local/repos/alchemy-run/alchemy-effect` and `~/.local/repos/alchemy-run/itty-aws`

## Overview

Infrastructure-as-code framework using Effect-TS for AWS resources.

## AWS Service Client Pattern

Generic client factory with retry and logging:

```typescript
export const createAWSServiceClientLayer = <Tag extends Context.Tag<any, any>, Client>(
  tag: Tag,
  clss: new (config: AWSClientConfig) => Client,
) => () =>
  Layer.effect(
    tag,
    Effect.gen(function* () {
      const region = yield* Region
      const credentials = yield* Credentials

      const client = new clss({
        region,
        credentials: {
          accessKeyId: Redacted.value(credentials.accessKeyId),
          secretAccessKey: Redacted.value(credentials.secretAccessKey),
          sessionToken: credentials.sessionToken
            ? Redacted.value(credentials.sessionToken)
            : undefined,
        },
      })

      // Proxy with automatic retry
      return new Proxy(client as any, {
        get: (target, prop) => (...args: any[]) =>
          target[prop](...args).pipe(
            Effect.retry({
              while: (e: any) =>
                e._tag === "ThrottlingException" ||
                e._tag === "RequestLimitExceeded" ||
                e._tag === "TooManyRequestsException",
              schedule: Schedule.exponential(10).pipe(
                Schedule.intersect(Schedule.recurs(10)),
                Schedule.jittered,
                Schedule.modifyDelay(([out]) =>
                  Duration.toMillis(out) > 3000 ? Duration.seconds(3) : out
                ),
              ),
            }),
            Logger.withMinimumLogLevel(LogLevel.Warning),
          ),
      })
    }),
  )

// Usage
export const client = createAWSServiceClientLayer(LambdaClient, LambdaClientImpl)
export const client = createAWSServiceClientLayer(DynamoDBClient, DynamoDBClientImpl)
```

## Credentials Service

```typescript
export class Credentials extends Context.Tag("AWS::Credentials")<
  Credentials,
  {
    accessKeyId: Redacted.Redacted<string>
    secretAccessKey: Redacted.Redacted<string>
    sessionToken: Redacted.Redacted<string> | undefined
    expiration?: number
  }
>() {}

// From environment
export const fromEnv = Layer.effect(
  Credentials,
  Effect.gen(function* () {
    const accessKeyId = yield* Config.redacted("AWS_ACCESS_KEY_ID")
    const secretAccessKey = yield* Config.redacted("AWS_SECRET_ACCESS_KEY")
    const sessionToken = yield* Config.redacted("AWS_SESSION_TOKEN").pipe(
      Config.option
    )
    return Credentials.of({
      accessKeyId,
      secretAccessKey,
      sessionToken: Option.getOrUndefined(sessionToken),
    })
  })
)

// From SSO profile
export const fromSSO = (profile: string) =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      const ssoToken = yield* loadSSOToken(profile)
      const roleCredentials = yield* getRoleCredentials(ssoToken)
      return Credentials.of({
        accessKeyId: Redacted.make(roleCredentials.accessKeyId),
        secretAccessKey: Redacted.make(roleCredentials.secretAccessKey),
        sessionToken: Redacted.make(roleCredentials.sessionToken),
        expiration: roleCredentials.expiration,
      })
    })
  )
```

## Region Service

```typescript
export class Region extends Context.Tag("AWS::Region")<Region, string>() {}

export const fromEnv = Layer.effect(
  Region,
  Config.string("AWS_REGION").pipe(
    Config.orElse(() => Config.string("AWS_DEFAULT_REGION"))
  )
)

export const fromStageConfig = Layer.effect(
  Region,
  Effect.gen(function* () {
    const stageConfig = yield* StageConfig
    return stageConfig.region ?? (yield* Config.string("AWS_REGION"))
  })
)
```

## Provider Pattern

Resource lifecycle management:

```typescript
export interface Provider<R extends Resource> {
  readonly stables?: string[]  // Properties that don't trigger replace

  diff?: Effect.Effect<
    { action: "replace" } | undefined,
    never,
    { id: string; news: Props; olds: Props }
  >

  create: Effect.Effect<
    Attrs,
    ProviderError,
    { id: string; news: Props; session: Session }
  >

  update: Effect.Effect<
    Attrs,
    ProviderError,
    { id: string; news: Props; olds: Props; output: Attrs; session: Session }
  >

  delete: Effect.Effect<
    void,
    ProviderError,
    { output: Attrs; session: Session }
  >
}
```

## DynamoDB Table Provider

```typescript
export const tableProvider = (): Layer.Layer<
  Provider<AnyTable>,
  never,
  App | DynamoDBClient
> =>
  Table.provider.effect(
    Effect.gen(function* () {
      const dynamodb = yield* DynamoDBClient
      const app = yield* App

      return {
        stables: ["tableName", "tableArn"],

        diff: Effect.fn(function* ({ news, olds }) {
          // Check if keys changed (requires replace)
          if (
            news.partitionKey !== olds.partitionKey ||
            news.sortKey !== olds.sortKey
          ) {
            return { action: "replace" }
          }
        }),

        create: Effect.fn(function* ({ id, news, session }) {
          const tableName = news.tableName ?? (yield* createPhysicalName({ id, maxLength: 255 }))

          yield* dynamodb.createTable({
            TableName: tableName,
            KeySchema: toKeySchema(news),
            AttributeDefinitions: toAttributeDefinitions(news.attributes),
            BillingMode: news.billingMode ?? "PAY_PER_REQUEST",
            Tags: createTagsList(id, news.tags),
          })

          yield* session.note(`Table created: ${tableName}`)

          // Wait for table to be active
          yield* waitForTableActive(dynamodb, tableName)

          return {
            tableName,
            tableArn: `arn:aws:dynamodb:${region}:${accountId}:table/${tableName}`,
            partitionKey: news.partitionKey,
            sortKey: news.sortKey,
          }
        }),

        update: Effect.fn(function* ({ id, news, olds, output, session }) {
          // Update tags if changed
          if (!deepEqual(news.tags, olds.tags)) {
            yield* dynamodb.tagResource({
              ResourceArn: output.tableArn,
              Tags: createTagsList(id, news.tags),
            })
          }
          return output
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* dynamodb.deleteTable({ TableName: output.tableName })
          yield* session.note(`Table deleted: ${output.tableName}`)
        }),
      }
    }),
  )
```

## SQS Queue with Retry

```typescript
export const queueProvider = () =>
  Queue.provider.effect(
    Effect.gen(function* () {
      const sqs = yield* SQSClient

      return {
        create: Effect.fn(function* ({ id, news, session }) {
          const queueName = news.queueName ?? (yield* createPhysicalName({ id }))

          const response = yield* sqs
            .createQueue({
              QueueName: queueName,
              Attributes: createAttributes(news),
            })
            .pipe(
              Effect.retry({
                while: (e) => e.name === "QueueDeletedRecently",
                schedule: Schedule.fixed(1000).pipe(
                  Schedule.tapOutput((i) =>
                    session.note(`Queue was deleted recently, retrying... ${i + 1}s`)
                  ),
                ),
              }),
            )

          const queueUrl = response.QueueUrl!
          yield* session.note(queueUrl)

          const queueArn = yield* sqs.getQueueAttributes({
            QueueUrl: queueUrl,
            AttributeNames: ["QueueArn"],
          }).pipe(Effect.map((r) => r.Attributes!.QueueArn!))

          return { queueName, queueUrl, queueArn }
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* sqs.deleteQueue({ QueueUrl: output.queueUrl })
        }),
      }
    }),
  )
```

## Resource Type Definition

```typescript
export interface TableProps<
  Items extends any = any,
  PartitionKey extends keyof Items = keyof Items,
  SortKey extends keyof Items | undefined = undefined,
> {
  items: type<Items>
  attributes: AttributesSchema<Items, PartitionKey, SortKey>
  partitionKey: PartitionKey
  sortKey?: SortKey
  tableName?: string
  billingMode?: "PAY_PER_REQUEST" | "PROVISIONED"
  tags?: Record<string, string>
}

export interface TableAttrs<Props extends TableProps> {
  tableName: Props["tableName"] extends string ? Props["tableName"] : string
  tableArn: `arn:aws:dynamodb:${string}:${string}:table/${this["tableName"]}`
  partitionKey: Props["partitionKey"]
  sortKey: Props["sortKey"]
}

export const Table = Resource<{
  <const ID extends string, const Props extends TableProps>(
    id: ID,
    props: Props,
  ): Table<ID, Props>
}>("AWS.DynamoDB.Table")
```

## Lambda Function with Bindings

```typescript
export interface FunctionProps<Req = unknown> extends RuntimeProps<Function, Req> {
  functionName?: string
  main: string
  handler?: string
  memory?: number
  runtime?: "nodejs20.x" | "nodejs22.x"
  architecture?: "x86_64" | "arm64"
  url?: boolean
}

// Usage with capability bindings
export class Api extends Lambda.serve("Api", {
  fetch: Effect.fn(function* (request) {
    const item = yield* DynamoDB.getItem({
      table: SingleTable,
      key: { id, name: "world" },
    })
    return { body: JSON.stringify(item) }
  }),
})({
  main: import.meta.filename,
  bindings: $(
    DynamoDB.GetItem(SingleTable, {
      leadingKeys: $.anyOf("USER#123"),
      attributes: $.anyOf("id", "name", "age"),
    }),
  ),
}) {}

export default Api.handler.pipe(
  Effect.provide(Layer.mergeAll(SQS.clientFromEnv(), DynamoDB.clientFromEnv())),
  Lambda.toHandler,
)
```

## Binding Pattern

Capability-based IAM bindings:

```typescript
export interface Binding<
  Run extends IRuntime<any, any, any>,
  Cap extends Capability = Capability,
> {
  runtime: Run
  capability: Cap
  tag: string
  props: Props
}

export const Binding = (runtime: any, cap: string, tag?: string) => {
  const Tag = Context.Tag(`${runtime.type}(${cap}, ${tag ?? cap})`)()

  return Object.assign(
    (resource: any, props?: any) => ({
      runtime,
      capability: {
        type: cap,
        resource,
        sid: `${cap}${resource.id}`.replace(/[^a-zA-Z0-9]/g, ""),
        label: `${cap}(${resource.id})`,
      },
      props,
      isCustom: false,
      tag: tag ?? cap,
      Tag,
    }),
    {
      provider: {
        effect: (eff) => Layer.effect(Tag, eff),
        succeed: (service) => Layer.succeed(Tag, service),
      },
    },
  )
}
```

## Error Types

```typescript
export class AccessDeniedException extends S.TaggedError<AccessDeniedException>()(
  "AccessDeniedException",
  {},
).pipe(withCategory(ERROR_CATEGORIES.AWS_ERROR)) {}

export class UnknownAwsError extends S.TaggedError<UnknownAwsError>()(
  "UnknownAwsError",
  {
    errorTag: S.String,
    errorData: S.Any,
  },
).pipe(withCategory(ERROR_CATEGORIES.AWS_ERROR)) {}

export class ProfileNotFound extends Data.TaggedError("Alchemy::AWS::ProfileNotFound")<{
  message: string
  profile: string
}> {}

export class ExpiredSSOToken extends Data.TaggedError("Alchemy::AWS::ExpiredSSOToken")<{
  message: string
  profile: string
}> {}
```

## Layer Composition

```typescript
export const resources = () =>
  Layer.mergeAll(
    DynamoDB.tableProvider(),
    Lambda.functionProvider(),
    SQS.queueProvider(),
    EC2.vpcProvider(),
  )

export const bindings = () =>
  Layer.mergeAll(
    DynamoDB.getItemFromLambdaFunction(),
    SQS.queueEventSourceProvider(),
    SQS.sendMessageFromLambdaFunction(),
  )

export const clients = () =>
  Layer.mergeAll(
    DynamoDB.client(),
    Lambda.client(),
    SQS.client(),
  )

export const providers = () =>
  resources().pipe(
    Layer.provideMerge(bindings()),
    Layer.provideMerge(clients()),
    Layer.provideMerge(Region.fromStageConfig()),
    Layer.provideMerge(Credentials.fromStageConfig()),
  )
```

## Plan & Apply

```typescript
export type CRUD<R extends Resource> =
  | Create<R>
  | Update<R>
  | Delete<R>
  | Replace<R>
  | NoopUpdate<R>

export const applyPlan = <P extends IPlan>(plan: P) =>
  Effect.gen(function* () {
    const cli = yield* CLI
    const session = yield* cli.startApplySession(plan)

    // 1. Expand graph (create new, update existing, create replacements)
    const resources = yield* expandAndPivot(plan, session)

    // 2. Delete orphans and replaced resources
    yield* collectGarbage(plan, session)

    yield* session.done()
    return resources
  })
```

## State Management

```typescript
export type ResourceStatus =
  | "creating"
  | "created"
  | "updating"
  | "updated"
  | "deleting"
  | "deleted"
  | "replacing"
  | "replaced"

interface BaseResourceState {
  resourceType: string
  logicalId: string
  instanceId: string
  status: ResourceStatus
  downstream: string[]
  props?: Props
  attr?: Attr
}

export interface CreatingResourceState extends BaseResourceState {
  status: "creating"
  props: Props
}

export interface CreatedResourceState extends BaseResourceState {
  status: "created"
  props: Props
  attr: Attr
}
```

## Testing Pattern

```typescript
test(
  "create, update, delete table",
  Effect.gen(function* () {
    const dynamodb = yield* DynamoDB.DynamoDBClient

    class Table extends DynamoDB.Table("Table", {
      tableName: "test",
      items: type<{ id: string }>,
      attributes: { id: S.String },
      partitionKey: "id",
    }) {}

    const stack = yield* apply(Table)

    const actualTable = yield* dynamodb.describeTable({
      TableName: stack.Table.tableName,
    })
    expect(actualTable.Table?.TableArn).toEqual(stack.Table.tableArn)

    yield* destroy()

    yield* assertTableIsDeleted(stack.Table.tableName)
  }).pipe(Effect.provide(AWS.providers())),
)

const assertTableIsDeleted = Effect.fn(function* (tableName: string) {
  const dynamodb = yield* DynamoDB.DynamoDBClient
  yield* dynamodb
    .describeTable({ TableName: tableName })
    .pipe(
      Effect.flatMap(() => Effect.fail(new TableStillExists())),
      Effect.retry({
        while: (e) => e._tag === "TableStillExists",
        schedule: Schedule.exponential(100),
      }),
      Effect.catchTag("ResourceNotFoundException", () => Effect.void),
    )
})
```
