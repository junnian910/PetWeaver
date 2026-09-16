import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import { LiveWS } from 'bilibili-live-ws'

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
]

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map((index) => orig[index]).join('').slice(0, 32)
}

function md5(value) {
  return createHash('md5').update(String(value)).digest('hex')
}

async function fetchWbiKeys() {
  const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const json = await response.json().catch(() => null)
  const imgUrl = json?.data?.wbi_img?.img_url
  const subUrl = json?.data?.wbi_img?.sub_url
  if (!imgUrl || !subUrl) throw new Error('获取 WBI 密钥失败')
  const imgKey = imgUrl.split('/').pop().split('.')[0]
  const subKey = subUrl.split('/').pop().split('.')[0]
  return { imgKey, subKey }
}

function signWbiParams(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey)
  const signed = { ...params, wts: Math.round(Date.now() / 1000) }
  const query = Object.keys(signed).sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(signed[key])}`)
    .join('&')
  signed.w_rid = md5(query + mixinKey)
  return signed
}

/**
 * Wraps a single Bilibili live connection and owns the only reconnection
 * policy (exponential backoff). Uses LiveWS instead of KeepLiveWS so the
 * library's internal 100ms reconnect loop cannot open a second parallel
 * connection to the same room.
 */
export class BilibiliAdapter extends EventEmitter {
  #handleOpen = () => {
    this.retries = 0
    this.emit('event', { type: 'status', status: 'connected' })
  }

  #handleDanmaku = (payload) => this.emit('event', mapDanmaku(payload))
  #handleGift = (payload) => this.emit('event', mapGift(payload))
  #handleSuperChat = (payload) => this.emit('event', mapSuperChat(payload))
  #handleGuard = (payload) => this.emit('event', mapGuard(payload))
  #handleEnter = (payload) => this.emit('event', mapEnter(payload))

  #handleError = (error) => {
    const detail = String(error?.message || error || this.lastError || '连接错误（无详细信息）')
    this.emit('event', { type: 'status', status: 'error', message: detail })
  }

  #handleClose = () => {
    if (this.closed || this.reconnectTimer !== null) return
    const delay = Math.min(30_000, 1_000 * 2 ** this.retries++)
    this.emit('event', { type: 'status', status: 'reconnecting', delay })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.closed) return
      void this.connect().catch((error) => {
        this.emit('event', { type: 'status', status: 'error', message: String(error?.message || error || '连接错误') })
      })
    }, delay)
  }

  constructor({ roomId, mock = false, cookie = '', clientFactory = (roomId, conf = {}) => new LiveWS(roomId, {
    ...(conf.address ? { address: conf.address } : {}),
    ...(conf.key ? { key: conf.key } : {}),
    ...(conf.uid !== undefined ? { uid: conf.uid } : {}),
    ...(conf.buvid ? { buvid: conf.buvid } : {})
  }), getConfImpl = async (roomId) => {
    const { imgKey, subKey } = await fetchWbiKeys()
    const signedParams = signWbiParams({ id: String(roomId), type: 0, web_location: '444.8' }, imgKey, subKey)
    const query = Object.keys(signedParams).sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(signedParams[key])}`)
      .join('&')
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': `https://live.bilibili.com/${roomId}` }
    if (cookie) headers.Cookie = cookie
    const response = await fetch(`https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${query}`, { headers })
    const json = await response.json().catch(() => null)
    const data = json?.data
    const host = Array.isArray(data?.host_list) ? data.host_list[0]?.host : null
    if (!data?.token || !host) {
      throw new Error((json?.code ? `B站返回错误码 ${json.code}` : '') + (json?.message || `B站未返回弹幕服务器配置（HTTP ${response.status}）`))
    }
    return {
      key: data.token,
      host,
      address: `wss://${host}/sub`,
      uid: Number(/DedeUserID=(\d+)/.exec(cookie)?.[1] || 0),
      buvid: (/buvid3=([^;]+)/.exec(cookie)?.[1]) || (/buvid4=([^;]+)/.exec(cookie)?.[1]) || ''
    }
  } } = {}) {
    super()
    this.roomId = roomId
    this.mock = mock
    this.cookie = cookie
    this.clientFactory = clientFactory
    this.getConfImpl = getConfImpl
    this.client = null
    this.retries = 0
    this.closed = false
    this.reconnectTimer = null
    this.lastError = ''
    this.lastClose = ''
  }

  async connect() {
    this.closed = false
    this.#disposeClient()
    if (this.mock) {
      this.emit('event', { type: 'status', status: 'connected', mode: 'mock' })
      return
    }
    if (!this.roomId) throw new Error('未配置 B 站房间号')
    const roomId = Number(this.roomId)
    let conf = {}
    try {
      conf = await this.getConfImpl(roomId)
    } catch (error) {
      this.emit('event', { type: 'status', status: 'error', message: '获取直播配置失败：' + String(error?.message || error) })
    }
    if (this.closed) return
    const client = this.clientFactory(roomId, conf)
    this.client = client
    this.#attachRawDiagnostics(client)
    client.on('open', this.#handleOpen)
    client.on('DANMU_MSG', this.#handleDanmaku)
    client.on('SEND_GIFT', this.#handleGift)
    client.on('SUPER_CHAT_MESSAGE', this.#handleSuperChat)
    client.on('GUARD_BUY', this.#handleGuard)
    client.on('INTERACT_WORD', this.#handleEnter)
    client.on('error', this.#handleError)
    client.on('close', this.#handleClose)
  }

  disconnect() {
    this.closed = true
    this.#disposeClient()
  }

  #disposeClient() {
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (!this.client) return
    this.client.removeAllListeners?.()
    try { this.client.close?.() } catch { /* already closed */ }
    this.client = null
  }

  #attachRawDiagnostics(client) {
    // bilibili-live-ws 的包装层会丢掉 WebSocket 的 error/close 详情，
    // 这里直接挂到底层 ws 上，便于在控制台看到真实原因。
    const raw = client?.ws?.ws
    if (!raw?.on) return
    raw.on('error', (error) => {
      this.lastError = String(error?.message || error || 'WebSocket error')
      this.emit('event', { type: 'status', status: 'error', message: '连接错误：' + this.lastError })
    })
    raw.on('close', (code, reason) => {
      this.lastClose = 'code=' + String(code ?? '?') + (reason ? ', reason=' + String(reason) : '')
    })
    raw.on('unexpected-response', (_request, response) => {
      this.lastError = 'HTTP ' + String(response?.statusCode || '?')
      this.emit('event', { type: 'status', status: 'error', message: '连接错误：HTTP ' + String(response?.statusCode || '?') })
    })
  }

  mockEvent(event) { if (this.mock) this.emit('event', event) }
}

function user(id, name) { return { id: String(id || ''), name: String(name || '观众').slice(0, 30) } }

function fansMedal(data) {
  const medal = data?.medal_info || data?.fans_medal || data?.medal || null
  if (!medal || typeof medal !== 'object') return null
  const name = String(medal.medal_name ?? medal.name ?? '').trim()
  const level = Number(medal.level ?? medal.medal_level ?? 0)
  if (!name && !level) return null
  return {
    name,
    level,
    colorStart: Number(medal.medal_color_start ?? medal.color_start ?? 0),
    colorEnd: Number(medal.medal_color_end ?? medal.color_end ?? 0),
    colorBorder: Number(medal.medal_color_border ?? medal.color_border ?? 0)
  }
}

function userWithMedal(id, name, medalData) {
  const medal = fansMedal(medalData)
  const base = user(id, name)
  return medal ? { ...base, fansMedal: medal } : base
}

function danmakuMedal(info) {
  const medal = Array.isArray(info?.[3]) && info[3].length ? info[3] : null
  if (!medal) return null
  return {
    medal_name: medal[0],
    level: medal[1],
    medal_color_start: medal[2],
    medal_color_end: medal[3],
    medal_color_border: medal[4]
  }
}

export function mapDanmaku(raw) { const info = raw?.data?.info || raw?.info || []; const text = String(info?.[1] || '').slice(0, 200); const userId = info?.[2]?.[0] || ''; return { type: 'danmaku', id: String(raw?.data?.msg_id || raw?.data?.data?.msg_id || raw?.msg_id || ''), user: userWithMedal(userId, info?.[2]?.[1], danmakuMedal(info)), text, raw } }
export function mapGift(raw) { const data = raw?.data?.data || raw?.data || {}; return { type: 'gift', id: String(data.tid || data.order_id || ''), user: userWithMedal(data.uid, data.uname, data), giftName: String(data.giftName || '礼物'), count: Number(data.num || 1), price: Number(data.price || 0), totalCoin: Number(data.total_coin || 0), raw } }
export function mapSuperChat(raw) { const data = raw?.data?.data || raw?.data || {}; const userInfo = data.user_info || {}; return { type: 'superChat', id: String(data.id || ''), user: userWithMedal(data.uid, userInfo.uname, userInfo), text: String(data.message || '').slice(0, 300), price: Number(data.price || 0), raw } }
export function mapGuard(raw) { const data = raw?.data?.data || raw?.data || {}; return { type: 'guard', id: String(data.guard_id || data.order_id || ''), user: userWithMedal(data.uid, data.username, data), level: Number(data.guard_level || 3), raw } }
export function mapEnter(raw) { const data = raw?.data?.data || raw?.data || {}; return { type: 'enter', id: String(data.msg_id || data.timestamp || ''), user: userWithMedal(data.uid, data.uname, data), raw } }
