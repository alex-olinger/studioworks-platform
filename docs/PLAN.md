# PLAN.md — StudioWorks Build Plan

---

## Part 1 — MVP ⬅ PRIORITY: Start here

### Context

StudioWorks is a TypeScript monorepo for AI video rendering. The core pipeline (API → queue → worker) is built and tested, but there's no working frontend, no GET endpoints, and no way to observe the render lifecycle from a browser. This plan completes the MVP: **a user can submit a render from a UI, watch status updates, and see results.**

The original 9-day plan had Days 1–4 mostly complete but included work items (User/Project/Scene/Shot/Asset models, deterministic hashing, shared Redis helper) that aren't needed for the MVP render loop. This refined plan drops those, keeps the day-based structure, and redistributes remaining work into Days 5–9.

**Scope:** MVP render pipeline only. No auth, no studio module, no real S3, no relational project hierarchy.

**Definition of done:** Submit a render from `/render/new` → watch it transition QUEUED → RUNNING → UPLOADING → COMPLETE on `/render/[id]` → see output asset link.

---

### Days 1–4: COMPLETE

#### Day 1 — Monorepo and Local Infra ✓

~~All tasks done. pnpm workspace, Turbo, TypeScript, Docker Compose, package scaffolds, infra scripts.~~

#### Day 2 — Prisma Schema ✓ (MVP scope)

~~RenderJob model + RenderJobStatus enum. Initial migration applied. PrismaClient singleton exported.~~

- **Deferred:** User, Project, Scene, Shot, Asset models — not needed for MVP (projectId is a string in spec JSON; scenes/shots live inside the RenderSpec JSON blob).

#### Day 3 — RenderSpec Contract ✓ (MVP scope)

~~Zod schemas (Shot, Scene, RenderSpec) defined and exported. 3 tests passing.~~

- **Deferred:** Sample payloads file, deterministic hash helper.

#### Day 4 — Queue Wiring ✓ (MVP scope + ahead of schedule)

~~BullMQ producer (API) and consumer (worker) connected. Additionally completed:~~

- `~~POST /render-jobs` endpoint (validate → persist → enqueue by ID)~~
- ~~`processRenderJob` state machine (QUEUED → RUNNING → UPLOADING → COMPLETE/FAILED)~~
- ~~Provider adapter stub~~
- ~~9 tests passing across shared, API, and worker~~

---

### Day 5 — API Read Endpoints + Provider Simulation (~3–4 hours)

**Goal:** Give the frontend everything it needs to display job data.

| #   | Task                                                                                                 | Time   | File(s)                                                                | Functions / Classes                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Register `@fastify/cors` (already a dependency, never called)                                        | 15 min | `apps/api/src/app.ts`                                                  | modify `buildApp()` — call `app.register(cors)` before routes                                                                           |
| 5.2 | `GET /render-jobs` — list jobs, `select` only id/status/createdAt/updatedAt, cursor-based pagination | 45 min | `apps/api/src/app.ts`                                                  | modify `buildApp()` — add `GET /render-jobs` route handler (inline)                                                                     |
| 5.3 | `GET /render-jobs/:id` — full job detail, 404 if not found                                           | 30 min | `apps/api/src/app.ts`                                                  | modify `buildApp()` — add `GET /render-jobs/:id` route handler (inline)                                                                 |
| 5.4 | Define shared response types (`RenderJobListItem`, `RenderJobDetail`) in `@studioworks/shared`       | 30 min | `packages/shared/src/index.ts`                                         | add exported types `RenderJobListItem`, `RenderJobDetail` (new)                                                                         |
| 5.5 | Upgrade provider adapter: add 3–5s delay to simulate work, return mock output asset URL              | 30 min | `apps/worker/src/providers/adapter.ts`, `apps/worker/src/processor.ts` | modify `providerAdapter.render()` — add delay + return mock URL; modify `processRenderJob()` — persist returned URL into `outputAssets` |
| 5.6 | Tests for GET endpoints (list, detail, 404, pagination)                                              | 45 min | `apps/api/src/routes/render-jobs.test.ts`                              | new test suite calling `buildApp()` — tests for list, detail, 404, cursor pagination                                                    |
| 5.7 | Create `docs/RENDER-PIPELINE.md` (state machine, data flow, gotchas)                                 | 30 min | `docs/RENDER-PIPELINE.md`                                              | —                                                                                                                                       |
| 5.8 | Commit                                                                                               | 5 min  | —                                                                      | —                                                                                                                                       |

