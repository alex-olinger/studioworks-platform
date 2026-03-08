# Render Pipeline — Technical Documentation

## 1. Executive Summary

The render pipeline is the core feature of StudioWorks. It accepts a **RenderSpec** (a structured description of scenes and shots to render), persists it as an immutable record in Postgres, and enqueues only the record's ID into Redis for asynchronous processing by a separate worker service.

The central design principle: **the queue is a notification channel, not a data store.** The full spec is never serialized into Redis. The worker receives only a `renderJobId`, loads the spec from Postgres itself, and drives the job through a state machine to completion or failure. This makes the system auditable, recoverable, and keeps the queue lightweight regardless of spec size.

---

## 2. Architecture

The pipeline spans three runtime services and two shared packages:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           apps/web (Next.js)                            │
│                                                                         │
│  /render/new  → user builds RenderSpec → POST /render-jobs  [planned]  │
│  /render      → user views job list, status, output assets  [planned]  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  HTTP POST
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          apps/api (Fastify)                             │
│                                                                         │
│  1. Validate RenderSpec against Zod schema (from @studioworks/shared)   │
│  2. Persist immutable RenderJob record in Postgres (via @studioworks/db)│
│  3. Enqueue { renderJobId: job.id } into Redis                          │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐                       │
│  │ app.ts   │───▶│ db       │    │ queue.ts     │                       │
│  │ (route)  │    │ (Prisma) │    │ (BullMQ Queue)│                      │
│  └──────────┘    └──────────┘    └──────┬───────┘                       │
└─────────────────────────────────────────┼───────────────────────────────┘
                                          │  Redis: { renderJobId }
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        apps/worker (BullMQ)                             │
│                                                                         │
│  1. Dequeue { renderJobId } from Redis                                  │
│  2. Load full RenderSpec from Postgres                                  │
│  3. Drive state machine: QUEUED → RUNNING → UPLOADING → COMPLETE/FAILED │
│  4. Call provider adapter with spec                                     │
│                                                                         │
│  ┌────────────┐    ┌──────────────┐    ┌────────────────────┐           │
│  │ worker.ts  │───▶│ processor.ts │───▶│ providers/adapter.ts│          │
│  │ (BullMQ)   │    │ (state mgmt) │    │ (render API call)   │          │
│  └────────────┘    └──────────────┘    └────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Separation of concerns

| Layer | Knows about | Does NOT know about |
|---|---|---|
| `app.ts` (API route) | Zod validation, Prisma, BullMQ Queue | How rendering works, provider APIs |
| `worker.ts` (queue listener) | BullMQ, which processor to call | Rendering logic, DB schema details |
| `processor.ts` (state machine) | Prisma, provider adapter interface | BullMQ, HTTP, how the job arrived |
| `providers/adapter.ts` | External render API | Job state, queue, database |

---

## 3. Data Flows

### Happy path: submit and render

```
User (web)                      API                         Redis              Worker
   │                             │                            │                   │
   │  POST /render-jobs          │                            │                   │
   │  { projectId, scenes }      │                            │                   │
   │────────────────────────────▶│                            │                   │
   │                             │                            │                   │
   │                     1. Zod validate                      │                   │
   │                     2. db.renderJob.create()             │                   │
   │                        → status: QUEUED                  │                   │
   │                        → spec: { ... } (immutable)       │                   │
   │                     3. queue.add('render',               │                   │
   │                        { renderJobId: job.id })          │                   │
   │                             │───────────────────────────▶│                   │
   │  201 { id, status: QUEUED } │                            │                   │
   │◀────────────────────────────│                            │                   │
   │                             │                            │                   │
   │                             │                            │  dequeue job      │
   │                             │                            │──────────────────▶│
   │                             │                            │                   │
   │                             │                     4. db.renderJob.update(RUNNING)
   │                             │                     5. db.renderJob.findUniqueOrThrow()
   │                             │                        → loads full spec from Postgres
   │                             │                     6. db.renderJob.update(UPLOADING)
   │                             │                     7. providerAdapter.render(spec)
   │                             │                     8. db.renderJob.update(COMPLETE)
   │                             │                            │                   │
```

