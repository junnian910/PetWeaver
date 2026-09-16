import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppController } from '../src/main/app-controller.js'
import { normalizeRelationship } from '../src/main/core/relationship.js'
import { AIMemoryStore } from '../src/main/core/ai-memory.js'

const config = {
  version: 2,
  roomId: '', broadcasterUid: '', liveEnabled: false, liveMock: true,
  tts: { enabled: false, hasKey: false },
  llm: { enabled: false, hasKey: false },
  music: { enabled: false, mock: true },
  commands: []
}

function createConfigStore() {
  return { getAll: () => structuredClone(config), getSecret: () => '' }
}

function createDeferredTTS() {
  const pending = []
  return {
    pending,
    synthesize: vi.fn((text) => new Promise((resolve) => pending.push({ text, resolve })))
  }
}

function createManualTimers() {
  const entries = []
  const cleared = []
  return {
    entries,
    cleared,
    setTimeoutFn(callback, delay) {
      const entry = { callback, delay, canceled: false }
      entries.push(entry)
      return entry
    },
    clearTimeoutFn(entry) {
      if (entry) entry.canceled = true
      cleared.push(entry)
    },
    fireNext() {
      const entry = entries.find((candidate) => !candidate.canceled && !candidate.fired)
      if (!entry) throw new Error('no pending timer')
      entry.fired = true
      entry.callback()
    },
    fireIdleNext() {
      const entry = entries.find((candidate) => !candidate.canceled && !candidate.fired && candidate.delay >= 20_000)
      if (!entry) throw new Error('no pending idle timer')
      entry.fired = true
      entry.callback()
    },
    active() { return entries.filter((entry) => !entry.canceled && !entry.fired) }
  }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => vi.useRealTimers())

describe('AppController delayed TTS', () => {
  it('forwards precomputed audio when the action actually starts', () => {
    const controller = new AppController(createConfigStore())
    const audio = []
    controller.on('action-audio', (payload) => audio.push(payload))

    controller.scheduler.request({ actionId: 'act_greet', text: '已有语音', audio: { type: 'url', value: 'ready-audio' } })

    expect(audio).toHaveLength(1)
    expect(audio[0]).toMatchObject({ actionId: 'act_greet', audio: { value: 'ready-audio' } })
    controller.dispose()
  })

  it('emits instanceId and actionId, and ignores late TTS from an old same-action instance', async () => {
    const controller = new AppController(createConfigStore())
    const tts = createDeferredTTS()
    controller.tts = tts
    const actions = []
    const audio = []
    controller.on('action', (action) => actions.push(action))
    controller.on('action-audio', (payload) => audio.push(payload))

    controller.triggerTest('act_greet', 'old', 300)
    const oldAction = actions.at(-1)
    controller.scheduler.stop()
    controller.triggerTest('act_greet', 'new', 300)
    const newAction = actions.at(-1)

    expect(oldAction.actionId).toBe('act_greet')
    expect(oldAction.instanceId).toMatch(/^[0-9a-f-]{36}$/)
    expect(oldAction.instanceId).not.toBe(oldAction.actionId)
    expect(newAction.instanceId).not.toBe(oldAction.instanceId)
    expect(tts.synthesize).toHaveBeenCalledTimes(2)

    tts.pending[0].resolve({ type: 'url', value: 'old-audio' })
    await flushPromises()
    expect(audio).toEqual([])
    tts.pending[1].resolve({ type: 'url', value: 'new-audio' })
    await flushPromises()
    expect(audio).toEqual([{ instanceId: newAction.instanceId, actionId: 'act_greet', audio: { type: 'url', value: 'new-audio' } }])
    controller.dispose()
  })

  it('does not synthesize queued actions until they become current', async () => {
    vi.useFakeTimers()
    const controller = new AppController(createConfigStore())
    const tts = createDeferredTTS()
    controller.tts = tts

    controller.scheduler.request({ actionId: 'act_work', text: 'current', priority: 20, durationMs: 100 })
    controller.scheduler.request({ actionId: 'act_greet', text: 'queued', priority: 10, durationMs: 100 })
    expect(tts.synthesize).toHaveBeenCalledTimes(1)
    tts.pending[0].resolve(null)
    await flushPromises()
    // act_work 完成后进入 1s 动作冷却，冷却结束 act_greet 才成为 current 并合成 TTS。
    vi.advanceTimersByTime(1300)
    expect(tts.synthesize).toHaveBeenCalledTimes(2)
    expect(tts.pending[1].text).toBe('queued')
    controller.dispose()
  })
})

