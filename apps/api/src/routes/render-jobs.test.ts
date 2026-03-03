import supertest from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../app'
import { queue } from '../queue'

describe('POST /render-jobs', () => {
  const app = buildApp()

  it('creates a RenderJob and enqueues it given a valid RenderSpec', async () => {
    const spec = {
      projectId: 'proj_123',
      scenes: [
        {
          id: 'scene_1',
          shots: [{ id: 'shot_1', prompt: 'Sunrise over mountains', durationSeconds: 5 }],
        },
      ],
    }

    const res = await supertest(app.server).post('/render-jobs').send(spec).expect(201)

    expect(res.body).toMatchObject({ status: 'QUEUED' })
    expect(res.body.id).toBeDefined()
  })

  it('returns 400 with Zod errors given an invalid RenderSpec', async () => {
    const res = await supertest(app.server)
      .post('/render-jobs')
      .send({ projectId: 'proj_123', scenes: [] })
      .expect(400)

    expect(res.body.errors).toBeDefined()
  })

  it('does not enqueue a full RenderSpec — only a renderJobId', async () => {
    // Assert queue receives only the ID, not the spec payload
    const enqueueSpy = vi.spyOn(queue, 'add')

    await supertest(app.server)
      .post('/render-jobs')
      .send({
        projectId: 'proj_123',
        scenes: [{ id: 'scene_1', shots: [{ id: 'shot_1', prompt: 'A wide shot', durationSeconds: 5 }] }],
      })

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ renderJobId: expect.any(String) }),
    )
    expect(enqueueSpy).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ scenes: expect.anything() }),
    )
  })
})
