import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'db',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Testcontainers can take time to pull/start images
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Run serially — Testcontainers + Prisma migrations are stateful
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    globalSetup: ['./src/test/global-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