### Failure path

```
   Same as above through step 6, then:

   │                             │                     7. providerAdapter.render(spec)
   │                             │                        → throws Error
   │                             │                     8. db.renderJob.update(FAILED)
```

### What goes where

```
Postgres (source of truth)          Redis (notification only)
┌────────────────────────────┐      ┌──────────────────────────┐
│ RenderJob                  │      │ BullMQ job payload       │
│   id:     "abc-123"        │      │   { renderJobId:         │
│   status: QUEUED → ...     │      │       "abc-123" }        │
│   spec:   { projectId,    │      │                          │
│             scenes: [...] }│      │  ← That's it. No spec.  │
│   createdAt, updatedAt     │      └──────────────────────────┘
└────────────────────────────┘
```

---

## 4. API Routes

### `POST /render-jobs`

**File:** `apps/api/src/app.ts:9`

| Aspect | Detail |
|---|---|
| Method | POST |
| Path | `/render-jobs` |
| Request body | `RenderSpec` — validated against `RenderSpecSchema` (Zod) |
| Success response | `201` — the created `RenderJob` record (`{ id, status, spec, createdAt, updatedAt }`) |
| Error response | `400` — `{ errors: <Zod flattened errors> }` |
| Side effects | Creates a `RenderJob` row in Postgres; enqueues `{ renderJobId }` to Redis |

**Request body shape:**

```json
{
  "projectId": "proj_123",
  "scenes": [
    {
      "id": "scene_1",
      "shots": [
        {
          "id": "shot_1",
          "prompt": "A cinematic wide shot of a mountain at sunrise",
          "durationSeconds": 5
        }
      ]
    }
  ]
}
```

**What happens on the server (line by line in `app.ts`):**

```
Line 10:  RenderSpecSchema.safeParse(request.body)     → validate
Line 12:  reply.status(400).send(...)                   → reject if invalid
Line 15:  db.renderJob.create({ data: { spec } })      → persist (QUEUED by default)
Line 16:  queue.add('render', { renderJobId: job.id })  → enqueue ID only
Line 18:  reply.status(201).send(job)                   → respond with full record
```

---

## 5. Database

### Schema (`packages/db/prisma/schema.prisma`)

```prisma
enum RenderJobStatus {
  QUEUED
  RUNNING
  UPLOADING
  COMPLETE
  FAILED
}

model RenderJob {
  id           String          @id @default(uuid())
  status       RenderJobStatus @default(QUEUED)
  spec         Json
  outputAssets Json?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
}
```

### Field-by-field

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID (string) | Primary key, auto-generated. This is the `renderJobId` that travels through the queue. |
| `status` | Enum | Job lifecycle state. Only the worker writes this after initial creation. |
| `spec` | JSON | The full `RenderSpec` payload, stored verbatim. **Immutable after creation.** |
| `outputAssets` | JSON (nullable) | Will hold references to output files (S3 keys) once the render completes. Currently unused. |
| `createdAt` | DateTime | Set once at creation. |
| `updatedAt` | DateTime | Auto-updated by Prisma on every `.update()` call. |

### Immutability rule

The `spec` field is **never updated** after the `RenderJob` is created. The worker reads it, passes it to the provider adapter, but never writes back to it. The processor test `'never mutates the persisted RenderSpec'` enforces this explicitly.

If you need to change a spec, you create a new `RenderJob` — you don't modify an existing one.

### State machine

