List of steps completed for a sample project:

```
bun create better-t-stack@latest todo --frontend tanstack-start --backend hono --runtime workers --database sqlite --orm drizzle --api orpc --auth better-auth --payments none --addons none --examples none --db-setup d1 --web-deploy cloudflare --server-deploy cloudflare --git --package-manager bun --install
```

Don't select ultracite with this, just set it up manually.

Delete `bts.jsonc`: `rm bts.jsonc`

Add tsgo to workspace: `bun add -D @typescript/native-preview` and set it as a catalog version

Add `check-types: tsgo --noEmit` commands to every `package.json`

Update `.vscode/settings.json` to

```
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.experimental.useTsgo": true,
}
```

Run `db:generate` to generate innitial schema

Now you can run `bun dev` without issues. NOTE: Make sure nothing else is running on port 3000 otherwise your server may run into CORS issues.

Running dev then generates `routeTree.gen`

Change `@cloudflare/workers-types` → `@cloudflare/workers-types/experimental` (packages/config/tsconfig.base.json)

Verify that `bun check-types` passes in the root.

Get ready for deployment:

`bun alchemy configure`
`bun alchemy login`

Deploy with:
`bun alchemy deploy`

Although keep in note that this deploys it to a $USER (personal) stage

Recommended Setup
A typical setup for a team is to have a single app with multiple stages:

Personal Stage - each developer runs alchemy deploy or alchemy dev and uses the default $USER stage
Pull Request Stage - each Pull Request deploys its own stage, pr-${pull-request-number}
Production Stage - deploy the main branch is deployed to the prod stage

Populate the following .envs:
`ALCHEMY_SECRET`\
`CORS_ORIGIN` should match your web url
`VITE_SERVER_URL` should match your server url
`BETTER_AUTH_URL` shoudl match your server url
`BETTER_AUTH_SECRET` if using better auth

For secrets, can simply use `openssl rand -base64 32`

You can populate them with your own secrets for personal development, by modifying `.env` in the respective places:

- `infra/.env` for `ALCHEMY_SECRET`
- `web/.env` for `VITE_SERVER_URL`
- `server/.env` for `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`

Sample setup could be:
Use `.env` for your personal stage deployments. And then use `.env.dev` for local dev.

`IS_DEV=true alchemy dev`

```
const envSuffix = process.env.IS_DEV === "true" ? ".dev" : "";

config({ path: `./.env${envSuffix}` });
config({ path: `../../apps/web/.env${envSuffix}` });
config({ path: `../../apps/server/.env${envSuffix}` });
```

After deploying your app, replace the relevant env variables with your worker

ex. `VITE_SERVER_URL=https://todo-server-robertsun.sunwrobert.workers.dev`

Set up ShadCN styling:

Better T Stack already sets up ShadCN but we can set it up with the preset we want.

`cd apps/web && rm apps/web/components.json && bunx --bun shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=maia&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=figtree&menuAccent=subtle&menuColor=default&radius=default&template=start" --template start`

Alternatively manually set `components.json` to:

```
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

and add these dependencies:

```
"@fontsource-variable/figtree": "^5.2.10",
"@hugeicons/core-free-icons": "^3.1.1",
"@hugeicons/react": "^1.1.4",
```

`index.css` changes

```
@import "@fontsource-variable/figtree";
--font-sans: 'Figtree Variable', sans-serif;
```

Add all of the shadcn components for discoverability/convenience:

`bunx --bun shadcn@latest add --all`

There will be some type errors on missing `use-mobile` and `resizable` mainly (v3 to v4 API changes)

use AI to fix.

Install ultracite for linting.

`bunx ultracite@latest init`

Select oxlint + oxfmt.

Also add tsgolint `bun add -D oxlint-tsgolint@latest`

Change `lefthook.yml` to just run `bun fix`

Add these scripts to package.json

```
"check": "bun ultracite check --type-aware",
"fix": "bun ultracite fix --type-aware",
```

Now run `bun fix`

Example `oxlintrc.json`

```
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

And then ask AI to fix the rest (no floating promises thru use of void, restrict-template-expressions)

Set up code quality CI:

```
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
