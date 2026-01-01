# Tech Stack

## Starter Template

[Better T Stack](https://www.better-t-stack.dev) - `bun create better-t-stack@latest`

## Frontend

- **Framework:** TanStack Start
- **State:** TanStack Query (default), Effect atoms (complex derived/reactive)
- **Forms:** React Hook Form
- **UI:** Shadcn Create (BaseUI) - [ui.shadcn.com/create?base=base](https://ui.shadcn.com/create?base=base)
- **Logic:** Effect-TS (idiomatic, functional patterns)
- **Validation:** Effect Schema
- **Dates:** date-fns
- **Icons:** Hugeicons
- **Animations:** Framer Motion + Tailwind CSS
- **i18n:** Paraglide
- **Component Dev:** Storybook

## Backend

- **API:** Hono
- **API Types:** tRPC
- **Logic:** Effect-TS
- **Auth:** Better Auth
- **Realtime:** Durable Objects (or SSE for simpler cases)

## Data

- **Database:** Cloudflare D1 (default), Postgres via Supabase (alternative)
- **ORM:** Drizzle
- **Object Storage:** Cloudflare R2
- **Caching:** Cloudflare KV, Workers Cache API

## Tooling

- **Package Manager:** Bun (default), pnpm (alternative)
- **Monorepo:** Bun workspaces (no Turborepo)
- **Linting:** Biome (via Ultracite)
- **Git Hooks:** Lefthook
- **CI/CD:** GitHub Actions

## Infrastructure

- **Compute:** Cloudflare Workers
- **Deployment:** Alchemy
- **Workflows:** Cloudflare Workflows / Effect-TS Workflows
- **Email:** Resend (or Cloudflare Email)

## Payments

- **Billing:** Polar

## Observability

- **Analytics:** PostHog
- **Feature Flags:** PostHog
- **Error Tracking:** Sentry
- **Tracing:** OpenTelemetry

## Testing

- **Unit/Integration:** Vitest, @effect/vitest
- **E2E:** Playwright
