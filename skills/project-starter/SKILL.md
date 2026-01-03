---
name: project-starter
description: Invoke when asked to create a completely new project, NOT a feature. This is used to set up a full E2E app using opinionated defaults.
---

Understand the full-scope of the spec, and interview the user to draft a complete spec.

# Project Startup Guide

Reference for bootstrapping a Better-T-Stack project with Cloudflare Workers, Drizzle, and TanStack Start.

## Phase 1: Scaffold Project

```bash
bun create better-t-stack@latest <project-name> \
  --frontend tanstack-start \
  --backend hono \
  --runtime workers \
  --database sqlite \
  --orm drizzle \
  --api orpc \
  --auth better-auth \
  --payments none \
  --addons none \
  --examples none \
  --db-setup d1 \
  --web-deploy cloudflare \
  --server-deploy cloudflare \
  --git \
  --package-manager bun \
  --install
```

Do NOT select ultracite during scaffolding—set it up manually in Phase 5.

## Phase 2: TypeScript Setup

1. Remove `bts.jsonc`:

   ```bash
   rm bts.jsonc
   ```

2. Add tsgo as dev dependency and catalog version:

   ```bash
   bun add -D @typescript/native-preview
   ```

3. Add `check-types` script to every `package.json`:

   ```json
   "check-types": "tsgo --noEmit"
   ```

4. Update `.vscode/settings.json`:

   ```json
   {
     "typescript.tsdk": "node_modules/typescript/lib",
     "typescript.enablePromptUseWorkspaceTsdk": true,
     "typescript.experimental.useTsgo": true
   }
   ```

5. Fix workers types in `packages/config/tsconfig.base.json`:
   - Change `@cloudflare/workers-types` → `@cloudflare/workers-types/experimental`

6. Generate initial database schema:

   ```bash
   bun db:generate
   ```

7. Run dev to generate route tree:

   ```bash
   bun dev
   ```

   Note: Port 3000 must be free to avoid CORS issues.

8. Verify types pass:
   ```bash
   bun check-types
   ```

## Phase 3: ShadCN Setup

1. Remove existing config and reinitialize with preset:

   ```bash
   cd apps/web
   rm components.json
   bunx --bun shadcn@latest init --preset "https://ui.shadcn.com/init?base=base&style=maia&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=figtree&menuAccent=subtle&menuColor=default&radius=default&template=start"
   ```

   **Alternative (manual setup):** Create `apps/web/components.json`:

   ```json
   {
     "$schema": "https://ui.shadcn.com/schema.json",
     "style": "base-maia",
     "rsc": false,
     "tsx": true,
     "tailwind": {
       "config": "",
       "css": "src/index.css",
       "baseColor": "neutral",
       "cssVariables": true,
       "prefix": ""
     },
     "iconLibrary": "hugeicons",
     "aliases": {
       "components": "@/components",
       "utils": "@/lib/utils",
       "ui": "@/components/ui",
       "lib": "@/lib",
       "hooks": "@/hooks"
     },
     "menuColor": "default",
     "menuAccent": "subtle",
     "registries": {}
   }
   ```

   Then add font/icon dependencies to `apps/web/package.json`:

   ```json
   "@fontsource-variable/figtree": "^5.2.10",
   "@hugeicons/core-free-icons": "^3.1.1",
   "@hugeicons/react": "^1.1.4"
   ```

   And update `apps/web/src/index.css`:

   ```css
   @import "@fontsource-variable/figtree";
   /* In :root */
   --font-sans: 'Figtree Variable', sans-serif;
   ```

2. Add all ShadCN components:

   ```bash
   bunx --bun shadcn@latest add --all
   ```

3. Fix type errors from v3→v4 API changes (primarily `use-mobile` and `resizable`):
   - Check component signatures and update to match v4 API
   - Run `bun check-types` until clean

## Phase 4: Storybook Setup

1. Initialize Storybook (minimal preset):

   ```bash
   bun create storybook@latest
   ```

2. Delete default stories folder—colocate stories with components instead.

3. Add to root `package.json`:

   ```json
   "storybook": "bun run --filter web storybook"
   ```

4. Install theme addon:

   ```bash
   bun add -D @storybook/addon-themes --filter web
   ```

