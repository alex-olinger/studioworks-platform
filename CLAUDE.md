# CLAUDE.md — StudioWorks Platform

Operating rules are in `.claude/rules/`. Docs index is maintained here.

---

## Docs

> **Rule:** When a new doc is added to `docs/`, it must also be listed here. CLAUDE.md is the index — if it's not listed here, agents won't know it exists.

- `docs/PLAN.md` — Full build plan in three parts: Part 1 MVP (Days 1–4 complete, Days 5–9 remaining), Part 2 production deployment roadmap, Part 3 data model & polish. Start at Part 1.
- `docs/ARCHITECTURE.md` — system design decisions and rationale
- `docs/RENDER-PIPELINE.md` — render job lifecycle: API → queue → worker, data flows, state machine, gotchas
- `docs/DEPLOYMENT-PLAN.md` — deployment status and post-MVP production roadmap (phases 1–7); detailed phase plan in `PLAN.md`
- `docs/LOCAL-DEV.md` — local environment setup

---

## Task Management

For any non-trivial task, follow this sequence:

1. **Plan first** — write the plan to `tasks/todo.md` with checkable items before writing any code
2. **Verify plan** — check in with the user before starting implementation if scope is ambiguous
3. **Track progress** — mark items complete as you go; update `tasks/todo.md` in place
4. **Explain changes** — provide a high-level summary at each meaningful step
5. **Document results** — add a review/outcome section to `tasks/todo.md` when done
6. **Capture lessons** — update `tasks/lessons.md` after any user correction or unexpected outcome

After any correction: update `tasks/lessons.md` with the pattern and a rule that prevents the same mistake. Review `tasks/lessons.md` at session start for relevant context.