**End-of-day state:** API serves list + detail. Worker produces visible output. Frontend work can begin.

---

### Day 6 — Frontend Setup + Render Submission Form (~3–4 hours)

**Depends on:** Day 5 (API endpoints must exist)

| #   | Task                                                                                                                                                                                     | Time   | File(s)                                                                    | Functions / Classes                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 6.1 | Install and configure Tailwind CSS                                                                                                                                                       | 30 min | `apps/web/tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css` | config files only — no functions                                        |
| 6.2 | Create API client utility (`submitRenderJob`, `listRenderJobs`, `getRenderJob`)                                                                                                          | 30 min | `apps/web/src/lib/api.ts`                                                  | new `submitRenderJob()`, `listRenderJobs()`, `getRenderJob()` (all new) |
| 6.3 | Configure Next.js `rewrites()` to proxy `/api/*` → `http://localhost:4000/*`                                                                                                             | 15 min | `apps/web/next.config.mjs`                                                 | add `rewrites()` to default export config object                        |
| 6.4 | Build render submission form at `/render/new` — project ID, scenes/shots (repeatable), prompt textarea, duration, client-side Zod validation, POST on submit, redirect to `/render/[id]` | 1.5 hr | `apps/web/src/app/render/new/page.tsx`                                     | new default export `RenderNewPage` component (new file)                 |
| 6.5 | Add nav bar to layout (StudioWorks title, links to `/render` and `/render/new`)                                                                                                          | 20 min | `apps/web/src/app/layout.tsx`                                              | modify `RootLayout()` — add `<nav>` with links before `{children}`      |
| 6.6 | Update MSW handlers for GET list endpoint                                                                                                                                                | 15 min | `apps/web/src/test/msw/handlers.ts`                                        | modify `handlers` array — add `http.get('/api/render-jobs')` handler    |
| 6.7 | Tests: form renders, valid submit calls API, invalid submit shows errors                                                                                                                 | 30 min | `apps/web/src/app/render/new/page.test.tsx`                                | new test suite rendering `RenderNewPage`                                |
| 6.8 | Commit                                                                                                                                                                                   | 5 min  | —                                                                          | —                                                                       |

**End-of-day state:** User can fill out a form and submit a render. Redirected to job detail on success.

---

### Day 7 — Job List + Job Detail Pages (~3–4 hours)

**Depends on:** Day 6 (Tailwind, API client, layout)

| #   | Task                                                                                                                                                                                        | Time   | File(s)                                                                               | Functions / Classes                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 7.1 | Job list page (`/render`) — fetch jobs, table with ID/status badge/time, link to detail, auto-poll every 5s, empty state, "New Render" button                                               | 1 hr   | `apps/web/src/app/render/page.tsx`                                                    | replace placeholder `RenderPage()` with full implementation — calls `listRenderJobs()`     |
| 7.2 | Job detail page (`/render/[id]`) — fetch job, status badge, spec breakdown (scenes/shots/prompts), poll every 3s while in-progress, show output asset when COMPLETE, show error when FAILED | 1.5 hr | `apps/web/src/app/render/[id]/page.tsx`                                               | replace placeholder `RenderDetailPage()` with full implementation — calls `getRenderJob()` |
| 7.3 | Shared UI components: `StatusBadge` (color per status), relative time formatter                                                                                                             | 30 min | `apps/web/src/components/status-badge.tsx`                                            | new `StatusBadge` component (default export), new `formatRelativeTime()` helper (both new) |
| 7.4 | Tests: list renders jobs, empty state, detail shows status, detail shows output                                                                                                             | 45 min | `apps/web/src/app/render/page.test.tsx`, `apps/web/src/app/render/[id]/page.test.tsx` | new test suites rendering `RenderPage` and `RenderDetailPage`                              |
| 7.5 | Commit                                                                                                                                                                                      | 5 min  | —                                                                                     | —                                                                                          |

**End-of-day state:** Full render loop visible in the browser. User can see all jobs, watch status change, view results.

---

### Day 8 — Error Handling + Polish + E2E Verification (~3–4 hours)

**Depends on:** Day 7 (all pages exist)

