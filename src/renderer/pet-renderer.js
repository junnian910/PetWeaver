import { getAction, resolvePlayableAction } from '../main/core/action-registry.js'

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0))
export const VIDEO_READY_TIMEOUT_MS = 1500
export const VIDEO_CROSSFADE_MS = 260

function registryActionResolver(actionId) {
  const requested = getAction(actionId) || getAction('idle_breath')
  const playable = resolvePlayableAction(requested.id)
  return { requested, playable, path: playable.videoPath }
}

/**
 * @typedef {Object} PetRenderer
 * @property {(actionId: string, options?: Object) => Promise<boolean>} play
 * @property {() => void} stop
 * @property {(scale: number) => void} setScale
 * @property {(facing: number|string) => void} setFacing
 * @property {(target: {x:number,y:number}) => void} setLookTarget
 * @property {(expression: string) => void} setExpression
 * @property {(phase: string) => void} setPhysicsPhase
 * @property {() => void} destroy
 */

export class VideoPetRenderer {
  constructor({ container, layers, assetBase = '', actionResolver = registryActionResolver, onPhysicsPhase = null } = {}) {
    this.container = container
    this.layers = [...(layers || [])]
    this.assetBase = assetBase
    this.actionResolver = actionResolver
    this.onPhysicsPhase = onPhysicsPhase
    this.activeIndex = 0
    this.currentActionId = null
    this.currentSchedulerId = null
    this.currentPath = null
    this.transitionToken = 0
    this.scale = 1
    this.facing = 1
    this.lookTarget = { x: .5, y: .5 }
    this.expression = 'neutral'
    this.physicsPhase = 'idle'
    this.pauseTimers = new Set()
    this.layers.forEach((layer) => {
      layer.muted = true
      layer.playsInline = true
      layer.preload = 'auto'
      layer.classList.remove('visible')
    })
  }

  async play(actionId, options = {}) {
    const resolution = this.actionResolver?.(actionId) || registryActionResolver(actionId)
    const requested = resolution.requested
    const playable = resolution.playable
    const path = resolution.path || playable.videoPath
    const fadeMs = Math.max(0, Number(options.fadeMs) || 0)
    const active = this.layers[this.activeIndex]
    if (active && this.currentPath === path) {
      ++this.transitionToken
      this.layers.forEach((layer, index) => {
        layer.classList.toggle('visible', index === this.activeIndex)
        if (index !== this.activeIndex) layer.pause?.()
      })
      this.#setFadeDuration(fadeMs)
      active.dataset.actionId = requested.id
      active.dataset.assetStatus = requested.assetStatus
      active.loop = options.loop ?? playable.loop
      // restart:false 用于回到待机的循环视频：保持当前播放相位，避免摆动中突然跳回第 0 帧抖一下。
      if (options.restart !== false || active.paused) active.currentTime = 0
      await active.play?.().catch?.(() => {})
      this.currentActionId = requested.id
      this.currentSchedulerId = options.schedulerId || options.id || null
      return true
    }
    const nextIndex = this.layers.length > 1 ? 1 - this.activeIndex : this.activeIndex
    const next = this.layers[nextIndex]
    if (!next) return false
    const swapIn = () => {
      this.#setFadeDuration(fadeMs)
      this.layers.forEach((item, index) => item.classList.toggle('visible', index === nextIndex))
      if (active && active !== next) {
        const pauseDelay = Math.max(VIDEO_CROSSFADE_MS, fadeMs)
        const timer = setTimeout(() => {
          this.pauseTimers.delete(timer)
          if (this.layers[this.activeIndex] !== active) active.pause?.()
        }, pauseDelay)
        this.pauseTimers.add(timer)
      }
      this.activeIndex = nextIndex
      this.currentActionId = requested.id
      this.currentSchedulerId = options.schedulerId || options.id || null
      this.currentPath = path
    }
    const prepare = () => {
      next.classList.remove('visible')
      next.dataset.actionId = requested.id
      next.dataset.assetStatus = requested.assetStatus
      next.loop = options.loop ?? playable.loop
      next.muted = true
    }
    // 备用层已加载过该视频（转场↔待机高频往返）时直接复用：
    // 不重新设置 src/load，避免解码器重建与正在播放的层抢占资源造成掉帧。
    if (String(next.src || '').endsWith(path) && next.readyState >= 2) {
      const token = ++this.transitionToken
      prepare()
      next.currentTime = 0
      await next.play?.().catch?.(() => {})
      if (token !== this.transitionToken) return false
      swapIn()
      return true
    }
    const token = ++this.transitionToken
    prepare()
    next.src = this.#assetUrl(path)
    next.load?.()
    const ready = await waitForVideo(next)
    if (token !== this.transitionToken) return false
    if (!ready) {
      if (requested.id !== 'idle_breath') return this.play('idle_breath', options)
      return false
    }
    next.currentTime = 0
    await next.play?.().catch?.(() => {})
    if (token !== this.transitionToken) return false
    // 动作切换使用轻微模糊叠加淡入，避免滑动遮罩带来的位移感。
    swapIn()
    return true
  }

