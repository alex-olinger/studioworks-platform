# Workflow

## Development Philosophy

- **When in doubt, ask before acting.** Confirm scope and intent rather than assuming. An incorrect assumption that proceeds silently is harder to recover from than a brief pause to verify.
- **Minimum necessary change.** Make exactly what was asked. Do not improve adjacent code, refactor surrounding logic, or clean up unrelated areas as a side effect. Flag anything worth fixing separately rather than folding it in.
- **Clean up after yourself.** Remove temporary scripts and debug artifacts when done. Close database and Redis connections in test teardown. Leave the environment ready for the next session — no dangling processes, no uncommitted scratch files.
- **One service at a time**, unless explicitly parallelized via subagents. Cross-service changes must call out the downstream impact explicitly — both in the work and in the PR description.

## Subagent Orchestration

Subagents are for parallel or context-heavy work. The main agent decides when to delegate; subagents never spawn further subagents.

**Use a subagent when:**
- Work is parallelizable (e.g., updating `apps/api` and `apps/web` simultaneously)
- A subtask generates large intermediate output that would pollute the main context
- Research, exploration, or analysis independent of the main task

**Don't use a subagent when:**
- The subtask requires reasoning about the overall plan — keep that in the main agent
- Subtasks have sequential dependencies — chain them explicitly
- The task is small — overhead isn't worth it

**Subagent rules:**
- One focused goal per subagent — don't bundle unrelated work
- Subagents have no memory — pass all needed context explicitly (goal, files, decisions already made, expected output shape)
- Summarize subagent output before acting on it; verify it matches the stated goal

## Common Task Checklists

**Add a new field to RenderSpec:**
1. Update Zod schema in `packages/shared`
2. `pnpm build --filter @studioworks/shared`
3. Update `apps/api` validation logic if needed
4. Update `apps/web` form/construction logic
5. Update `apps/worker` if the field affects rendering behavior
6. Add a Prisma migration if stored as a DB column

**Add a new render provider:**
1. Create adapter in `apps/worker/src/providers/`
2. Implement the shared provider interface
3. Register in the provider registry
4. No changes required in `apps/api` or `apps/web`

**Add a new API endpoint:**
1. Define request/response types in `@studioworks/shared` if cross-service
2. Add the Fastify route in `apps/api`
3. Wire up Zod validation on request body/params
4. Add the corresponding client call in `apps/web`

## Code Output Standards

Every file written by any agent must:
1. Be complete — no truncation, no `// ...rest of file`, no `// TODO: implement`
2. State the full file path explicitly
3. Compile — no unresolved imports, no missing types
4. Follow all conventions in `conventions.md`

When a `@studioworks/shared` change is required: show the shared change first, then downstream service changes.
When a Prisma schema change is required: show the model diff and migration command before writing application code that uses the new model.