| #   | Task                                                                                                                             | Time   | File(s)                                                                    | Functions / Classes                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 8.1 | API: `setErrorHandler` (structured JSON, no stack traces), `setNotFoundHandler` for undefined routes                             | 45 min | `apps/api/src/app.ts`                                                      | modify `buildApp()` — call `app.setErrorHandler()` and `app.setNotFoundHandler()`                                         |
| 8.2 | Worker: store error message in `outputAssets` JSON (`{ error: "..." }`) on failure, add job ID logging at start/end              | 30 min | `apps/worker/src/processor.ts`                                             | modify `processRenderJob()` — update catch block to write `{ error }` into `outputAssets`; add `console.log` at start/end |
| 8.3 | Frontend error states: API errors on submission (inline), 404 on detail, network errors during polling, FAILED job error display | 45 min | `apps/web/src/app/render/new/page.tsx`, `[id]/page.tsx`, `render/page.tsx` | modify `RenderNewPage`, `RenderDetailPage`, `RenderPage` — add error state handling in each component                     |
| 8.4 | Loading states: skeletons/spinners for list and detail fetching, disabled submit button while in-flight                          | 30 min | Same frontend files                                                        | modify `RenderNewPage`, `RenderDetailPage`, `RenderPage` — add loading state branches                                     |
| 8.5 | Manual E2E test walkthrough: submit → watch transitions → verify output → submit invalid → verify errors                         | 30 min | —                                                                          | —                                                                                                                         |
| 8.6 | Fix any issues discovered during E2E test                                                                                        | 30 min | Various                                                                    | —                                                                                                                         |
| 8.7 | Commit                                                                                                                           | 5 min  | —                                                                          | —                                                                                                                         |

**End-of-day state:** App handles errors gracefully. Loading states visible. Full flow manually verified.

---

### Day 9 — Docs + Test Coverage + Hardening (~3–4 hours)

**Depends on:** Day 8 (stable flow)

| #   | Task                                                                             | Time   | File(s)            | Functions / Classes                                                                                                   |
| --- | -------------------------------------------------------------------------------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 9.1 | Create/update docs: `ARCHITECTURE.md`, `LOCAL-DEV.md`, `DEPLOYMENT-PLAN.md`      | 1 hr   | `docs/`            | —                                                                                                                     |
| 9.2 | Review and fill test gaps across API, worker, and frontend                       | 1 hr   | Various test files | audit tests covering `buildApp()`, `processRenderJob()`, `providerAdapter.render()`, `RenderPage`, `RenderDetailPage` |
| 9.3 | Run `pnpm typecheck` — fix any type errors, ensure no `any`                      | 30 min | —                  | touch any function or type with errors as discovered                                                                  |
| 9.4 | Clean up: unused imports, stray `console.log`, verify `select` in Prisma queries | 30 min | —                  | audit `buildApp()`, `processRenderJob()`, `providerAdapter.render()` for leftover debug output and missing `select`   |
| 9.5 | Update root `README.md` with accurate quick-start and doc links                  | 15 min | `README.md`        | —                                                                                                                     |
| 9.6 | Final commit: "MVP definition of done met"                                       | 5 min  | —                  | —                                                                                                                     |

**End-of-day state:** MVP complete. Render pipeline works end-to-end from browser. Code is clean, typed, tested, documented.

---

### MVP Deferred Items

These were in the original plan but are explicitly out of scope for MVP. Picked up in Parts 2 and 3 below.

| Item                                                   | Reason Deferred                                |
| ------------------------------------------------------ | ---------------------------------------------- |
| User, Project, Scene, Shot, Asset Prisma models        | No auth or project management UI in MVP        |
| NextAuth / Auth.js                                     | No user accounts in MVP                        |
| S3 presigned URLs + real file storage                  | Mock output URL sufficient for MVP             |
| Deterministic spec hashing                             | Deduplication not needed for MVP               |
| Shared Redis connection helper                         | Independent connections work fine              |
| Studio module (clients, scripts, storyboards, prompts) | Out of scope per plan scope decision           |
| Real render provider integration                       | Provider adapter stub with delay is sufficient |
| Sample payloads file                                   | Tests already contain sample data              |

---

### MVP Dependency Chain

