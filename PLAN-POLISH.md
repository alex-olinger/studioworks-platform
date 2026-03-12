# PLAN-POLISH.md — Post-MVP Polish: Data Model, Hashing & Shared Redis

## Context

PLAN.md explicitly deferred these items from the MVP:

| Item | Why deferred |
|---|---|
| User, Project, Scene, Shot, Asset Prisma models | No auth or project management UI in MVP |
| Deterministic spec hashing | Deduplication not needed for MVP |
| Shared Redis connection helper | Independent connections work fine at small scale |

This plan picks them up. The goal is to promote `projectId` from a bare string inside the `RenderSpec` JSON blob to a real relational model, add first-class User/Scene/Shot/Asset records, enable spec deduplication via content hashing, and eliminate duplicated Redis connection config.

**Precondition:** MVP (PLAN.md Days 5–9) is complete and stable before starting this work.

---

## Current State (what exists today)

- **Prisma schema** has a single model: `RenderJob` with `id`, `status`, `spec` (Json), `outputAssets` (Json?), timestamps.
- **RenderSpec** is a flat Zod schema: `{ projectId: string, scenes: [{ id, shots: [{ id, prompt, durationSeconds }] }] }`.
- `projectId` is an opaque string — no foreign key, no Project table.
- Scenes/shots exist only inside the `spec` JSON blob — no relational records.
- No User model — auth is deferred but the model belongs here so auth can reference it.
- Redis connection strings are independently hardcoded in `apps/api/src/queue.ts` and `apps/worker/src/worker.ts`.
- No spec deduplication — identical specs create separate jobs every time.

---

## Phase 1 — Shared Redis Connection Helper (~1 hour)

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

## Phase 2 — User & Project Models (~2–3 hours)

**Goal:** Add `User` and `Project` tables. Wire `RenderJob.projectId` as a real FK. Keep auth out of scope — the User model exists so auth (Phase 4 in PLAN.md post-MVP roadmap) can attach to it without another migration.

