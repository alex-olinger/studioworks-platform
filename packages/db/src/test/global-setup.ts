import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { execSync } from 'child_process'

let container: Awaited<ReturnType<typeof PostgreSqlContainer.prototype.start>>

export async function setup() {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('studioworks_test')
    .withUsername('studioworks')
    .withPassword('studioworks')
    .start()

  const connectionUri = container.getConnectionUri()
  process.env.DATABASE_URL = connectionUri

  // Run Prisma migrations against the test container
  execSync('pnpm --filter @studioworks/db db:migrate:deploy', {
    env: { ...process.env, DATABASE_URL: connectionUri },
    stdio: 'inherit',
  })
}

export async function teardown() {
  await container?.stop()
}