describe('AppController idle scheduling and gates', () => {
  it('schedules one 20-45 second timer, restarts without stacking, and disposes it', async () => {
    const timers = createManualTimers()
    const controller = new AppController(createConfigStore(), { ...timers, randomFn: () => 1 })

    await controller.applyConfig()
    expect(timers.active()).toHaveLength(2)
    expect(timers.active()[0].delay).toBe(45_000)
    const first = timers.active()[0]
    await controller.applyConfig()
    expect(first.canceled).toBe(true)
    expect(timers.active()).toHaveLength(2)
    controller.dispose()
    expect(timers.active()).toHaveLength(0)
  })

  it.each([
    ['scheduler busy', (controller) => controller.scheduler.request({ actionId: 'act_sleep' })],
    ['persistent sleep', (controller) => controller.setIdleGate({ sleep: true })],
    ['dragging', (controller) => controller.setIdleGate({ dragging: true })],
    ['physics phase', (controller) => controller.setIdleGate({ tossing: true, physicsPhase: 'airborne' })]
  ])('does not start idle random while %s, then resumes after the gate clears', async (_name, setGate) => {
    const timers = createManualTimers()
    const controller = new AppController(createConfigStore(), { ...timers, randomFn: () => 0 })
    await controller.applyConfig()
    const actions = []
    controller.on('action', (action) => actions.push(action))
    setGate(controller)
    actions.length = 0
    timers.fireIdleNext()
    expect(actions).toEqual([])

    controller.scheduler.stop()
    controller.setIdleGate({ sleep: false, dragging: false, tossing: false, physicsPhase: 'idle' })
    timers.fireIdleNext()
    expect(actions).toHaveLength(1)
    expect(actions[0].source).toBe('idle')
    controller.dispose()
  })
})

describe('AppController schedule', () => {
  function createScheduleStore(schedule, extra = {}) {
    return { getAll: () => structuredClone({ ...config, schedule, ...extra }), getSecret: () => '' }
  }

  it('fires hourly chime and due reminders once per window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 14, 12, 29, 50))
    const schedule = {
      hourlyChime: true,
      reminders: [{ id: 'r1', time: '12:30', text: '喝水啦！', actionId: 'act_stretch', enabled: true }]
    }
    const controller = new AppController(createScheduleStore(schedule))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.applyConfig()

    vi.advanceTimersByTime(15_000) // 12:30:05 → 提醒到点
    expect(actions.filter((action) => action.source === 'schedule' && action.actionId === 'act_stretch')).toHaveLength(1)
    vi.advanceTimersByTime(15_000) // 12:30:20 → 同一分钟不重复
    expect(actions.filter((action) => action.source === 'schedule')).toHaveLength(1)

    vi.setSystemTime(new Date(2026, 7, 14, 13, 0, 0))
    vi.advanceTimersByTime(15_000)
    expect(actions.filter((action) => action.source === 'schedule' && action.actionId === 'special_hourly')).toHaveLength(1)
    controller.dispose()
    vi.useRealTimers()
  })

  it('suppresses chime and reminders during quiet hours and busy gates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 14, 12, 29, 50))
    const schedule = {
      hourlyChime: true,
      reminders: [{ id: 'r1', time: '12:30', text: '喝水啦！', enabled: true }]
    }
    const quietHours = { enabled: true, start: '12:00', end: '13:00' }
    const controller = new AppController(createScheduleStore(schedule, { quietHours }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.applyConfig()
    vi.advanceTimersByTime(15_000)
    expect(actions).toHaveLength(0)
    controller.dispose()
    vi.useRealTimers()
  })

  it('does nothing when the config has no schedule section', async () => {
    const controller = new AppController(createConfigStore())
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.applyConfig()
    controller.handleLiveEvent({ type: 'status', status: 'connected' })
    expect(actions).toHaveLength(0)
    controller.dispose()
  })
})

