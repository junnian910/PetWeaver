import { describe, expect, it } from 'vitest'
import { clampWindowPosition, clampWindowPositionToDisplays, getDisplayWorkAreas, getPetMovementInsets, getResetPosition, getVirtualDesktopBounds, getVirtualWorkAreaBounds, getWorkAreaForPoint, getWorkAreaForWindow } from '../src/main/core/window-movement.js'

describe('window movement', () => {
  const displays = [
    { bounds:{ x:-1920, y:0, width:1920, height:1080 } },
    { bounds:{ x:0, y:-120, width:2560, height:1440 } }
  ]

  it('builds the full virtual desktop instead of a single work area', () => {
    expect(getVirtualDesktopBounds(displays)).toEqual({ x:-1920, y:-120, right:2560, bottom:1320 })
  })

  it('allows a fixed-size window to touch every virtual desktop edge', () => {
    const desktop = getVirtualDesktopBounds(displays)
    expect(clampWindowPosition(-3000, -300, { width:420, height:520 }, desktop)).toEqual({ x:-1920, y:-120 })
    expect(clampWindowPosition(3000, 2000, { width:420, height:520 }, desktop)).toEqual({ x:2140, y:800 })
  })

  it('allows the visible pet to touch the desktop edges through transparent margins', () => {
    const desktop = getVirtualDesktopBounds([{ bounds:{ x:0, y:0, width:1920, height:1080 } }])
    const size = { width:420, height:520 }
    const insets = getPetMovementInsets(size, 1)
    expect(clampWindowPosition(-500, -500, size, desktop, insets)).toEqual({ x:Math.ceil(-insets.left), y:Math.ceil(-insets.top) })
    expect(clampWindowPosition(2500, 2000, size, desktop, insets)).toEqual({ x:Math.floor(desktop.right - insets.right), y:Math.floor(desktop.bottom - insets.bottom) })
  })

  it('always returns finite integer coordinates for invalid edge inputs', () => {
    const desktop = getVirtualDesktopBounds([{ bounds:{ x:0, y:0, width:1920, height:1080 } }])
    const insets = getPetMovementInsets({ width:NaN, height:Infinity }, NaN)
    const position = clampWindowPosition(NaN, Infinity, { width:NaN, height:Infinity }, desktop)
    expect(position).toEqual({ x:0, y:0 })
    expect(Object.values(insets).every(Number.isFinite)).toBe(true)
    expect(Number.isInteger(position.x)).toBe(true)
    expect(Number.isInteger(position.y)).toBe(true)
  })

  it('ignores malformed display bounds instead of emitting invalid desktop edges', () => {
    expect(getVirtualDesktopBounds([
      { bounds:{ x:NaN, y:0, width:0, height:1080 } },
      { bounds:{ x:-1280, y:-40, width:1280, height:1024 } }
    ])).toEqual({ x:-1280, y:-40, right:0, bottom:984 })
  })

  it('selects a real nearest display instead of the empty rectangle between offset screens', () => {
    const splitDisplays = [
      { id: 'left', bounds: { x: 0, y: 0, width: 800, height: 600 } },
      { id: 'right', bounds: { x: 1000, y: 120, width: 800, height: 600 } }
    ]
    const areas = getDisplayWorkAreas(splitDisplays)
    expect(getWorkAreaForPoint({ x: 900, y: 200 }, areas).id).toBe('left')
    expect(getWorkAreaForPoint({ x: 980, y: 200 }, areas).id).toBe('right')
    expect(getWorkAreaForWindow({ x: 820, y: 140, width: 420, height: 520 }, areas).id).toBe('right')

    const insets = getPetMovementInsets({ width: 420, height: 520 }, 1)
    const position = clampWindowPositionToDisplays(820, 140, { width: 420, height: 520 }, splitDisplays, insets)
    expect(position.x).toBeGreaterThanOrEqual(Math.ceil(1000 - insets.left))
    expect(position.y).toBeGreaterThanOrEqual(Math.ceil(120 - insets.top))
    expect(position.x).not.toBe(820)
  })

  it('keeps work-area dimensions for physics and excludes taskbars from the virtual work area', () => {
    const displays = [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
      { bounds: { x: 1920, y: -120, width: 1600, height: 900 }, workArea: { x: 1920, y: -120, width: 1600, height: 860 } }
    ]
    expect(getDisplayWorkAreas(displays)).toEqual([
      { id: 0, x: 0, y: 0, width: 1920, height: 1040, right: 1920, bottom: 1040 },
      { id: 1, x: 1920, y: -120, width: 1600, height: 860, right: 3520, bottom: 740 }
    ])
    expect(getVirtualWorkAreaBounds(displays)).toEqual({ x: 0, y: -120, right: 3520, bottom: 1040 })
  })

  it('clamps the initial virtual-corner fallback into a real L-shaped work area', () => {
    const displays = [
      { id: 'primary', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
      { id: 'right', bounds: { x: 1920, y: 0, width: 1600, height: 500 }, workArea: { x: 1920, y: 0, width: 1600, height: 500 } }
    ]
    const size = { width: 420, height: 520 }
    const insets = getPetMovementInsets(size, 1)
    const desktop = getVirtualWorkAreaBounds(displays)
    const rawX = desktop.right - insets.right - 24
    const rawY = desktop.bottom - insets.bottom - 24
    const position = clampWindowPositionToDisplays(rawX, rawY, size, displays, insets)

    expect(position).toEqual({ x: 3174, y: -6 })
    expect(position.x).toBeGreaterThanOrEqual(1920)
    expect(position.y).toBeLessThanOrEqual(500 - insets.bottom)
  })

  it('uses a primary display work area for reset positioning', () => {
    const position = getResetPosition({ workArea: { x: 1000, y: 120, width: 800, height: 600 } }, { width: 420, height: 520 }, 1)
    expect(position.x).toBeGreaterThanOrEqual(1000)
    expect(position.y).toBeGreaterThanOrEqual(120)
    expect(position.x).toBeLessThan(1800)
    expect(position.y).toBeLessThan(720)
  })
})
