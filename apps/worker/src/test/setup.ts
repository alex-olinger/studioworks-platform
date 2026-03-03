import { db } from '@studioworks/db'
import { afterEach } from 'vitest'

afterEach(async () => {
  await db.renderJob.deleteMany()
})