  stop() {
    this.transitionToken += 1
    this.pauseTimers.forEach((timer) => clearTimeout(timer))
    this.pauseTimers.clear()
    this.layers.forEach((layer) => { layer.pause?.(); layer.classList.remove('visible') })
    this.currentActionId = null
    this.currentSchedulerId = null
    this.currentPath = null
  }

  setActionResolver(actionResolver) {
    this.stop()
    this.actionResolver = typeof actionResolver === 'function' ? actionResolver : registryActionResolver
  }

  setScale(scale) {
    this.scale = Math.max(.1, Math.min(3, Number(scale) || 1))
    this.container?.style.setProperty('--pet-scale', String(this.scale))
    if (this.container) this.container.style.transform = `scale(${this.scale})`
  }

  setFacing(facing) {
    this.facing = Number(facing) < 0 || facing === 'left' ? -1 : 1
    this.container?.style.setProperty('--facing', String(this.facing))
  }

  setLookTarget(target = {}) {
    this.lookTarget = { x: clamp01(target.x ?? .5), y: clamp01(target.y ?? .5) }
    this.container?.style.setProperty('--look-x', String(this.lookTarget.x))
    this.container?.style.setProperty('--look-y', String(this.lookTarget.y))
  }

  setExpression(expression = 'neutral') {
    this.expression = String(expression || 'neutral')
    if (this.container) this.container.dataset.expression = this.expression
  }

  setPhysicsPhase(phase = 'idle') {
    this.physicsPhase = String(phase)
    if (this.container) this.container.dataset.physicsPhase = this.physicsPhase
    this.onPhysicsPhase?.(this.physicsPhase)
  }

  destroy() {
    this.stop()
    this.layers.forEach((layer) => { layer.removeAttribute('src'); layer.removeAttribute('data-action-id') })
    this.container = null
    this.onPhysicsPhase = null
  }

  #assetUrl(path) {
    const value = String(path || '')
    return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/') ? value : `${this.assetBase}${value}`
  }

  #setFadeDuration(fadeMs) {
    // 每次显式写入：fadeMs 为 0 时清空内联样式，回落到 CSS 的 260ms 默认值。
    this.layers.forEach((layer) => { layer.style.transitionDuration = fadeMs ? `${fadeMs}ms` : '' })
  }
}

export class Live2DPetRenderer {
  constructor({ modelUrl = '' } = {}) {
    this.modelUrl = String(modelUrl || '')
    this.available = false
    this.unavailableReason = this.modelUrl
      ? 'Live2D 不可用：Cubism SDK 和 model loader 尚未接入'
      : 'Live2D 不可用：缺少 model3.json'
  }

  isAvailable() { return this.available }
  play() { return Promise.resolve(false) }
  stop() {}
  setScale() {}
  setFacing() {}
  setLookTarget() {}
  setExpression() {}
  setPhysicsPhase() {}
  destroy() {}
}

export function createPetRenderer(options = {}) {
  const live2d = new Live2DPetRenderer({ modelUrl: options.modelUrl })
  if (live2d.isAvailable()) return live2d
  options.onLive2DUnavailable?.(live2d.unavailableReason)
  return new VideoPetRenderer(options)
}

function waitForVideo(video) {
  if (video.readyState >= 2) return Promise.resolve(true)
  return new Promise((resolve) => {
    let settled = false
    let timer = null
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeEventListener?.('loadeddata', onReady)
      video.removeEventListener?.('canplay', onReady)
      video.removeEventListener?.('error', onError)
      resolve(value)
    }
    const onReady = () => finish(true)
    const onError = () => finish(false)
    timer = setTimeout(() => finish(false), VIDEO_READY_TIMEOUT_MS)
    video.addEventListener?.('loadeddata', onReady, { once: true })
    video.addEventListener?.('canplay', onReady, { once: true })
    video.addEventListener?.('error', onError, { once: true })
  })
}
