import { db } from '@studioworks/db'
import { providerAdapter } from './providers/adapter.js'

export async function processRenderJob({ renderJobId }: { renderJobId: string }) {
  await db.renderJob.update({ where: { id: renderJobId }, data: { status: 'RUNNING' } })

  try {
    const job = await db.renderJob.findUniqueOrThrow({ where: { id: renderJobId } })
    await db.renderJob.update({ where: { id: renderJobId }, data: { status: 'UPLOADING' } })
    await providerAdapter.render(job.spec)
    await db.renderJob.update({ where: { id: renderJobId }, data: { status: 'COMPLETE' } })
  } catch {
    await db.renderJob.update({ where: { id: renderJobId }, data: { status: 'FAILED' } })
  }
}
