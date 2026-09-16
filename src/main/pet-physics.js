import { createCursorDragLoop } from './core/drag-session.js'
import { advanceToss, createTossState } from './core/toss-physics.js'
import { dockEdgeFor } from './core/docking.js'
import { clampWindowPosition, getDisplayWorkAreas, getPetMovementInsets, getResetPosition, getWorkAreaForPoint, getWorkAreaForWindow } from './core/window-movement.js'

const TOSS_TICK_MS = 16
const TOSS_MAX_DURATION_MS = 6_500
const TOSS_MIN_SPEED = 2.5
const TOSS_IMPACT_COOLDOWN_MS = 220

/**
 * Encapsulates the window movement physics: cursor-follow dragging, toss
 * flight and position reset. Talks to the AppController idle gates and the
 * renderer phase channel so actions pause while the pet is in motion.
 */
export class PetPhysics {
  #dragLoop = null
  #dragSession = null
  #tossTimer = null
  #dockedEdge = null
  #preDockPosition = null

  constructor({ petWindow, screen, configStore, controller, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
    this.petWindow = petWindow
    this.screen = screen
    this.configStore = configStore
    this.controller = controller
    this.setIntervalFn = setIntervalFn
    this.clearIntervalFn = clearIntervalFn
  }

  #scale() { return this.configStore.getAll().scale / .52 }

  #sendToRenderer(channel, payload) {
    try { this.petWindow?.send(channel, payload) } catch { /* window tearing down mid-phase is fine */ }
  }