```
Day 5 (API read endpoints + CORS + provider sim)
  ↓
Day 6 (Tailwind + API client + submission form)
  ↓
Day 7 (Job list + detail pages with polling)
  ↓
Day 8 (Error handling + loading states + E2E test)
  ↓
Day 9 (Docs + test coverage + cleanup)
```

Strictly sequential. Each day builds on the previous.

---

### Key Technical Decisions

1. **Client components with polling** — Use `"use client"` with `useEffect` + `setInterval` for status polling. Simpler than server components for this use case.
2. **Next.js rewrites for API proxy** — `/api/*` → `http://localhost:4000/*`. Avoids CORS in dev. CORS still registered on API for production.
3. **No form library** — `useState` for form state. The form isn't complex enough to warrant Formik/react-hook-form.
4. **Error info in `outputAssets` JSON** — Store `{ error: "..." }` on failure rather than adding a Prisma migration. Keeps schema stable.
5. **Raw Tailwind** — No shadcn/ui for MVP. Can be layered on later without architectural changes.

---

### MVP Verification

After Day 9, the following should all pass:

```bash
pnpm infra:up                   # Postgres + Redis running
pnpm dev                        # All 3 services start
pnpm test                       # All tests pass (target: 15+ tests)
pnpm typecheck                  # No type errors
```

Manual verification:

1. Open `http://localhost:3000/render/new`
2. Fill in project ID, add a scene with a shot (prompt + duration)
3. Submit → redirected to `/render/[id]`
4. Watch status: QUEUED → RUNNING → UPLOADING → COMPLETE (within ~5s)
5. See output asset link on completion
6. Navigate to `/render` — job appears in list with green COMPLETE badge
7. Submit invalid data → see validation errors inline

---
---

## Part 2 — Post-MVP: Production Deployment

> **Precondition:** Do not start until Part 1 MVP definition of done is met.

### Phase 1 — Production Dockerfiles (~1 day)

The existing Dockerfiles are placeholders. Replace them with real multi-stage builds.

| Service       | What it needs                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`    | Multi-stage: `pnpm install --frozen-lockfile` → `pnpm build --filter @studioworks/api` → slim runtime image with `node dist/index.js` |
| `apps/worker` | Same pattern. Worker entry point instead of API                                                                                       |
| `apps/web`    | `next build` → standalone output mode (`output: 'standalone'` in `next.config.mjs`) → slim image running `node server.js`             |

All three images share a base stage that installs workspace deps via pnpm, then diverge for per-service builds. Prisma `generate` runs at build time.

**Key files:** `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile` (new), `next.config.mjs`

### Phase 2 — Managed Services on Railway/Render (~1 day)

Provision managed infrastructure — no self-hosting Postgres or Redis.

| Concern  | Service                                                                            |
| -------- | ---------------------------------------------------------------------------------- |
| Postgres | Railway Postgres plugin or Render Managed PostgreSQL                               |
| Redis    | Railway Redis plugin or Render private Redis                                       |
| S3       | AWS S3 bucket (both platforms can talk to AWS) or Cloudflare R2 for cheaper egress |

Each service gets injected env vars (`DATABASE_URL`, `REDIS_URL`, `AWS_*`) via the platform's secrets/environment config. No `.env` files in production.

**Migration strategy:** Run `prisma migrate deploy` as a deploy hook or one-off command before the API starts — never `migrate dev` in production.

### Phase 3 — Deploy the Three Services (~1 day)

| Service       | Type              | Port | Notes                                                                               |
| ------------- | ----------------- | ---- | ----------------------------------------------------------------------------------- |
| `apps/web`    | Web service       | 3000 | Custom domain, serves the frontend. `NEXT_PUBLIC_API_URL` points to the API service |
| `apps/api`    | Web service       | 4000 | Internal or public URL. Health check: `GET /health` (add a simple route)            |
| `apps/worker` | Background worker | none | No port exposed. Connects to same Postgres + Redis as API                           |

**Deploy trigger:** Push to `main` → platform auto-builds from Dockerfile → deploys.

### Phase 4 — Auth (NextAuth / Auth.js) (~2 days)

1. Add `User` model to Prisma schema, run migration
2. Configure NextAuth with a provider (GitHub OAuth is simplest to start)
3. Protect API routes — check session/token at route level
4. Associate `RenderJob` with a `userId`
5. Filter queries: users only see their own jobs
6. Frontend: login/logout, redirect unauthenticated users

**Key files:** `packages/db/prisma/schema.prisma`, `apps/web/src/lib/auth.ts`, `apps/api/src/middleware/auth.ts` (new), API route handlers

### Phase 5 — Real S3 Integration (~1 day)

1. Create an S3 bucket (or R2) with a CORS policy allowing browser uploads
2. API generates presigned PUT URLs — frontend uploads directly to S3 (never proxy through API)
3. Worker writes output assets to S3, stores only the S3 key in `outputAssets`
4. Frontend generates presigned GET URLs or uses a CloudFront/public bucket for reads
5. Validate file type + size with Zod before issuing presigned URLs

**Key files:** `apps/api/src/s3.ts` (new), provider adapter, processor

### Phase 6 — CI/CD Pipeline (~1 day)

| Step                     | Tool                       | What it does                                                  |
| ------------------------ | -------------------------- | ------------------------------------------------------------- |
| Lint + typecheck         | GitHub Actions             | `pnpm lint && pnpm typecheck` on every PR                     |
| Unit + integration tests | GitHub Actions             | `pnpm test` — Testcontainers spin up ephemeral Postgres/Redis |
| Build check              | GitHub Actions             | `pnpm build` — ensures all services compile                   |
| Deploy                   | Railway/Render auto-deploy | Merge to `main` → auto-deploy all services                    |

**Key files:** `.github/workflows/ci.yml` (new), `infra/ci/`

### Phase 7 — Observability + Hardening (ongoing)

- **Health checks:** `GET /health` on API (checks DB + Redis connectivity), worker heartbeat
- **Logging:** Structured JSON logs (pino via Fastify's built-in logger) → platform log drain
- **Error tracking:** Sentry or similar — catch unhandled exceptions in all three services
- **Rate limiting:** `@fastify/rate-limit` on public API endpoints
- **HTTPS:** Handled by Railway/Render's edge — no manual cert management

### Deployment Dependency Chain

```
Phase 1 (Dockerfiles)
  ↓
