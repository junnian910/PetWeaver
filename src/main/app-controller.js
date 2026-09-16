import { EventEmitter } from 'node:events'
import { ActionScheduler } from './core/action-scheduler.js'
import { parseCommand, parseDirectCommand } from './core/command-parser.js'
import { Lottery } from './core/lottery.js'
import { SlidingWindowLimiter, UserCooldown } from './core/rate-limiter.js'
import { createLiveAdapter } from './live/adapter-factory.js'
import { OfflineLLMProvider, OfflineTTSProvider } from './providers/offline.js'
import { DeepSeekProvider } from './providers/deepseek.js'
import { AliyunTTSProvider } from './providers/aliyun-tts.js'
import { EdgeTTSProvider } from './providers/edge-tts.js'
import { AliyunRealtimeAsrProvider, OfflineAsrProvider, createAsrProvider } from './providers/asr.js'
import { VoiceboxTTSProvider, VoiceboxAsrProvider, VoiceboxLLMProvider } from './providers/voicebox.js'
import { MusicProvider } from './providers/music.js'
import { ACTION_REGISTRY, actionDefinitions, getAction, isActionEnabled } from './core/action-registry.js'
import { EventDeduper } from './core/event-dedup.js'
import { createVoiceReactionState, voiceEventsFor } from './core/voice-reactions.js'
import { isQuietNow } from './core/quiet-hours.js'
import { dueReminders, isHourChimeTime } from './core/schedule.js'
import { applyInteraction, applyMoodDecay, createRelationshipState } from './core/relationship.js'
import { giftTierFor } from './core/gift-tiers.js'
import { filterLiveText } from './core/safety.js'
import { applauseEventsFor, createApplauseState } from './core/applause-detector.js'
import { limitUnicode } from './core/text-limit.js'

const LIVE_SOURCES = new Set(['danmaku', 'gift', 'superChat', 'guard', 'llm', 'music', 'lottery', 'nickname', 'enter', 'session'])
const EVENT_TIMELINE_CAP = 200
const OVERLAY_TIMELINE_CAP = 80

export class AppController extends EventEmitter {
  constructor(configStore, { setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, randomFn = Math.random, memoryStore = null, embedder = null, petPackageService = null } = {}) {
    super()
    this.configStore = configStore
    this.scheduler = new ActionScheduler()
    this.cooldown = new UserCooldown()
    this.globalLimiter = new SlidingWindowLimiter()
    this.setTimeoutFn = setTimeoutFn
    this.clearTimeoutFn = clearTimeoutFn
    this.randomFn = randomFn
    this.memoryStore = memoryStore
    this.memoryEmbedder = embedder
    this.petPackageService = petPackageService
    this.activePetPersona = null
    this.lottery = new Lottery(this.randomFn)
    this.live = null
    this.idleTimer = null
    this.idleGate = { enabled: true, sleep: false, dragging: false, tossing: false, physicsPhase: 'idle', docked: false }
    this.llm = new OfflineLLMProvider()
    this.tts = new OfflineTTSProvider()
    this.asr = new OfflineAsrProvider()
    this.music = new MusicProvider({ mock: true })
    this.eventDeduper = new EventDeduper()
    this.voiceState = createVoiceReactionState()
    this.asrSession = null
    this.testAsrSession = null
    this.lastAsrErrorAt = 0
    this.voiceAwakeUntil = 0
    this.lastNameReactAt = 0
    this.scheduleTimer = null
    this.lastHourlyChimeAt = 0
    this.firedReminders = new Map()
    this.relationship = createRelationshipState()
    this.livePaused = false
    this.eventTimeline = []
    this.liveOverlayEvents = []
    this.liveAiTimeline = []
    this.liveActionTimeline = []
    this.applauseState = createApplauseState()
    this.liveSession = { startedAt: 0, danmaku: 0, gift: 0, superChat: 0, guard: 0 }
    this.status = { live: 'disconnected', tts: 'offline', llm: 'offline', asr: 'offline', music: 'offline', currentTrack: '' }
    this.scheduler.on('action', (action) => {
      if (action.actionId === 'act_sleep') this.setIdleGate({ sleep: true })
      if (action.actionId === 'act_wake') this.setIdleGate({ sleep: false })
      if (LIVE_SOURCES.has(action.source)) {
        this.liveActionTimeline.push({ at: Date.now(), actionId: action.actionId, text: limitUnicode(action.text, 40), source: action.source, instanceId: action.instanceId })
        if (this.liveActionTimeline.length > OVERLAY_TIMELINE_CAP) this.liveActionTimeline.splice(0, this.liveActionTimeline.length - OVERLAY_TIMELINE_CAP)
      }
      this.emit('action', action)
      if (action.audio) this.emit('action-audio', { instanceId: action.instanceId, actionId: action.actionId, audio: action.audio })
      else void this.#synthesizeStartedAction(action)
    })
    this.scheduler.on('finished', ({ action }) => {
      if (action.actionId === 'act_sleep') this.setIdleGate({ sleep: false })
    })
    this.scheduler.on('idle', () => this.emit('idle'))
  }

