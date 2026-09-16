import WebSocket from 'ws'

/**
 * ASR（语音转文字）Provider 接口约定：
 *   test()            连通性探测，返回 { ok, message }
 *   createSession()   流式识别会话 { write(pcm16kBuffer), end() }，
 *                     通过 onFinal(text) 回调返回整句结果。
 */
export class OfflineAsrProvider {
  constructor() { this.available = false }
  async test() { return { ok: false, message: '当前为离线模式，未启用语音识别' } }
  createSession() { throw new Error('语音识别未启用') }
}

/**
 * 阿里云百炼 paraformer 实时语音识别（WebSocket 双工协议）。
 * 二进制帧为 16kHz 单声道 PCM16；结果事件兼容 result-generated 与
 * TranscriptionResultChanged 两种负载形态。连接细节如与线上协议有出入，
 * 测试对话框会展示具体错误，便于按官方文档微调。
 */
export class AliyunRealtimeAsrProvider {
  constructor(config = {}, apiKey = '', { WebSocketImpl = WebSocket } = {}) {
    this.config = config
    this.apiKey = apiKey
    this.WebSocketImpl = WebSocketImpl
    this.model = String(config.model || 'paraformer-realtime-v2')
    this.url = String(config.baseUrl || 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/').replace(/\/$/, '')
  }

  async listModels() { return ['paraformer-realtime-v2', 'paraformer-realtime-v1', 'paraformer-v2', 'sensevoice-v1'] }

  #tokenUrl() {
    const separator = this.url.includes('?') ? '&' : '?'
    return `${this.url}${separator}token=${encodeURIComponent(this.apiKey)}`
  }

  async test() {
    if (!this.apiKey) return { ok: false, message: '尚未配置百炼 API Key' }
    return new Promise((resolve) => {
      let settled = false
      const finish = (result) => { if (!settled) { settled = true; socket?.close?.(); clearTimeout(timer); resolve(result) } }
      const socket = new this.WebSocketImpl(this.#tokenUrl(), { headers: { Authorization: `Bearer ${this.apiKey}` } })
      const timer = setTimeout(() => finish({ ok: false, message: '连接超时（8 秒）' }), 8_000)
      socket.on('error', (error) => finish({ ok: false, message: `连接失败：${error.message}` }))
      socket.on('open', () => {
        this.#sendStart(socket, 'probe')
        socket.on('message', () => finish({ ok: true, message: '实时语音识别服务连接成功' }))
      })
    })
  }

  #sendStart(socket, taskId) {
    socket.send(JSON.stringify({
      header: { task_id: taskId, action: 'run-task', streaming: 'duplex' },
      payload: {
        task_group: 'audio',
        task: 'asr',
        function: 'recognition',
        model: this.model,
        parameters: { format: 'pcm', sample_rate: 16000 }
      }
    }))
  }

  createSession({ onPartial = null, onFinal = null, onError = null, maxPendingChunks = 40 } = {}) {
    if (!this.apiKey) throw new Error('尚未配置百炼 API Key')
    const taskId = 'fafa-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)
    const socket = new this.WebSocketImpl(this.#tokenUrl(), { headers: { Authorization: 'Bearer ' + this.apiKey } })
    let started = false
    let closed = false
    const pending = []
    const finishWithError = (message) => {
      if (closed) return
      closed = true
      pending.length = 0
      try { socket.close?.() } catch { /* already closed */ }
      onError?.(new Error(message))
    }
    socket.on('error', (error) => finishWithError('ASR 连接错误：' + error.message))
    socket.on('open', () => {
      started = true
      this.#sendStart(socket, taskId)
      while (pending.length) socket.send(pending.shift())
    })
    socket.on('message', (raw) => {
      let message
      try { message = JSON.parse(String(raw)) } catch { return }
      const text = extractSentenceText(message)
      if (text) onFinal?.(text)
    })
    return {
      write(buffer) {
        if (closed) return
        if (!started) {
          // 连接建立前的音频先缓冲，open 后统一发送，避免首包丢失。
          if (pending.length >= maxPendingChunks) pending.shift()
          pending.push(buffer)
          return
        }
        socket.send(buffer)
      },
      end() {
        if (closed) return
        closed = true
        pending.length = 0
        if (started) socket.send(JSON.stringify({ header: { task_id: taskId, action: 'finish-task' } }))
        try { socket.close?.() } catch { /* already closed */ }
      }
    }
  }
}

export function extractSentenceText(message) {
  const sentence = message?.payload?.output?.sentence
  if (sentence && typeof sentence.text === 'string' && sentence.text.trim()) return sentence.text.trim()
  const legacy = message?.payload?.result
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim()
  return ''
}

export function createAsrProvider(config = {}, apiKey = '') {
  if (config.enabled && apiKey) return new AliyunRealtimeAsrProvider(config, apiKey)
  return new OfflineAsrProvider()
}
