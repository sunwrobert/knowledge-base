---
name: project-starter
description: Invoke when asked to create a completely new project, NOT a feature. This is used to set up a full E2E app using opinionated defaults.
---

Understand the full-scope of the spec, and interview the user to draft a complete spec.

### Better T Stack

Recommend a config for solving this with https://www.better-t-stack.dev

List of options:

Web Frontend

- TanStack Router (selected) - Modern type-safe router for React
- React Router - Declarative routing for React
- TanStack Start - Full-stack React and Solid framework powered by TanStack Router
- Next.js - React framework with hybrid rendering
- Nuxt - Vue full-stack framework (SSR, SSG, hybrid)
- Svelte - Cybernetically enhanced web apps
- Solid - Simple and performant reactivity for building UIs
- No Web Frontend - No web-based frontend

Native Frontend

- Expo + Bare (default) - Expo with StyleSheet (no styling library)
- Expo + Uniwind - Fastest Tailwind bindings for React Native with HeroUI Native
- Expo + Unistyles - Expo with Unistyles (type-safe styling)
- No Native Frontend (selected) - No native mobile frontend

Backend

- Hono (selected) - Ultrafast web framework
- Elysia - TypeScript web framework
- Express - Popular Node.js framework
- Fastify - Fast, low-overhead web framework for Node.js
- Convex - Reactive backend-as-a-service
- Fullstack Next.js (unavailable) - Use Next.js built-in API routes
- Fullstack TanStack Start (unavailable) - Use TanStack Start's built-in API routes
- No Backend - Skip backend integration (frontend only)

Runtime

- Bun (selected) - Fast JavaScript runtime & toolkit
- Node.js - JavaScript runtime environment
- Cloudflare Workers - Serverless runtime for the edge
- No Runtime (unavailable) - No specific runtime

Api

- tRPC (selected) - End-to-end typesafe APIs
- oRPC - Typesafe APIs Made Simple
- No API - No API layer (API routes disabled)

Database

- SQLite (selected) - File-based SQL database
- PostgreSQL - Advanced SQL database
- MySQL - Popular relational database
- MongoDB - NoSQL document database
- No Database - Skip database integration

Orm

- Drizzle (selected) - TypeScript ORM
- Prisma - Next-gen ORM
- Mongoose (unavailable) - Elegant object modeling tool
- No ORM (unavailable) - Skip ORM integration

Db Setup

- Turso - Distributed SQLite with edge replicas (libSQL)
- Cloudflare D1 (unavailable) - Serverless SQLite-compatible database for Cloudflare Workers
- Neon Postgres (unavailable) - Serverless Postgres with autoscaling and branching
- Prisma PostgreSQL (unavailable) - Managed Postgres via Prisma Data Platform
- MongoDB Atlas (unavailable) - Managed MongoDB clusters in the cloud
- Supabase (unavailable) - Local Postgres stack via Supabase (Docker required)
- PlanetScale (unavailable) - Postgres & Vitess (MySQL) on NVMe
- Docker (unavailable) - Run Postgres/MySQL/MongoDB locally via Docker Compose
- Basic Setup (selected) - No cloud DB integration

Web Deploy

- Cloudflare - Deploy to Cloudflare Workers using Alchemy
- None (selected) - Skip deployment setup

Server Deploy

- Cloudflare (unavailable) - Deploy to Cloudflare Workers using Alchemy
- None (selected) - Skip deployment setup

Auth

- Better-Auth (selected) - The most comprehensive authentication framework for TypeScript
- Clerk (unavailable) - More than authentication, Complete User Management
- No Auth - Skip authentication

Payments

- Polar - Turn your software into a business. 6 lines of code.
- No Payments (selected) - Skip payments integration

Package Manager

- npm - Default package manager
- pnpm - Fast, disk space efficient
- bun (selected) - All-in-one toolkit

Addons

- PWA (Progressive Web App) - Make your app installable and work offline
- Tauri - Build native desktop apps
- Starlight - Build stellar docs with astro
- Biome - Format, lint, and more
- Husky - Modern native Git hooks made easy
- Ultracite - Biome preset with AI integration
- Fumadocs - Build excellent documentation site
- Oxlint - Oxlint + Oxfmt (linting & formatting)
- Ruler - Centralize your AI rules
- OpenTUI - Build terminal user interfaces
- WXT - Build browser extensions
- Turborepo (selected) - High-performance build system

Examples

- Todo Example - Simple todo application
- AI Example - AI integration example using AI SDK

Git

- Git (selected) - Initialize Git repository
- No Git - Skip Git initialization

Install

- Install Dependencies (selected) - Install packages automatically
- Skip Install - Skip dependency installation

Prefer the following options unless there's a good reason not to:

`bun create better-t-stack@latest my-better-t-app --frontend tanstack-start --backend hono --runtime workers --api trpc --auth better-auth --payments none --database sqlite --orm drizzle --db-setup d1 --package-manager bun --git --web-deploy cloudflare --server-deploy cloudflare --install --addons ultracite --examples none`

Obviously, don't use certain options if they are not applicable to the spec. (e.g. selecting D1 when we have no need for a db)

## Add Effect TS

Add Effect TS to both backend and frontend services.

https://www.effect.solutions/quick-start

Copy the agent instructions and paste them into your agent.

Your agent will guide you through setting up your repository with Effect best practices.

- Setting up the Effect Language Service
- Installing our effect-solutions cli
- Refining your TypeScript configuration
- Cloning the Effect repository to use as reference

## Setup ShadCN UI

If following Better T Stack scaffolding:

`rm -rf apps/web/components.json apps/web/src/components/ui`

```
cd apps/web && bunx --bun shadcn@latest create --preset "https://ui.shadcn.com/init?base=base&style=maia&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=figtree&menuAccent=subtle&menuColor=default&radius=default&template=start" --template start
```

Add all ShadCN components

`bunx shadcn@latest add -a -o`

## Install Storybook

Set up Storybook through their wizard

`bunx create storybook@latest`
