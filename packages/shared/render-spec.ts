import { z } from 'zod'

export const ShotSchema = z.object({
  id: z.string(),
  prompt: z.string().min(1),
  durationSeconds: z.number().positive(),
})

export const SceneSchema = z.object({
  id: z.string(),
  shots: z.array(ShotSchema).min(1),
})

export const RenderSpecSchema = z.object({
  projectId: z.string(),
  scenes: z.array(SceneSchema).min(1),
})

export type RenderSpec = z.infer<typeof RenderSpecSchema>
export type Scene = z.infer<typeof SceneSchema>
export type Shot = z.infer<typeof ShotSchema>
