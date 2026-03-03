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

  const databaseUrl = pgContainer.getConnectionUri()
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getFirstMappedPort()}`

  process.env.DATABASE_URL = databaseUrl
  process.env.REDIS_URL = redisUrl

  execSync('pnpm --filter @studioworks/db db:migrate:deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  })
}

export async function teardown() {
  await Promise.all([pgContainer?.stop(), redisContainer?.stop()])
}
