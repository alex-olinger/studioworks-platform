# StudioWorks Platform Architecture

apps/ = runtime services
packages/ = shared logic
docker/ = local infrastructure containers
infra/ = production infrastructure definition

---

## How the System Fits Together

The platform is split into three services that communicate only through well-defined boundaries — HTTP and a Redis queue — never by calling each other's code directly.

```
web (Next.js)
  └─ POST /render-jobs ──► api (Fastify)
                              ├─ validates RenderSpec (Zod)
                              ├─ persists RenderJob (Postgres, immutable)
                              └─ enqueues renderJobId ──► Redis
                                                            └─ worker (BullMQ)
                                                                ├─ loads spec from DB
                                                                ├─ calls providerAdapter
                                                                └─ updates job status
```

**Key constraint:** The API only ever enqueues the `renderJobId`, never the full spec. The worker loads the spec from the database itself. This means the queue stays lightweight and the spec is always read from a single source of truth.

---

## Why the Worker Is Split Into Two Layers

The worker has two distinct files: `worker.ts` and `processor.ts`.

**`worker.ts`** is the BullMQ entry point. It knows about the queue — how to connect, how to dequeue jobs, and how to report success or failure back to BullMQ. It does no rendering logic itself.

**`processor.ts`** is the rendering logic. It owns the job state machine (`QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED`) and calls the provider adapter to do the actual render. It knows nothing about BullMQ.

This separation matters because the worker is intentionally replaceable. A future GPU service written in Python could consume the same Redis queue and the same Postgres database without touching any of this code. Keeping queue mechanics out of `processor.ts` means the rendering logic can be tested independently without a running queue.

---

## Why the Provider Adapter Exists

`apps/worker/src/providers/adapter.ts` is a stub that wraps the call to the actual render provider (e.g. a video generation API). It exists as its own module so that:

- The processor calls a stable interface (`providerAdapter.render(spec)`) regardless of which provider is active
- Swapping or adding a provider only requires changes inside `providers/` — no changes to queue logic or state management
- Tests can `vi.spyOn(providerAdapter, 'render')` to simulate provider success or failure without making real API calls

---

## How Prisma Connects the Database to TypeScript

Prisma acts as the bridge between Postgres and the rest of the codebase in two steps:

```
schema.prisma        ← you define the shape here
      ↓  prisma migrate
migration.sql        ← Prisma generates SQL to make Postgres match
      ↓  applied to Postgres
actual tables

schema.prisma
      ↓  prisma generate
PrismaClient         ← Prisma generates TypeScript types that match the tables
      ↓
your code            ← db.renderJob.create(), db.renderJob.findUnique(), etc.
```

"Fully typed" means TypeScript knows the exact shape of every database object at compile time — fields, types, and valid enum values — so mistakes are caught while writing code, not at runtime:

```ts
job.id        // string
job.status    // RenderJobStatus — QUEUED | RUNNING | UPLOADING | COMPLETE | FAILED
job.spec      // Json

job.badField  // ✗ TypeScript error — field doesn't exist
db.renderJob.create({ data: { status: 'INVALID' } })  // ✗ TypeScript error — not a valid enum value
```

`schema.prisma` is the single source of truth. Migrations keep Postgres in sync with it; `prisma generate` keeps the TypeScript types in sync with it.

---

## Source File Map

### `packages/shared`
| File | Purpose |
|---|---|
| `render-spec.ts`  | Zod schema for `RenderSpec` — the canonical cross-service contract |
| `src/index.ts`    | Re-exports schema types and `RENDER_QUEUE_NAME` constant |

### `packages/db`
| File | Purpose |
|---|---|
| `src/index.ts`    | Exports `db` — the shared PrismaClient singleton |
| `prisma/schema.prisma` | DB schema source of truth — `RenderJob` model, `RenderJobStatus` enum |

### `apps/api`
| File | Purpose |
|---|---|
| `src/index.ts`    | Server entry point, listens on port 4000 |
| `src/app.ts`      | Fastify app — `POST /render-jobs` validates spec, persists job, enqueues by ID |
| `src/queue.ts`    | BullMQ `Queue` instance connected to Redis |

### `apps/worker`
| File | Purpose |
|---|---|
| `src/worker.ts`               | BullMQ Worker entry point — dequeues `renderJobId`, calls processor |
| `src/processor.ts`            | `processRenderJob` — drives state machine (QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED) |
| `src/providers/adapter.ts`    | Provider adapter stub — wraps the render API call, swappable without touching queue logic |

### `apps/web`

> **Status:** Layout and home page are minimal stubs. Render pages are placeholder components. Full implementation is Days 5–7 of `PLAN.md`.

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Next.js root layout (minimal — no nav yet) |
| `src/app/page.tsx` | Home page (stub `<h1>StudioWorks</h1>`) |
| `src/app/render/page.tsx` | Render job list — placeholder (target: fetch jobs, status table, poll every 5s) |
| `src/app/render/[id]/page.tsx` | Job detail — placeholder (target: status badge, spec breakdown, poll, output asset link) |
| `src/app/studio/page.tsx` | Creative marketing studio landing (future) |
| `src/app/studio/clients/page.tsx` | Client management (future) |
| `src/app/studio/scripts/page.tsx` | Commercial screenplay storage (future) |
| `src/app/studio/storyboards/page.tsx` | Storyboard storage (future) |
| `src/app/studio/prompts/page.tsx` | Prompt builder, template library, and render submission (future) |

### `packages/shared` — studio
| File | Purpose |
|---|---|
| `src/studio/index.ts` | Placeholder for future studio types — `PromptTemplate`, `CommercialScript`, `Storyboard`, `Client` |
