import { describe, expect, it } from 'vitest'
import { poseTransition } from '../remotion-pet/src/ActionMotion.jsx'

describe('action pose interpolation', () => {
  it('holds a pose before blending continuously to the next one', () => {
    expect(poseTransition(3, 0)).toEqual({ from: 0, to: 1, mix: 0 })
    expect(poseTransition(3, 0.25).mix).toBe(0)
    expect(poseTransition(3, 0.45).mix).toBeGreaterThan(0)
    expect(poseTransition(3, 0.45).mix).toBeLessThan(1)
    expect(poseTransition(3, 0.5)).toEqual({ from: 1, to: 2, mix: 0 })
    expect(poseTransition(3, 1)).toEqual({ from: 2, to: 2, mix: 0 })
  })

  it('keeps a single-pose action stable', () => {
    expect(poseTransition(1, 0.75)).toEqual({ from: 0, to: 0, mix: 0 })
  })
})