5. Configure `.storybook/preview.ts`:

   ```typescript
   import type { Preview } from "@storybook/react-vite";
   import { withThemeByClassName } from "@storybook/addon-themes";
   import "../src/index.css";

   const preview: Preview = {
     decorators: [
       withThemeByClassName({
         themes: { light: "", dark: "dark" },
         defaultTheme: "light",
         parentSelector: "html",
       }),
     ],
     parameters: {
       controls: {
         matchers: {
           color: /(background|color)$/i,
           date: /Date$/i,
         },
       },
     },
   };

   export default preview;
   ```

6. Sync ShadCN documentation for reference:

   ```bash
   # From knowledge-base repo
   ./scripts/sync-shadcn-docs.sh
   ```

   This populates `docs/plans/ui/` with component documentation.

7. Create stories for all UI components. Agent instructions:
   - Create Storybook story files for all UI components in `apps/web/src/components/ui/`
   - Review documentation in `docs/plans/ui/` for component demos
   - Check actual component props (docs are Radix-based but components may use `@base-ui/react`)
   - Use CSF3 format with `satisfies Meta<typeof Component>` and `satisfies StoryObj<typeof meta>`
   - Note: base-ui uses `render` prop instead of Radix's `asChild`
   - Use project's icon library (hugeicons)
   - Run `bun check-types` until all type errors are resolved

8. Create example vitest unit test using `composeStories` (Button is a good candidate).

## Phase 5: Linting Setup

1. Initialize ultracite:

   ```bash
   bunx ultracite@latest init
   ```

   Select: oxlint + oxfmt

2. Add tsgolint:

   ```bash
   bun add -D oxlint-tsgolint@latest
   ```

3. Add scripts to root `package.json`:

   ```json
   "check": "bun ultracite check --type-aware",
   "fix": "bun ultracite fix --type-aware"
   ```

4. Configure `oxlintrc.json`:

   ```json
   {
     "$schema": "./node_modules/oxlint/configuration_schema.json",
     "extends": [
       "ultracite/oxlint/core",
       "ultracite/oxlint/react",
       "ultracite/oxlint/remix"
     ],
     "rules": {
       "typescript/unbound-method": "off"
     }
   }
   ```

5. Update `lefthook.yml` to run `bun fix`.

6. Run fix and resolve remaining issues:
   ```bash
   bun fix
   ```
   Common fixes: floating promises (add `void`), restrict-template-expressions.

Note: oxfmt respects `.prettierignore`.

## Phase 6: CI Setup

Create `.github/workflows/quality.yml`:

```yaml
name: Code Quality

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint
        run: bun run check

      - name: Type check
        run: bun run check-types

      - name: Unit tests
        run: bun run test:unit
```

Add a placeholder test so CI passes initially. Prefer vitest for tests.

## Phase 7: Deployment Setup

### Alchemy Configuration

```bash
bun alchemy configure
bun alchemy login
bun alchemy deploy
```

Default deployment uses `$USER` stage (personal).

### Stage Strategy

| Stage         | Trigger                          | Use Case             |
| ------------- | -------------------------------- | -------------------- |
| `$USER`       | `alchemy deploy` / `alchemy dev` | Personal development |
| `pr-{number}` | PR deploy action                 | Pull request preview |
| `prod`        | Main branch deploy               | Production           |

### Environment Variables

Generate secrets: `openssl rand -base64 32`

| Variable             | Location           | Description       |
| -------------------- | ------------------ | ----------------- |
| `ALCHEMY_SECRET`     | `infra/.env`       | Alchemy auth      |
| `VITE_SERVER_URL`    | `apps/web/.env`    | Server API URL    |
| `CORS_ORIGIN`        | `apps/server/.env` | Allowed origin    |
| `BETTER_AUTH_URL`    | `apps/server/.env` | Auth callback URL |
| `BETTER_AUTH_SECRET` | `apps/server/.env` | Auth secret       |

### Local vs Deployed Env Strategy

Use `.env` for deployed stages, `.env.dev` for local development:

```bash
IS_DEV=true alchemy dev
```

Configure env loading in infra:

