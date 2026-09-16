import { createHash, randomBytes } from 'node:crypto'
import WebSocket from 'ws'

/**
 * Edge TTS Provider（直连微软 Edge Read Aloud 的 WebSocket 协议）。
 *
 * 不依赖任何本地服务或 API Key。默认音色为 zh-CN-XiaoxiaoNeural，
 * 也支持设置页通过”读取音色列表”获取内置中文 / 英文 / 日文常用音色。
 * 如果自建了 Edge-TTS HTTP 服务（例如 TT3301/Edge-TTS 这类项目），
 * 可以把 TTS 预设保持为 Edge TTS、把”接口地址”改成自建服务地址，
 * 本 Provider 会优先走 /v1/audio/speech 或 /tts 接口。
 *
 * 说明：Edge TTS 只能使用微软提供的预设音色，不能直接训练自定义音色。
 * 如果想要自己的声音，请用声音克隆服务（例如 Voicebox）训练后生成
 * profile，再在 TTS 预设里选择 Voicebox 调用。
 */
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'

// 与 rany2/edge-tts 同步的真实 Chromium 版本号。微软要求 Sec-MS-GEC-Version
// 必须是真实存在的版本（例如 143.0.3650.75），伪造的 130.0.0.0 会被反滥用
// 校验直接以 403 拒绝（见 https://github.com/rany2/edge-tts/issues/290）。
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.', 1)[0]
const SEC_MS_GEC_VERSION = '1-' + CHROMIUM_FULL_VERSION

const WINDOWS_EPOCH_SEC = 11644473600 // 1601-01-01 到 1970-01-01 的秒数
const FIVE_MINUTES_SEC = 300
const TICKS_PER_SEC = 10_000_000n // 100ns 为 1 tick，每秒 1e7 tick

/**
 * 生成 Sec-MS-GEC 反滥用 token。
 * 算法（逆向自 Edge 浏览器，与 rany2/edge-tts 的 DRM.generate_sec_ms_gec 一致）：
 *  1. 取当前 UTC 时间（秒，含时钟偏移校正），加上 Windows File Time 纪元偏移
 *  2. 向下取整到 5 分钟边界
 *  3. 换算为 100ns ticks，拼接 TrustedClientToken 字符串
 *  4. SHA-256 哈希，输出大写十六进制
 */
let clockSkewMs = 0

function generateSecMsGec() {
  const unixSec = Math.floor((Date.now() + clockSkewMs) / 1000)
  const roundedSec = unixSec - (unixSec % FIVE_MINUTES_SEC)
  const ticks = BigInt(roundedSec + WINDOWS_EPOCH_SEC) * TICKS_PER_SEC
  const input = ticks.toString() + TRUSTED_CLIENT_TOKEN
  return createHash('sha256').update(input, 'ascii').digest('hex').toUpperCase()
}

/**
 * 生成微软要求的 JavaScript 风格日期字符串（RFC 1123 带 GMT+0000 注释），
 * 与 edge-tts-universal 的 dateToString() / Edge 浏览器 toUTCString() 完全一致，
 * 用于 X-Timestamp 头。注意：必须带逗号（"Mon, 17 Aug 2026 ..."），
 * 服务端按该格式解析，格式不对会以 1002 协议错误关闭连接。
 */
export function jsDateString(date = new Date()) {
  return date.toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
}

/**
 * 将音色短名（如 zh-CN-XiaoxiaoNeural）转换为 SSML 中使用的完整名称
 * （如 Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)）。
 * 已经是完整格式的短名原样返回；不符合规则的返回原值。
 * 与服务端校验逻辑一致：SSML 必须使用完整名称，否则连接被 1002 关闭。
 */
export function toFullVoiceName(voice) {
  const match = /^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(String(voice || '').trim())
  if (!match) return String(voice || '')
  let [, lang, region, name] = match
  if (name.includes('-')) {
    const parts = name.split('-')
    region += '-' + parts[0]
    name = parts.slice(1).join('-')
  }
  return `Microsoft Server Speech Text to Speech Voice (${lang}-${region}, ${name})`
}

