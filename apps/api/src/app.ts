import Fastify from 'fastify'
import { db } from '@studioworks/db'
import { RenderSpecSchema } from '@studioworks/shared'
import { queue } from './queue.js'

export function buildApp() {
  const app = Fastify({ logger: false })

  app.post('/render-jobs', async (request, reply) => {
    const result = RenderSpecSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ errors: result.error.flatten() })
    }

    const job = await db.renderJob.create({ data: { spec: result.data } })
    await queue.add('render', { renderJobId: job.id })

    return reply.status(201).send(job)
  })

  // Kick off Fastify's async init so routes are ready before tests run
  app.ready().catch(console.error)

  return app
}
