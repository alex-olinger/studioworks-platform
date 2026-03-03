import { describe, expect, it, vi } from 'vitest'
import { db } from '@studioworks/db'
import { processRenderJob } from './processor'
import { providerAdapter } from './providers/adapter'

describe('processRenderJob', () => {
  it('transitions state from QUEUED → RUNNING → UPLOADING → COMPLETE on success', async () => {
    const job = await db.renderJob.create({
      data: {
        status: 'QUEUED',
        spec: { projectId: 'proj_1', scenes: [/* ... */] },
      },
    })

    await processRenderJob({ renderJobId: job.id })

    const updated = await db.renderJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(updated.status).toBe('COMPLETE')
  })

  it('transitions to FAILED when the provider adapter throws', async () => {
    const job = await db.renderJob.create({
      data: {
        status: 'QUEUED',
        spec: { projectId: 'proj_1', scenes: [/* ... */] },
      },
    })

    vi.spyOn(providerAdapter, 'render').mockRejectedValueOnce(new Error('Provider timeout'))

    await processRenderJob({ renderJobId: job.id })

    const updated = await db.renderJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(updated.status).toBe('FAILED')
  })

  it('never mutates the persisted RenderSpec', async () => {
    const originalSpec = { projectId: 'proj_1', scenes: [/* ... */] }
    const job = await db.renderJob.create({ data: { status: 'QUEUED', spec: originalSpec } })

    await processRenderJob({ renderJobId: job.id })

    const updated = await db.renderJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(updated.spec).toEqual(originalSpec)
  })
})
