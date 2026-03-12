# StudioWorks Local Development

## Prerequisites

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop)

---

## First-Time Setup

Run these once when cloning the repo for the first time.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Default values in `.env.example` work out of the box with the Docker Compose setup.

### 3. Start infrastructure

```bash
pnpm infra:up
```

Starts Postgres (port 5432) and Redis (port 6379) via Docker Compose.

### 4. Apply database migrations

```bash
pnpm --filter @studioworks/db db:migrate:deploy
```

Creates all tables in Postgres. Migrations live in `packages/db/prisma/migrations/`.

---

## Routine Dev Startup

Run these each time you start working.

### 1. Start infrastructure (if not already running)

```bash
pnpm infra:up
```

### 2. Start all services

```bash
pnpm dev
```

Runs all three services in parallel:

| Service | URL |
|---|---|
| `apps/web` | http://localhost:3000 |
| `apps/api` | http://localhost:4000 |
| `apps/worker` | (no HTTP — listens on Redis queue) |

---

## Database Tasks

### Create a new migration after changing `schema.prisma`

Use this when **you** edited `schema.prisma` and need the database to reflect those changes.

```bash
cd packages/db && node_modules/.bin/prisma migrate dev --name <migration-name>
```

Dev only — interactive. Generates a new SQL migration file, applies it to the DB, and regenerates the Prisma client.

### Regenerate the Prisma client after pulling someone else's schema changes

Use this when you pulled a commit that updated `schema.prisma` (and its migration was already applied to the DB). The schema and DB are already in sync — you just need your local TypeScript client to catch up.

```bash
pnpm --filter @studioworks/db db:generate
```

Reads `schema.prisma` and regenerates the TypeScript client — updated types, models, and query methods. Does not touch the database.

---

## Infrastructure Commands

```bash
pnpm infra:up      # start Postgres + Redis
pnpm infra:down    # stop containers
pnpm infra:logs    # tail container logs
pnpm infra:reset   # stop containers and wipe all data (destructive)
```
