import { describe, expect, it } from 'vitest'
import { gestureEndOutcome } from '../src/renderer/gesture-outcome.js'

describe('gesture end outcome', () => {
  const dragging = { windowDragging: true, petted: false }

  it('ends a pointer cancel as drag cleanup without toss', () => {
    expect(gestureEndOutcome('cancel', dragging, { vx: 20, vy: -8 })).toEqual({
      type: 'cancel', toss: false, velocity: { vx: 0, vy: 0 }
    })
  })

  it('keeps an ordinary drag as drag without selecting state_move or changing physics', () => {
    expect(gestureEndOutcome('up', dragging, { vx: 0, vy: 0 })).toEqual({
      type: 'drag', toss: false, velocity: { vx: 0, vy: 0 }
    })
    expect(gestureEndOutcome('up', dragging, { vx: 20, vy: -8 }, { tossEnabled: false })).toEqual({
      type: 'drag', toss: false, velocity: { vx: 0, vy: 0 }
    })
  })

  it('tosses only when release velocity is nonzero and enabled', () => {
    expect(gestureEndOutcome('up', dragging, { vx: 20, vy: -8 }, { tossEnabled: true })).toEqual({
      type: 'toss', toss: true, velocity: { vx: 20, vy: -8 }
    })
  })
})
