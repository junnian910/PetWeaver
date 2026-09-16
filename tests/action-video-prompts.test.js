import { describe, expect, it } from 'vitest'
import { ACTION_DIRECTIONS, ACTION_VIDEO_NEGATIVE_PROMPT, buildActionVideoPrompt, buildActionVideoRequest } from '../scripts/action-video-prompts.js'

describe('action video prompts', () => {
  it('gives every registered storyboard a detailed continuous-motion prompt', () => {
    expect(Object.keys(ACTION_DIRECTIONS)).toHaveLength(43)
    for (const actionId of Object.keys(ACTION_DIRECTIONS)) {
      const prompt = buildActionVideoPrompt(actionId)
      expect(prompt.length).toBeGreaterThan(1_500)
      expect(prompt).toContain('0.0-0.7 seconds')
      expect(prompt).toContain('final pose must match the first pose')
    }
  })

  it('creates a fixed 5-second, silent I2V request with a negative prompt', () => {
    expect(buildActionVideoRequest('act_work', 'https://getapib.org/image/reference.png')).toMatchObject({
      model: 'wan2.6-i2v-flash', image_url: 'https://getapib.org/image/reference.png', resolution: '720p', duration: 5, audio: false,
      negative_prompt: ACTION_VIDEO_NEGATIVE_PROMPT
    })
    expect(() => buildActionVideoRequest('act_work', 'file:///reference.png')).toThrow('public HTTPS')
  })
})