```
  ┌──────────┐
  │  QUEUED  │ ← initial state (set by Prisma @default on create)
  └────┬─────┘
       │  worker picks up job
       ▼
  ┌──────────┐
  │ RUNNING  │ ← set immediately when processor starts
  └────┬─────┘
       │  spec loaded, render about to execute
       ▼
  ┌───────────┐
  │ UPLOADING │ ← set just before calling providerAdapter.render()
  └─────┬─────┘
        │
   ┌────┴─────┐
   ▼          ▼
┌──────────┐ ┌────────┐
│ COMPLETE │ │ FAILED │
└──────────┘ └────────┘
```

---

## 6. External Dependencies

### Redis (BullMQ)

| Aspect | Detail |
|---|---|
| Purpose | Async job queue between API and worker |
| Client | `bullmq` (both `Queue` in API and `Worker` in worker service) |
| Connection | `process.env.REDIS_URL` or `redis://localhost:6379` |
| Queue name | `'render-jobs'` (exported as `RENDER_QUEUE_NAME` from `@studioworks/shared`) |
| Payload | `{ renderJobId: string }` — nothing else |

Both the API and worker import the queue name from the shared package to prevent drift:

```
@studioworks/shared → RENDER_QUEUE_NAME = 'render-jobs'
  ├── apps/api/src/queue.ts     → new Queue(RENDER_QUEUE_NAME, ...)
  └── apps/worker/src/worker.ts → new Worker(RENDER_QUEUE_NAME, ...)
```

### Postgres (Prisma)

| Aspect | Detail |
|---|---|
| Purpose | Source of truth for all `RenderJob` records and specs |
| Client | `@studioworks/db` exports a shared `PrismaClient` singleton |
| Connection | `process.env.DATABASE_URL` |
| Used by | API (creates jobs) and Worker (reads spec, updates status) |

### Provider adapter (future)

| Aspect | Detail |
|---|---|
| Purpose | Wraps the actual AI render API call |
| File | `apps/worker/src/providers/adapter.ts` |
| Current state | Stub — `async render(_spec): Promise<void>` does nothing |
| Interface | `providerAdapter.render(spec)` — takes the raw spec JSON |
| Design intent | Swappable without touching queue logic, processor, or API |

---

## 7. Key Files

Listed in execution order, following a request through the system:

| File | Role | What happens here |
|---|---|---|
| `packages/shared/render-spec.ts` | Schema | Defines `RenderSpecSchema` (Zod), `RenderSpec`, `Scene`, `Shot` types |
| `packages/shared/src/index.ts` | Re-exports | Exports schema + `RENDER_QUEUE_NAME` constant |
| `apps/api/src/app.ts` | Route handler | Validates spec → creates RenderJob → enqueues ID |
| `apps/api/src/queue.ts` | Queue instance | BullMQ `Queue` connected to Redis |
| `apps/api/src/index.ts` | Server entry | Starts Fastify on port 4000 |
| `apps/worker/src/worker.ts` | Queue listener | BullMQ `Worker` — dequeues job, calls `processRenderJob` |
| `apps/worker/src/processor.ts` | State machine | Loads spec from DB, drives QUEUED→...→COMPLETE/FAILED |
| `apps/worker/src/providers/adapter.ts` | Render call | Stub that will call an external AI video/image API |
| `packages/db/src/index.ts` | DB client | Exports shared `PrismaClient` singleton |
| `packages/db/prisma/schema.prisma` | DB schema | `RenderJob` model and `RenderJobStatus` enum |

### Test files

| File | What it tests |
|---|---|
| `packages/shared/src/render-spec.test.ts` | Zod schema validation — valid specs parse, invalid specs reject |
| `apps/api/src/routes/render-jobs.test.ts` | API route — 201 on valid, 400 on invalid, queue receives only ID |
| `apps/worker/src/processor.test.ts` | Processor state machine — success path, failure path, spec immutability |

---

## 8. Common Gotchas

### The queue payload is intentionally minimal

```ts
// CORRECT — this is what the API enqueues:
queue.add('render', { renderJobId: job.id })

// WRONG — never do this:
queue.add('render', { renderJobId: job.id, spec: result.data })
```

