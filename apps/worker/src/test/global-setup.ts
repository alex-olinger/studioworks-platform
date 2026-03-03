import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { execSync } from 'child_process'

let pgContainer: Awaited<ReturnType<typeof PostgreSqlContainer.prototype.start>>
let redisContainer: Awaited<ReturnType<typeof RedisContainer.prototype.start>>

export async function setup() {
  ;[pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('studioworks_test')
      .withUsername('studioworks')
      .withPassword('studioworks')
      .start(),
    new RedisContainer('redis:7-alpine').start(),
  ])

  process.env.DATABASE_URL = pgContainer.getConnectionUri()
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getFirstMappedPort()}`

  execSync('pnpm --filter @studioworks/db db:migrate:deploy', {
    env: { ...process.env, DATABASE_URL: pgContainer.getConnectionUri() },
    stdio: 'inherit',
  })
}

export async function teardown() {
  await Promise.all([pgContainer?.stop(), redisContainer?.stop()])
}
