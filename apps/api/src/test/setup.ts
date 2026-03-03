import { db } from '@studioworks/db'
import { afterEach } from 'vitest'

// Clean up DB state between tests to keep them independent
afterEach(async () => {
  await db.renderJob.deleteMany()
})
