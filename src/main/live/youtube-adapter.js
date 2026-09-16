import { EventEmitter } from 'node:events'

const API_URL = 'https://www.googleapis.com/youtube/v3/liveChat/messages'
const VIDEOS_API_URL = 'https://www.googleapis.com/youtube/v3/videos'

export function parseYouTubeVideoId(value) {
  const text = String(value || '').trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text
  try {
    const url = new URL(text)
    if (url.hostname === 'youtu.be') return /^[a-zA-Z0-9_-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : ''
    const candidate = url.searchParams.get('v') || /^\/(?:live|embed)\/([^/?]+)/.exec(url.pathname)?.[1] || ''
    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : ''
  } catch {
    return ''
  }
}

function viewer(details = {}) {
  return {
    id: String(details.channelId || ''),
    name: String(details.displayName || '观众').slice(0, 30),
    avatarUrl: String(details.profileImageUrl || ''),
    isOwner: details.isChatOwner === true,
    isModerator: details.isChatModerator === true,
    isMember: details.isChatSponsor === true
  }
}

function amount(micros) {
  const value = Number(micros)
  return Number.isFinite(value) ? value / 1_000_000 : 0
}

export function mapYouTubeMessage(item) {
  const snippet = item?.snippet || {}
  const author = viewer(item?.authorDetails)
  const base = { id: String(item?.id || ''), user: author, raw: item }

  if (snippet.type === 'textMessageEvent') {
    return { ...base, type: 'danmaku', text: String(snippet.textMessageDetails?.messageText || snippet.displayMessage || '').slice(0, 200) }
  }
  if (snippet.type === 'superChatEvent') {
    const details = snippet.superChatDetails || {}
    return {
      ...base,
      type: 'superChat',
      text: String(details.userComment || snippet.displayMessage || '').slice(0, 300),
      price: amount(details.amountMicros),
      currency: String(details.currency || ''),
      amountDisplay: String(details.amountDisplayString || '')
    }
  }
  if (snippet.type === 'superStickerEvent') {
    const details = snippet.superStickerDetails || {}
    return {
      ...base,
      type: 'gift',
      giftName: String(details.superStickerMetadata?.altText || 'Super Sticker').slice(0, 80),
      count: 1,
      price: amount(details.amountMicros),
      currency: String(details.currency || ''),
      amountDisplay: String(details.amountDisplayString || '')
    }
  }
  if (snippet.type === 'newSponsorEvent') {
    return { ...base, type: 'guard', level: 1, membership: String(snippet.newSponsorDetails?.memberLevelName || '') }
  }
  if (snippet.type === 'memberMilestoneChatEvent') {
    const details = snippet.memberMilestoneChatDetails || {}
    return {
      ...base,
      type: 'guard',
      level: Math.max(1, Number(details.memberMonth || 1)),
      membership: String(details.memberLevelName || ''),
      text: String(details.userComment || snippet.displayMessage || '').slice(0, 300)
    }
  }
  if (snippet.type === 'membershipGiftingEvent') {
    const details = snippet.membershipGiftingDetails || {}
    return {
      ...base,
      type: 'gift',
      giftName: String(details.giftMembershipsLevelName || '频道会员赠送').slice(0, 80),
      count: Math.max(1, Number(details.giftMembershipsCount || 1)),
      price: 0
    }
  }
  if (snippet.type === 'giftMembershipReceivedEvent') {
    return { ...base, type: 'guard', level: 1, membership: String(snippet.giftMembershipReceivedDetails?.memberLevelName || '') }
  }
  if (snippet.type === 'giftEvent') {
    const details = snippet.giftDetails || {}
    return {
      ...base,
      type: 'gift',
      giftName: String(details.giftName || details.altText || 'YouTube Gift').slice(0, 80),
      count: Math.max(1, Number(details.comboCount || 1)),
      price: 0,
      jewels: Math.max(0, Number(details.jewelsAmount || 0))
    }
  }
  return null
}

export class YouTubeAdapter extends EventEmitter {
  constructor({
    liveChatId,
    videoId,
    apiKey,
    mock = false,
    fetchImpl = fetch,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    emitInitialHistory = false
  } = {}) {
    super()
    this.liveChatId = String(liveChatId || '').trim()
    this.videoId = parseYouTubeVideoId(videoId)
    this.apiKey = String(apiKey || '').trim()
    this.mock = mock
    this.fetchImpl = fetchImpl
    this.setTimeoutFn = setTimeoutFn
    this.clearTimeoutFn = clearTimeoutFn
    this.emitInitialHistory = emitInitialHistory
    this.pageToken = ''
    this.timer = null
    this.closed = true
    this.connected = false
    this.polling = false
    this.retries = 0
    this.state = 'disconnected'
  }

  getState() { return this.state }

  async connect() {
    this.disconnect()
    this.closed = false
    if (this.mock) {
      this.#status('connected', { mode: 'mock' })
      return
    }
    if (!this.apiKey) throw new Error('未配置 YouTube Data API Key')
    this.#status('connecting')
    if (!this.liveChatId) this.liveChatId = await this.#resolveLiveChatId()
    await this.#poll()
  }

  disconnect() {
    this.closed = true
    this.connected = false
    this.polling = false
    this.clearTimeoutFn(this.timer)
    this.timer = null
    this.pageToken = ''
    this.state = 'disconnected'
  }

  mockEvent(event) { if (this.mock) this.emit('event', event) }

  async #resolveLiveChatId() {
    if (!this.videoId) throw new Error('未配置有效的 YouTube 视频 ID、直播地址或 Live Chat ID')
    const url = new URL(VIDEOS_API_URL)
    url.searchParams.set('part', 'liveStreamingDetails')
    url.searchParams.set('id', this.videoId)
    url.searchParams.set('key', this.apiKey)
    const response = await this.fetchImpl(url, { headers: { Accept: 'application/json' } })
    const json = await response.json().catch(() => null)
    if (!response.ok) throw new Error(`YouTube 直播信息请求失败：${json?.error?.message || `HTTP ${response.status}`}`)
    const liveChatId = String(json?.items?.[0]?.liveStreamingDetails?.activeLiveChatId || '')
    if (!liveChatId) throw new Error('该视频当前没有可用的 YouTube Live Chat')
    return liveChatId
  }

  #status(status, extra = {}) {
    this.state = status
    this.emit('event', { type: 'status', status, ...extra })
  }

  #schedule(delay) {
    if (this.closed) return
    this.clearTimeoutFn(this.timer)
    this.timer = this.setTimeoutFn(() => {
      this.timer = null
      void this.#poll()
    }, delay)
  }

  async #poll() {
    if (this.closed || this.polling) return
    this.polling = true
    const hadToken = Boolean(this.pageToken)
    try {
      const url = new URL(API_URL)
      url.searchParams.set('part', 'id,snippet,authorDetails')
      url.searchParams.set('liveChatId', this.liveChatId)
      url.searchParams.set('key', this.apiKey)
      url.searchParams.set('maxResults', '200')
      url.searchParams.set('hl', 'zh-CN')
      if (this.pageToken) url.searchParams.set('pageToken', this.pageToken)
      const response = await this.fetchImpl(url, { headers: { Accept: 'application/json' } })
      const json = await response.json().catch(() => null)
      if (!response.ok) {
        const message = json?.error?.message || `HTTP ${response.status}`
        throw new Error(`YouTube Live Chat 请求失败：${message}`)
      }
      if (this.closed) return
      if (!this.connected) {
        this.connected = true
        this.#status('connected')
      }
      if (hadToken || this.emitInitialHistory) {
        for (const item of Array.isArray(json?.items) ? json.items : []) {
          const event = mapYouTubeMessage(item)
          if (event) this.emit('event', event)
        }
      }
      this.pageToken = String(json?.nextPageToken || this.pageToken)
      this.retries = 0
      if (json?.offlineAt) {
        this.closed = true
        this.#status('disconnected', { message: 'YouTube 直播已结束' })
        return
      }
      const interval = Math.max(1_000, Math.min(30_000, Number(json?.pollingIntervalMillis || 5_000)))
      this.#schedule(interval)
    } catch (error) {
      if (this.closed) return
      const delay = Math.min(30_000, 1_000 * 2 ** this.retries++)
      this.#status(this.connected ? 'reconnecting' : 'error', { message: String(error?.message || error), delay })
      this.#schedule(delay)
    } finally {
      this.polling = false
    }
  }
}