export const EDGE_TTS_VOICES = Object.freeze([
  'zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-CN-YunxiNeural', 'zh-CN-YunyangNeural',
  'zh-CN-liaoning-XiaobeiNeural', 'zh-CN-shaanxi-XiaoniNeural',
  'zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural', 'zh-HK-HiuMaanNeural', 'zh-HK-WanLungNeural',
  'en-US-AriaNeural', 'en-US-GuyNeural', 'en-US-JennyNeural', 'en-GB-SoniaNeural', 'en-GB-RyanNeural',
  'ja-JP-NanamiNeural', 'ja-JP-KeitaNeural'
])

export class EdgeTTSProvider {
  constructor(config = {}, { WebSocketImpl = WebSocket } = {}) {
    this.config = config || {}
    this.WebSocketImpl = WebSocketImpl
    this.voice = String(this.config.voice || 'zh-CN-XiaoxiaoNeural').trim()
    this.rate = clampRate(Number(this.config.speed ?? this.config.rate ?? 1))
    this.baseUrl = String(this.config.baseUrl || '').replace(/\/+$/, '')
    this.serverMode = Boolean(this.baseUrl && !/speech\.platform\.bing\.com/i.test(this.baseUrl))
  }

  async listVoices() {
    if (this.serverMode) {
      const voices = await fetchServerVoices(this.baseUrl).catch(() => null)
      if (voices?.length) return voices
    }
    return [...EDGE_TTS_VOICES]
  }

  async listModels() {
    if (this.serverMode) {
      const models = await fetchServerModels(this.baseUrl).catch(() => null)
      if (models?.length) return models
    }
    return ['edge-tts']
  }

  async test() {
    const audio = await this.synthesize('发发语音测试成功').catch((error) => { throw error })
    return { ok: Boolean(audio), message: audio ? 'Edge TTS 连接成功，语音已生成' : 'Edge TTS 未返回音频' }
  }

  /**
   * 返回 { type: 'data', value: 'data:audio/mpeg;base64,...' }。
   * 与 AliyunTTSProvider 的返回约定一致，渲染层可直接交给 Audio 播放。
   * 配置了本地 / 自建 Edge-TTS HTTP 服务地址时优先走 HTTP 接口，
   * 否则直连微软 Edge Read Aloud WebSocket。
   */
  async synthesize(text) {
    const input = String(text || '').trim().slice(0, 500)
    if (!input) return null
    if (this.serverMode) return synthesizeFromServer(this.baseUrl, input, this.voice, this.rate)
    return synthesizeFromWebSocket(input, this.voice, this.rate, this.WebSocketImpl)
  }
}

export async function fetchServerVoices(baseUrl) {
  const candidates = ['/voices', '/v1/voices', '/api/voices']
  for (const suffix of candidates) {
    const response = await fetch(baseUrl + suffix)
    if (!response.ok) continue
    const data = await response.json().catch(() => null)
    const list = Array.isArray(data) ? data : data?.voices || data?.data || null
    if (Array.isArray(list)) return list.map((voice) => voice?.voice || voice?.id || voice?.name || voice?.shortName || null).filter(Boolean)
  }
  return []
}

export async function fetchServerModels(baseUrl) {
  const candidates = ['/models', '/v1/models', '/api/models']
  for (const suffix of candidates) {
    const response = await fetch(baseUrl + suffix)
    if (!response.ok) continue
    const data = await response.json().catch(() => null)
    const list = Array.isArray(data) ? data : data?.models || data?.data || null
    if (Array.isArray(list)) return list.map((model) => model?.id || model?.name || model?.model || null).filter(Boolean)
  }
  return []
}