  async applyConfig() {
    const config = this.configStore.getAll()
    this.#configSnapshot = config
    const ttsConfig = config.tts || {}
    const packagePersona = this.petPackageService?.active(config.pet?.activePackageId)?.persona?.prompt
    this.activePetPersona = String(packagePersona || '')
    const llmConfig = packagePersona ? { ...(config.llm || {}), personaPrompt: packagePersona } : (config.llm || {})
    const asrConfig = config.asr || {}
    const ttsReady = ttsConfig.enabled && (ttsConfig.preset === 'voicebox'
      ? Boolean((ttsConfig.baseUrl || '').trim() && (ttsConfig.voice || '').trim())
      : ttsConfig.preset === 'edge-tts'
        ? true
        : Boolean(ttsConfig.hasKey))
    const llmReady = llmConfig.enabled && (llmConfig.preset === 'voicebox'
      ? Boolean((llmConfig.baseUrl || '').trim())
      : llmConfig.preset === 'custom'
        ? Boolean((llmConfig.baseUrl || '').trim())
        : Boolean(llmConfig.hasKey))
    const asrReady = asrConfig.enabled && (asrConfig.preset === 'voicebox'
      ? Boolean((asrConfig.baseUrl || '').trim())
      : Boolean(this.configStore.getSecret('asrApiKey') || this.configStore.getSecret('ttsApiKey')))

    this.llm = llmReady
      ? (llmConfig.preset === 'voicebox'
        ? new VoiceboxLLMProvider(llmConfig)
        : new DeepSeekProvider(llmConfig, this.configStore.getSecret('llmApiKey')))
      : new OfflineLLMProvider()
    this.tts = ttsReady
      ? (ttsConfig.preset === 'voicebox'
        ? new VoiceboxTTSProvider(ttsConfig)
        : ttsConfig.preset === 'edge-tts'
          ? new EdgeTTSProvider(ttsConfig)
          : new AliyunTTSProvider(ttsConfig, this.configStore.getSecret('ttsApiKey')))
      : new OfflineTTSProvider()
    this.asr = asrReady
      ? (asrConfig.preset === 'voicebox'
        ? new VoiceboxAsrProvider(asrConfig)
        : createAsrProvider(asrConfig, this.configStore.getSecret('asrApiKey') || this.configStore.getSecret('ttsApiKey')))
      : new OfflineAsrProvider()
    this.music?.disconnect()
    this.music = new MusicProvider({ ...config.music, password: this.configStore.getSecret('musicPassword') })
    this.relationship = this.configStore.getRelationship?.() || createRelationshipState()
    this.status.llm = llmReady ? 'ready' : 'offline'
    this.status.tts = ttsReady ? 'ready' : 'offline'
    this.status.asr = asrReady ? 'ready' : 'offline'
    this.status.music = config.music.enabled ? (config.music.mock ? 'mock' : 'ready') : 'offline'
    this.disconnectLive()
    if (config.liveEnabled) {
      this.live = createLiveAdapter({
        platform: config.livePlatform,
        mock: config.liveMock,
        bilibili: { roomId: config.roomId, cookie: this.configStore.getSecret('bilibiliCookie') },
        youtube: { videoId: config.youtube?.videoId, liveChatId: config.youtube?.liveChatId, apiKey: this.configStore.getSecret('youtubeApiKey') }
      })
      this.live.on('event', (event) => this.handleLiveEvent(event))
      this.status.live = config.liveMock ? 'mock' : 'connecting'
      if (config.liveMock) {
        this.live.connect()
      } else {
        void this.live.connect().catch((error) => {
          this.status.live = 'error'
          this.emit('notice', String(error?.message || error || '连接失败'))
          this.emit('status', this.getStatus())
        })
      }
    } else this.status.live = 'disabled'
    this.#startIdleBehavior()
    this.#startSchedule()
    this.emit('status', this.getStatus())
  }

  disconnectLive() { this.live?.disconnect(); this.live = null }
  dispose() {
    this.stopIdleBehavior()
    this.stopSchedule()
    this.disconnectLive()
    this.stopAsrSession()
    this.stopTestAsrSession()
    this.music?.disconnect()
  }
  setIdleGate(patch = {}) {
    this.idleGate = { ...this.idleGate, ...patch }
  }

  // 热路径配置快照：语音响度 15Hz、弹幕风暴等场景下避免每次都做全量配置深合并。
  // applyConfig() 是唯一的配置写入刷新点，其余时间直接读快照。
  #configSnapshot = null
  config() { return this.#configSnapshot ?? this.configStore.getAll() }
  stopIdleBehavior() {
    if (this.idleTimer !== null) this.clearTimeoutFn(this.idleTimer)
    this.idleTimer = null
  }

  stopSchedule() {
    if (this.scheduleTimer !== null) this.clearTimeoutFn(this.scheduleTimer)
    this.scheduleTimer = null
  }

  #startSchedule() {
    this.stopSchedule()
    const schedule = () => {
      this.scheduleTimer = this.setTimeoutFn(() => {
        this.scheduleTimer = null
        this.#runScheduleTick()
        schedule()
      }, 15_000)
    }
    schedule()
  }

