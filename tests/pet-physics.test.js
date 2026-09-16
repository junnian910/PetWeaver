import { afterEach, describe, expect, it, vi } from 'vitest'
import { PetPhysics } from '../src/main/pet-physics.js'

function createFakePetWindow() {
  const sends = []
  return {
    sends,
    destroyed: false,
    position: { x: 100, y: 100 },
    get isDestroyed() { return this.destroyed },
    getBounds() { return { x: this.position.x, y: this.position.y, width: 420, height: 520 } },
    setPosition(x, y) { this.position = { x, y } },
    show() { this.shown = true },
    send(channel, payload) { sends.push({ channel, payload }) }
  }
}

function createFakeScreen() {
  return {
    getCursorScreenPoint: () => ({ x: 960, y: 540 }),
    getAllDisplays: () => [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
    getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
  }
}

function createFakeController() {
  const gates = []
  const gate = { enabled: true, sleep: false, dragging: false, tossing: false, physicsPhase: 'idle' }
  return {
    gates,
    gate,
    setIdleGate(patch) { gates.push(patch); Object.assign(gate, patch) }
  }
}

function createFakeStore() {
  return { getAll: () => ({ scale: .52 }) }
}

afterEach(() => vi.useRealTimers())

describe('PetPhysics', () => {
  it('rejects a tiny toss without touching the idle gate', () => {
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: createFakeStore(), controller })
    expect(physics.toss({ vx: 0, vy: 0 })).toBe(false)
    expect(controller.gates).toEqual([])
    expect(window.sends).toEqual([])
    physics.dispose()
  })

  it('runs a toss until landing, emits the landed phase once, and keeps the gate up', () => {
    vi.useFakeTimers()
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: createFakeStore(), controller })
    expect(physics.toss({ vx: 0, vy: -18 })).toBe(true)
    expect(controller.gate.tossing).toBe(true)
    expect(window.sends[0]).toEqual({ channel: 'window:toss-phase', payload: 'airborne' })
    vi.advanceTimersByTime(10_000)
    const landed = window.sends.filter((entry) => entry.payload === 'landed')
    expect(landed).toHaveLength(1)
    expect(controller.gate.tossing).toBe(true)
    expect(controller.gate.physicsPhase).toBe('landed')
    physics.dispose()
  })

  it('cancels an in-flight toss when a drag starts so the renderer cannot stay airborne', () => {
    vi.useFakeTimers()
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: createFakeStore(), controller })
    physics.toss({ vx: 5, vy: -12 })
    vi.advanceTimersByTime(64)
    physics.startDrag()
    expect(window.sends.some((entry) => entry.payload === 'idle')).toBe(true)
    expect(controller.gate.tossing).toBe(false)
    expect(controller.gate.physicsPhase).toBe('idle')
    expect(controller.gate.dragging).toBe(true)
    physics.stopDrag()
    expect(controller.gate.dragging).toBe(false)
    physics.dispose()
  })

  it('stops the toss when the window is destroyed mid-flight', () => {
    vi.useFakeTimers()
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: createFakeStore(), controller })
    physics.toss({ vx: 8, vy: -10 })
    window.destroyed = true
    vi.advanceTimersByTime(64)
    expect(controller.gate.tossing).toBe(false)
    expect(controller.gate.physicsPhase).toBe('idle')
    physics.dispose()
  })

  it('docks on a user-ended drag that ends at the screen edge and undocks on demand', () => {
    const window = createFakePetWindow()
    const controller = createFakeController()
    const screen = createFakeScreen()
    const physics = new PetPhysics({ petWindow: window, screen, configStore: { getAll: () => ({ scale: .52, dock: { enabled: true } }) }, controller })
    physics.startDrag()
    // 把窗口位置模拟到左边缘（可见左边缘 = 0）
    window.position = { x: -90, y: 100 }
    physics.stopDrag()
    expect(physics.dockedEdge).toBe('left')
    expect(controller.gate.docked).toBe(true)
    expect(window.sends.some((entry) => entry.channel === 'window:docked')).toBe(true)

    const restoreX = window.position.x
    window.position = { x: -200, y: 80 }
    expect(physics.undock()).toBe(true)
    expect(physics.dockedEdge).toBeNull()
    expect(controller.gate.docked).toBe(false)
    expect(window.position.x).toBe(restoreX)
    expect(window.sends.some((entry) => entry.channel === 'window:undocked')).toBe(true)
    physics.dispose()
  })

  it('does not dock when the drag loop fails instead of ending by release', () => {
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: { getAll: () => ({ scale: .52, dock: { enabled: true } }) }, controller })
    physics.startDrag()
    window.position = { x: -90, y: 100 }
    physics.stopDrag({ fromUser: false })
    expect(physics.dockedEdge).toBeNull()
    physics.dispose()
  })

  it('undocks before starting a toss', () => {
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: { getAll: () => ({ scale: .52, dock: { enabled: true } }) }, controller })
    physics.startDrag()
    window.position = { x: -90, y: 100 }
    physics.stopDrag()
    expect(physics.dockedEdge).toBe('left')
    physics.toss({ vx: 0, vy: -10 })
    expect(physics.dockedEdge).toBeNull()
    physics.dispose()
  })

  it('clears docking when the position is reset', () => {
    const window = createFakePetWindow()
    const controller = createFakeController()
    const physics = new PetPhysics({ petWindow: window, screen: createFakeScreen(), configStore: { getAll: () => ({ scale: .52, dock: { enabled: true } }) }, controller })
    physics.startDrag()
    window.position = { x: -90, y: 100 }
    physics.stopDrag()
    expect(physics.dockedEdge).toBe('left')

    const reset = physics.resetPosition()

    expect(window.position).toEqual(reset)
    expect(physics.dockedEdge).toBeNull()
    expect(controller.gate.docked).toBe(false)
    expect(window.sends.some((entry) => entry.channel === 'window:undocked')).toBe(true)
    physics.dispose()
  })

  it('resetPosition throws a friendly error when the window is unavailable', () => {
    const physics = new PetPhysics({ petWindow: null, screen: createFakeScreen(), configStore: createFakeStore(), controller: createFakeController() })
    expect(() => physics.resetPosition()).toThrow('桌宠窗口未就绪')
    physics.dispose()
  })
})
