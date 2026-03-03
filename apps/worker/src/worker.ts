import 'dotenv/config'
import { Worker } from 'bullmq'
import { RENDER_QUEUE_NAME } from '@studioworks/shared'
import { processRenderJob } from './processor.js'

const worker = new Worker(
  RENDER_QUEUE_NAME,
  async (job) => {
    await processRenderJob({ renderJobId: job.data.renderJobId })
  },
  { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } },
)

worker.on('completed', (job) => console.log(`Job ${job.id} completed`))
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err))

console.log('Worker listening on queue:', RENDER_QUEUE_NAME)
