# Architecture

## Project Overview

StudioWorks is a TypeScript-first monorepo for generating cinematic AI video through a structured, studio-style pipeline. It follows a strict separation between three runtime services and two shared packages.

## Monorepo Structure

```
studioworks-platform/
  apps/
    web/                  # Next.js frontend
      src/app/
        render/           # Render job tracker
          page.tsx        # Job list / dashboard
          [id]/page.tsx   # Job detail — status, progress, output assets
        studio/           # Creative marketing studio
          page.tsx
          clients/
          scripts/        # Commercial screenplays
          storyboards/
          prompts/        # Prompt builder, template library, render submission
    api/                  # Fastify backend
    worker/               # BullMQ async job processor
  packages/
    shared/               # RenderSpec Zod schema, queue names, shared types
      src/
        studio/           # Future studio-specific types (PromptTemplate, Script, etc.)
    db/                   # Prisma schema and database client
  docker/
    compose.dev.yml
  infra/
  docs/
```

**Package manager:** pnpm (`pnpm-workspace.yaml`)
**Build system:** Turborepo (`turbo.json`)
**Language:** TypeScript throughout — strict mode, no `any`

## Services

### `apps/web`
- Next.js frontend — App Router (`app/`)
- Responsible for project/scene/shot configuration UI
- Constructs and validates a `RenderSpec` before submission
- Communicates with `apps/api` only — never directly with the worker or database
- Styling: Tailwind CSS + shadcn/ui
- Auth: NextAuth / Auth.js (`import { auth } from "@/lib/auth"`)

### `apps/api`
- Node.js + **Fastify** (not Next.js API routes) — listens on port 4000
- Validates incoming `RenderSpec`, persists an **immutable** `RenderJob`, enqueues only the `renderJobId`
- Does not execute rendering logic

### `apps/worker`
- Node.js + BullMQ
- Receives **only** a `renderJobId` — loads the `RenderSpec` from Postgres via `@studioworks/db`
- Updates job lifecycle: `QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED`
- Writes output assets to S3
- Intentionally replaceable — a future Python/GPU service must be able to consume the same queue and DB without touching `apps/api` or `apps/web`

## Shared Packages

### `@studioworks/shared`
- **Source of truth for all cross-service contracts**
- Contains the `RenderSpec` Zod schema — always validate against this, never duplicate it
- Exports queue names and shared TypeScript types
- Any change here has downstream effects on all three services — treat modifications carefully
- After changes: `pnpm build --filter @studioworks/shared` to propagate types

### `@studioworks/db`
- Prisma schema and generated client
- All database access must go through this package — never import `@prisma/client` directly in `apps/`
- After schema changes: `pnpm --filter @studioworks/db db:generate`
- To apply migrations: `pnpm --filter @studioworks/db db:migrate`

## Data Flow

```
web: user configures scene/shot → builds RenderSpec
  → api: validates RenderSpec (Zod) → persists RenderJob (immutable) → enqueues renderJobId
    → worker: dequeues renderJobId → loads spec from DB → executes provider adapter
      → updates job state → writes output assets to S3
```

**Critical immutability constraint:** The `RenderJob` record and its embedded `RenderSpec` are immutable once written. Never update or patch a persisted spec — create a new `RenderJob` instead. This is a hard architectural rule, not a preference.
