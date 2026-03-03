import { describe, expect, it } from 'vitest'
import { RenderSpecSchema } from '../render-spec'

describe('RenderSpecSchema', () => {
  it('parses a valid RenderSpec', () => {
    const input = {
      projectId: 'proj_123',
      scenes: [
        {
          id: 'scene_1',
          shots: [
            {
              id: 'shot_1',
              prompt: 'A cinematic wide shot of a mountain at sunrise',
              durationSeconds: 5,
            },
          ],
        },
      ],
    }

    const result = RenderSpecSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects a spec with no scenes', () => {
    const result = RenderSpecSchema.safeParse({ projectId: 'proj_123', scenes: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a shot with an empty prompt', () => {
    const result = RenderSpecSchema.safeParse({
      projectId: 'proj_123',
      scenes: [{ id: 'scene_1', shots: [{ id: 'shot_1', prompt: '', durationSeconds: 5 }] }],
    })
    expect(result.success).toBe(false)
  })
})
