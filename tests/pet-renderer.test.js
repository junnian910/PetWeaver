import { describe, expect, it, vi } from 'vitest'
import { createPetRenderer, Live2DPetRenderer, VideoPetRenderer, VIDEO_CROSSFADE_MS, VIDEO_READY_TIMEOUT_MS } from '../src/renderer/pet-renderer.js'

function createClassList() {
  const values = new Set()
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    toggle: (name, force) => {
      const next = force === undefined ? !values.has(name) : Boolean(force)
      if (next) values.add(name)
      else values.delete(name)
      return next
    },
    contains: (name) => values.has(name)
  }
}

function createVideo({ readyState = 3 } = {}) {
  const listeners = new Map()
  const video = {
    readyState,
    muted: false,
    playsInline: false,
    loop: false,
    paused: false,
    currentTime: 0,
    src: '',
    dataset: {},
    style: { transitionDuration: '' },
    classList: createClassList(),
    loadCalls: 0,
    playCalls: 0,
    pauseCalls: 0,
    removedAttributes: [],
    load() { this.loadCalls += 1 },
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve() },
    pause() { this.pauseCalls += 1; this.paused = true },
    addEventListener(type, callback) { listeners.set(type, callback) },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type) },
    emit(type) { listeners.get(type)?.() },
    removeAttribute(name) { this.removedAttributes.push(name); if (name === 'src') this.src = '' }
  }
  return video
}

function createContainer() {
  const properties = new Map()
  return {
    dataset: {},
    style: {
      properties,
      transform: '',
      setProperty(name, value) { properties.set(name, value) }
    }
  }
}

function createRenderer(layers = [createVideo(), createVideo()]) {
  return { renderer: new VideoPetRenderer({ container: createContainer(), layers, assetBase: '/app/' }), layers }
}

