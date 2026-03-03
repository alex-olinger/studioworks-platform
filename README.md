# StudioWorks

**A TypeScript-first monorepo platform for generating cinematic AI video through a structured, studio-style workflow.**

StudioWorks models the film production pipeline — projects, scenes, and shots — and orchestrates AI video rendering through a persistent job queue, strict shared contracts, and a clean separation of concerns across three runtime services.

---

## Architecture Overview

```
studioworks-platform/
  apps/
    web/                        # Next.js frontend
      src/app/
        render/                 # Render job tracker
          page.tsx              # Job list / dashboard
          [id]/page.tsx         # Job detail — status, progress, output assets
        studio/                 # Creative marketing studio
          clients/
          scripts/              # Commercial screenplays
          storyboards/
          prompts/              # Prompt builder, template library, render submission
    api/                        # Fastify backend — persistence, validation, job submission
    worker/                     # BullMQ service — async render job execution
  packages/
    shared/                     # RenderSpec Zod schema, queue constants, shared types
      src/
        studio/                 # Future studio-specific types (PromptTemplate, Script, etc.)
    db/                         # Prisma schema and database client
  docker/
    compose.dev.yml
  infra/
    ci/
    k8s/
    terraform/
  docs/
    ARCHITECTURE.md
    DEPLOYMENT_PLAN.md
    LOCAL_DEV.md
```

### Services

| Service | Runtime | Responsibility |
|---|---|---|
| `web` | Next.js | Shot editor UI, RenderSpec construction, status polling, video playback |
| `api` | Node / Fastify | CRUD for projects/scenes/shots, render submission, job status |
| `worker` | Node / BullMQ | Job consumption, provider adapter execution, asset record creation |

### Data Flow

```
Frontend builds RenderSpec
  → API validates + persists immutable RenderJob record
    → Worker receives renderJobId
      → Worker loads spec from DB
        → Executes provider adapter
          → QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED
```

### Data Stores

- **Postgres** — users, projects, scenes, shots, assets, render job specs
- **Redis** — BullMQ job queue

---

## Key Design Decisions

- **Immutable RenderJob specs** — the spec is persisted at submission time; the worker only ever receives a `renderJobId` and loads the spec from the database. This decouples the worker from the API's request lifecycle entirely.
- **Deterministic spec hashing** — RenderSpecs are hashed at submission time to support deduplication and auditability.
- **Shared TypeScript contracts** — `@studioworks/shared` and `@studioworks/db` are the single source of truth for all cross-service types, preventing drift.
- **Provider-agnostic worker** — the worker executes a provider adapter stub, making it straightforward to swap or extend with additional AI video providers.
- **Python GPU rendering path** — the worker can be replaced or augmented with a Python-based GPU rendering service without touching the API or frontend boundaries.

---

## Tech Stack

- **Language:** TypeScript (strict, throughout)
- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** Next.js
- **Backend:** Fastify
- **Queue:** BullMQ (Redis-backed)
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Infrastructure:** Docker Compose (local), Kubernetes + Terraform (production)
- **Validation:** Zod (RenderSpec schema)

---

## Getting Started

### Prerequisites

- Node.js v20+
- pnpm
- Docker (for Postgres and Redis)

### Local Development

```bash
# Install dependencies
pnpm install

# Start Postgres and Redis
docker compose -f docker/compose.dev.yml up -d

# Copy environment variables
cp .env.example .env

# Run database migrations
pnpm --filter @studioworks/db db:migrate

# Start all services in development mode
pnpm dev
```

See [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) for a full local setup walkthrough.

---

## Domain Model

```
User
 └── Projects
      └── Scenes
           └── Shots
                └── RenderJobs → Assets
```

Each **Shot** holds the creative configuration (prompt, duration, resolution, seed). A **RenderJob** captures an immutable snapshot of the RenderSpec at submission time. **Assets** are created by the worker upon successful completion and reference the output video file.

---

## RenderSpec

The `RenderSpec` is a Zod-validated contract defined in `@studioworks/shared`. It is built client-side, validated again on submission, and stored immutably in the `RenderJob` record. The worker re-validates the spec on load before execution.

---

## Job Lifecycle

```
QUEUED → RUNNING → UPLOADING → COMPLETE
                              → FAILED
```

Lifecycle state is written by the worker directly to the `RenderJob` record in Postgres. The API exposes a status endpoint for polling.

---

## Planned: Creative Marketing Studio

A creative marketing studio module is planned as a future expansion of the platform. It will allow users to organize AI video/image production work for clients — storing commercial scripts (screenplays), storyboards, and building reusable prompt libraries with automation tools for image and video generation.

Route scaffolding and shared type placeholders are already in place under `apps/web/src/app/studio/` and `packages/shared/src/studio/`. The current build focus remains on the core render pipeline.

---

## Deployment

Production infrastructure is defined under `infra/` using Terraform (cloud resources) and Kubernetes manifests (service deployment). CI pipelines are defined under `infra/ci/`.

See [`docs/DEPLOYMENT_PLAN.md`](docs/DEPLOYMENT_PLAN.md) for details.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full system architecture |
| [`docs/RENDER_PIPELINE.md`](docs/RENDER_PIPELINE.md) | Render job lifecycle, data flows, state machine, gotchas |
| [`docs/DEPLOYMENT_PLAN.md`](docs/DEPLOYMENT_PLAN.md) | Production deployment guide |
| [`docs/LOCAL_DEV.md`](docs/LOCAL_DEV.md) | Local development setup |

---

## License

MIT