```typescript
const envSuffix = process.env.IS_DEV === "true" ? ".dev" : "";

config({ path: `./.env${envSuffix}` });
config({ path: `../../apps/web/.env${envSuffix}` });
config({ path: `../../apps/server/.env${envSuffix}` });
```

After deploying, update `VITE_SERVER_URL` to match your worker URL.

## Phase 8: Init Agents

1. Run `init-project.sh` from knowledge-base.

2. Initialize CLAUDE.md with Opus 4.5:

   ```bash
   /init CLAUDE.md
   ```

3. Move content to `AGENTS.md` and symlink:
   ```bash
   ln -sf AGENTS.md CLAUDE.md
   ```

## Phase 9: CI/CD Deployment

### 1. Generate Required Tokens

```bash
# Generate ALCHEMY_PASSWORD (state encryption)
openssl rand -base64 32

# Generate ALCHEMY_STATE_TOKEN (must be same across all deployments)
openssl rand -base64 32

# Generate CLOUDFLARE_API_TOKEN (use Alchemy CLI for correct permissions)
bunx alchemy util create-cloudflare-token
```

### 2. Configure GitHub Secrets

Go to repository Settings → Secrets and variables → Actions, add:

| Secret                 | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `ALCHEMY_PASSWORD`     | Encryption password for state                         |
| `ALCHEMY_STATE_TOKEN`  | Token for Cloudflare state store (same for all)       |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers/D1 permissions      |
| `BETTER_AUTH_SECRET`   | Auth secret (generate with `openssl rand -base64 32`) |

Also add repository variable (Settings → Variables → Actions):

| Variable       | Description                                          |
| -------------- | ---------------------------------------------------- |
| `CF_SUBDOMAIN` | Your Cloudflare account subdomain (e.g., `username`) |

Note: `GITHUB_TOKEN` is automatically provided by GitHub Actions. URL-based env vars (`VITE_SERVER_URL`, `CORS_ORIGIN`, `BETTER_AUTH_URL`) are generated dynamically in the workflow based on stage and `CF_SUBDOMAIN`.

### 3. Update alchemy.run.ts for CI

Add CloudflareStateStore and GitHubComment for PR previews:

```typescript
import alchemy from "alchemy";
import { D1Database, TanStackStart, Worker } from "alchemy/cloudflare";
import { GitHubComment } from "alchemy/github";
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("my-app", {
  stateStore: (scope) => new CloudflareStateStore(scope),
});

// ... your resources (db, web, server) ...

// Add PR preview comment
if (process.env.PULL_REQUEST) {
  await GitHubComment("preview-comment", {
    owner: "your-username",
    repository: "your-repo",
    issueNumber: Number(process.env.PULL_REQUEST),
    body: `## Preview Deployed

Your changes have been deployed to a preview environment:

| Service | URL |
|---------|-----|
| Web | ${web.url} |
| Server | ${server.url} |

Built from commit ${process.env.GITHUB_SHA?.slice(0, 7)}

---
<sub>This comment updates automatically with each push.</sub>`,
  });
}

await app.finalize();
```

### 4. Create Deploy Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Application

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, reopened, synchronize, closed]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

env:
  STAGE: ${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || (github.ref == 'refs/heads/main' && 'prod' || github.ref_name) }}

