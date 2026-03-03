import { Queue } from 'bullmq'
import { RENDER_QUEUE_NAME } from '@studioworks/shared'

export const queue = new Queue(RENDER_QUEUE_NAME, {
  connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
})