### 2A — Prisma Schema Changes

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
  specHash     String?         // Phase 3 — deterministic hash for dedup
  outputAssets Json?
  project      Project?        @relation(fields: [projectId], references: [id])
  projectId    String?         // optional — existing jobs have no project FK
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([projectId])
  @@index([specHash])
}
```

### 2B — API Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 2B.1 | Update `POST /render-jobs` | `apps/api/src/app.ts` | If `projectId` in the validated spec corresponds to a real Project record, set the FK. If not found, still allow creation (backward compat) but log a warning. |
| 2B.2 | Add `GET /projects` | `apps/api/src/app.ts` | List projects with cursor pagination. Select `id`, `name`, `createdAt`. |
| 2B.3 | Add `GET /projects/:id` | `apps/api/src/app.ts` | Project detail with recent render jobs (last 10). |
| 2B.4 | Add `POST /projects` | `apps/api/src/app.ts` | Create a project. Body: `{ name: string }`. No userId yet (no auth) — use a hardcoded placeholder userId or make userId optional until auth lands. |
| 2B.5 | Define shared types | `packages/shared/src/index.ts` | `ProjectListItem`, `ProjectDetail` types |
| 2B.6 | Tests | `apps/api/` | CRUD tests for project endpoints, updated render-job tests verifying FK behavior |

### 2C — Frontend Changes (minimal)

| # | Task | File(s) | Detail |
|---|---|---|---|
| 2C.1 | Update render submission form | `apps/web/src/app/render/new/page.tsx` | Replace free-text `projectId` input with a dropdown that fetches from `GET /projects`. Keep free-text as fallback if no projects exist. |
| 2C.2 | Add API client functions | `apps/web/src/lib/api.ts` | `listProjects()`, `createProject()` |
| 2C.3 | Commit | — | — |

---

## Phase 3 — Scene, Shot & Asset Models (~2–3 hours)

**Goal:** Promote scenes and shots from JSON-embedded arrays to first-class Prisma records. Add an Asset model for output files.

### 3A — Prisma Schema Changes

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

### 3B — Worker Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 3B.1 | Update processor to write Asset records | `apps/worker/src/processor.ts` | On COMPLETE, create an `Asset` record instead of (or in addition to) writing to `outputAssets` JSON. Keep `outputAssets` populated for backward compat during transition. |
| 3B.2 | Update provider adapter return type | `apps/worker/src/providers/adapter.ts` | Return `{ s3Key: string, fileType: string, sizeBytes?: number }` instead of `void` |

### 3C — API Changes

| # | Task | File(s) | Detail |
|---|---|---|---|
| 3C.1 | Add scene/shot CRUD under projects | `apps/api/src/app.ts` | `POST /projects/:id/scenes`, `GET /projects/:id/scenes`, etc. Scenes contain shots. |
| 3C.2 | Update job detail to include Asset records | `apps/api/src/app.ts` | `GET /render-jobs/:id` includes related `assets` |
| 3C.3 | Define shared types | `packages/shared/src/index.ts` | `SceneRecord`, `ShotRecord`, `AssetRecord` types (distinct from the Zod spec types `Scene`/`Shot`) |
| 3C.4 | Tests | `apps/api/` | CRUD tests for scenes/shots, asset inclusion in job detail |
| 3C.5 | Commit | — | — |

### 3D — RenderSpec Evolution (decision point)

**Question:** Should `RenderSpec` continue to embed inline scene/shot data, or should it reference Scene/Shot records by ID?

**Option A — Keep inline (recommended for now):**
- RenderSpec stays self-contained and immutable
- Scenes/shots in DB are the "library" — the spec snapshots them at submission time
- No risk of spec meaning changing if a Shot record is later edited

**Option B — Reference by ID:**
- Spec becomes `{ projectId, sceneIds: [uuid] }` — worker resolves at execution time
- Simpler spec, but breaks immutability (editing a Shot changes what the spec means)

**Recommendation:** Option A. The spec is an immutable snapshot. Scene/Shot records in the DB are the editable source material. The submission form reads from the DB records and embeds them into the spec at submit time.

---

## Phase 4 — Deterministic Spec Hashing (~1–2 hours)

**Goal:** SHA-256 hash of the canonical RenderSpec JSON, stored as `specHash` on `RenderJob`. Enables deduplication: if an identical spec was already rendered successfully, the API can return the existing job instead of creating a new one.

| # | Task | File(s) | Detail |
|---|---|---|---|
| 4.1 | Add `hashRenderSpec()` to shared | `packages/shared/src/hash.ts` | Accepts a `RenderSpec`, deterministically serializes it (sorted keys via `JSON.stringify` with replacer, or a canonical JSON lib), returns SHA-256 hex string. |
| 4.2 | Re-export from barrel | `packages/shared/src/index.ts` | `export { hashRenderSpec } from './hash.js'` |
| 4.3 | Unit tests for hash stability | `packages/shared/src/hash.test.ts` | Same spec → same hash. Reordered keys → same hash. Different spec → different hash. |
| 4.4 | Compute hash on job creation | `apps/api/src/app.ts` | In `POST /render-jobs`, call `hashRenderSpec(spec)`, store in `specHash` column. |
| 4.5 | Add dedup check (optional, behind flag) | `apps/api/src/app.ts` | Before creating a new job, query for existing COMPLETE job with same `specHash`. If found, return it with `{ deduplicated: true }` instead of creating a new job. Controlled by env var `ENABLE_SPEC_DEDUP=true`. |
| 4.6 | Tests | `apps/api/` | Test hash is stored, test dedup returns existing job, test dedup is skipped when disabled |
| 4.7 | Build shared | — | `pnpm build --filter @studioworks/shared` |
| 4.8 | Commit | — | — |

**Hashing implementation notes:**

```typescript
import { createHash } from 'node:crypto'
import type { RenderSpec } from '../render-spec.js'