export async function synthesizeFromServer(baseUrl, text, voice, rate) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  const attempts = [
    {
      url: baseUrl + '/v1/audio/speech',
      options: {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'edge-tts', input: text, voice, response_format: 'mp3', speed: rate })
      }
    },
    {
      url: baseUrl + '/tts',
      options: {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate })
      }
    },
    {
      url: baseUrl + '/tts?text=' + encodeURIComponent(text) + '&voice=' + encodeURIComponent(voice) + '&rate=' + encodeURIComponent(String(rate)),
      options: { method: 'GET', signal: controller.signal }
    }
  ]
  try {
    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, attempt.options)
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())
        if (!buffer.length) continue
        return { type: 'data', value: 'data:audio/mpeg;base64,' + buffer.toString('base64') }
      } catch {
        // 尝试下一个端点
      }
    }
    throw new Error('Edge TTS HTTP 服务未返回音频，请检查服务地址与接口路径')
  } finally {
    clearTimeout(timer)
  }
}

export async function synthesizeFromWebSocket(text, voice, rate, WebSocketImpl) {
  const input = String(text || '').trim().slice(0, 500)
  if (!input) return null
  let lastError = null
  // 403 时用响应 Date 头校正时钟；短暂的网络重置则最多补连两次。
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await openEdgeWsConnection(input, voice, rate, WebSocketImpl)
    } catch (error) {
      lastError = error
      const retryForClockSkew = Boolean(error?.skewAdjusted)
      const retryForNetwork = isRetryableNetworkError(error)
      if ((!retryForClockSkew && !retryForNetwork) || attempt === 2) throw error
      if (retryForNetwork) await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 300 : 900))
    }
  }
  throw lastError
}

function isRetryableNetworkError(error) {
  const code = String(error?.code || error?.cause?.code || '').toUpperCase()
  if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return true
  return /\b(ECONNRESET|ECONNABORTED|EPIPE|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH)\b/i.test(String(error?.message || ''))
}

function openEdgeWsConnection(input, voice, rate, WebSocketImpl) {
  return new Promise((resolve, reject) => {
    let settled = false
    let skewAdjusted = false
    let receivedAudio = false
    const chunks = []
    let socket
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { socket?.close?.() } catch { /* already closed */ }
      fn(value)
    }
    const url = buildWsUrl()
    socket = new WebSocketImpl(url, {
      headers: defaultHeaders(),
      perMessageDeflate: true
    })
    const timer = setTimeout(() => finish(reject, new Error('Edge TTS 连接超时（15 秒）')), 15_000)
    socket.on('unexpected-response', (_request, response) => {
      // 403 时微软会返回 Date 头，用它校正本地时钟偏移（Sec-MS-GEC 依赖本机时间）。
      const serverDate = response?.headers?.date
      if (!serverDate) return
      const serverMs = Date.parse(serverDate)
      if (Number.isNaN(serverMs)) return
      const newSkew = serverMs - Date.now()
      if (Math.abs(newSkew - clockSkewMs) > 500) {
        clockSkewMs = newSkew
        skewAdjusted = true
      }
    })
    socket.on('error', (error) => {
      const message = new Error('Edge TTS 连接失败：' + String(error?.message || error))
      message.skewAdjusted = skewAdjusted
      if (error?.code) message.code = error.code
      message.cause = error
      finish(reject, message)
    })
    socket.on('close', () => {
      clearTimeout(timer)
      if (settled) return
      if (!receivedAudio) { settled = true; reject(new Error('Edge TTS 未返回音频数据')); return }
      settled = true
      const base64 = Buffer.concat(chunks).toString('base64')
      resolve({ type: 'data', value: 'data:audio/mpeg;base64,' + base64 })
    })
    socket.on('open', () => {
      try {
        socket.send(speechConfigMessage())
        socket.send(ssmlMessage(input, voice, rate))
      } catch (error) {
        finish(reject, error)
      }
    })
    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
        const audio = extractAudioFrame(buffer)
        if (audio.length) {
          receivedAudio = true
          chunks.push(audio)
        }
        return
      }
      const text = String(data || '')
      if (text.includes('Path:turn.end')) {
        if (!receivedAudio) { finish(reject, new Error('Edge TTS 未返回音频数据')); return }
        clearTimeout(timer)
        if (settled) return
        settled = true
        const base64 = Buffer.concat(chunks).toString('base64')
        try { socket.close() } catch { /* already closed */ }
        resolve({ type: 'data', value: 'data:audio/mpeg;base64,' + base64 })
      }
    })
  })
}

