import { describe, expect, it } from 'vitest'
import { advanceToss, createTossState } from '../src/main/core/toss-physics.js'

const area = { x:0, y:0, width:1920, height:1080 }

describe('toss physics', () => {
  it('slows the release velocity before starting the flight', () => {
    expect(createTossState(20, -10)).toEqual({ vx:13, vy:-6.5 })
  })

  it('applies gravity while preserving useful horizontal velocity', () => {
    const next = advanceToss(createTossState(20, -12), { x:500, y:400, width:420, height:520 }, area)
    expect(next.x).toBeGreaterThan(500)
    expect(next.y).toBeLessThan(400)
    expect(next.vy).toBeGreaterThan(-12)
  })

  it('reports side impact and reverses horizontal direction', () => {
    const next = advanceToss(createTossState(-20, 0), { x:2, y:200, width:420, height:520 }, area)
    expect(next.impact).toBe('side')
    expect(next.x).toBe(0)
    expect(next.vx).toBeGreaterThan(0)
  })

  it('settles on the floor after a low-energy landing', () => {
    const next = advanceToss(createTossState(.5, 1), { x:500, y:560, width:420, height:520 }, area)
    expect(next.impact).toBe('floor')
    expect(next.landed).toBe(true)
    expect(next.y).toBe(560)
  })

  it('bounces from the floor without declaring an early landing', () => {
    const next = advanceToss(createTossState(8, 20), { x:500, y:555, width:420, height:520 }, area)
    expect(next.impact).toBe('floor')
    expect(next.landed).toBe(false)
    expect(next.vy).toBeLessThan(0)
  })
})