export function hashRenderSpec(spec: RenderSpec): string {
  // Canonical JSON: sorted keys ensure identical specs produce identical hashes
  // regardless of property insertion order
  const canonical = JSON.stringify(spec, Object.keys(spec).sort())
  return createHash('sha256').update(canonical).digest('hex')
}
```

The naive `Object.keys().sort()` only sorts top-level keys. For deep sorting, use a recursive approach or a library like `fast-json-stable-stringify`. Given that `RenderSpec` has a known, fixed structure (Zod-validated), a purpose-built serializer that walks `projectId → scenes (sorted by id) → shots (sorted by id)` is more reliable than generic key sorting.

**Dedup semantics:**
- Only dedup against `COMPLETE` jobs — never return a FAILED or in-progress job as a dedup hit
- The caller receives the existing job ID and can poll its results
- New env var: `ENABLE_SPEC_DEDUP` — document in CLAUDE.md env var table

---

## Phase 5 — Integration & Cleanup (~1 hour)

| # | Task | File(s) | Detail |
|---|---|---|---|
| 5.1 | Run full test suite | — | `pnpm test` — all existing + new tests pass |
| 5.2 | Type check | — | `pnpm typecheck` — no errors, no `any` |
| 5.3 | Update `CLAUDE.md` Source File Map | `CLAUDE.md` | Add new files: `packages/shared/src/redis.ts`, `packages/shared/src/hash.ts`, new Prisma models |
| 5.4 | Update `CLAUDE.md` env vars table | `CLAUDE.md` | Add `ENABLE_SPEC_DEDUP` |
| 5.5 | Update `docs/ARCHITECTURE.md` | `docs/ARCHITECTURE.md` | Document relational model, hashing strategy, dedup behavior |
| 5.6 | Final commit | — | — |

---

## Dependency Chain

```
Phase 1 (Shared Redis helper)          — independent, can start anytime
Phase 2 (User & Project models)        — independent of Phase 1
Phase 3 (Scene, Shot, Asset models)    — depends on Phase 2 (needs Project)
Phase 4 (Deterministic hashing)        — depends on Phase 2 (needs specHash column, added in 2A)
Phase 5 (Integration & cleanup)        — depends on all above
```

Phases 1 and 2 can run in parallel. Phases 3 and 4 can run in parallel after Phase 2.

```
Phase 1 ─────────────────────────┐
                                 ├──→ Phase 5
Phase 2 ──┬──→ Phase 3 ─────────┤
          └──→ Phase 4 ─────────┘
```

---

## Estimated Total Effort

| Phase | Estimate |
|---|---|
| Phase 1 — Shared Redis | ~1 hour |
| Phase 2 — User & Project | ~2–3 hours |
| Phase 3 — Scene, Shot, Asset | ~2–3 hours |
| Phase 4 — Deterministic hashing | ~1–2 hours |
| Phase 5 — Integration & cleanup | ~1 hour |
| **Total** | **~7–10 hours** |

---

## Risk Notes

1. **Migration on existing data:** Phase 2 adds an optional `projectId` FK to `RenderJob`. Existing rows will have `projectId = null`. This is safe — no data loss, no NOT NULL constraint.
2. **RenderSpec backward compat:** The Zod schema doesn't change. `projectId` in the spec remains a string. The FK is a separate column resolved at creation time. Existing specs with arbitrary `projectId` strings continue to work.
3. **Asset vs outputAssets transition:** Phase 3 introduces `Asset` records alongside the existing `outputAssets` JSON blob. Both are populated during transition. A future cleanup migration can drop `outputAssets` once all consumers read from `Asset` records.
4. **Hash stability:** The hashing function must be deterministic across Node.js versions. Using `node:crypto` SHA-256 with canonical JSON serialization is stable. Pin the serialization approach and never change it without a migration to rehash existing records.
