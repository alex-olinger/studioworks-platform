import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

export type { RenderJob, RenderJobStatus } from '@prisma/client'
