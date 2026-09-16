import { EventEmitter } from 'node:events'
import { getAction } from './action-registry.js'

export class ActionScheduler extends EventEmitter {
  constructor({ maxQueue = 50, actionGapMs = 1000 } = {}) {
    super()
    this.maxQueue = maxQueue
    // 动作间冷却：上一个动作结束后，先回待机过渡，冷却结束才允许下一个动作。
    this.actionGapMs = Math.max(0, Number(actionGapMs) || 0)
    this.nextStartAt = 0
    this.gapTimer = null
    this.current = null
    this.queue = []
    this.timer = null
    this.timerActionId = null
    this.transitioning = false
    this.deferred = []
  }

  isIdle() { return !this.current && this.queue.length === 0 }

  #inCooldown() { return this.actionGapMs > 0 && Date.now() < this.nextStartAt }

  request(input = {}) {
    const entry = getAction(input.actionId)
    const instanceId = crypto.randomUUID()
    const action = {
      id: instanceId,
      instanceId,
      actionId: input.actionId || 'idle_breath',
      priority: finiteNumber(input.priority, entry?.priority ?? 10, 0, 100),
      durationMs: finiteNumber(input.durationMs, 2200, 300, 15_000),
      text: String(input.text ?? '').slice(0, 300),
      source: input.source || 'system',
      interrupt: input.interrupt !== false,
      interruptible: input.interruptible ?? entry?.interruptible ?? true,
      persistent: input.persistent ?? entry?.persistent ?? false,
      audio: input.audio || null,
      meta: input.meta || {}
    }
    if (this.transitioning) {
      if (this.queue.length + this.deferred.length >= this.maxQueue) return false
      this.deferred.push(action)
      return true
    }
    return this.#request(action)
  }

  #request(action) {
    if (!this.current) {
      if (this.#inCooldown()) {
        // 冷却期内到达的动作先排队，冷却结束后按优先级播放。
        if (this.queue.length >= this.maxQueue) return false
        this.#enqueue(action)
        this.#scheduleNext()
        return true
      }
      return this.#start(action)
    }
    if (this.#shouldInterrupt(action)) {
      // Finish the current item without dequeuing anything. The urgent item
      // must become current before the existing queue is considered again.
      this.#finish('interrupted', { startNext: false, emitIdle: false, drainDeferred: false })
      return this.#start(action)
    }
    // 当前正在播放同一动作时忽略重复触发，避免同一动作被连续刷屏。
    if (this.current.actionId === action.actionId) return true
    if (this.queue.length >= this.maxQueue) return false
    this.#enqueue(action)
    return true
  }

  #enqueue(action) {
    // 队列里已有同动作时替换为最新请求（保留最新台词与优先级）。
    const existingIndex = this.queue.findIndex((queued) => queued.actionId === action.actionId)
    if (existingIndex >= 0) this.queue.splice(existingIndex, 1)
    this.queue.push(action)
    this.queue.sort((a, b) => b.priority - a.priority)
  }

  #scheduleNext() {
    clearTimeout(this.gapTimer)
    this.gapTimer = null
    if (this.current || !this.queue.length) return
    const delay = Math.max(0, this.nextStartAt - Date.now())
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null
      if (this.current || !this.queue.length) return
      this.#start(this.queue.shift())
    }, delay)
  }

  stop() {
    this.queue = []
    this.deferred = []
    clearTimeout(this.gapTimer)
    this.gapTimer = null
    this.nextStartAt = 0
    this.#finish('stopped', { startNext: false })
  }

  /**
   * 按谓词清空待播动作（不打断当前正在播放的动作）。
   * 返回被移除的条目数。
   */
  clearQueue(predicate = null) {
    const before = this.queue.length
    if (!predicate) {
      this.queue = []
      this.deferred = []
      return before
    }
    this.queue = this.queue.filter((action) => !predicate(action))
    this.deferred = this.deferred.filter((action) => !predicate(action))
    return before - this.queue.length
  }

  #shouldInterrupt(action) {
    if (!action.interrupt || !this.current.interruptible) return false
    const wakingFromSleep = this.current.actionId === 'act_sleep' && action.actionId === 'act_wake'
    return wakingFromSleep || action.priority > this.current.priority
  }

  #start(action) {
    this.current = action
    this.transitioning = true
    try {
      this.emit('action', action)
    } finally {
      this.transitioning = false
    }
    if (this.current !== action) return false
    if (action.persistent) {
      this.#drainDeferred()
      return true
    }
    const actionId = action.id
    this.timerActionId = actionId
    this.timer = setTimeout(() => {
      if (this.current?.id !== actionId || this.timerActionId !== actionId) return
      this.#finish('completed')
    }, action.durationMs)
    this.#drainDeferred()
    return true
  }

  #finish(reason, { startNext = true, emitIdle = true, drainDeferred = true } = {}) {
    if (!this.current) return
    clearTimeout(this.timer)
    const previous = this.current
    this.current = null
    this.timer = null
    this.timerActionId = null
    const wasTransitioning = this.transitioning
    this.transitioning = true
    try {
      this.emit('finished', { action: previous, reason })
      // 无论队列里有没有下一个，动作结束后都进入冷却：1s 内新到的请求同样要等。
      // stop() 是彻底清空，不留冷却。
      if (this.actionGapMs > 0 && reason !== 'stopped') this.nextStartAt = Date.now() + this.actionGapMs
      if (startNext && this.queue.length) {
        if (this.actionGapMs > 0) {
          // 先发 idle 让播放器切回待机过渡，冷却结束再启动队列里的下一个动作。
          this.#scheduleNext()
        } else {
          const next = this.queue.shift()
          if (next) {
            this.transitioning = false
            return this.#start(next)
          }
        }
      }
      if (emitIdle) this.emit('idle')
    } finally {
      this.transitioning = wasTransitioning
    }
    if (drainDeferred && !wasTransitioning) this.#drainDeferred()
  }

  #drainDeferred() {
    if (this.transitioning || this.draining) return
    this.draining = true
    try {
      while (this.deferred.length) this.#request(this.deferred.shift())
    } finally {
      this.draining = false
    }
  }
}

function finiteNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}
