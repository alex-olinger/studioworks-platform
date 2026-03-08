# StudioWorks

**A TypeScript-first monorepo platform for generating cinematic AI video through a structured, studio-style workflow.**

StudioWorks orchestrates AI video rendering through a persistent job queue, strict shared contracts, and a clean separation of concerns across three runtime services.

---

## Architecture Overview

```
studioworks/
  apps/
    web/                        # Next.js frontend (port 3000)
      src/app/
        render/                 # Render job tracker (in progress)
          page.tsx              # Job list
          [id]/page.tsx         # Job detail — status, progress, output assets
        studio/                 # Creative marketing studio (future)
          clients/
          scripts/
          storyboards/
          prompts/
    api/                        # Fastify backend (port 4000)
    worker/                     # BullMQ async job processor
  packages/
    shared/                     # RenderSpec Zod schema, queue constants, shared types
    db/                         # Prisma schema and database client
  docker/
    compose.dev.yml
  docs/
    ARCHITECTURE.md
    RENDER-PIPELINE.md
    DEPLOYMENT-PLAN.md
    LOCAL-DEV.md
    PLAN.md
```

### Services

| Service | Runtime | Responsibility |
|---|---|---|
| `web` | Next.js | RenderSpec construction, job submission, status polling |
| `api` | Node / Fastify | Validate RenderSpec, persist RenderJob, enqueue by ID |
| `worker` | Node / BullMQ | Dequeue job, load spec from DB, drive state machine, call provider adapter |

### Data Flow

```
Frontend builds RenderSpec
  → API validates (Zod) + persists immutable RenderJob
    → Worker receives renderJobId only
      → Worker loads spec from Postgres
        → Calls provider adapter
          → QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED
```

### Data Stores

- **Postgres** — `RenderJob` records and embedded `RenderSpec` JSON (source of truth)
- **Redis** — BullMQ job queue (notification channel only — never stores the spec)

---

## Key Design Decisions

- **Immutable RenderJob specs** — the spec is persisted at submission time and never modified. The worker only receives a `renderJobId` and loads the spec from Postgres itself. This decouples the worker from the API's request lifecycle entirely.
- **Minimal queue payload** — only `{ renderJobId }` is enqueued, never the full spec. Queue stays lightweight regardless of spec size.
- **Shared TypeScript contracts** — `@studioworks/shared` is the single source of truth for all cross-service types (`RenderSpec`, `RENDER_QUEUE_NAME`). `@studioworks/db` is the only path to the database — never import `@prisma/client` directly.
- **Provider-agnostic worker** — the worker calls a provider adapter stub, making it straightforward to swap or extend with additional AI video providers without touching API or queue logic.
- **Python GPU path** — the worker can be replaced or augmented with a Python-based GPU rendering service without touching the API or frontend boundaries.

---

## Tech Stack

- **Language:** TypeScript (strict, throughout)
- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js (App Router)
- **Backend:** Fastify
- **Queue:** BullMQ (Redis-backed)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Validation:** Zod (`RenderSpec` schema in `@studioworks/shared`)
- **Testing:** Vitest + Testcontainers

---

## Getting Started

### Prerequisites

- Node.js v20+
- pnpm v10+
- Docker (for Postgres and Redis)

### Local Development

```bash
pnpm install
cp .env.example .env                                    # defaults work with Docker Compose
pnpm infra:up                                           # start Postgres (5432) + Redis (6379)
pnpm --filter @studioworks/db db:migrate:deploy         # apply migrations (first time only)
pnpm dev                                                # web (3000), api (4000), worker
```

See [`docs/LOCAL-DEV.md`](docs/LOCAL-DEV.md) for the full setup walkthrough.

---

## Current State

The core render pipeline is implemented and tested end-to-end:

- `POST /render-jobs` — validates `RenderSpec`, persists `RenderJob`, enqueues ID
- Worker consumes the queue, drives the state machine, calls the provider adapter stub
- 9 tests passing across shared schema, API route, and worker processor

The frontend (`/render`, `/render/[id]`) and API read endpoints (`GET /render-jobs`, `GET /render-jobs/:id`) are in progress — see [`docs/PLAN.md`](docs/PLAN.md) for the detailed build plan.

---

## RenderSpec

The `RenderSpec` is a Zod-validated contract defined in `@studioworks/shared`:

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

Built client-side, validated on submission, stored immutably in the `RenderJob` record.

---

## Job Lifecycle

```
QUEUED → RUNNING → UPLOADING → COMPLETE
                             → FAILED
```

State is written by the worker directly to the `RenderJob` record in Postgres.

---

## Planned: Creative Marketing Studio

A creative marketing studio module is planned as a future expansion. It will allow users to organize AI video/image production work for clients — storing commercial scripts, storyboards, and reusable prompt libraries.

Route scaffolding and shared type placeholders are already in place under `apps/web/src/app/studio/` and `packages/shared/src/studio/`.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, key decisions, source file map |
| [`docs/RENDER-PIPELINE.md`](docs/RENDER-PIPELINE.md) | Render job lifecycle, data flows, state machine, gotchas |
| [`docs/PLAN.md`](docs/PLAN.md) | MVP build plan — Days 1–4 complete, Days 5–9 remaining |
| [`docs/DEPLOYMENT-PLAN.md`](docs/DEPLOYMENT-PLAN.md) | Deployment status and post-MVP production roadmap |
| [`docs/LOCAL-DEV.md`](docs/LOCAL-DEV.md) | Local development setup |

---

## License

MIT
