# CLAUDE.md — StudioWorks Platform

> This file is the shared brain for all agents — main and clones alike.
> Clones spawn with no memory. Everything needed to operate must be derivable from this file plus the files explicitly passed to them.
> Keep this file accurate. Drift here causes every clone to produce wrong output.

---

## Project Overview

StudioWorks is a TypeScript-first monorepo for generating cinematic AI video through a structured, studio-style pipeline. It follows a strict separation between three runtime services and two shared packages.

---

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
    ARCHITECTURE.md
    DEPLOYMENT-PLAN.md
    LOCAL-DEV.md
```

**Package manager:** pnpm (`pnpm-workspace.yaml`)
**Build system:** Turborepo (`turbo.json`)
**Language:** TypeScript throughout — strict mode, no `any`

---

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

---

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

---

## Data Flow

```
web: user configures scene/shot → builds RenderSpec
  → api: validates RenderSpec (Zod) → persists RenderJob (immutable) → enqueues renderJobId
    → worker: dequeues renderJobId → loads spec from DB → executes provider adapter
      → updates job state → writes output assets to S3
```

**Critical immutability constraint:** The `RenderJob` record and its embedded `RenderSpec` are immutable once written. Never update or patch a persisted spec — create a new `RenderJob` instead. This is a hard architectural rule, not a preference.

---

## Infrastructure

| Concern | Technology |
|---|---|
| Primary database | Postgres |
| Job queue | Redis (BullMQ) |
| File storage | S3 (AWS SDK v3) — presigned PUT URLs, never proxy through a service |
| Local dev | Docker Compose (`docker/compose.dev.yml`) |
| Container builds | Dockerfiles in `apps/api/` and `apps/worker/` |
| Future production | Kubernetes + Terraform (`infra/`) |

### Local Development

```bash
pnpm install
cp .env.example .env                                     # default values work with Docker Compose
pnpm infra:up                                            # starts Postgres (5432) + Redis (6379)
pnpm --filter @studioworks/db db:migrate:deploy          # apply migrations (first-time only)
pnpm dev                                                 # runs web (3000), api (4000), worker
```

Infrastructure commands: `pnpm infra:up / infra:down / infra:logs / infra:reset`

Full setup: `docs/LOCAL-DEV.md`

---

## Development Philosophy

- **When in doubt, ask before acting.** Confirm scope and intent rather than assuming. This applies to both agents and humans — an incorrect assumption that proceeds silently is harder to recover from than a brief pause to verify.
- **Minimum necessary change.** Make exactly what was asked. Do not improve adjacent code, refactor surrounding logic, or clean up unrelated areas as a side effect. If you notice something worth fixing nearby, flag it separately rather than folding it in.
- **Clean up after yourself.** Remove temporary scripts and debug artifacts when done. Close database and Redis connections in test teardown. Leave the environment in a state ready for the next session — no dangling processes, no uncommitted scratch files.
- **One service at a time**, unless explicitly parallelized via subagents. Cross-service changes must call out the downstream impact explicitly — both in the work and in the PR description.
- **Simplicity first.** Make every change as simple as possible. Impact minimal code. Three clear lines beat a premature abstraction.
- **No laziness.** Find root causes — no temporary fixes. Senior developer standards. When given a bug report: just fix it. Point at logs, errors, and failing tests — then resolve them without requiring hand-holding from the user. Go fix failing CI tests without being told how.
- **Demand elegance (for non-trivial changes).** Pause and ask "is there a more elegant way?" If a fix feels hacky, ask "knowing everything I know now, what is the elegant solution?" Skip this for simple, obvious fixes — don't over-engineer.
- **Verify before declaring done.** Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness. Diff behavior between expected and actual when relevant. Ask: "Would a staff engineer approve this?"
- **Plan mode for non-trivial tasks.** Enter plan mode for any task with 3+ steps or architectural decisions. If something goes sideways mid-task, stop and re-plan immediately — don't keep pushing. Use plan mode for verification steps, not just building. Write detailed specs upfront to reduce ambiguity.
- **Self-improvement loop.** After any correction from the user, update `tasks/lessons.md` with the pattern and a rule that prevents the same mistake. Ruthlessly iterate on these lessons until the mistake rate drops. Review `tasks/lessons.md` at session start for relevant context.

---

## Key Conventions

### TypeScript
- Strict mode enabled project-wide — never weaken `tsconfig.json`
- All inter-service data shapes defined in `@studioworks/shared`, not inline within a service
- Avoid `any` — prefer `unknown` with runtime Zod parsing at service boundaries

### Schema & Validation
- All API endpoints accepting a `RenderSpec` must validate with `.parse()` or `.safeParse()` — never skip
- Zod errors surface as structured 400 responses, not unhandled exceptions

### Fastify API Routes (`apps/api`)
- Define request/response types in `@studioworks/shared` if shared across services
- Validate all request bodies and params with Zod
- Return structured error responses — never raw exceptions or stack traces
- Auth checked at route level before any DB access

### Worker / Queue
- Provider adapters are isolated modules in `apps/worker/src/providers/`
- Swapping or adding a provider must not require changes to queue logic or `apps/api`/`apps/web`
- Every job handler: try/catch, log job ID at start and end, throw on failure (BullMQ handles retries)
- Use `job.updateProgress()` for long-running jobs

### Database
- All schema changes go through Prisma migrations — no raw DDL
- Never import `@prisma/client` directly in `apps/` — always through `@studioworks/db`
- `RenderJob` records are append-only — never mutate a persisted spec
- Always use `select` in Prisma queries — never return full objects unless every field is needed
- Cursor-based pagination only — no OFFSET
- Multi-step writes: `prisma.$transaction([])`

### S3 File Storage
- Generate presigned PUT URLs server-side — upload client-side directly to S3
- Never stream file uploads through `apps/api` or `apps/web`
- Validate file type and size with Zod before issuing presigned URL
- Store only the S3 key in the DB, never the full URL
- Key pattern: `{entity}/{userId}/{uuid}.{ext}`

### Testing
- Test runner: **Vitest** with root workspace config (`vitest.workspace.ts`) covering all packages and apps
- Integration tests (`apps/api`, `apps/worker`, `packages/db`): Testcontainers for real Postgres/Redis per suite
- Apply migrations in tests with `pnpm --filter @studioworks/db db:migrate:deploy` (non-interactive — not `db:migrate`)
- Web tests (`apps/web`): jsdom + MSW for API mocking — no direct DB or Redis access
- DB access in tests: `@studioworks/db` — never `@prisma/client`
- `afterEach` teardown deletes rows in FK-safe order to keep tests independent

### Commits & PRs
- Scope changes to a single service or package where possible
- Changes to `@studioworks/shared` or `@studioworks/db` must be called out explicitly in the PR description

---

## Task Management Workflow

For any non-trivial task, follow this sequence:

1. **Plan first** — write the plan to `tasks/todo.md` with checkable items before writing any code
2. **Verify plan** — check in with the user before starting implementation if scope is ambiguous
3. **Track progress** — mark items complete as you go; update `tasks/todo.md` in place
4. **Explain changes** — provide a high-level summary at each meaningful step
5. **Document results** — add a review/outcome section to `tasks/todo.md` when done
6. **Capture lessons** — update `tasks/lessons.md` after any user correction or unexpected outcome

---

## Common Task Checklists

**Add a new field to RenderSpec:**
1. Update Zod schema in `packages/shared`
2. `pnpm build --filter @studioworks/shared`
3. Update `apps/api` validation logic if needed
4. Update `apps/web` form/construction logic
5. Update `apps/worker` if the field affects rendering behavior
6. Add a Prisma migration if stored as a DB column

**Add a new render provider:**
1. Create adapter in `apps/worker/src/providers/`
2. Implement the shared provider interface
3. Register in the provider registry
4. No changes required in `apps/api` or `apps/web`

**Add a new API endpoint:**
1. Define request/response types in `@studioworks/shared` if cross-service
2. Add the Fastify route in `apps/api`
3. Wire up Zod validation on request body/params
4. Add the corresponding client call in `apps/web`

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | `.env` + Docker | Prisma / Postgres connection |
| `REDIS_URL` | `.env` + Docker | BullMQ connection |
| `NEXTAUTH_SECRET` | `.env` + Docker | Auth.js secret |
| `NEXTAUTH_URL` | `.env` + Docker | Auth.js base URL |
| `AWS_ACCESS_KEY_ID` | `.env` + Docker | S3 access |
| `AWS_SECRET_ACCESS_KEY` | `.env` + Docker | S3 secret |
| `AWS_S3_BUCKET` | `.env` + Docker | S3 bucket name |
| `AWS_REGION` | `.env` + Docker | S3 region |

When writing code that requires a new env var, flag it: name, purpose, and which files it belongs in.

---

## Model Selection Guidance

When you assess that a task warrants Opus over Sonnet, say so at the start of your response:
> **Suggest: Opus** — [one-line reason]

The user makes the final call to switch with `/model`. Never switch automatically or block on it — flag it and proceed with the current model.

Flag for Opus when the task involves:
- Designing or changing `@studioworks/shared` schemas (ripple effects across all services)
- Prisma schema changes that require migrations
- Architectural decisions with multiple valid tradeoffs
- Debugging that spans more than 2 services simultaneously
- Any task where Sonnet has already produced incorrect output twice

---

## Docs

> **Rule:** When a new doc is added to `docs/`, it must also be listed here with a one-line description. CLAUDE.md is the index — if it's not listed here, agents won't know it exists.

- `docs/PLAN.md` — MVP task list with per-task file, function, and class targets. Days 1–4 complete; Days 5–9 remaining.
- `docs/PLAN-POLISH.md` — Post-MVP only: User/Project/Scene/Shot/Asset models, deterministic spec hashing, shared Redis helper. Do not load unless MVP is complete.
- `docs/ARCHITECTURE.md` — system design decisions and rationale
- `docs/RENDER-PIPELINE.md` — render job lifecycle: API → queue → worker, data flows, state machine, gotchas
- `docs/DEPLOYMENT-PLAN.md` — deployment status and post-MVP production roadmap (phases 1–7); detailed phase plan in `PLAN.md`
- `docs/LOCAL-DEV.md` — local environment setup

---

## Source File Map

Clones: read this before grepping. These are the files that matter.

### `packages/shared`
| File | Purpose |
|---|---|
| `render-spec.ts` | Zod schema for `RenderSpec` — canonical cross-service contract (package root, not `src/`) |
| `src/index.ts` | Re-exports schema types and `RENDER_QUEUE_NAME` constant |

### `packages/db`
| File | Purpose |
|---|---|
| `src/index.ts` | Exports `db` — the shared PrismaClient singleton |
| `prisma/schema.prisma` | DB schema source of truth |
| `prisma/migrations/` | Generated migration files — never edit manually |

### `apps/api`
| File | Purpose |
|---|---|
| `src/index.ts` | Server entry point, listens on port 4000 |
| `src/app.ts` | Fastify app — `POST /render-jobs` validates spec, persists job, enqueues by ID |
| `src/queue.ts` | BullMQ `Queue` instance connected to Redis |

### `apps/worker`
| File | Purpose |
|---|---|
| `src/worker.ts` | BullMQ Worker entry point — dequeues `renderJobId`, calls processor |
| `src/processor.ts` | `processRenderJob` — drives state machine (`QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED`) |
| `src/providers/adapter.ts` | Provider adapter stub — wraps render API call, swappable without touching queue logic |

### `apps/web`
| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Next.js root layout |
| `src/app/page.tsx` | Home page entry point |
| `src/app/render/page.tsx` | Render job tracker — list, status, results |
| `src/app/render/[id]/page.tsx` | Job detail — status, progress, output assets (dynamic route) |
| `src/app/studio/page.tsx` | Creative marketing studio landing (future) |
| `src/app/studio/clients/page.tsx` | Client management (future) |
| `src/app/studio/scripts/page.tsx` | Commercial screenplay storage (future) |
| `src/app/studio/storyboards/page.tsx` | Storyboard storage (future) |
| `src/app/studio/prompts/page.tsx` | Prompt builder, template library, and render submission |

### `packages/shared` — studio
| File | Purpose |
|---|---|
| `src/studio/index.ts` | Placeholder for future studio types — `PromptTemplate`, `CommercialScript`, `Storyboard`, `Client` |

---

## Subagent Orchestration

Subagents are for parallel or context-heavy work. The main agent decides when to delegate; subagents never spawn further subagents.

### When to use a subagent
- Work is parallelizable (e.g., updating `apps/api` and `apps/web` simultaneously)
- A subtask generates large intermediate output that would pollute the main context
- Research, exploration, or analysis independent of the main task
- Complex problems that benefit from parallel compute — throw more subagents at hard problems rather than grinding sequentially

### When NOT to use a subagent
- The subtask requires reasoning about the overall plan — keep that in the main agent
- Subtasks have sequential dependencies — chain them explicitly
- The task is small — overhead isn't worth it

### Subagent strategy
- Use subagents liberally to keep the main context window clean
- One focused goal per subagent — don't bundle unrelated work
- Offload research and exploration early so results are available when implementation starts
- Do not duplicate work a subagent is already doing — if you delegate research, don't also search yourself
- Subagents have no memory — pass all needed context explicitly (goal, files, decisions already made, expected output shape)
- Summarize subagent output before acting on it; verify it matches the stated goal

---

## Code Output Standards

Every file written by any agent (main or clone) must:
1. Be complete — no truncation, no `// ...rest of file`, no `// TODO: implement`
2. State the full file path explicitly
3. Compile — no unresolved imports, no missing types
4. Follow all conventions in this file

When a `@studioworks/shared` change is required: show the shared change first, then downstream service changes.
When a Prisma schema change is required: show the model diff and migration command before writing application code that uses the new model.