Phase 2 (Managed Postgres + Redis + S3 bucket)
  ↓
Phase 3 (Deploy services — live URL with mock provider, no auth)
  ↓
Phase 4 (Auth) + Phase 5 (Real S3) — can be parallel
  ↓
Phase 6 (CI/CD)
  ↓
Phase 7 (Observability — ongoing)
```

### Cost Estimate (Railway)

| Resource              | Estimated monthly cost   |
| --------------------- | ------------------------ |
| Web service (Next.js) | ~$5 (hobby)              |
| API service (Fastify) | ~$5 (hobby)              |
| Worker service        | ~$5 (hobby)              |
| Postgres (1 GB)       | ~$5                      |
| Redis (25 MB)         | ~$0 (included)           |
| S3 / R2 storage       | ~$1–5 depending on usage |
| **Total**             | **~$20–25/month**        |

---
---

## Part 3 — Post-MVP: Data Model & Polish

> **Precondition:** Do not start until Part 1 MVP is complete and stable.
> These are quality/scale improvements — not blockers for a working product.

### Current State (at MVP completion)

- **Prisma schema** has a single model: `RenderJob` with `id`, `status`, `spec` (Json), `outputAssets` (Json?), timestamps.
- **RenderSpec** is a flat Zod schema: `{ projectId: string, scenes: [{ id, shots: [{ id, prompt, durationSeconds }] }] }`.
- `projectId` is an opaque string — no foreign key, no Project table.
- Scenes/shots exist only inside the `spec` JSON blob — no relational records.
- No User model — auth is deferred but the model belongs here so auth (Part 2 Phase 4) can attach to it without another migration.
- Redis connection strings are independently hardcoded in `apps/api/src/queue.ts` and `apps/worker/src/worker.ts`.
- No spec deduplication — identical specs create separate jobs every time.

---

### Phase 1 — Shared Redis Connection Helper (~1 hour)

**Goal:** Single source of truth for Redis connection config across API and worker.

| # | Task | File(s) | Detail |
|---|---|---|---|
| 1.1 | Add `getRedisConnection()` to `@studioworks/shared` | `packages/shared/src/redis.ts` | Export a function returning `{ url: string }` from `process.env.REDIS_URL` with `redis://localhost:6379` fallback. No IORedis instance — just config, so the package stays dependency-light. |
| 1.2 | Re-export from barrel | `packages/shared/src/index.ts` | `export { getRedisConnection } from './redis.js'` |
| 1.3 | Consume in API queue | `apps/api/src/queue.ts` | Replace inline `{ url: process.env.REDIS_URL ?? '...' }` with `getRedisConnection()` |
| 1.4 | Consume in worker | `apps/worker/src/worker.ts` | Same replacement |
| 1.5 | Build shared package | — | `pnpm build --filter @studioworks/shared` |
| 1.6 | Run existing tests | — | `pnpm test` — nothing should break |
| 1.7 | Commit | — | — |

