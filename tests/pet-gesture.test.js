import { describe, expect, it } from 'vitest'
import { createPetGesture, createPetStroke, petRegionAt, releaseVelocity, updatePetGesture, updatePetStroke } from '../src/renderer/pet-gesture.js'

const point = (clientX, clientY, timeStamp, screenX = clientX, screenY = clientY) => ({ pointerId:1, clientX, clientY, screenX, screenY, timeStamp })

describe('pet gestures', () => {
  it('recognizes a horizontal back-and-forth head pet without starting a drag', () => {
    const gesture = createPetGesture(point(100, 100, 0), { head:true })
    const moves = [point(126,102,30), point(94,101,60), point(130,103,90), point(96,100,120)]
    const results = moves.map((move) => updatePetGesture(gesture, move, { pettingEnabled:true, pettingSensitivity:1 }))
    expect(results).toContain('pet')
    expect(gesture.dragging).toBe(false)
  })

  it('recognizes a single left-right hover stroke without holding the mouse button', () => {
    const stroke = createPetStroke(point(100, 100, 0))
    expect(updatePetStroke(stroke, point(124, 101, 30), { pettingSensitivity: 1 })).toBe(false)
    expect(updatePetStroke(stroke, point(96, 100, 60), { pettingSensitivity: 1 })).toBe(true)
  })

  it('turns a deliberate non-head move into a drag', () => {
    const gesture = createPetGesture(point(100, 250, 0), { head:false })
    expect(updatePetGesture(gesture, point(110,250,30), {})).toBe('drag-start')
  })

  it('keeps a short one-way head stroke eligible for click/petting instead of dragging', () => {
    const gesture = createPetGesture(point(100, 100, 0), { head: true })
    expect(updatePetGesture(gesture, point(118, 100, 30), { pettingEnabled: true, pettingSensitivity: 1 })).toBe('pending')
    expect(gesture.dragging).toBe(false)
  })

  it('does not toss after a slow release', () => {
    const gesture = createPetGesture(point(100, 250, 0), { head:false })
    updatePetGesture(gesture, point(110,250,100), {})
    expect(releaseVelocity(gesture, point(112,250,180), 1)).toEqual({ vx:0, vy:0 })
  })

  it('returns a directional velocity after a fast release', () => {
    const gesture = createPetGesture(point(100, 250, 0), { head:false })
    updatePetGesture(gesture, point(145,260,20,145,260), {})
    const velocity = releaseVelocity(gesture, point(205,270,45,205,270), 1)
    expect(velocity.vx).toBeGreaterThan(4)
    expect(velocity.vy).toBeGreaterThan(0)
  })

  it('classifies head, belly and body regions from a layer rect', () => {
    const rect = { left: 0, top: 0, width: 400, height: 500 }
    expect(petRegionAt(200, 120, rect)).toBe('head')
    expect(petRegionAt(140, 120, rect)).toBe('head')
    expect(petRegionAt(200, 340, rect)).toBe('belly')
    expect(petRegionAt(200, 460, rect)).toBe('body')
    expect(petRegionAt(60, 200, rect)).toBe('body')
    expect(petRegionAt(200, 200, null)).toBe('body')
  })

  it('recognizes a belly stroke as a pet without starting a drag', () => {
    const gesture = createPetGesture(point(100, 340, 0), { belly:true })
    const moves = [point(126,342,30), point(94,341,60), point(130,343,90), point(96,340,120)]
    const results = moves.map((move) => updatePetGesture(gesture, move, { pettingEnabled:true, pettingSensitivity:1 }))
    expect(results).toContain('pet')
    expect(gesture.dragging).toBe(false)
  })
})
