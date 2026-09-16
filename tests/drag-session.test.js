import { describe, expect, it } from 'vitest'
import { createCursorDragLoop } from '../src/main/core/drag-session.js'

describe('cursor drag loop', () => {
  it('stops the loop and reports failure when cursor reading throws', () => {
    let tick = null
    const cleared = []
    const failures = []
    const loop = createCursorDragLoop({
      readCursor: () => { throw new Error('cursor unavailable') },
      onCursor: () => {},
      onFailure: () => failures.push('failed'),
      setIntervalFn: (callback) => { tick = callback; return 7 },
      clearIntervalFn: (id) => cleared.push(id)
    })

    loop.start()
    expect(loop.isRunning()).toBe(false)
    expect(cleared).toEqual([7])
    expect(failures).toEqual(['failed'])
    expect(tick).not.toBeNull()
  })

  it('stops a running loop without leaving another timer behind', () => {
    let tick = null
    const cleared = []
    const loop = createCursorDragLoop({
      readCursor: () => ({ x: 1, y: 2 }),
      onCursor: () => {},
      setIntervalFn: (callback) => { tick = callback; return 8 },
      clearIntervalFn: (id) => cleared.push(id)
    })

    loop.start()
    expect(loop.isRunning()).toBe(true)
    tick()
    loop.stop()
    loop.stop()
    expect(cleared).toEqual([8])
    expect(loop.isRunning()).toBe(false)
  })

  it('stops the loop when the cursor reader returns invalid coordinates', () => {
    let tick = null
    const cleared = []
    const failures = []
    const loop = createCursorDragLoop({
      readCursor: () => ({ x: Number.NaN, y: 4 }),
      onCursor: () => {},
      onFailure: () => failures.push('failed'),
      setIntervalFn: (callback) => { tick = callback; return 9 },
      clearIntervalFn: (id) => cleared.push(id)
    })

    loop.start()

    expect(loop.isRunning()).toBe(false)
    expect(cleared).toEqual([9])
    expect(failures).toEqual(['failed'])
    expect(tick).not.toBeNull()
  })
})
