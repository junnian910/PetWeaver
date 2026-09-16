import { describe, expect, it } from 'vitest'
import { frameAnchorShift, playbackFrameAt, playbackPolicies } from '../src/renderer/animation-playback.js'

describe('animation playback', () => {
  it('uses a fixed frame cadence instead of stretching frames to the action duration', () => {
    const frames = ['a', 'b', 'c', 'd']
    expect(playbackFrameAt('waving', frames, [], 0).frame).toBe('a')
    expect(playbackFrameAt('waving', frames, [], playbackPolicies.waving.frameMs).frame).toBe('b')
    expect(playbackFrameAt('waving', frames, [], playbackPolicies.waving.frameMs * 5).frame).toBe('a')
  })

  it('joins jumping to the idle pose at both ends of each cycle', () => {
    const frames = ['crouch', 'rise', 'peak', 'fall', 'land']
    const idle = ['rest']
    expect(playbackFrameAt('jumping', frames, idle, 0).frame).toBe('rest')
    expect(playbackFrameAt('jumping', frames, idle, playbackPolicies.jumping.frameMs).frame).toBe('crouch')
    expect(playbackFrameAt('jumping', frames, idle, playbackPolicies.jumping.frameMs * 6).frame).toBe('rest')
  })

  it('compensates the generated left drift against one shared frame center', () => {
    expect(98.32 + frameAnchorShift('idle', 0)).toBeCloseTo(95.5)
    expect(93.1 + frameAnchorShift('idle', 5)).toBeCloseTo(95.5)
    expect(98.83 + frameAnchorShift('failed', 0)).toBeCloseTo(95.5)
    expect(91.29 + frameAnchorShift('failed', 6)).toBeCloseTo(95.5)
  })

  it('plays expressive actions above eight source frames per second', () => {
    for (const state of ['waving', 'jumping', 'failed', 'waiting']) {
      expect(playbackPolicies[state].frameMs).toBeLessThanOrEqual(125)
    }
  })
})
