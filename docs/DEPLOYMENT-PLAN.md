# StudioWorks Deployment Plan

## Current State (Local Dev Only)

MVP pipeline (API → queue → worker) is implemented and tested. The frontend is in progress (Days 5–9 of `PLAN.md`). No production deployment exists yet.

**Local development:**

```bash
pnpm infra:up   # starts Postgres (5432) + Redis (6379) via Docker Compose
pnpm dev        # runs web (3000), api (4000), worker concurrently
```

See `LOCAL-DEV.md` for full setup instructions.

---

## Post-MVP Deployment Roadmap

Detailed phase plan lives in `PLAN.md` under **"Post-MVP: Production Deployment Roadmap"**. Summary:

| Phase | Work | ~Time |
|---|---|---|
| 1 | Production Dockerfiles — multi-stage builds for API, worker, web | 1 day |
| 2 | Managed services — Railway/Render Postgres, Redis; AWS S3 or Cloudflare R2 | 1 day |
| 3 | Deploy three services — web (3000), api (4000), worker (no port) | 1 day |
| 4 | Auth — NextAuth/Auth.js, User model, protect API routes | 2 days |
| 5 | Real S3 integration — presigned PUT URLs, worker writes output keys | 1 day |
| 6 | CI/CD — GitHub Actions: lint, typecheck, test, build on PR; auto-deploy on merge to main | 1 day |
| 7 | Observability — structured logging (pino), health checks, error tracking (Sentry), rate limiting | ongoing |

**Phases 4 and 5 can run in parallel after Phase 3 is live.**

Target platform: Railway (preferred) or Render. Cost estimate: ~$20–25/month on Railway hobby plan.

---

## Prerequisites Before Phase 1

- [ ] Days 5–9 of MVP plan complete (frontend, GET endpoints, error handling)
- [ ] All tests passing (`pnpm test`)
- [ ] No type errors (`pnpm typecheck`)
- [ ] E2E flow manually verified end-to-end in local dev
