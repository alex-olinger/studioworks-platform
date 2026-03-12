# Model Selection Guidance

When you assess that a task warrants Opus over Sonnet, say so at the start of your response:
> **Suggest: Opus** — [one-line reason]

The user makes the final call to switch with `/model`. Never switch automatically or block on it — flag it and proceed with the current model.

Flag for Opus when the task involves:
- Designing or changing `@studioworks/shared` schemas (ripple effects across all services)
- Prisma schema changes that require migrations
- Architectural decisions with multiple valid tradeoffs
- Debugging that spans more than 2 services simultaneously
- Any task where Sonnet has already produced incorrect output twice