/**
 * 解析服务端下发的二进制音频帧：前 2 字节为头部总长度（大端，含 2 字节长度字段
 * 与尾部 \r\n），头部文本从偏移 2 开始，音频数据从 headerLength + 2 开始
 * （与 edge-tts-universal / Python edge-tts 一致；多切 2 字节会损坏 MP3 同步头）。
 * 头部不合法时按整帧音频处理（兼容测试桩与极简帧）。
 */
function extractAudioFrame(buffer) {
  if (buffer.length > 2) {
    const headerLength = buffer.readUInt16BE(0)
    if (headerLength > 0 && headerLength + 2 <= buffer.length) {
      const header = buffer.toString('latin1', 2, 2 + headerLength)
      if (header.includes('Path:audio')) {
        return buffer.slice(headerLength + 2)
      }
    }
  }
  return buffer
}

/**
 * 构造 WebSocket 地址。Sec-MS-GEC / Sec-MS-GEC-Version 必须放在 URL 查询参数里
 * （放在请求头无效，微软按 URL 参数校验），并携带随机 ConnectionId，
 * 与 rany2/edge-tts 的 URL 拼接完全一致。
 */
export function buildWsUrl() {
  const connectionId = randomBytes(16).toString('hex')
  return WSS_URL
    + '&ConnectionId=' + connectionId
    + '&Sec-MS-GEC=' + generateSecMsGec()
    + '&Sec-MS-GEC-Version=' + SEC_MS_GEC_VERSION
}

export function defaultHeaders() {
  return {
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'Sec-WebSocket-Version': '13',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + CHROMIUM_MAJOR + '.0.0.0 Safari/537.36 Edg/' + CHROMIUM_MAJOR + '.0.0.0',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9',
    Cookie: 'muid=' + randomBytes(16).toString('hex').toUpperCase() + ';'
  }
}

export function speechConfigMessage() {
  const config = JSON.stringify({
    context: {
      synthesis: {
        audio: {
          // 与 edge-tts-universal 1.4.0 一致：sentenceBoundaryEnabled=false / wordBoundaryEnabled=true
          metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'true' },
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
        }
      }
    }
  })
  return `X-Timestamp:${jsDateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${config}\r\n`
}

export function ssmlMessage(text, voice = 'zh-CN-XiaoxiaoNeural', rate = 1) {
  // X-RequestId 必须是 32 位十六进制（等价 uuid4 无连字符），
  // 自定义格式（如 fafa- 前缀）会被服务端以 1002 协议错误关闭。
  const requestId = randomBytes(16).toString('hex')
  const rateText = (Math.max(-90, Math.min(200, Math.round((clampRate(rate) - 1) * 100))) || 0) + '%'
  // 服务端只接受完整音色名（Microsoft Server Speech Text to Speech Voice (...)），
  // 短名（zh-CN-XiaoxiaoNeural）会导致连接被 1002 关闭；xml:lang 固定 en-US 与官方库一致。
  const fullVoice = toFullVoiceName(voice)
  const safeVoice = /^Microsoft Server Speech Text to Speech Voice \(.+,.+\)$/.test(fullVoice)
    ? fullVoice
    : 'Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)'
  const safeText = String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${safeVoice}'><prosody pitch='+0Hz' rate='${rateText}' volume='+0%'>${safeText}</prosody></voice></speak>`
  // 注意 X-Timestamp 末尾的 Z 是微软 Edge 的解析要求（“This is not a mistake, Microsoft Edge bug.”），
  // 与 rany2/edge-tts 的 ssml_headers_plus_data 一致。
  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${jsDateString()}Z\r\nPath:ssml\r\n\r\n${ssml}`
}

function clampRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 1
  return Math.max(0.4, Math.min(2.5, number))
}

export const EDGE_TTS_ENDPOINT = WSS_URL
export const EDGE_TRUSTED_CLIENT_TOKEN = TRUSTED_CLIENT_TOKEN