If you ever put the spec into the queue payload, the test `'does not enqueue a full RenderSpec — only a renderJobId'` will catch it. This is an architectural invariant, not a preference.

### The spec is immutable after persistence

The `db.renderJob.create()` call writes the spec once. After that, only `status` and `outputAssets` are ever written to. There is no endpoint or code path to update a spec — if the user wants to change something, they submit a new job. The processor test `'never mutates the persisted RenderSpec'` enforces this.

### Worker state transitions are not guarded

The processor sets `RUNNING` immediately and unconditionally (line 5 of `processor.ts`). If the job isn't currently `QUEUED` — say it's already `RUNNING` from a previous attempt — the update still succeeds. There's no `WHERE status = 'QUEUED'` guard. This is fine for now but worth knowing if BullMQ retries become relevant.

### The processor sets UPLOADING before the render, not after

```ts
// processor.ts — current order:
await db.renderJob.update({ ..., data: { status: 'UPLOADING' } })  // ← first
await providerAdapter.render(job.spec)                              // ← then render
```

This means `UPLOADING` is set *before* the provider is called, not after it returns output. The status is aspirational ("we're about to upload") rather than factual ("we have output and are uploading it"). This will likely change once the provider adapter actually produces output files.

### `app.ready()` is called in `buildApp()`

Line 22 of `app.ts` calls `app.ready()` eagerly so that Fastify's route registration is complete before supertest sends requests. Without this, tests can hit the route before it's registered and get 404s. The `.catch(console.error)` swallows init errors silently — something to watch for during debugging.

### `render-spec.ts` lives at the package root, not in `src/`

The Zod schema file is at `packages/shared/render-spec.ts`, while the re-export barrel is at `packages/shared/src/index.ts`. This is slightly unusual — most files in the monorepo follow the `src/` convention. The test imports from `../render-spec` (relative), while services import via `@studioworks/shared`.

---

## 9. Common Operations

### Run all tests

```bash
pnpm test
```

This executes `vitest run` across all workspaces via the root `vitest.workspace.ts` config. All 9 tests should pass:
- 3 in `packages/shared` (schema validation)
- 3 in `apps/api` (route behavior)
- 3 in `apps/worker` (processor state machine)

### Run tests for a single service

```bash
pnpm --filter @studioworks/api test        # API route tests only
pnpm --filter @studioworks/worker test     # Worker processor tests only
pnpm --filter @studioworks/shared test     # Schema tests only
```

### Start the full stack locally

```bash
pnpm infra:up                              # Postgres (5432) + Redis (6379)
pnpm dev                                   # web (3000), api (4000), worker
```

### Submit a test render job manually

```bash
curl -X POST http://localhost:4000/render-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj_test",
    "scenes": [{
      "id": "scene_1",
      "shots": [{ "id": "shot_1", "prompt": "A cinematic sunset", "durationSeconds": 5 }]
    }]
  }'
```

Expected response: `201` with `{ id: "...", status: "QUEUED", spec: {...}, ... }`

### Inspect Redis queue

```bash
# Connect to Redis CLI
docker exec -it studioworks-redis redis-cli

# List pending jobs
LRANGE bull:render-jobs:wait 0 -1

# Inspect a specific job
HGETALL bull:render-jobs:<job-id>
```

### Apply database migrations

```bash
pnpm --filter @studioworks/db db:migrate:deploy   # apply existing migrations (non-interactive)
cd packages/db && node_modules/.bin/prisma migrate dev --name <name>  # create a new migration
```

### Debug a failing job

1. Check the worker console output — it logs completion and failure with job IDs
2. Query the DB for the job's current status:
   ```sql
   SELECT id, status, "updatedAt" FROM "RenderJob" WHERE id = '<job-id>';
   ```
3. If stuck in `RUNNING`, the provider adapter likely threw and the catch block failed too — check for DB connectivity issues
4. If stuck in `UPLOADING`, the provider adapter is hanging — check external API status
