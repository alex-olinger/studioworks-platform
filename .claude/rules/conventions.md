# Conventions

## TypeScript
- Strict mode enabled project-wide — never weaken `tsconfig.json`
- All inter-service data shapes defined in `@studioworks/shared`, not inline within a service
- Avoid `any` — prefer `unknown` with runtime Zod parsing at service boundaries

## Schema & Validation
- All API endpoints must validate request bodies and params with Zod — never skip
- Zod errors surface as structured 400 responses, not unhandled exceptions

## Fastify API Routes (`apps/api`)
- Define request/response types in `@studioworks/shared` if shared across services
- Validate all request bodies and params with Zod
- Return structured error responses — never raw exceptions or stack traces
- Auth checked at route level before any DB access

## Worker / Queue
- Provider adapters are isolated modules in `apps/worker/src/providers/`
- Swapping or adding a provider must not require changes to queue logic or `apps/api`/`apps/web`
- Every job handler: try/catch, log job ID at start and end, throw on failure (BullMQ handles retries)
- Use `job.updateProgress()` for long-running jobs

## Database
- All schema changes go through Prisma migrations — no raw DDL
- Never import `@prisma/client` directly in `apps/` — always through `@studioworks/db`
- `RenderJob` records are append-only — never mutate a persisted spec
- Always use `select` in Prisma queries — never return full objects unless every field is needed
- Cursor-based pagination only — no OFFSET
- Multi-step writes: `prisma.$transaction([])`

## S3 File Storage
- Generate presigned PUT URLs server-side — upload client-side directly to S3
- Never stream file uploads through `apps/api` or `apps/web`
- Validate file type and size with Zod before issuing presigned URL
- Store only the S3 key in the DB, never the full URL
- Key pattern: `{entity}/{userId}/{uuid}.{ext}`

## Testing
- Test runner: **Vitest** with root workspace config (`vitest.workspace.ts`) covering all packages and apps
- Integration tests (`apps/api`, `apps/worker`, `packages/db`): Testcontainers for real Postgres/Redis per suite
- Apply migrations in tests with `pnpm --filter @studioworks/db db:migrate:deploy` (non-interactive — not `db:migrate`)
- Web tests (`apps/web`): jsdom + MSW for API mocking — no direct DB or Redis access
- DB access in tests: `@studioworks/db` — never `@prisma/client`
- `afterEach` teardown deletes rows in FK-safe order to keep tests independent

## Commits & PRs
- Scope changes to a single service or package where possible
- Changes to `@studioworks/shared` or `@studioworks/db` must be called out explicitly in the PR description