  #runScheduleTick() {
    const config = this.configStore.getAll()
    const decayed = applyMoodDecay(this.relationship)
    if (decayed.mood !== this.relationship.mood) this.configStore.setRelationship?.(decayed)
    this.relationship = decayed
    const sch = config.schedule
    if (!sch) return
    const now = new Date()
    const quiet = isQuietNow(config.quietHours)
    const busy = this.idleGate.sleep || this.idleGate.dragging || this.idleGate.tossing || this.idleGate.docked
    if (sch.hourlyChime !== false && isHourChimeTime(now) && now.getTime() - this.lastHourlyChimeAt > 30 * 60_000) {
      this.lastHourlyChimeAt = now.getTime()
      if (!quiet && !busy) {
        const text = '现在是' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        void this.#queue({ actionId: this.#pickFrom('special', 'special_hourly'), text, priority: 30, source: 'schedule' })
      }
    }
    for (const reminder of dueReminders(sch.reminders, now)) {
      const key = String(reminder.id || 'reminder') + ':' + String(reminder.time) + ':' + now.toDateString()
      if (now.getTime() - (this.firedReminders.get(key) || 0) < 60_000) continue
      this.firedReminders.set(key, now.getTime())
      if (this.firedReminders.size > 200) {
        const oldest = this.firedReminders.keys().next().value
        this.firedReminders.delete(oldest)
      }
      if (quiet || busy) continue
      void this.#queue({ actionId: reminder.actionId || 'act_greet', text: String(reminder.text || '到点啦！').slice(0, 300), priority: 25, source: 'schedule' })
    }
  }
  getMemoryStatus() {
    const embedding = this.memoryEmbedder?.status?.() || { available: false, loaded: false, error: '' }
    return { records: this.memoryStore?.size?.() || 0, capacity: this.memoryStore?.capacityLimit?.() || 400, embedding }
  }
  getStatus() { return { ...this.status, lotteryParticipants: this.lottery.size, livePaused: this.livePaused, memory: this.getMemoryStatus() } }
  getActions() { return actionDefinitions() }

  #recordTimeline(event, outcome) {
    this.eventTimeline.push({
      at: Date.now(),
      type: event?.type || 'unknown',
      source: this.#timelineSource(event),
      text: this.#timelineSummary(event),
      outcome
    })
    if (this.eventTimeline.length > EVENT_TIMELINE_CAP) this.eventTimeline.splice(0, this.eventTimeline.length - EVENT_TIMELINE_CAP)
  }

  #timelineSource(event) {
    const type = event?.type
    if (type === 'danmaku') return 'danmaku'
    if (type === 'gift') return 'gift'
    if (type === 'superChat') return 'superChat'
    if (type === 'guard') return 'guard'
    return type || 'unknown'
  }

  #timelineSummary(event) {
    if (!event) return ''
    if (event.type === 'danmaku' || event.type === 'superChat') return String(event.text || '').slice(0, 40)
    if (event.type === 'gift') return String(event.giftName || '礼物') + ' x' + Number(event.count || 1)
    if (event.type === 'guard') return String(event.user?.name || '观众')
    return ''
  }

  getLiveTimeline() { return [...this.eventTimeline] }

  getLiveOverlaySnapshot() {
    return {
      events: [...this.liveOverlayEvents],
      ai: [...this.liveAiTimeline],
      actions: [...this.liveActionTimeline],
      relationship: this.relationship,
      status: this.getStatus()
    }
  }

  #emitLiveEvent(event) {
    this.liveOverlayEvents.push(event)
    if (this.liveOverlayEvents.length > OVERLAY_TIMELINE_CAP) this.liveOverlayEvents.splice(0, this.liveOverlayEvents.length - OVERLAY_TIMELINE_CAP)
    this.emit('live-event', event)
  }

  #liveEventPayload(event, outcome) {
    return {
      type: event?.type || 'unknown',
      user: event?.user || null,
      text: String(event?.text || ''),
      giftName: event?.giftName || '',
      count: Number(event?.count || 1),
      price: Number(event?.price || 0),
      level: Number(event?.level || 0),
      command: event?.type === 'danmaku' && Boolean(parseCommand(event?.text, this.config()?.commands || [])),
      outcome,
      at: Date.now()
    }
  }

  pauseLive() {
    this.livePaused = true
    this.emit('status', this.getStatus())
    return true
  }

  resumeLive() {
    this.livePaused = false
    this.emit('status', this.getStatus())
    return true
  }

  async reconnectLive() {
    this.emit('notice', '正在重连直播…')
    await this.applyConfig()
    return this.getStatus()
  }

  clearLiveActions() {
    return this.scheduler.clearQueue((action) => LIVE_SOURCES.has(action.source))
  }

  async listTtsVoices() {
    if (this.tts && typeof this.tts.listVoices === 'function') return this.tts.listVoices()
    const ttsConfig = this.configStore.getAll().tts || {}
    const key = this.configStore.getSecret('ttsApiKey')
    if (ttsConfig.preset === 'edge-tts') return new EdgeTTSProvider(ttsConfig).listVoices()
    if (ttsConfig.preset === 'voicebox' && ttsConfig.baseUrl) return new VoiceboxTTSProvider(ttsConfig).listVoices()
    if (ttsConfig.hasKey || key) return new AliyunTTSProvider(ttsConfig, key).listVoices()
    throw new Error('当前 TTS 提供方不支持读取音色列表')
  }

  async listTtsModels() {
    if (this.tts && typeof this.tts.listModels === 'function') return this.tts.listModels()
    const ttsConfig = this.configStore.getAll().tts || {}
    if (ttsConfig.preset === 'edge-tts') return new EdgeTTSProvider(ttsConfig).listModels()
    if (ttsConfig.preset === 'voicebox' && ttsConfig.baseUrl) return new VoiceboxTTSProvider(ttsConfig).listModels()
    if (ttsConfig.hasKey || this.configStore.getSecret('ttsApiKey')) return new AliyunTTSProvider(ttsConfig, this.configStore.getSecret('ttsApiKey')).listModels()
    throw new Error('当前 TTS 提供方不支持读取模型列表')
  }

  async listLlmModels() {
    if (this.llm && typeof this.llm.listModels === 'function') return this.llm.listModels()
    const llmConfig = this.configStore.getAll().llm || {}
    if (llmConfig.preset === 'voicebox' && llmConfig.baseUrl) return new VoiceboxLLMProvider(llmConfig).listModels()
    if (llmConfig.preset === 'custom' && llmConfig.baseUrl) return new DeepSeekProvider(llmConfig, '').listModels()
    if (llmConfig.hasKey || this.configStore.getSecret('llmApiKey')) return new DeepSeekProvider(llmConfig, this.configStore.getSecret('llmApiKey')).listModels()
    throw new Error('当前 AI 提供方不支持读取模型列表')
  }

  async listAsrModels() {
    if (this.asr && typeof this.asr.listModels === 'function') return this.asr.listModels()
    const asrConfig = this.configStore.getAll().asr || {}
    if (asrConfig.preset === 'voicebox' && asrConfig.baseUrl) return ['whisper']
    if (asrConfig.hasKey || this.configStore.getSecret('asrApiKey') || this.configStore.getSecret('ttsApiKey')) return new AliyunRealtimeAsrProvider(asrConfig, this.configStore.getSecret('asrApiKey') || this.configStore.getSecret('ttsApiKey')).listModels()
    throw new Error('当前 ASR 提供方不支持读取模型列表')
  }

  async testService(name) {
    if (name === 'music') {
      const result = await this.music.connect()
      this.status.music = result?.ok === false ? 'error' : 'ready'
      this.emit('status', this.getStatus())
      return result
    }
    if (name === 'live') {
      if (!this.configStore.getAll().liveEnabled) return { ok: false, message: '直播连接未开启' }
      if (this.configStore.getAll().liveMock) return { ok: true, message: '直播互动处于模拟测试模式' }
      if (!this.live) return { ok: false, message: '直播服务尚未启动，请保存设置后重试' }
      const state = this.live.getState?.() || this.status.live
      if (state === 'connected') return { ok: true, message: '直播房间已连接' }
      if (state === 'connecting' || state === 'reconnecting') return { ok: false, message: '直播连接中：' + state }
      return { ok: false, message: '直播未连接：' + state }
    }
    if (name === 'llm') {
      const text = await this.llm.reply([{ role: 'user', content: '用一句话打个招呼' }], { roomId: 'diagnostics' })
      this.status.llm = 'ready'
      this.emit('status', this.getStatus())
      return { ok: true, message: text }
    }
    if (name === 'tts') {
      const audio = await this.tts.synthesize('发发语音测试成功')
      this.status.tts = audio ? 'ready' : 'offline'
      this.emit('status', this.getStatus())
      return { ok: Boolean(audio), message: audio ? '语音已生成' : '当前为离线模式' }
    }
    if (name === 'asr') {
      const result = await this.asr.test()
      this.status.asr = result?.ok ? 'ready' : 'error'
      this.emit('status', this.getStatus())
      return result
    }
    throw new Error('未知服务')
  }

  async handleLiveEvent(event) {
    if (!event || this.eventDeduper.hasSeen(event)) return
    if (event.type === 'status') {
      const previous = this.status.live
      this.status.live = event.status
      this.emit('status', this.getStatus())
      this.#emitLiveEvent({ type: 'status', status: event.status, message: String(event.message || ''), mode: String(event.mode || ''), at: Date.now() })
      if (event.status === 'connected' && previous !== 'connected') {
        this.liveSession = { startedAt: Date.now(), danmaku: 0, gift: 0, superChat: 0, guard: 0 }
      }
      if ((event.status === 'disconnected' || event.status === 'error') && this.liveSession.startedAt) {
        const session = this.liveSession
        this.liveSession = { startedAt: 0, danmaku: 0, gift: 0, superChat: 0, guard: 0 }
        const summary = '本次直播收到' + session.danmaku + '条弹幕、' + session.gift + '件礼物、' + session.superChat + '条 SC、' + session.guard + '次上舰，辛苦啦！'
        this.emit('notice', summary)
        void this.#queue({ actionId: this.#pickFrom('session', 'act_greet'), text: summary, priority: 75, source: 'session' })
      }
      return
    }
    const config = this.configStore.getAll()
    if (config.liveEvents && config.liveEvents[event.type] === false) {
      this.#recordTimeline(event, 'disabled')
      this.#emitLiveEvent(this.#liveEventPayload(event, 'disabled'))
      return
    }
    if (this.livePaused) {
      this.#recordTimeline(event, 'paused')
      this.#emitLiveEvent(this.#liveEventPayload(event, 'paused'))
      return
    }
    // 进场事件默认只通知悬浮组件与时间线；在动作分配里勾选进场动作后
    // 才进入低优先级欢迎队列，避免普通直播间被进场刷屏。
    if (event.type === 'enter') {
      this.#recordTimeline(event, 'notified')
      this.#emitLiveEvent(this.#liveEventPayload(event, 'notified'))
      if (this.#hasAssigned('enter')) {
        void this.#queue({ actionId: this.#pickFrom('enter', 'act_greet'), text: '欢迎' + (event.user?.name || '观众') + '～', priority: 8, source: 'enter', durationMs: 1500 })
      }
      return
    }
    if ((event.type === 'danmaku' || event.type === 'superChat') && config.safety?.enabled !== false) {
      const check = filterLiveText(event.text, config.safety?.keywords)
      if (check.blocked) {
        this.#recordTimeline({ ...event, text: '' }, 'blocked')
        this.#emitLiveEvent(this.#liveEventPayload({ ...event, text: '' }, 'blocked'))
        return
      }
      event = { ...event, text: check.text }
    }
    if (!this.globalLimiter.allow()) {
      this.#recordTimeline(event, 'rate-limited')
      this.#emitLiveEvent(this.#liveEventPayload(event, 'rate-limited'))
      return
    }
    this.#recordTimeline(event, 'processed')
    this.#emitLiveEvent(this.#liveEventPayload(event, 'processed'))
    try {
      if (this.liveSession.startedAt && event.type in this.liveSession) this.liveSession[event.type] += 1
      if (event.type === 'danmaku') { this.recordInteraction('danmaku'); return await this.#handleDanmaku(event) }
      if (event.type === 'gift') { this.recordInteraction('gift'); return this.#queueGiftReaction(event) }
      if (event.type === 'superChat') { this.recordInteraction('superChat'); return this.#queue({ actionId: this.#pickFrom('superChat', 'gift_sc'), priority: 80, text: (event.user?.name || '观众') + '说：' + (event.text || ''), source: 'superChat', durationMs: 5000 }) }
      if (event.type === 'guard') { this.recordInteraction('guard'); return this.#queue({ actionId: this.#pickFrom('guard', 'gift_guard'), priority: 90, text: '感谢' + (event.user?.name || '观众') + '上舰！', source: 'guard', durationMs: 5000 }) }
    } catch (error) {
      this.emit('notice', '直播事件处理失败：' + String(error?.message || error))
    }
  }

  /**
   * 礼物分级反馈：普通 / 中等(≥1万瓜子) / 大额(≥10万) / 豪华(≥100万)。
   */
  #queueGiftReaction(event) {
    const name = event.user?.name || '观众'
    const giftName = event.giftName || '礼物'
    const tier = giftTierFor(event.price)
    const fallback = tier === 'super' ? 'act_firework' : (tier === 'big' ? 'act_dance' : (tier === 'medium' ? 'emo_excited' : 'gift_thanks'))
    const group = tier === 'super' ? 'giftSuper' : (tier === 'big' ? 'giftBig' : (tier === 'medium' ? 'giftMedium' : 'gift'))
    const priority = tier === 'super' ? 75 : (tier === 'big' ? 73 : (tier === 'medium' ? 71 : 70))
    const text = tier === 'super'
      ? '哇！感谢' + name + '的' + giftName + '！放烟花啦！'
      : (tier === 'big'
        ? '感谢' + name + '的大手笔「' + giftName + '」！'
        : (tier === 'medium'
          ? '谢谢' + name + '的' + giftName + '！'
          : '谢谢' + name + '的' + giftName + '！'))
    return this.#queue({ actionId: this.#pickFrom(group, fallback), priority, text, source: 'gift' })
  }

  async triggerLocal(actionId, text = '') {
    this.recordInteraction('pet')
    return this.#queue({ actionId, text, priority: getAction(actionId)?.priority ?? 55, source: 'mouse' })
  }

  /**
   * 记录一次有效互动：更新亲密度/每日计数/短期情绪，关系阶段升级时
   * 播报并庆祝。状态只保存在本机。
   */
  recordInteraction(kind) {
    const before = this.relationship
    const next = applyMoodDecay(applyInteraction(before, kind))
    this.relationship = next
    this.configStore.setRelationship?.(next)
    if (next.stage !== before.stage) {
      this.emit('notice', '关系升级：' + next.stage + '！')
      void this.#queue({ actionId: this.#pickFrom('special', 'act_firework'), text: '我们的关系更近了一步！现在是「' + next.stage + '」啦！', priority: 95, source: 'relationship' })
    }
    this.emit('relationship', next)
    return next
  }

  getRelationship() {
    return applyMoodDecay(this.relationship)
  }

  resetRelationship() {
    this.relationship = createRelationshipState()
    this.configStore.resetRelationship?.()
    this.emit('relationship', this.relationship)
    return this.relationship
  }

  /**
   * 麦克风音量（0..100）→ 语音反应。配置来自 config.voice，
   * 大叫与捂耳朵动作各自进入冷却，避免持续噪声刷屏。
   */
  handleVoiceLevel(levelPct) {
    const config = this.config()
    const voice = config.voice || {}
    if (!voice.enabled) return
    if (this.idleGate.docked) return
    if (isQuietNow(config.quietHours)) return
    const level01 = Math.max(0, Math.min(100, Number(levelPct) || 0)) / 100
    const result = voiceEventsFor(level01, voice, this.voiceState)
    this.voiceState = result.state
    for (const event of result.events) {
      if (event === 'shout') void this.#queue({ actionId: this.#pickFrom('voiceShout', voice.shoutAction || 'emo_shout'), text: '哇！这么大声！', priority: 60, source: 'voice' })
      if (event === 'cover') void this.#queue({ actionId: this.#pickFrom('voiceNoisy', 'act_cover_ears'), text: '太吵啦，捂耳朵～', priority: 55, source: 'voice' })
    }
    // 掌声彩蛋（音量包络启发式，接口为后续 ML 预留）
    if (config.applause?.enabled === true) {
      const applause = applauseEventsFor(level01, config.applause, this.applauseState)
      this.applauseState = applause.state
      if (applause.events.includes('applause')) {
        void this.#queue({ actionId: 'emo_excited', text: '谢谢大家的掌声！', priority: 65, source: 'voice' })
      }
    }
    this.emit('voice-level', { level: result.level, thresholdPct: result.thresholdPct })
  }

  triggerTest(actionId, text = '', durationMs = 2200) {
    this.scheduler.stop()
    return this.scheduler.request({ actionId, text, durationMs, priority: 100, source: 'settings' })
  }

  stopActions() { this.scheduler.stop() }

  /**
   * AI 输入源：'all' 全部 / 'voice' 仅语音转写 / 'danmaku' 仅弹幕。
   */
  #llmAllowsSource(source) {
    const inputSource = String(this.configStore.getAll().llm?.inputSource ?? 'all')
    return inputSource === 'all' || inputSource === source
  }

  /**
   * TTS 回复范围：'all' 全部 / 'voice' 仅回复语音 / 'danmaku' 仅回复弹幕与直播 / 'off' 关闭。
   */
  #ttsAllowsSource(source) {
    const replyScope = String(this.configStore.getAll().tts?.replyScope ?? 'all')
    if (replyScope === 'off') return false
    if (replyScope === 'all') return true
    if (replyScope === 'voice') return source === 'voice'
    return source !== 'voice'
  }

  /**
   * 渲染层采集的 16kHz PCM16 音频块（Int16Array）→ 流式 ASR 会话。
   * 会话惰性建立；出错后 10 秒内不重试，避免对无效 Key 反复重连。
   */
  feedAsrPcm(chunk) {
    const config = this.configStore.getAll()
    if (!config.voice?.enabled || !config.asr?.enabled) return
    if (!this.asrSession) {
      if (Date.now() - this.lastAsrErrorAt < 10_000) return
      try {
        this.asrSession = this.asr.createSession({
          onFinal: (text) => { this.emit('voice-transcript', text); void this.handleVoiceTranscript(text) },
          onError: () => { this.lastAsrErrorAt = Date.now(); this.stopAsrSession() }
        })
      } catch {
        this.asrSession = null
        return
      }
    }
    try { this.asrSession.write?.(chunk) } catch { this.stopAsrSession() }
  }

  stopAsrSession() {
    this.asrSession?.end?.()
    this.asrSession = null
  }

  /** Test-center ASR path: microphone PCM can be tested without enabling the
   * always-on voice reaction switch, but it still uses the configured ASR. */
  feedTestAsrPcm(chunk) {
    if (!this.configStore.getAll().asr?.enabled) return false
    if (!this.testAsrSession) {
      try {
        this.testAsrSession = this.asr.createSession({
          onFinal: async (text) => {
            const result = await this.simulateVoiceText(text).catch(() => null)
            this.emit('test-voice-result', { text: limitUnicode(text, 40), result })
          },
          onError: (error) => this.emit('test-voice-result', { text: '', error: String(error?.message || error || 'ASR 失败') })
        })
      } catch (error) {
        this.emit('test-voice-result', { text: '', error: String(error?.message || error || 'ASR 会话创建失败') })
        return false
      }
    }
    try { this.testAsrSession.write?.(chunk); return true } catch { this.stopTestAsrSession(); return false }
  }

  stopTestAsrSession() {
    this.testAsrSession?.end?.()
    this.testAsrSession = null
  }

  /**
   * 主播语音转写文本：不需要「发发」前缀，直接匹配指令（说「跳舞」= 跳舞）。
   * 不是命令且 AI 输入源允许语音时进入 LLM 对话。返回结构化结果供测试中心展示。
   */
  async handleVoiceTranscript(text, { skipWakeWord = false } = {}) {
    const config = this.configStore.getAll()
    const check = filterLiveText(text, config.safety?.enabled !== false ? config.safety?.keywords : [])
    const normalized = check.text
    if (!normalized) return null
    const now = Date.now()
    const hasWake = /(发发|fafa|法法)/i.test(normalized)
    if (hasWake) this.voiceAwakeUntil = now + 15_000
    // 语音唤醒词开启时，未唤醒的语音不进入命令与对话。
    if (config.voice?.wakeWordEnabled === true && !skipWakeWord && now > this.voiceAwakeUntil) return null
    this.recordInteraction('voice')
    this.voiceAwakeUntil = Math.max(this.voiceAwakeUntil, Date.now() + 15_000)
    const command = parseDirectCommand(normalized, config.commands)
    if (command?.type === 'music') {
      if (!config.music.enabled) {
        await this.#queue({ actionId: 'act_sing', text: '点歌功能暂未开发哦。', priority: 50, source: 'voice' })
        return { kind: 'music', ok: false, reason: '点歌功能暂未开发' }
      }
      const musicCheck = filterLiveText(command.query, config.safety?.enabled !== false ? config.safety?.keywords : [])
      if (musicCheck.blocked) {
        await this.#queue({ actionId: 'emo_sad', text: '这首歌不太方便点哦。', priority: 50, source: 'voice' })
        return { kind: 'music', ok: false, reason: '命中敏感词' }
      }
      try {
        const result = await this.music.request(musicCheck.text, { id: 'voice-broadcaster', name: '主播' })
        this.status.currentTrack = String(result.title || musicCheck.text)
        await this.#queue({ actionId: 'act_sing', text: '收到《' + (result.title || musicCheck.text) + '》！', priority: 100, source: 'music' })
        return { kind: 'music', ok: true, title: result.title || musicCheck.text }
      } catch {
        await this.#queue({ actionId: 'emo_sad', text: '点歌失败了，稍后再试吧。', priority: 50, source: 'voice' })
        return { kind: 'music', ok: false, reason: '点歌服务请求失败' }
      }
    }
    if (command?.type === 'command') {
      await this.#runCommand(command, { source: 'voice', user: { id: 'voice-broadcaster', name: '主播' } })
      return { kind: 'command', actionId: command.actionId, text: command.text || '' }
    }
    if (!this.#llmAllowsSource('voice')) {
      const actionId = this.#pickFrom('voice', 'act_greet')
      await this.#queue({ actionId, text: '我听见啦！', priority: 40, source: 'voice' })
      return { kind: 'fallback', actionId, text: '我听见啦！' }
    }
    let reply
    try {
      reply = await this.#llmChat([{ role: 'user', content: limitUnicode(normalized, 40) }], { roomId: config.roomId, source: 'voice' })
    } catch {
      reply = { text: '我听见啦！', actionId: null }
    }
    const actionId = reply.actionId && isActionEnabled(reply.actionId) ? reply.actionId : this.#pickFrom('voice', 'act_greet')
    await this.#queue({ actionId, text: reply.text || '我听见啦！', priority: 40, source: 'voice' })
    return { kind: 'llm', actionId, text: reply.text || '我听见啦！' }
  }

  /** 测试中心：模拟一次主播语音（跳过唤醒词门槛），并给出可读结果。 */
  async simulateVoiceText(text) {
    return this.handleVoiceTranscript(limitUnicode(text, 40), { skipWakeWord: true })
  }

  /** 测试中心：真实发起一次点歌请求（模拟观众身份）。 */
  async testMusicRequest(query) {
    const config = this.configStore.getAll()
    const name = String(query || '').trim().slice(0, 100)
    if (!name) return { ok: false, message: '请输入歌名' }
    if (!config.music.enabled) return { ok: false, message: '点歌功能暂未开发' }
    try {
      const result = await this.music.request(name, { id: 'test-viewer', name: '测试观众' })
      return { ok: true, title: result?.title || name, message: result?.mock ? '模拟模式：已进入播放队列' : '点歌请求已提交' }
    } catch (error) {
      return { ok: false, message: '点歌失败：' + String(error?.message || error) }
    }
  }

  /** 测试中心：调节点歌服务音量。 */
  async testMusicVolume(volume) {
    if (!this.music || typeof this.music.setVolume !== 'function') return { ok: false, message: '点歌服务不可用' }
    return this.music.setVolume(volume)
  }

  /**
   * 共享的指令执行：抽奖、猜拳、抽签、报时与普通动作映射。
   * 弹幕与主播语音走同一条路径，仅来源与用户不同。
   */
  #runCommand(command, { source, user = null }) {
    if (command.actionId === 'lottery_join') {
      const joined = this.lottery.join(user?.id ? user : { id: source + '-anon', name: user?.name || source })
      this.emit('status', this.getStatus())
      if (joined) return this.#queue({ actionId: this.#pickFrom('lottery', 'special_lottery'), text: (user?.name || '有人') + '已加入抽奖！', priority: 20, source, durationMs: 1000 })
      return false
    }
    if (command.actionId === 'lottery_draw') {
      const winner = this.lottery.draw()
      this.emit('status', this.getStatus())
      return this.#queue({ actionId: this.#pickFrom('lottery', 'special_lottery'), text: winner ? ('恭喜' + winner.name + '中奖！') : '还没有人参加抽奖哦。', priority: 100, source, durationMs: 5000 })
    }
    if (command.actionId === 'game_rps') {
      const choices = ['石头', '剪刀', '布']
      const roll = Number(this.randomFn())
      const index = Number.isFinite(roll) ? Math.floor(roll * choices.length) % choices.length : 0
      return this.#queue({ actionId: 'act_greet', text: '我出' + choices[index] + '！你出什么？', priority: 40, source })
    }
    if (command.actionId === 'game_lots') {
      const lots = ['大吉', '中吉', '小吉', '末吉']
      const roll = Number(this.randomFn())
      const index = Number.isFinite(roll) ? Math.floor(roll * lots.length) % lots.length : 0
      return this.#queue({ actionId: 'act_greet', text: (user?.name || '你') + '抽到了「' + lots[index] + '」！', priority: 40, source })
    }
    const text = command.actionId === 'special_hourly' ? ('现在是' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })) : command.text
    const actionId = command.actionId === 'special_hourly' ? this.#pickFrom('special', 'special_hourly') : command.actionId
    return this.#queue({ actionId, text, priority: command.priority, source })
  }

  async #handleDanmaku(event) {
    const config = this.config()
    const command = parseCommand(event.text, config.commands)
    if (!command) {
      if (!this.cooldown.allow(event.user?.id || 'anonymous')) return
      const spoken = limitUnicode(event.text, 40)
      if (!spoken || !this.#ttsAllowsSource('danmaku')) return
      const speaker = event.user?.name || '观众'
      // 喊名字免前缀：弹幕里出现「发发」就反应（全局 8 秒节流）。
      if (config.interaction?.nameReact !== false && /(发发|fafa|法法)/i.test(String(event.text || '')) && Date.now() - this.lastNameReactAt >= 8_000) {
        this.lastNameReactAt = Date.now()
        return this.#queue({ actionId: this.#pickFrom('danmaku', 'act_lookaround'), text: speaker + '说：' + spoken, priority: 35, source: 'nickname', durationMs: 2000 })
      }
      return this.#queue({ actionId: this.#pickFrom('danmaku', 'act_greet'), text: speaker + '说：' + spoken, priority: 12, source: 'danmaku', durationMs: 1500, interrupt: false })
    }
    if (!this.cooldown.allow(event.user?.id || 'anonymous')) return
    if (command.type === 'music') {
      if (!config.music.enabled) return this.#queue({ actionId: 'act_sing', text: '点歌功能暂未开发哦。', priority: 50, source: 'music' })
      const musicCheck = filterLiveText(command.query, config.safety?.enabled !== false ? config.safety?.keywords : [])
      if (musicCheck.blocked) return this.#queue({ actionId: 'emo_sad', text: '这首歌不太方便点哦。', priority: 50, source: 'music' })
      try {
        const result = await this.music.request(musicCheck.text, event.user)
        this.status.currentTrack = String(result.title || musicCheck.text)
        return this.#queue({ actionId: 'act_sing', text: '收到《' + (result.title || musicCheck.text) + '》！', priority: 100, source: 'music' })
      }
      catch { return this.#queue({ actionId: 'emo_sad', text: '点歌失败了，稍后再试吧。', priority: 50, source: 'music' }) }
    }
    if (command.type === 'unknown') {
      if (!this.#llmAllowsSource('danmaku')) return this.#queue({ actionId: 'act_greet', text: '我听见啦！', priority: 40, source: 'danmaku' })
      let reply
      try {
        reply = await this.#llmChat([{ role: 'user', content: limitUnicode(command.prompt, 40) }], { roomId: config.roomId, source: 'danmaku' })
      } catch {
        reply = { text: '我听见啦！', actionId: null }
      }
      const actionId = reply.actionId && isActionEnabled(reply.actionId) ? reply.actionId : 'act_greet'
      const text = limitUnicode(reply.text || '我听见啦！', 40)
      this.#recordAiReply({ user: event.user, prompt: command.prompt, reply: text, actionId })
      return this.#queue({ actionId, text, priority: 40, source: 'llm' })
    }
    if (command.adminOnly && String(event.user.id) !== String(config.broadcasterUid)) return
    return this.#runCommand(command, { source: 'danmaku', user: event.user })
  }

  async #queue(action) {
    // 停用的动作（如自我介绍）不再进入播放队列。
    if (action?.actionId && !isActionEnabled(action.actionId)) return false
    return this.scheduler.request(action)
  }

  /** Test center/diagnostics use the same persona + memory path as live chat. */
  async testLlmReply(message) {
    const text = limitUnicode(message, 40)
    if (!text) return ''
    const result = await this.#llmChat([{ role: 'user', content: text }], { roomId: 'diagnostics', source: 'diagnostics' })
    return result.text
  }

  #recordAiReply({ user = null, prompt = '', reply = '', actionId = null } = {}) {
    const entry = { at: Date.now(), user: user || { name: '观众' }, prompt: limitUnicode(prompt, 40), reply: limitUnicode(reply, 40), actionId: actionId || null }
    this.liveAiTimeline.push(entry)
    if (this.liveAiTimeline.length > OVERLAY_TIMELINE_CAP) this.liveAiTimeline.splice(0, this.liveAiTimeline.length - OVERLAY_TIMELINE_CAP)
    this.emit('ai-reply', entry)
  }

  /** 动作分配组是否已有可用选项。 */
  #hasAssigned(group) {
    const list = this.configStore.getAll().actionAssign?.[group]
    return (Array.isArray(list) ? list : []).some((id) => isActionEnabled(id) && getAction(id))
  }

  /** 从动作分配组里随机取一个可用的动作；组为空或全是停用动作时用 fallback。 */
  #pickFrom(group, fallback) {
    const list = this.configStore.getAll().actionAssign?.[group]
    const pool = Array.isArray(list) ? list.filter((id) => isActionEnabled(id) && getAction(id)) : []
    if (pool.length) {
      const roll = Math.floor(Number(this.randomFn()) * pool.length)
      return pool[Math.min(Math.max(roll, 0), pool.length - 1)]
    }
    return fallback
  }


  /** 智能体可调用的动作：排除待机/状态/转场等不适合由 AI 主动触发的系统动作。 */
  #agentActions() {
    return actionDefinitions().filter((entry) => entry.enabled !== false && entry.category !== 'idle' && entry.category !== 'state' && entry.category !== 'transition')
  }

  #personaPrompt(config = this.config()) {
    const packagePersona = this.activePetPersona ?? this.petPackageService?.active(config.pet?.activePackageId)?.persona?.prompt
    return limitUnicode(packagePersona || config.llm?.personaPrompt || '', 200)
  }

  /** 统一 LLM 调用：支持智能体返回动作，也兼容普通纯文本 Provider。 */
  async #llmChat(messages, context = {}) {
    const prompt = limitUnicode(messages?.findLast?.((message) => message?.role === 'user')?.content || messages?.at?.(-1)?.content || '', 40)
    let queryVector = null
    let memories = []
    if (prompt && this.memoryEmbedder?.embed && this.memoryStore?.search) {
      try {
        queryVector = await this.memoryEmbedder.embed(prompt)
        memories = this.memoryStore.search(queryVector, 3)
      } catch {
        // A missing/corrupt local model only disables retrieval; chat remains usable.
      }
    }
    const chatConfig = this.config()
    const chatContext = {
      ...context,
      personaPrompt: this.#personaPrompt(chatConfig),
      memories,
      actions: context.actions || this.#agentActions()
    }
    const remember = async (text) => {
      if (!prompt || !text || !queryVector || !this.memoryStore?.add || this.llm instanceof OfflineLLMProvider) return
      try { this.memoryStore.add({ prompt, reply: limitUnicode(text, 40), at: Date.now(), vector: queryVector }) } catch { /* local memory is best effort */ }
    }
    if (typeof this.llm.agentReply === 'function') {
      const result = await this.llm.agentReply(messages, chatContext)
      if (result && typeof result === 'object') {
        const text = limitUnicode(String(result.text || '').trim(), 40)
        await remember(text)
        return { text, actionId: result.actionId || null }
      }
      const text = limitUnicode(String(result || '').trim(), 40)
      await remember(text)
      return { text, actionId: null }
    }
    const text = await this.llm.reply(messages, chatContext)
    const limited = limitUnicode(String(text || '').trim(), 40)
    await remember(limited)
    return { text: limited, actionId: null }
  }

  async #synthesizeStartedAction(action) {
    if (!action.text || action.audio || !this.tts) return
    if (!this.#ttsAllowsSource(action.source)) return
    if (isQuietNow(this.configStore.getAll().quietHours)) return
    const audio = await this.tts.synthesize(action.text).catch(() => null)
    if (!audio || this.scheduler.current?.id !== action.instanceId) return
    action.audio = audio
    this.emit('action-audio', { instanceId: action.instanceId, actionId: action.actionId, audio })
  }

  #startIdleBehavior() {
    this.stopIdleBehavior()
    const config = this.config()
    const pool = ACTION_REGISTRY.filter((entry) => entry.category === 'idle' || entry.category === 'random').map((entry) => entry.id).filter((id) => id !== 'idle_breath')
    // 自主编排：用户勾选的待机动作；为空则使用默认组合。
    const picked = config.idleSet?.actions || []
    const idleActions = picked.length > 0 ? pool.filter((id) => picked.includes(id)) : pool
    const schedule = () => {
      const random = Math.max(0, Math.min(1, Number(this.randomFn()) || 0))
      this.idleTimer = this.setTimeoutFn(() => {
        this.idleTimer = null
        if (isQuietNow(this.config().quietHours)) { schedule(); return }
        if (this.idleGate.enabled && !this.idleGate.sleep && !this.idleGate.dragging && !this.idleGate.tossing && !this.idleGate.docked && (this.idleGate.physicsPhase === 'idle' || !this.idleGate.physicsPhase) && this.scheduler.isIdle()) {
          const actionId = idleActions[Math.floor(random * idleActions.length)] || 'idle_blink'
          // 动作视频统一为 2s：调度时长不短于视频时长，避免动作播到一半被切走造成画面跳动。
          this.scheduler.request({ actionId, priority: 5, durationMs: 2000 + Math.floor(Math.random() * 800), source: 'idle', interrupt: false })
        }
        schedule()
      }, 20_000 + Math.floor(random * 25_000))
    }
    schedule()
  }

}