  startDrag() {
    if (!this.petWindow || this.petWindow.isDestroyed) return
    // Grabbing the pet cancels an in-flight toss and clears its phase gates so
    // the renderer cannot get stuck on the airborne fallback image.
    this.#cancelToss()
    this.controller?.setIdleGate({ tossing: false, physicsPhase: 'idle' })
    this.stopDrag()
    try {
      const startCursor = this.screen.getCursorScreenPoint()
      const startBounds = this.petWindow.getBounds()
      const areas = getDisplayWorkAreas(this.screen.getAllDisplays())
      const insets = getPetMovementInsets(startBounds, this.#scale())
      this.#dragSession = { startCursor, startBounds, areas, insets, lastX: startBounds.x, lastY: startBounds.y }
      this.controller?.setIdleGate({ dragging: true })
    } catch {
      this.stopDrag()
      return
    }
    this.#dragLoop = createCursorDragLoop({
      readCursor: () => this.screen.getCursorScreenPoint(),
      onCursor: (cursor) => this.#moveDrag(cursor),
      onFailure: () => this.stopDrag({ fromUser: false })
    })
    this.#dragLoop.start()
  }

  #moveDrag(cursor) {
    if (!this.#dragSession) return
    if (!this.petWindow || this.petWindow.isDestroyed) {
      this.stopDrag({ fromUser: false })
      return
    }
    const session = this.#dragSession
    const desktop = getWorkAreaForPoint(cursor, session.areas)
    const position = clampWindowPosition(
      session.startBounds.x + cursor.x - session.startCursor.x,
      session.startBounds.y + cursor.y - session.startCursor.y,
      session.startBounds,
      desktop,
      session.insets
    )
    if (position.x === session.lastX && position.y === session.lastY) return
    session.lastX = position.x
    session.lastY = position.y
    try {
      this.petWindow.setPosition(position.x, position.y, false)
    } catch {
      this.stopDrag({ fromUser: false })
    }
  }

  stopDrag({ fromUser = true } = {}) {
    const session = this.#dragSession
    this.#dragLoop?.stop()
    this.#dragLoop = null
    this.#dragSession = null
    this.controller?.setIdleGate({ dragging: false })
    // 只有用户主动结束拖动（松手）才判定贴边收纳；读取失败/窗口异常
    // 清理定时器时不做收纳，避免误触发。
    if (session && fromUser) this.#maybeDock(session)
  }

  get dockedEdge() { return this.#dockedEdge }

  #maybeDock(session) {
    const config = this.configStore.getAll()
    if (!config.dock?.enabled || !this.petWindow || this.petWindow.isDestroyed) return
    const bounds = this.petWindow.getBounds()
    const areas = getDisplayWorkAreas(this.screen.getAllDisplays())
    const area = getWorkAreaForWindow(bounds, areas)
    const edge = dockEdgeFor(bounds, session.insets, area)
    if (edge && !this.#dockedEdge) {
      this.#dockedEdge = edge
      this.#preDockPosition = { x: bounds.x, y: bounds.y }
      this.#sendToRenderer('window:docked', { edge })
      this.controller?.setIdleGate({ docked: true })
    }
  }

  undock() {
    if (!this.#dockedEdge) return false
    const position = this.#preDockPosition
    this.#dockedEdge = null
    this.#preDockPosition = null
    this.controller?.setIdleGate({ docked: false })
    this.#sendToRenderer('window:undocked', {})
    if (position && this.petWindow && !this.petWindow.isDestroyed) {
      try { this.petWindow.setPosition(position.x, position.y) } catch { /* window closed */ }
    }
    return true
  }

  #cancelToss() {
    if (this.#tossTimer === null) return
    this.clearIntervalFn(this.#tossTimer)
    this.#tossTimer = null
    // No landed event is coming; reset the renderer so it drops the airborne
    // fallback and both sides return to the idle physics phase.
    this.#sendToRenderer('window:toss-phase', 'idle')
  }

  toss(velocity = {}) {
    if (this.#dockedEdge) this.undock()
    const { vx = 0, vy = 0 } = velocity || {}
    this.#cancelToss()
    let state = createTossState(vx, vy)
    if (Math.hypot(state.vx, state.vy) < TOSS_MIN_SPEED) return false
    if (!this.petWindow || this.petWindow.isDestroyed) return false
    this.controller?.setIdleGate({ tossing: true, physicsPhase: 'airborne' })
    let lastImpactAt = 0
    const startedAt = Date.now()
    this.#sendToRenderer('window:toss-phase', 'airborne')
    this.#tossTimer = this.setIntervalFn(() => {
      if (!this.petWindow || this.petWindow.isDestroyed) {
        this.#cancelToss()
        this.controller?.setIdleGate({ tossing: false, physicsPhase: 'idle' })
        return
      }
      const bounds = this.petWindow.getBounds()
      const areas = getDisplayWorkAreas(this.screen.getAllDisplays())
      const area = getWorkAreaForWindow(bounds, areas)
      const next = advanceToss(state, bounds, area)
      state = { vx: next.vx, vy: next.vy }
      try {
        this.petWindow.setPosition(next.x, next.y)
      } catch {
        this.#cancelToss()
        return
      }
      if (next.impact && next.impact !== 'floor' && performance.now() - lastImpactAt > TOSS_IMPACT_COOLDOWN_MS) {
        lastImpactAt = performance.now()
        this.controller?.setIdleGate({ physicsPhase: 'impact' })
        this.#sendToRenderer('window:toss-phase', 'impact')
      }
      if (next.landed || Date.now() - startedAt >= TOSS_MAX_DURATION_MS) {
        const floor = area.y + area.height - bounds.height
        try { this.petWindow.setPosition(next.x, floor) } catch { /* window closed mid-landing */ }
        this.clearIntervalFn(this.#tossTimer)
        this.#tossTimer = null
        // Keep tossing gate up until the renderer finishes its landed pose and
        // reports the idle physics phase back to us.
        this.controller?.setIdleGate({ tossing: true, physicsPhase: 'landed' })
        this.#sendToRenderer('window:toss-phase', 'landed')
      }
    }, TOSS_TICK_MS)
    return true
  }

  resetPosition() {
    if (!this.petWindow || this.petWindow.isDestroyed) throw new Error('桌宠窗口未就绪')
    if (this.#dockedEdge) this.undock()
    const bounds = this.petWindow.getBounds()
    const position = getResetPosition(this.screen.getPrimaryDisplay(), bounds, this.#scale())
    const { x, y } = position
    this.petWindow.setPosition(x, y)
    this.petWindow.show()
    return { x, y }
  }

  dispose() {
    this.stopDrag()
    this.#cancelToss()
    this.#dockedEdge = null
    this.#preDockPosition = null
  }
}
