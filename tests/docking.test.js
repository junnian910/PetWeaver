import { describe, expect, it } from 'vitest'
import { dockEdgeFor } from '../src/main/core/docking.js'

const area = { x: 0, y: 0, width: 1920, height: 1080 }
const bounds = { x: 100, y: 100, width: 420, height: 520 }
const insets = { left: 90, top: 44, right: 90, bottom: 24 }

describe('edge docking detection', () => {
  it('detects a visible edge touching the work area edge', () => {
    // 角色可见右边缘 = x + width - inset.right = 100 + 420 - 90 = 430，距离右缘很远
    expect(dockEdgeFor(bounds, insets, area)).toBeNull()
    const atLeft = { ...bounds, x: -90 } // 可见左边缘 = 0
    expect(dockEdgeFor(atLeft, insets, area)).toBe('left')
    const atRight = { ...bounds, x: 1920 - 420 + 90 } // 可见右边缘 = 1920
    expect(dockEdgeFor(atRight, insets, area)).toBe('right')
    const atTop = { ...bounds, y: -44 }
    expect(dockEdgeFor(atTop, insets, area)).toBe('top')
    const atBottom = { ...bounds, y: 1080 - 520 + 24 }
    expect(dockEdgeFor(atBottom, insets, area)).toBe('bottom')
  })

  it('ignores near-edge positions beyond the threshold', () => {
    const near = { ...bounds, x: -90 + 20 }
    expect(dockEdgeFor(near, insets, area, 14)).toBeNull()
    expect(dockEdgeFor(near, insets, area, 30)).toBe('left')
  })

  it('tolerates missing insets and malformed inputs', () => {
    expect(dockEdgeFor({ x: -10, y: 50, width: 420, height: 520 }, {}, area)).toBe('left')
    expect(dockEdgeFor(null, insets, area)).toBeNull()
    expect(dockEdgeFor(bounds, insets, null)).toBeNull()
  })
})