**Why a function returning config, not an IORedis instance?**
BullMQ manages its own connections internally. Passing a shared IORedis instance causes lifecycle issues (premature `.quit()`). A config-only helper avoids that while still centralizing the connection string.

---

### Phase 2 — User & Project Models (~2–3 hours)

**Goal:** Add `User` and `Project` tables. Wire `RenderJob.projectId` as a real FK. Keep auth out of scope — the User model exists so auth (Part 2 Phase 4) can attach to it without another migration.

#### 2A — Prisma Schema Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 2A.1 | Add `User` model | `packages/db/prisma/schema.prisma` | `id` (uuid), `email` (unique), `name` (optional), timestamps. No password field — auth will use OAuth. |
| 2A.2 | Add `Project` model | `packages/db/prisma/schema.prisma` | `id` (uuid), `name`, `userId` (FK → User), timestamps. |
| 2A.3 | Add relations | `packages/db/prisma/schema.prisma` | `User` has many `Project`s. `Project` has many `RenderJob`s. `RenderJob` gets `projectId` (FK → Project, **optional** for backward compat with existing jobs). |
| 2A.4 | Generate migration | — | `pnpm --filter @studioworks/db db:migrate` with descriptive name |
| 2A.5 | Regenerate client | — | `pnpm --filter @studioworks/db db:generate` |
| 2A.6 | Export new types | `packages/db/src/index.ts` | Add `User`, `Project` to the type re-exports |

**Schema sketch:**

```prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?
  projects  Project[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Project {
  id         String      @id @default(uuid())
  name       String
  user       User        @relation(fields: [userId], references: [id])
  userId     String
  renderJobs RenderJob[]
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
}

model RenderJob {
  id           String          @id @default(uuid())
  status       RenderJobStatus @default(QUEUED)
  spec         Json
  specHash     String?         // Phase 4 — deterministic hash for dedup
  outputAssets Json?
  project      Project?        @relation(fields: [projectId], references: [id])
  projectId    String?         // optional — existing jobs have no project FK
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([projectId])
  @@index([specHash])
}
```

#### 2B — API Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 2B.1 | Update `POST /render-jobs` | `apps/api/src/app.ts` | If `projectId` in the validated spec corresponds to a real Project record, set the FK. If not found, still allow creation (backward compat) but log a warning. |
| 2B.2 | Add `GET /projects` | `apps/api/src/app.ts` | List projects with cursor pagination. Select `id`, `name`, `createdAt`. |
| 2B.3 | Add `GET /projects/:id` | `apps/api/src/app.ts` | Project detail with recent render jobs (last 10). |
| 2B.4 | Add `POST /projects` | `apps/api/src/app.ts` | Create a project. Body: `{ name: string }`. No userId yet (no auth) — use a hardcoded placeholder userId or make userId optional until auth lands. |
| 2B.5 | Define shared types | `packages/shared/src/index.ts` | `ProjectListItem`, `ProjectDetail` types |
| 2B.6 | Tests | `apps/api/` | CRUD tests for project endpoints, updated render-job tests verifying FK behavior |

#### 2C — Frontend Changes (minimal)

| # | Task | File(s) | Detail |
|---|---|---|---|
| 2C.1 | Update render submission form | `apps/web/src/app/render/new/page.tsx` | Replace free-text `projectId` input with a dropdown that fetches from `GET /projects`. Keep free-text as fallback if no projects exist. |
| 2C.2 | Add API client functions | `apps/web/src/lib/api.ts` | `listProjects()`, `createProject()` |
| 2C.3 | Commit | — | — |

---

### Phase 3 — Scene, Shot & Asset Models (~2–3 hours)

