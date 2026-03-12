# PLAN.md — StudioWorks MVP Build Plan (Refined)

## Context

StudioWorks is a TypeScript monorepo for AI video rendering. The core pipeline (API → queue → worker) is built and tested, but there's no working frontend, no GET endpoints, and no way to observe the render lifecycle from a browser. This plan completes the MVP: **a user can submit a render from a UI, watch status updates, and see results.**

The original 9-day plan had Days 1–4 mostly complete but included work items (User/Project/Scene/Shot/Asset models, deterministic hashing, shared Redis helper) that aren't needed for the MVP render loop. This refined plan drops those, keeps the day-based structure, and redistributes remaining work into Days 5–9.

**Scope:** MVP render pipeline only. No auth, no studio module, no real S3, no relational project hierarchy.

**Definition of done:** Submit a render from `/render/new` → watch it transition QUEUED → RUNNING → UPLOADING → COMPLETE on `/render/[id]` → see output asset link.

---

## Days 1–4: COMPLETE

### Day 1 — Monorepo and Local Infra ✓

~~All tasks done. pnpm workspace, Turbo, TypeScript, Docker Compose, package scaffolds, infra scripts.~~

### Day 2 — Prisma Schema ✓ (MVP scope)

~~RenderJob model + RenderJobStatus enum. Initial migration applied. PrismaClient singleton exported.~~

- **Deferred:** User, Project, Scene, Shot, Asset models — not needed for MVP (projectId is a string in spec JSON; scenes/shots live inside the RenderSpec JSON blob).

### Day 3 — RenderSpec Contract ✓ (MVP scope)

~~Zod schemas (Shot, Scene, RenderSpec) defined and exported. 3 tests passing.~~

- **Deferred:** Sample payloads file, deterministic hash helper.

### Day 4 — Queue Wiring ✓ (MVP scope + ahead of schedule)

~~BullMQ producer (API) and consumer (worker) connected. Additionally completed:~~

- `POST /render-jobs` endpoint (validate → persist → enqueue by ID)
- `processRenderJob` state machine (QUEUED → RUNNING → UPLOADING → COMPLETE/FAILED)
- Provider adapter stub
- 9 tests passing across shared, API, and worker

---

## Day 5 — API Read Endpoints + Provider Simulation (~3–4 hours)

**Goal:** Give the frontend everything it needs to display job data.

| #   | Task                                                                                                 | Time   | File(s)                                                                | Functions / Classes                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Register `@fastify/cors` (already a dependency, never called)                                        | 15 min | `apps/api/src/app.ts`                                                  | modify `buildApp()` — call `app.register(cors)` before routes                                                                           |
| 5.2 | `GET /render-jobs` — list jobs, `select` only id/status/createdAt/updatedAt, cursor-based pagination | 45 min | `apps/api/src/app.ts`                                                  | modify `buildApp()` — add `GET /render-jobs` route handler (inline)                                                                     |
| 5.3 | `GET /render-jobs/:id` — full job detail, 404 if not found                                           | 30 min | `apps/api/src/app.ts`                                                  | modify `buildApp()` — add `GET /render-jobs/:id` route handler (inline)                                                                 |
| 5.4 | Define shared response types (`RenderJobListItem`, `RenderJobDetail`) in `@studioworks/shared`       | 30 min | `packages/shared/src/index.ts`                                         | add exported types `RenderJobListItem`, `RenderJobDetail` (new)                                                                         |
| 5.5 | Upgrade provider adapter: add 3–5s delay to simulate work, return mock output asset URL              | 30 min | `apps/worker/src/providers/adapter.ts`, `apps/worker/src/processor.ts` | modify `providerAdapter.render()` — add delay + return mock URL; modify `processRenderJob()` — persist returned URL into `outputAssets` |
| 5.6 | Tests for GET endpoints (list, detail, 404, pagination)                                              | 45 min | `apps/api/src/routes/render-jobs.test.ts`                              | new test suite calling `buildApp()` — tests for list, detail, 404, cursor pagination                                                    |
| 5.7 | Create `docs/RENDER_PIPELINE.md` (state machine, data flow, gotchas)                                 | 30 min | `docs/RENDER_PIPELINE.md`                                              | —                                                                                                                                       |
| 5.8 | Commit                                                                                               | 5 min  | —                                                                      | —                                                                                                                                       |

**End-of-day state:** API serves list + detail. Worker produces visible output. Frontend work can begin.

---