jobs:
  deploy:
    if: ${{ github.event.action != 'closed' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Deploy
        run: bun run deploy --stage ${{ env.STAGE }}
        env:
          ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD }}
          ALCHEMY_STATE_TOKEN: ${{ secrets.ALCHEMY_STATE_TOKEN }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          VITE_SERVER_URL: https://todo-server-${{ env.STAGE }}.${{ vars.CF_SUBDOMAIN }}.workers.dev
          CORS_ORIGIN: https://todo-web-${{ env.STAGE }}.${{ vars.CF_SUBDOMAIN }}.workers.dev
          BETTER_AUTH_URL: https://todo-server-${{ env.STAGE }}.${{ vars.CF_SUBDOMAIN }}.workers.dev
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
          PULL_REQUEST: ${{ github.event.number }}
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  cleanup:
    runs-on: ubuntu-latest
    if: ${{ github.event_name == 'pull_request' && github.event.action == 'closed' }}
    permissions:
      id-token: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Safety Check
        run: |
          if [ "${{ env.STAGE }}" = "prod" ]; then
            echo "ERROR: Cannot destroy prod environment in cleanup job"
            exit 1
          fi

      - name: Destroy Preview Environment
        run: bun run destroy --stage ${{ env.STAGE }}
        env:
          ALCHEMY_PASSWORD: ${{ secrets.ALCHEMY_PASSWORD }}
          ALCHEMY_STATE_TOKEN: ${{ secrets.ALCHEMY_STATE_TOKEN }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          PULL_REQUEST: ${{ github.event.number }}
```

### CI/CD Behavior

| Trigger           | Stage         | Action                             |
| ----------------- | ------------- | ---------------------------------- |
| Push to `main`    | `prod`        | Deploy production                  |
| PR opened/updated | `pr-{number}` | Deploy preview + add comment to PR |
| PR closed/merged  | `pr-{number}` | Destroy preview environment        |

## Phase 10: E2E Testing

E2E tests provide **verifiable feedback loops for agents**—critical for autonomous development. Tests run against deployed preview URLs after each deployment.

### Structure

```
tests/
└── e2e/
    ├── package.json          # @todo/e2e workspace with @playwright/test
    ├── playwright.config.ts
    ├── pom/
    │   ├── index.ts
    │   ├── base.page.ts      # Abstract base with goto()
    │   └── home.page.ts      # Page-specific locators as getters
    └── home.spec.ts
```

Add `tests/*` to root workspaces and `"test:e2e": "bun run --filter @todo/e2e test"` script.

### Key Patterns

**1. Playwright config with dynamic BASE_URL:**

```typescript
const baseURL = process.env.BASE_URL || 'http://localhost:3001'
const isLocalhost = baseURL.includes('localhost')

export default defineConfig({
  use: { baseURL },
  // Only start dev server for localhost
  ...(isLocalhost && {
    webServer: { command: 'bun run --cwd ../.. dev', url: baseURL },
  }),
})
```

**2. POM with getters (not constructor instantiation):**

```typescript
export class HomePage extends BasePage {
  async goto() { await this.page.goto('/') }

  // Locators as getters - lazily evaluated
  get signInButton() {
    return this.page.getByRole('button', { name: 'Sign In' })
  }

  get connectedStatus() {
    return this.page.getByText('Connected')
  }

  // Actions
  async waitForApiStatus() {
    await this.connectedStatus.or(this.disconnectedStatus).waitFor({ timeout: 15000 })
  }
}
```

**3. Tests use POM:**

```typescript
test.beforeEach(async ({ page }) => {
  homePage = new HomePage(page)
  await homePage.goto()
})

test('should show connected status', async () => {
  await homePage.waitForApiStatus()
  await expect(homePage.connectedStatus).toBeVisible()
})
```

### CI Integration

**1. Deploy workflow emits `deployment_status`:**

Add `deployments: write` permission, then use `chrnorm/deployment-action@v2` before deploy and `chrnorm/deployment-status@v2` after to create GitHub deployment records.

**2. E2E workflow triggers on deployment success:**

```yaml
on:
  deployment_status:

jobs:
  e2e:
    if: github.event.deployment_status.state == 'success'
    steps:
      # ... setup ...
      - name: Run E2E tests
        run: bun run test:e2e
        env:
          BASE_URL: ${{ github.event.deployment_status.environment_url }}
```

### Why This Matters for Agents

1. Agent makes changes → PR deployed to preview URL
2. `deployment_status` triggers E2E workflow
3. Tests run against actual deployed app
4. Failures provide actionable feedback for iteration

Agents can't visually inspect UIs, but can run tests against deployed URLs to verify changes work.

## Verification Checklist

- [ ] `bun check-types` passes
- [ ] `bun check` passes
- [ ] `bun dev` runs without errors
- [ ] `bun storybook` launches
- [ ] CI workflow passes
- [ ] `bun run deploy` succeeds locally
- [ ] GitHub secrets configured
- [ ] PR preview deployment works
- [ ] Main branch deploys to prod
- [ ] `bun run test:e2e` passes locally
- [ ] E2E tests run after deployment in CI