describe('AppController relationship', () => {
  function createStore(patch = {}) {
    const persisted = {}
    return {
      persisted,
      getAll: () => structuredClone({ ...config, ...patch }),
      getSecret: () => '',
      getRelationship: () => (persisted.state ? normalizeRelationship(persisted.state) : undefined),
      setRelationship: (state) => { persisted.state = structuredClone(state) },
      resetRelationship: () => { delete persisted.state }
    }
  }

  it('records interactions, persists them and celebrates stage upgrades', async () => {
    const store = createStore()
    const controller = new AppController(store)
    const actions = []
    const notices = []
    controller.on('action', (action) => actions.push(action))
    controller.on('notice', (message) => notices.push(message))

    await controller.triggerLocal('act_greet')
    expect(controller.relationship.intimacy).toBe(2)
    expect(store.persisted.state.intimacy).toBe(2)

    controller.relationship = { ...controller.relationship, intimacy: 99, stage: '初见' }
    await controller.triggerLocal('act_greet')
    expect(controller.relationship.stage).toBe('熟悉')
    expect(notices.some((message) => message.includes('关系升级'))).toBe(true)
    expect(actions.some((action) => action.actionId === 'act_firework')).toBe(true)
    controller.dispose()
  })

  it('resets relationship state on demand', () => {
    const store = createStore()
    const controller = new AppController(store)
    controller.recordInteraction('guard')
    expect(controller.relationship.intimacy).toBeGreaterThan(0)
    const reset = controller.resetRelationship()
    expect(reset.intimacy).toBe(0)
    expect(reset.stage).toBe('初见')
    controller.dispose()
  })

  it('loads persisted relationship during applyConfig', async () => {
    const store = createStore()
    store.persisted.state = { intimacy: 120, dailyInteractions: 9, lastDate: '', stage: '初见', mood: 40, moodUpdatedAt: 0 }
    const controller = new AppController(store)
    await controller.applyConfig()
    expect(controller.relationship.intimacy).toBe(120)
    expect(controller.relationship.stage).toBe('熟悉')
    controller.dispose()
  })
})

describe('AppController live console', () => {
  function createStore(patch = {}) {
    return { getAll: () => structuredClone({ ...config, ...patch }), getSecret: () => '' }
  }

  it('pauses live events into the timeline and resumes processing', async () => {
    const controller = new AppController(createStore())
    const actions = []
    controller.on('action', (action) => actions.push(action))
    controller.pauseLive()
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u1', name: '老板' }, giftName: '辣条' })
    expect(actions).toHaveLength(0)
    expect(controller.getLiveTimeline()).toHaveLength(1)
    expect(controller.getLiveTimeline()[0]).toMatchObject({ type: 'gift', outcome: 'paused' })
    controller.resumeLive()
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u2', name: '老板2' }, giftName: '辣条' })
    expect(actions).toHaveLength(1)
    expect(controller.getLiveTimeline().at(-1).outcome).toBe('processed')
    controller.dispose()
  })

  it('caps the event timeline at 200 entries', async () => {
    const controller = new AppController(createStore())
    for (let index = 0; index < 250; index += 1) {
      await controller.handleLiveEvent({ type: 'status', status: 'connected' })
      controller.pauseLive()
      await controller.handleLiveEvent({ type: 'danmaku', text: 'x' + index, user: { id: 'u' + index, name: 'n' } })
      controller.resumeLive()
    }
    // status 事件不进入时间线，只有被暂停的弹幕会记录
    expect(controller.getLiveTimeline().length).toBeLessThanOrEqual(200)
    controller.dispose()
  })

  it('clears only live-sourced pending actions', () => {
    const controller = new AppController(createStore())
    controller.scheduler.request({ actionId: 'act_work', priority: 30, durationMs: 900, source: 'mouse' })
    controller.scheduler.request({ actionId: 'gift_thanks', priority: 20, durationMs: 300, source: 'gift' })
    controller.scheduler.request({ actionId: 'idle_blink', priority: 10, durationMs: 300, source: 'danmaku' })
    expect(controller.clearLiveActions()).toBe(2)
    controller.dispose()
  })
})

