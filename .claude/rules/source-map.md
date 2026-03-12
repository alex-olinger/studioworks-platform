# Source File Map

Read this before grepping. These are the files that matter.

## `packages/shared`
| File | Purpose |
|---|---|
| `render-spec.ts` | Zod schema for `RenderSpec` — canonical cross-service contract (package root, not `src/`) |
| `src/index.ts` | Re-exports schema types and `RENDER_QUEUE_NAME` constant |

## `packages/db`
| File | Purpose |
|---|---|
| `src/index.ts` | Exports `db` — the shared PrismaClient singleton |
| `prisma/schema.prisma` | DB schema source of truth |
| `prisma/migrations/` | Generated migration files — never edit manually |

## `apps/api`
| File | Purpose |
|---|---|
| `src/index.ts` | Server entry point, listens on port 4000 |
| `src/app.ts` | Fastify app — `POST /render-jobs` validates spec, persists job, enqueues by ID |
| `src/queue.ts` | BullMQ `Queue` instance connected to Redis |

## `apps/worker`
| File | Purpose |
|---|---|
| `src/worker.ts` | BullMQ Worker entry point — dequeues `renderJobId`, calls processor |
| `src/processor.ts` | `processRenderJob` — drives state machine (`QUEUED → RUNNING → UPLOADING → COMPLETE / FAILED`) |
| `src/providers/adapter.ts` | Provider adapter stub — wraps render API call, swappable without touching queue logic |

## `apps/web`
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

## `packages/shared` — studio
| File | Purpose |
|---|---|
| `src/studio/index.ts` | Placeholder for future studio types — `PromptTemplate`, `CommercialScript`, `Storyboard`, `Client` |

## `tasks/`
| File | Purpose |
|---|---|
| `tasks/todo.md` | Active plan for the current task — checkable items, updated in place as work progresses |
| `tasks/lessons.md` | Running log of corrections and rules derived from them — review at session start |