**Goal:** Promote scenes and shots from JSON-embedded arrays to first-class Prisma records. Add an Asset model for output files.

#### 3A — Prisma Schema Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 3A.1 | Add `Scene` model | `packages/db/prisma/schema.prisma` | `id` (uuid), `projectId` (FK → Project), `order` (Int), timestamps. |
| 3A.2 | Add `Shot` model | `packages/db/prisma/schema.prisma` | `id` (uuid), `sceneId` (FK → Scene), `prompt` (text), `durationSeconds` (Float), `order` (Int), timestamps. |
| 3A.3 | Add `Asset` model | `packages/db/prisma/schema.prisma` | `id` (uuid), `renderJobId` (FK → RenderJob), `s3Key` (string), `fileType` (string), `sizeBytes` (BigInt?), timestamps. Replaces the `outputAssets` JSON blob with structured records. |
| 3A.4 | Add relations | `packages/db/prisma/schema.prisma` | Project → Scene[], Scene → Shot[], RenderJob → Asset[] |
| 3A.5 | Generate migration | — | — |
| 3A.6 | Export new types | `packages/db/src/index.ts` | Add `Scene`, `Shot`, `Asset` |

**Schema sketch:**

```prisma
model Scene {
  id        String   @id @default(uuid())
  project   Project  @relation(fields: [projectId], references: [id])
  projectId String
  order     Int
  shots     Shot[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
}

model Shot {
  id              String   @id @default(uuid())
  scene           Scene    @relation(fields: [sceneId], references: [id])
  sceneId         String
  prompt          String
  durationSeconds Float
  order           Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([sceneId])
}

model Asset {
  id          String    @id @default(uuid())
  renderJob   RenderJob @relation(fields: [renderJobId], references: [id])
  renderJobId String
  s3Key       String
  fileType    String
  sizeBytes   BigInt?
  createdAt   DateTime  @default(now())

  @@index([renderJobId])
}
```

#### 3B — Worker Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 3B.1 | Update processor to write Asset records | `apps/worker/src/processor.ts` | On COMPLETE, create an `Asset` record instead of (or in addition to) writing to `outputAssets` JSON. Keep `outputAssets` populated for backward compat during transition. |
| 3B.2 | Update provider adapter return type | `apps/worker/src/providers/adapter.ts` | Return `{ s3Key: string, fileType: string, sizeBytes?: number }` instead of `void` |

#### 3C — API Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 3C.1 | Add scene/shot CRUD under projects | `apps/api/src/app.ts` | `POST /projects/:id/scenes`, `GET /projects/:id/scenes`, etc. Scenes contain shots. |
| 3C.2 | Update job detail to include Asset records | `apps/api/src/app.ts` | `GET /render-jobs/:id` includes related `assets` |
| 3C.3 | Define shared types | `packages/shared/src/index.ts` | `SceneRecord`, `ShotRecord`, `AssetRecord` types (distinct from the Zod spec types `Scene`/`Shot`) |
| 3C.4 | Tests | `apps/api/` | CRUD tests for scenes/shots, asset inclusion in job detail |
| 3C.5 | Commit | — | — |

#### 3D — RenderSpec Evolution (decision point)

**Option A — Keep inline (recommended):**
- RenderSpec stays self-contained and immutable
- Scenes/shots in DB are the "library" — the spec snapshots them at submission time
- No risk of spec meaning changing if a Shot record is later edited

**Option B — Reference by ID:**
- Spec becomes `{ projectId, sceneIds: [uuid] }` — worker resolves at execution time
- Simpler spec, but breaks immutability (editing a Shot changes what the spec means)

**Recommendation:** Option A. The spec is an immutable snapshot. Scene/Shot records in the DB are the editable source material. The submission form reads from the DB records and embeds them into the spec at submit time.

---

### Phase 4 — Deterministic Spec Hashing (~1–2 hours)

**Goal:** SHA-256 hash of the canonical RenderSpec JSON, stored as `specHash` on `RenderJob`. Enables deduplication: if an identical spec was already rendered successfully, the API can return the existing job instead of creating a new one.