describe('VideoPetRenderer', () => {
  it('crossfades between the two supplied video layers before pausing the old one', async () => {
    vi.useFakeTimers()
    const { renderer, layers } = createRenderer()
    try {
      expect(await renderer.play('act_greet')).toBe(true)
      expect(layers[1].src).toBe('/app/assets/videos/waving-real.webm')
      expect(layers[1].playCalls).toBe(1)
      expect(layers[1].classList.contains('visible')).toBe(true)
      expect(layers[0].classList.contains('visible')).toBe(false)
      expect(renderer.currentActionId).toBe('act_greet')

      expect(await renderer.play('act_sing')).toBe(true)
      expect(layers[0].src).toBe('/app/assets/videos/singing.webm')
      expect(layers[0].playCalls).toBe(1)
      expect(layers[0].classList.contains('visible')).toBe(true)
      expect(layers[1].classList.contains('visible')).toBe(false)
      expect(layers[1].pauseCalls).toBe(0)
      await vi.advanceTimersByTimeAsync(VIDEO_CROSSFADE_MS)
      expect(layers[1].pauseCalls).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses a role-package action resolver without prefixing custom protocol URLs', async () => {
    const layers = [createVideo(), createVideo()]
    const requested = { id: 'act_greet', assetStatus: 'available', loop: false }
    const playable = { ...requested, videoPath: 'pet-resource://test-pet/videos/act_greet.webm' }
    const renderer = new VideoPetRenderer({
      container: createContainer(),
      layers,
      assetBase: '/app/',
      actionResolver: () => ({ requested, playable, path: playable.videoPath })
    })

    expect(await renderer.play('act_greet')).toBe(true)
    expect(layers[1].src).toBe('pet-resource://test-pet/videos/act_greet.webm')
  })

  it('replays the active layer when the requested action path is unchanged', async () => {
    const { renderer, layers } = createRenderer()

    await renderer.play('act_greet')
    const active = layers[1]
    const inactive = layers[0]
    const loadCalls = active.loadCalls

    expect(await renderer.play('act_greet')).toBe(true)
    expect(active.loadCalls).toBe(loadCalls)
    expect(active.playCalls).toBe(2)
    expect(renderer.currentActionId).toBe('act_greet')
    expect(inactive.playCalls).toBe(0)
  })

  it('keeps the loop phase when returning to the idle video with restart:false', async () => {
    const { renderer, layers } = createRenderer()

    await renderer.play('idle_breath')
    const active = layers[1]
    active.currentTime = 1.25

    expect(await renderer.play('idle_breath', { loop: true, restart: false })).toBe(true)
    expect(active.currentTime).toBe(1.25)
    expect(active.playCalls).toBe(2)

    // 默认（restart 未指定）依旧从头重播，供指令重复触发使用。
    expect(await renderer.play('idle_breath', { loop: true })).toBe(true)
    expect(active.currentTime).toBe(0)
  })

  it('reuses the standby layer without reloading when switching back to a known video', async () => {
    vi.useFakeTimers()
    const { renderer, layers } = createRenderer()
    try {
      await renderer.play('idle_breath')
      await renderer.play('transition_settle')
      const idleLayer = layers[1]
      const loadCalls = idleLayer.loadCalls

      expect(await renderer.play('idle_breath')).toBe(true)
      expect(idleLayer.loadCalls).toBe(loadCalls)
      expect(idleLayer.classList.contains('visible')).toBe(true)
      expect(renderer.currentActionId).toBe('idle_breath')
      expect(idleLayer.currentTime).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('applies a longer crossfade duration for the idle-return transition', async () => {
    vi.useFakeTimers()
    const { renderer, layers } = createRenderer()
    try {
      await renderer.play('act_greet')
      expect(await renderer.play('idle_breath', { loop: true, restart: false, fadeMs: 260 })).toBe(true)
      expect(layers[0].style.transitionDuration).toBe('260ms')
      // 旧层在更长的转场结束后才暂停。
      expect(layers[1].pauseCalls).toBe(0)
      await vi.advanceTimersByTimeAsync(260)
      expect(layers[1].pauseCalls).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates semantic metadata when switching between independent videos', async () => {
    const { renderer, layers } = createRenderer()

    await renderer.play('idle_breath')
    await renderer.play('act_dance')

    const active = layers.find((layer) => layer.classList.contains('visible'))
    expect(active?.dataset.actionId).toBe('act_dance')
    expect(active?.dataset.assetStatus).toBe('available')
    expect(renderer.currentActionId).toBe('act_dance')
  })

  it('cancels a pending replacement when the active path is replayed', async () => {
    const { renderer, layers } = createRenderer()

    await renderer.play('emo_shy')
    layers[0].readyState = 0
    const pendingReplacement = renderer.play('idle_breath')
    layers[1].classList.remove('visible')

    expect(await renderer.play('emo_shy')).toBe(true)
    layers[0].emit('loadeddata')

    expect(await pendingReplacement).toBe(false)
    expect(renderer.currentActionId).toBe('emo_shy')
    expect(layers[1].classList.contains('visible')).toBe(true)
  })

  it('loads a dedicated action video while retaining its semantic ID', async () => {
    const { renderer, layers } = createRenderer()

    expect(await renderer.play('act_dance')).toBe(true)
    expect(layers[1].src).toBe('/app/assets/videos/actions/act_dance.webm')
    expect(layers[1].dataset.actionId).toBe('act_dance')
    expect(layers[1].dataset.assetStatus).toBe('available')
    expect(renderer.currentActionId).toBe('act_dance')
    expect(renderer.currentPath).toBe('assets/videos/actions/act_dance.webm')
  })

  it.each(['act_dance', 'act_sing'])('falls back from %s to idle exactly once on video error', async (actionId) => {
    const layers = [createVideo(), createVideo({ readyState: 0 })]
    const renderer = new VideoPetRenderer({ container: createContainer(), layers })
    const pendingPlay = renderer.play(actionId)

    layers[1].emit('error')
    await Promise.resolve()
    expect(layers[1].loadCalls).toBe(2)
    layers[1].emit('error')

    expect(await pendingPlay).toBe(false)
    expect(renderer.currentActionId).toBeNull()
    expect(layers[1].loadCalls).toBe(2)
  })

  it('returns false when idle_breath itself fails without recursing', async () => {
    const layers = [createVideo(), createVideo({ readyState: 0 })]
    const renderer = new VideoPetRenderer({ container: createContainer(), layers })
    const idlePlay = renderer.play('idle_breath')

    layers[1].emit('error')

    expect(await idlePlay).toBe(false)
    expect(layers[1].loadCalls).toBe(1)
    expect(renderer.currentActionId).toBeNull()
  })

  it('times out stalled loads, falls back, and remains usable for a later switch', async () => {
    vi.useFakeTimers()
    try {
      const layers = [createVideo(), createVideo({ readyState: 0 })]
      const renderer = new VideoPetRenderer({ container: createContainer(), layers })
      const pendingPlay = renderer.play('act_dance')

      await vi.advanceTimersByTimeAsync(VIDEO_READY_TIMEOUT_MS)
      await vi.advanceTimersByTimeAsync(VIDEO_READY_TIMEOUT_MS)

      expect(await pendingPlay).toBe(false)
      expect(renderer.currentActionId).toBeNull()
      expect(vi.getTimerCount()).toBe(0)

      layers[1].readyState = 3
      expect(await renderer.play('act_greet')).toBe(true)
      expect(renderer.currentActionId).toBe('act_greet')
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates scale, facing, look target, expression, physics phase, and destroys cleanly', async () => {
    const container = createContainer()
    const layers = [createVideo(), createVideo()]
    const phases = []
    const renderer = new VideoPetRenderer({ container, layers, onPhysicsPhase: (phase) => phases.push(phase) })
    await renderer.play('act_greet')

    renderer.setScale(9)
    renderer.setFacing('left')
    renderer.setLookTarget({ x: -1, y: 2 })
    renderer.setExpression('happy')
    renderer.setPhysicsPhase('airborne')

    expect(renderer.scale).toBe(3)
    expect(container.style.transform).toBe('scale(3)')
    expect(container.style.properties.get('--facing')).toBe('-1')
    expect(container.style.properties.get('--look-x')).toBe('0')
    expect(container.style.properties.get('--look-y')).toBe('1')
    expect(container.dataset.expression).toBe('happy')
    expect(container.dataset.physicsPhase).toBe('airborne')
    expect(phases).toEqual(['airborne'])

    renderer.destroy()
    expect(renderer.container).toBeNull()
    expect(layers[1].pauseCalls).toBe(1)
    expect(layers[1].classList.contains('visible')).toBe(false)
    expect(layers[1].removedAttributes).toEqual(['src', 'data-action-id'])
  })
})

describe('Live2DPetRenderer and factory fallback', () => {
  it('reports missing model3.json as unavailable', () => {
    const renderer = new Live2DPetRenderer()

    expect(renderer.isAvailable()).toBe(false)
    expect(renderer.unavailableReason).toMatch(/model3\.json/)
  })

  it('stays unavailable without an SDK even when model3.json is supplied', () => {
    const renderer = new Live2DPetRenderer({ modelUrl: 'models/fafa.model3.json' })

    expect(renderer.isAvailable()).toBe(false)
    expect(renderer.unavailableReason).toMatch(/Live2D.*不可用/)
    expect(renderer.unavailableReason).toMatch(/SDK|loader|接入/)
  })

  it('always falls back to VideoPetRenderer and reports the reason', () => {
    const notices = []
    const renderer = createPetRenderer({
      modelUrl: 'models/fafa.model3.json',
      container: createContainer(),
      layers: [createVideo(), createVideo()],
      onLive2DUnavailable: (reason) => notices.push(reason)
    })

    expect(renderer).toBeInstanceOf(VideoPetRenderer)
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatch(/Live2D.*不可用/)
  })
})