## Day 6 — Frontend Setup + Render Submission Form (~3–4 hours)

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

## Day 7 — Job List + Job Detail Pages (~3–4 hours)

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

## Day 8 — Error Handling + Polish + E2E Verification (~3–4 hours)

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

## Day 9 — Docs + Test Coverage + Hardening (~3–4 hours)

**Depends on:** Day 8 (stable flow)

| #   | Task                                                                             | Time   | File(s)            | Functions / Classes                                                                                                   |
| --- | -------------------------------------------------------------------------------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 9.1 | Create/update docs: `ARCHITECTURE.md`, `LOCAL_DEV.md`, `DEPLOYMENT_PLAN.md`      | 1 hr   | `docs/`            | —                                                                                                                     |
| 9.2 | Review and fill test gaps across API, worker, and frontend                       | 1 hr   | Various test files | audit tests covering `buildApp()`, `processRenderJob()`, `providerAdapter.render()`, `RenderPage`, `RenderDetailPage` |
| 9.3 | Run `pnpm typecheck` — fix any type errors, ensure no `any`                      | 30 min | —                  | touch any function or type with errors as discovered                                                                  |
| 9.4 | Clean up: unused imports, stray `console.log`, verify `select` in Prisma queries | 30 min | —                  | audit `buildApp()`, `processRenderJob()`, `providerAdapter.render()` for leftover debug output and missing `select`   |
| 9.5 | Update root `README.md` with accurate quick-start and doc links                  | 15 min | `README.md`        | —                                                                                                                     |
| 9.6 | Final commit: "MVP definition of done met"                                       | 5 min  | —                  | —                                                                                                                     |

**End-of-day state:** MVP complete. Render pipeline works end-to-end from browser. Code is clean, typed, tested, documented.

---

## Deferred Items (Post-MVP)

These were in the original plan but are explicitly out of scope for MVP:

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

## Dependency Chain

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

## Key Technical Decisions

1. **Client components with polling** — Use `"use client"` with `useEffect` + `setInterval` for status polling. Simpler than server components for this use case.
2. **Next.js rewrites for API proxy** — `/api/*` → `http://localhost:4000/*`. Avoids CORS in dev. CORS still registered on API for production.
3. **No form library** — `useState` for form state. The form isn't complex enough to warrant Formik/react-hook-form.
4. **Error info in `outputAssets` JSON** — Store `{ error: "..." }` on failure rather than adding a Prisma migration. Keeps schema stable.
5. **Raw Tailwind** — No shadcn/ui for MVP. Can be layered on later without architectural changes.

---

## Verification

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

## Post-MVP: Production Deployment Roadmap (Railway / Render)

> Broad strokes only. Each phase becomes its own detailed plan when the time comes.

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

Each app deploys as a separate Railway service (or Render web service / background worker):

| Service       | Type              | Port | Notes                                                                               |
| ------------- | ----------------- | ---- | ----------------------------------------------------------------------------------- |
| `apps/web`    | Web service       | 3000 | Custom domain, serves the frontend. `NEXT_PUBLIC_API_URL` points to the API service |
| `apps/api`    | Web service       | 4000 | Internal or public URL. Health check: `GET /health` (add a simple route)            |
| `apps/worker` | Background worker | none | No port exposed. Connects to same Postgres + Redis as API                           |

**Networking:** On Railway, services in the same project communicate over private networking. The web frontend calls the API via its public URL (or private URL if both are on Railway). The Next.js rewrite proxy (`/api/*` → API) works if the API is reachable at build/runtime.

**Deploy trigger:** Push to `main` → platform auto-builds from Dockerfile → deploys.

### Phase 4 — Auth (NextAuth / Auth.js) (~2 days)

Required before going truly public. Add to the MVP:

1. Add `User` model to Prisma schema, run migration
2. Configure NextAuth with a provider (GitHub OAuth is simplest to start)
3. Protect API routes — check session/token at route level
4. Associate `RenderJob` with a `userId`
5. Filter queries: users only see their own jobs
6. Frontend: login/logout, redirect unauthenticated users

**Key files:** `packages/db/prisma/schema.prisma`, `apps/web/src/lib/auth.ts`, `apps/api/src/middleware/auth.ts` (new), API route handlers

### Phase 5 — Real S3 Integration (~1 day)

Replace the mock output URL with actual file storage:

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

### Production Deployment Dependency Chain

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

Railway's hobby plan ($5/month) includes $5 of usage per service. Render has a free tier for web services but background workers require a paid plan.