| # | Task | File(s) | Detail |
|---|---|---|---|
| 4.1 | Add `hashRenderSpec()` to shared | `packages/shared/src/hash.ts` | Accepts a `RenderSpec`, deterministically serializes it (sorted keys via `JSON.stringify` with replacer, or a canonical JSON lib), returns SHA-256 hex string. |
| 4.2 | Re-export from barrel | `packages/shared/src/index.ts` | `export { hashRenderSpec } from './hash.js'` |
| 4.3 | Unit tests for hash stability | `packages/shared/src/hash.test.ts` | Same spec → same hash. Reordered keys → same hash. Different spec → different hash. |
| 4.4 | Compute hash on job creation | `apps/api/src/app.ts` | In `POST /render-jobs`, call `hashRenderSpec(spec)`, store in `specHash` column. |
| 4.5 | Add dedup check (optional, behind flag) | `apps/api/src/app.ts` | Before creating a new job, query for existing COMPLETE job with same `specHash`. If found, return it with `{ deduplicated: true }` instead of creating a new job. Controlled by `ENABLE_SPEC_DEDUP=true`. |
| 4.6 | Tests | `apps/api/` | Test hash is stored, test dedup returns existing job, test dedup is skipped when disabled |
| 4.7 | Build shared | — | `pnpm build --filter @studioworks/shared` |
| 4.8 | Commit | — | — |

**Dedup semantics:**
- Only dedup against `COMPLETE` jobs — never return a FAILED or in-progress job as a dedup hit
- New env var: `ENABLE_SPEC_DEDUP` — add to env vars table in `infrastructure.md`

**Hashing note:** The naive `Object.keys().sort()` only sorts top-level keys. For deep sorting, a purpose-built serializer that walks `projectId → scenes (sorted by id) → shots (sorted by id)` is more reliable than generic key sorting. Pin the approach — changing it requires a migration to rehash existing records.

---

### Phase 5 — Integration & Cleanup (~1 hour)

| # | Task | File(s) | Detail |
|---|---|---|---|
| 5.1 | Run full test suite | — | `pnpm test` — all existing + new tests pass |
| 5.2 | Type check | — | `pnpm typecheck` — no errors, no `any` |
| 5.3 | Update `source-map.md` | `.claude/rules/source-map.md` | Add new files: `packages/shared/src/redis.ts`, `packages/shared/src/hash.ts`, new Prisma models |
| 5.4 | Update `infrastructure.md` env vars | `.claude/rules/infrastructure.md` | Add `ENABLE_SPEC_DEDUP` |
| 5.5 | Update `docs/ARCHITECTURE.md` | `docs/ARCHITECTURE.md` | Document relational model, hashing strategy, dedup behavior |
| 5.6 | Final commit | — | — |

---

### Part 3 Dependency Chain

```
Phase 1 (Shared Redis helper)          — independent, can start anytime
Phase 2 (User & Project models)        — independent of Phase 1
Phase 3 (Scene, Shot, Asset models)    — depends on Phase 2 (needs Project)
Phase 4 (Deterministic hashing)        — depends on Phase 2 (needs specHash column)
Phase 5 (Integration & cleanup)        — depends on all above
```

```
Phase 1 ─────────────────────────┐
                                 ├──→ Phase 5
Phase 2 ──┬──→ Phase 3 ─────────┤
          └──→ Phase 4 ─────────┘
```

### Part 3 Estimated Effort

| Phase | Estimate |
|---|---|
| Phase 1 — Shared Redis | ~1 hour |
| Phase 2 — User & Project | ~2–3 hours |
| Phase 3 — Scene, Shot, Asset | ~2–3 hours |
| Phase 4 — Deterministic hashing | ~1–2 hours |
| Phase 5 — Integration & cleanup | ~1 hour |
| **Total** | **~7–10 hours** |

### Risk Notes

1. **Migration on existing data:** Phase 2 adds an optional `projectId` FK to `RenderJob`. Existing rows will have `projectId = null`. Safe — no data loss, no NOT NULL constraint.
2. **RenderSpec backward compat:** The Zod schema doesn't change. `projectId` in the spec remains a string. The FK is a separate column resolved at creation time.
3. **Asset vs outputAssets transition:** Phase 3 introduces `Asset` records alongside the existing `outputAssets` JSON blob. Both are populated during transition. A future cleanup migration can drop `outputAssets` once all consumers read from `Asset` records.
4. **Hash stability:** Using `node:crypto` SHA-256 with canonical JSON serialization is stable across Node.js versions. Never change the serialization approach without a migration to rehash existing records.
