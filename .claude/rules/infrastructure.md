# Infrastructure

| Concern | Technology |
|---|---|
| Primary database | Postgres |
| Job queue | Redis (BullMQ) |
| File storage | S3 (AWS SDK v3) — presigned PUT URLs, never proxy through a service |
| Local dev | Docker Compose (`docker/compose.dev.yml`) |
| Container builds | Dockerfiles in `apps/api/` and `apps/worker/` |
| Future production | Kubernetes + Terraform (`infra/`) |

## Local Development

```bash
pnpm install
cp .env.example .env                                     # default values work with Docker Compose
pnpm infra:up                                            # starts Postgres (5432) + Redis (6379)
pnpm --filter @studioworks/db db:migrate:deploy          # apply migrations (first-time only)
pnpm dev                                                 # runs web (3000), api (4000), worker
```

Infrastructure commands: `pnpm infra:up / infra:down / infra:logs / infra:reset`

Full setup: `docs/LOCAL-DEV.md`

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