describe('AppController safety, gift tiers and games', () => {
  function createStore(patch = {}) {
    return { getAll: () => structuredClone({ ...config, ...patch }), getSecret: () => '' }
  }

  it('blocks sensitive danmaku before it reaches any handler', async () => {
    const controller = new AppController(createStore({ safety: { enabled: true, keywords: ['微信'] } }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'danmaku', text: '加微信 123', user: { id: 'u1', name: '观众' } })
    expect(actions).toHaveLength(0)
    expect(controller.getLiveTimeline().at(-1)).toMatchObject({ outcome: 'blocked', text: '' })
    controller.dispose()
  })

  it('disables event types via the liveEvents toggles', async () => {
    const controller = new AppController(createStore({ liveEvents: { danmaku: true, gift: false, superChat: true, guard: true } }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u1', name: '老板' }, giftName: '辣条' })
    expect(actions).toHaveLength(0)
    expect(controller.getLiveTimeline().at(-1).outcome).toBe('disabled')
    controller.dispose()
  })

  it('escalates gift reactions by price tier', async () => {
    const controller = new AppController(createStore())
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u1', name: '老板' }, giftName: '辣条', price: 100 })
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u2', name: '大户' }, giftName: '小电视', price: 120_000 })
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u3', name: '神豪' }, giftName: '飞船', price: 1_050_000 })
    expect(actions.map((action) => action.actionId)).toEqual(['gift_thanks', 'act_dance', 'act_firework'])
    controller.dispose()
  })

  it('uses the configured gift action pool when actionAssign.gift is set', async () => {
    const controller = new AppController(createStore({ actionAssign: { gift: ['act_hop'] } }), { randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u1', name: '老板' }, giftName: '辣条', price: 100 })
    expect(actions[0]).toMatchObject({ actionId: 'act_hop', source: 'gift' })
    controller.dispose()
  })

  it('uses configured pools for super chat and guard events', async () => {
    const controller = new AppController(createStore({ actionAssign: { superChat: ['act_stretch'], guard: ['act_spin'] } }), { randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'superChat', user: { id: 'u1', name: '老板' }, text: '留言' })
    await controller.handleLiveEvent({ type: 'guard', user: { id: 'u2', name: '舰长' } })
    expect(actions.map((action) => action.actionId)).toEqual(['act_stretch', 'act_spin'])
    controller.dispose()
  })

  it('plays rock-paper-scissors and lucky draw for game commands', async () => {
    const commands = [
      { aliases: ['猜拳'], actionId: 'game_rps', text: '', priority: 40 },
      { aliases: ['抽签'], actionId: 'game_lots', text: '', priority: 40 }
    ]
    const controller = new AppController(createStore({ commands }), { randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发,猜拳', user: { id: 'u1', name: '观众' } })
    controller.scheduler.stop()
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发,抽签', user: { id: 'u2', name: '老板' } })
    expect(actions[0]).toMatchObject({ actionId: 'act_greet', text: '我出石头！你出什么？', source: 'danmaku' })
    expect(actions[1]).toMatchObject({ actionId: 'act_greet', source: 'danmaku' })
    expect(actions[1].text).toContain('抽到了「大吉」')
    controller.dispose()
  })

  it('uses the lottery action pool for lottery events', async () => {
    const commands = [{ aliases: ['开奖'], actionId: 'lottery_draw', text: '', priority: 100, adminOnly: true }]
    const controller = new AppController(createStore({ commands, broadcasterUid: 'u1', actionAssign: { lottery: ['act_hop'] } }), { randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    controller.lottery.join({ id: 'u1', name: '观众' })
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发,开奖', user: { id: 'u1', name: '观众' } })
    expect(actions.at(-1)).toMatchObject({ actionId: 'act_hop', source: 'danmaku' })
    controller.dispose()
  })

  it('tracks the current music track on successful song requests', async () => {
    const controller = new AppController(createStore({ music: { enabled: true, mock: false } }))
    controller.music = { request: async () => ({ title: '测试曲目' }), disconnect: () => {} }
    await controller.handleLiveEvent({ type: 'danmaku', text: '点歌,测试', user: { id: 'u1', name: '观众' } })
    expect(controller.getStatus().currentTrack).toBe('测试曲目')
    controller.dispose()
  })
})

describe('AppController applause and session summary', () => {
  function createStore(patch = {}) {
    return { getAll: () => structuredClone({ ...config, ...patch }), getSecret: () => '' }
  }

  it('celebrates applause after enough mic spikes', () => {
    const controller = new AppController(createStore({ voice: { enabled: true }, applause: { enabled: true, threshold: 60, spikesRequired: 4, windowMs: 3000, cooldownMs: 30000 } }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    for (let clap = 0; clap < 5; clap += 1) {
      controller.handleVoiceLevel(20)
      controller.handleVoiceLevel(80)
    }
    expect(actions.some((action) => action.actionId === 'emo_excited' && action.text.includes('掌声'))).toBe(true)
    controller.dispose()
  })

  it('summarizes the live session when the connection drops', async () => {
    const controller = new AppController(createStore())
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'status', status: 'connected' })
    await controller.handleLiveEvent({ type: 'danmaku', text: '你好', user: { id: 'u1', name: '观众' } })
    await controller.handleLiveEvent({ type: 'gift', user: { id: 'u2', name: '老板' }, giftName: '辣条' })
    await controller.handleLiveEvent({ type: 'status', status: 'disconnected' })
    expect(actions).toHaveLength(3)
    expect(actions.at(-1).source).toBe('session')
    expect(actions.at(-1).text).toContain('1条弹幕')
    expect(actions.at(-1).text).toContain('1件礼物')
    controller.dispose()
  })

  it('does not summarize when the session never started', async () => {
    const controller = new AppController(createStore())
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'status', status: 'disconnected' })
    expect(actions).toHaveLength(0)
    controller.dispose()
  })

  it('uses the session action pool for session summary', async () => {
    const controller = new AppController(createStore({ actionAssign: { session: ['act_dance'] } }), { randomFn: () => 0 })
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'status', status: 'connected' })
    await controller.handleLiveEvent({ type: 'status', status: 'disconnected' })
    expect(actions.at(-1)).toMatchObject({ actionId: 'act_dance', source: 'session' })
    controller.dispose()
  })
})

describe('AppController voice reactions', () => {
  function createVoiceStore(voice) {
    return { getAll: () => structuredClone({ ...config, voice }), getSecret: () => '' }
  }

  it('fires shout reactions from mic levels and respects the cooldown', () => {
    vi.useFakeTimers()
    const controller = new AppController(createVoiceStore({ enabled: true, threshold: 35, sensitivity: 1, reactionCooldownMs: 6000, shoutAction: 'emo_shout' }))
    const actions = []
    controller.on('action', (action) => actions.push(action))

    controller.handleVoiceLevel(80)
    expect(actions.filter((action) => action.actionId === 'emo_shout')).toHaveLength(1)
    expect(actions[0].source).toBe('voice')

    controller.handleVoiceLevel(80)
    expect(actions.filter((action) => action.actionId === 'emo_shout')).toHaveLength(1)

    vi.advanceTimersByTime(7_000)
    controller.handleVoiceLevel(80)
    expect(actions.filter((action) => action.actionId === 'emo_shout')).toHaveLength(2)
    controller.dispose()
    vi.useRealTimers()
  })

  it('treats IPC microphone levels as percentages instead of normalized amplitudes', () => {
    const controller = new AppController(createVoiceStore({ enabled: true, threshold: 35, sensitivity: 1, reactionCooldownMs: 6000, shoutAction: 'emo_shout' }))
    const actions = []
    controller.on('action', (action) => actions.push(action))

    controller.handleVoiceLevel(30)
    expect(actions).toHaveLength(0)
    controller.handleVoiceLevel(80)
    expect(actions).toHaveLength(1)
    controller.dispose()
  })

  it('covers ears after sustained noise and ignores levels when disabled', () => {
    vi.useFakeTimers()
    const controller = new AppController(createVoiceStore({ enabled: true, threshold: 35, sensitivity: 1, reactionCooldownMs: 6000, coverAfterSeconds: 1.5 }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    for (let tick = 0; tick < 40; tick += 1) {
      vi.advanceTimersByTime(50)
      controller.handleVoiceLevel(90)
    }
    // 捂耳朵优先级低于正在播放的大叫，先进入调度队列；推进时间让队列消化后再断言。
    vi.advanceTimersByTime(3_000)
    expect(actions.some((action) => action.actionId === 'act_cover_ears')).toBe(true)
    controller.dispose()

    const disabled = new AppController(createVoiceStore({ enabled: false, threshold: 35 }))
    const actions2 = []
    disabled.on('action', (action) => actions2.push(action))
    disabled.handleVoiceLevel(100)
    expect(actions2).toHaveLength(0)
    disabled.dispose()
    vi.useRealTimers()
  })
})

describe('AppController voice transcripts and reply scopes', () => {
  function createStore(patch = {}) {
    return { getAll: () => structuredClone({ ...config, ...patch }), getSecret: () => '' }
  }

  it('routes voice commands through the command table with a voice source', async () => {
    const commands = [{ aliases: ['跳舞'], actionId: 'act_dance', text: '蹦起来～', priority: 50 }]
    const controller = new AppController(createStore({ commands }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleVoiceTranscript('发发,跳舞')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ actionId: 'act_dance', source: 'voice' })
    controller.dispose()
  })

  it('triggers voice commands without the 发发 prefix and reports the outcome', async () => {
    const commands = [{ aliases: ['跳舞'], actionId: 'act_dance', text: '蹦起来～', priority: 50 }]
    const controller = new AppController(createStore({ commands }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    const result = await controller.handleVoiceTranscript('跳舞')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ actionId: 'act_dance', source: 'voice' })
    expect(result).toMatchObject({ kind: 'command', actionId: 'act_dance' })
    controller.dispose()
  })

  it('uses the configured voice action pool for non-command speech', async () => {
    const controller = new AppController(createStore({ llm: { enabled: false, hasKey: false, inputSource: 'all' }, actionAssign: { voice: ['act_sing'] } }))
    controller.llm = { reply: async () => '自定义回复' }
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleVoiceTranscript('今天天气怎么样')
    expect(actions[0]).toMatchObject({ actionId: 'act_sing', source: 'voice', text: '自定义回复' })
    controller.dispose()
  })

  it('treats non-command speech as LLM chat only when the voice input source is allowed', async () => {
    const allowed = new AppController(createStore({ llm: { enabled: false, hasKey: false, inputSource: 'all' } }))
    const blocked = new AppController(createStore({ llm: { enabled: false, hasKey: false, inputSource: 'danmaku' } }))
    allowed.llm = { reply: async () => '自定义回复' }
    const a1 = []
    const a2 = []
    allowed.on('action', (action) => a1.push(action))
    blocked.on('action', (action) => a2.push(action))
    await allowed.handleVoiceTranscript('今天天气怎么样')
    await blocked.handleVoiceTranscript('今天天气怎么样')
    expect(a1).toHaveLength(1)
    expect(a1[0]).toMatchObject({ source: 'voice', text: '自定义回复' })
    expect(a2).toHaveLength(1)
    expect(a2[0]).toMatchObject({ source: 'voice', text: '我听见啦！' })
    allowed.dispose()
    blocked.dispose()
  })

  it('gates TTS synthesis by reply scope per action source', async () => {
    const tts = { synthesize: vi.fn(async () => null) }
    const danmakuOnly = new AppController(createStore({ tts: { enabled: false, hasKey: false, replyScope: 'danmaku' } }))
    danmakuOnly.tts = tts
    danmakuOnly.scheduler.request({ actionId: 'act_greet', text: '语音台词', priority: 40, source: 'voice' })
    await flushPromises()
    expect(tts.synthesize).not.toHaveBeenCalled()
    danmakuOnly.scheduler.request({ actionId: 'act_greet', text: '弹幕台词', priority: 60, source: 'danmaku' })
    await flushPromises()
    expect(tts.synthesize).toHaveBeenCalledTimes(1)
    expect(tts.synthesize).toHaveBeenCalledWith('弹幕台词')
    danmakuOnly.dispose()
  })

  it('speaks ordinary danmaku as a low-priority attribution and keeps commands silent', async () => {
    const commands = [{ aliases: ['跳舞'], actionId: 'act_dance', text: '蹦起来～', priority: 50 }]
    const controller = new AppController(createStore({ commands }))
    const actions = []
    controller.on('action', (action) => actions.push(action))

    await controller.handleLiveEvent({ id: 'ordinary-1', type: 'danmaku', text: '大家好', user: { id: 'u1', name: '观众' } })
    await controller.handleLiveEvent({ id: 'command-1', type: 'danmaku', text: '发发,跳舞', user: { id: 'u2', name: '观众2' } })

    expect(actions.some((action) => action.text === '观众说：大家好' && action.source === 'danmaku')).toBe(true)
    expect(actions.some((action) => action.actionId === 'act_dance' && action.text === '蹦起来～')).toBe(true)
    expect(actions.some((action) => action.text?.includes('发发,跳舞'))).toBe(false)
    controller.dispose()
  })

  it('passes the persona and top local memory matches through the shared LLM path', async () => {
    const memory = new AIMemoryStore()
    memory.add({ prompt: '之前的问题', reply: '之前的回答', at: 1, vector: [1, 0] })
    const received = []
    const controller = new AppController(createStore({ llm: { personaPrompt: '自定义形象', inputSource: 'all' } }), {
      memoryStore: memory,
      embedder: { embed: vi.fn(async () => [1, 0]), status: () => ({ available: true, loaded: true }) }
    })
    controller.llm = { reply: vi.fn(async (_messages, context) => { received.push(context); return '新的回答' }) }

    await expect(controller.testLlmReply('新的问题')).resolves.toBe('新的回答')
    expect(received[0]).toMatchObject({ personaPrompt: '自定义形象' })
    expect(received[0].memories).toHaveLength(1)
    expect(controller.getStatus().memory).toMatchObject({ records: 2, capacity: 400 })
    controller.dispose()
  })

  it('uses the active role package persona for the shared LLM path', async () => {
    const received = []
    const controller = new AppController(createStore({ pet: { activePackageId: 'momo' }, llm: { personaPrompt: '旧角色提示词', inputSource: 'all' } }), {
      petPackageService: { active: vi.fn(() => ({ id: 'momo', persona: { prompt: '你是 Momo，一只安静的像素猫。' } })) }
    })
    controller.llm = { reply: vi.fn(async (_messages, context) => { received.push(context); return '喵' }) }

    await expect(controller.testLlmReply('你好')).resolves.toBe('喵')
    expect(received[0]).toMatchObject({ personaPrompt: '你是 Momo，一只安静的像素猫。' })
    controller.dispose()
  })
})

describe('AppController ASR pcm feed', () => {
  function createAsrStore() {
    return {
      getAll: () => structuredClone({ ...config, voice: { enabled: true }, asr: { enabled: true } }),
      getSecret: () => ''
    }
  }

  it('creates the ASR session lazily and forwards chunks', () => {
    const writes = []
    const controller = new AppController(createAsrStore())
    controller.asr = {
      createSession: vi.fn(({ onFinal }) => ({ write: (chunk) => writes.push(chunk), end: vi.fn(), onFinal }))
    }
    controller.feedAsrPcm(new Int16Array([1, 2]))
    controller.feedAsrPcm(new Int16Array([3]))
    expect(controller.asr.createSession).toHaveBeenCalledTimes(1)
    expect(writes).toHaveLength(2)
    controller.stopAsrSession()
    controller.dispose()
  })

  it('backs off after an ASR session error instead of reconnecting per chunk', () => {
    vi.useFakeTimers()
    let sessionCount = 0
    const controller = new AppController(createAsrStore())
    controller.asr = {
      createSession: vi.fn(({ onError }) => {
        sessionCount += 1
        setTimeout(() => onError(), 0)
        return { write: vi.fn(), end: vi.fn() }
      })
    }
    controller.feedAsrPcm(new Int16Array([1]))
    vi.advanceTimersByTime(10)
    expect(sessionCount).toBe(1)
    controller.feedAsrPcm(new Int16Array([2]))
    controller.feedAsrPcm(new Int16Array([3]))
    expect(sessionCount).toBe(1)
    vi.advanceTimersByTime(10_000)
    controller.feedAsrPcm(new Int16Array([4]))
    expect(sessionCount).toBe(2)
    controller.dispose()
    vi.useRealTimers()
  })

  it('uses the same ASR chain for a one-shot test-center microphone session', async () => {
    let callbacks
    const controller = new AppController(createAsrStore())
    controller.asr = {
      createSession: vi.fn((options) => { callbacks = options; return { write: vi.fn(), end: vi.fn() } })
    }
    const results = []
    controller.on('test-voice-result', (result) => results.push(result))

    expect(controller.feedTestAsrPcm(new Int16Array([1, 2]))).toBe(true)
    await callbacks.onFinal('麦克风测试')
    await flushPromises()

    expect(results[0]).toMatchObject({ text: '麦克风测试' })
    controller.dispose()
  })
})

describe('AppController name mention, wake word and quiet hours', () => {
  function createStore(patch = {}) {
    return { getAll: () => structuredClone({ ...config, ...patch }), getSecret: () => '' }
  }

  it('reacts to name mentions without the command prefix, throttled globally', async () => {
    vi.useFakeTimers()
    const controller = new AppController(createStore({ interaction: { nameReact: true } }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发今天好可爱', user: { id: 'u1', name: '观众A' } })
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ actionId: 'act_lookaround', source: 'nickname' })
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发在吗', user: { id: 'u2', name: '观众B' } })
    expect(actions).toHaveLength(1)
    vi.advanceTimersByTime(9_000)
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发！', user: { id: 'u3', name: '观众C' } })
    expect(actions).toHaveLength(3)
    controller.dispose()
    vi.useRealTimers()
  })

  it('does not react to mentions when disabled', async () => {
    const controller = new AppController(createStore({ interaction: { nameReact: false } }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleLiveEvent({ type: 'danmaku', text: '发发好', user: { id: 'u1', name: '观众' } })
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ source: 'danmaku', text: '观众说：发发好' })
    controller.dispose()
  })

  it('ignores voice transcripts until the wake word is spoken', async () => {
    vi.useFakeTimers()
    const controller = new AppController(createStore({ voice: { wakeWordEnabled: true }, llm: { inputSource: 'voice' } }))
    const actions = []
    controller.on('action', (action) => actions.push(action))
    await controller.handleVoiceTranscript('今天天气不错')
    expect(actions).toHaveLength(0)
    await controller.handleVoiceTranscript('发发 今天天气不错')
    expect(actions).toHaveLength(1)
    controller.dispose()
    vi.useRealTimers()
  })

  it('suppresses TTS during quiet hours but still plays actions', async () => {
    const store = createStore({ quietHours: { enabled: true, start: '00:00', end: '23:59' } })
    const controller = new AppController(store)
    const tts = { synthesize: vi.fn(async () => null) }
    controller.tts = tts
    controller.scheduler.request({ actionId: 'act_greet', text: '夜深了', priority: 60, source: 'danmaku' })
    await flushPromises()
    expect(tts.synthesize).not.toHaveBeenCalled()
    controller.dispose()
  })
})

describe('AppController live event containment', () => {
  it('queues malformed gift events with fallback names instead of rejecting', async () => {
    const controller = new AppController(createConfigStore())
    const actions = []
    controller.on('action', (action) => actions.push(action))

    await expect(controller.handleLiveEvent({ type: 'gift' })).resolves.toBe(true)
    await expect(controller.handleLiveEvent({ type: 'superChat', text: 'hello' })).resolves.toBe(true)
    await expect(controller.handleLiveEvent(null)).resolves.toBeUndefined()
    expect(actions).toHaveLength(2)
    expect(actions[0].text).toContain('观众')
    controller.dispose()
  })

  it('reports events that fail mid-handling as notices instead of rejecting', async () => {
    const controller = new AppController(createConfigStore())
    const notices = []
    controller.on('notice', (message) => notices.push(message))

    await expect(controller.handleLiveEvent({ type: 'danmaku', text: '发发,跳舞' })).resolves.toBe(true)
    expect(notices).toHaveLength(0)
    controller.dispose()
  })
})
