import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppController } from '../src/main/app-controller.js'
import { BilibiliAdapter, mapEnter } from '../src/main/live/bilibili-adapter.js'

function createConfigStore(overrides = {}) {
  const config = {
    version: 3,
    roomId: '', broadcasterUid: '', liveEnabled: false, liveMock: true,
    tts: { enabled: false, hasKey: false },
    llm: { enabled: false, hasKey: false },
    music: { enabled: false, mock: true },
    quietHours: { enabled: false },
    liveEvents: { danmaku: true, gift: true, superChat: true, guard: true, enter: true },
    safety: { enabled: true, keywords: [] },
    idleSet: { actions: [] },
    commands: [],
    ...overrides
  }
  return { getAll: () => structuredClone(config), getSecret: () => '' }
}

function createManualTimers() {
  const entries = []
  return {
    entries,
    setTimeoutFn(callback, delay) { const entry = { callback, delay, canceled: false, fired: false }; entries.push(entry); return entry },
    clearTimeoutFn(entry) { if (entry) entry.canceled = true },
    fireIdleNext() {
      const entry = entries.find((candidate) => !candidate.canceled && !candidate.fired && candidate.delay >= 20_000)
      if (!entry) throw new Error('no pending idle timer')
      entry.fired = true
      entry.callback()
    }
  }
}

function createFakeClient() {
  const listeners = new Map()
  return {
    on(event, handler) { listeners.set(event, handler) },
    emit(event, payload) { listeners.get(event)?.(payload) },
    removeAllListeners() { listeners.clear() },
    close() {}
  }
}

afterEach(() => vi.useRealTimers())

describe('mapEnter', () => {
  it('maps INTERACT_WORD payloads to enter events', () => {
    const raw = { data: { msg_id: 'i-1', uid: 'u9', uname: '小风' } }
    const event = mapEnter(raw)
    expect(event).toEqual({ type: 'enter', id: 'i-1', user: { id: 'u9', name: '小风' }, raw })
  })
})

describe('BilibiliAdapter enter events', () => {
  it('forwards INTERACT_WORD as a unified enter event', async () => {
    const adapter = new BilibiliAdapter({ roomId: '123', getConfImpl: async () => ({}), clientFactory: () => createFakeClient() })
    const events = []
    adapter.on('event', (event) => events.push(event))
    await adapter.connect()
    adapter.client.emit('INTERACT_WORD', { data: { msg_id: 'i-1', uid: 'u9', uname: '小风' } })
    expect(events.map((event) => event.type)).toEqual(['enter'])
    expect(events[0]).toMatchObject({ id: 'i-1', user: { id: 'u9', name: '小风' } })
    adapter.disconnect()
  })
})

describe('AppController live-event broadcasts', () => {
  it('emits live-event for processed danmaku with outcome', async () => {
    const controller = new AppController(createConfigStore())
    const events = []
    controller.on('live-event', (event) => events.push(event))
    await controller.handleLiveEvent({ type: 'danmaku', id: 'd1', user: { id: 'u1', name: '观众' }, text: '发发好' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'danmaku', outcome: 'processed', user: { id: 'u1', name: '观众' }, text: '发发好' })
    expect(events[0].at).toBeTypeOf('number')
    controller.dispose()
  })

  it('notifies enter events without queuing actions or consuming rate limit', async () => {
    const controller = new AppController(createConfigStore())
    const events = []
    const actions = []
    controller.on('live-event', (event) => events.push(event))
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'enter', user: { id: 'u2', name: '小风' } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'enter', outcome: 'notified', user: { name: '小风' } })
    expect(actions).toEqual([])
    expect(controller.getLiveTimeline().at(-1)).toMatchObject({ type: 'enter', outcome: 'notified' })
    controller.dispose()
  })

  it('reports disabled and paused outcomes', async () => {
    const controller = new AppController(createConfigStore({ liveEvents: { danmaku: true, gift: false, superChat: true, guard: true, enter: true } }))
    const events = []
    controller.on('live-event', (event) => events.push(event))
    await controller.handleLiveEvent({ type: 'gift', id: 'g1', user: { id: 'u3', name: '老板' }, giftName: '辣条' })
    controller.pauseLive()
    await controller.handleLiveEvent({ type: 'danmaku', id: 'd2', user: { id: 'u4', name: '观众' }, text: '你好' })
    expect(events.map((event) => event.outcome)).toEqual(['disabled', 'paused'])
    controller.dispose()
  })

  it('reports blocked outcomes for filtered danmaku', async () => {
    const controller = new AppController(createConfigStore({ safety: { enabled: true, keywords: ['微信'] } }))
    const events = []
    controller.on('live-event', (event) => events.push(event))
    await controller.handleLiveEvent({ type: 'danmaku', id: 'd3', user: { id: 'u5', name: '观众' }, text: '加微信 123' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'danmaku', outcome: 'blocked', text: '' })
    controller.dispose()
  })

  it('emits live-event for connection status changes', async () => {
    const controller = new AppController(createConfigStore())
    const events = []
    controller.on('live-event', (event) => events.push(event))
    await controller.handleLiveEvent({ type: 'status', status: 'connected' })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'status', status: 'connected' })
    controller.dispose()
  })
})

describe('AppController idle set', () => {
  it('plays only the picked idle actions when idleSet.actions is set', async () => {
    const timers = createManualTimers()
    const controller = new AppController(createConfigStore({ idleSet: { actions: ['act_hop'] } }), { setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn, randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.applyConfig()
    timers.fireIdleNext()
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ actionId: 'act_hop', source: 'idle' })
    controller.dispose()
  })

  it('falls back to the default pool when idleSet.actions is empty', async () => {
    const timers = createManualTimers()
    const controller = new AppController(createConfigStore(), { setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn, randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.applyConfig()
    timers.fireIdleNext()
    expect(actions).toHaveLength(1)
    expect(actions[0].source).toBe('idle')
    expect(actions[0].actionId).not.toBe('idle_breath')
    controller.dispose()
  })
})
