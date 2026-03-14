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

---

## Anti-Over-Engineering

**The problem:** Claude defaults to framework-style abstractions learned from open-source
codebases. Resist this. A 500-line flat module is better than 1500 lines across 3–4 layers
unless the layering is explicitly justified.

### Rules

- **Flat before layered.** Write the simplest direct implementation first. Do not introduce
  abstraction layers unless a concrete, present need requires them — not a hypothetical
  future one.

- **No speculative generalization.** Do not extract base classes, generic factories,
  plugin systems, or strategy patterns unless more than one concrete use case exists
  *right now* in this codebase.

- **Line count as a smell check.** If an implementation exceeds 2× the line count of a
  direct equivalent, stop and justify each layer explicitly. If you can't justify it,
  flatten it.

- **One layer of indirection is usually enough.** Service → DB call. Handler → Service.
  Do not add a Repository, a UnitOfWork, and an AbstractBaseRepository on top of a
  Postgres client that already handles connection pooling.

- **No framework scaffolding for app code.** Do not structure application logic the way
  a library or framework would structure its own internals. Apps are not frameworks.

- **Ask before adding an interface/abstract class.** If a new interface has exactly one
  implementation and no test double requires it, do not create it.

### The check before committing

Before presenting code, answer:
1. Could this be written with one fewer layer? If yes — write that version.
2. Is every abstraction boundary justified by something that exists today, not "we might need it"?
3. Would a new team member understand this without reading three other files first?

If any answer is "no," refactor before presenting.
