import WebSocket from 'ws'

export class MusicProvider {
  constructor(config = {}) {
    this.config = config
    this.socket = null
    this.connectTimer = null
    this.finishConnect = null
  }

  async connect() {
    this.disconnect()
    if (this.config.mock) return { ok: true, mode: 'mock' }
    if (this.config.provider === 'alisten') return { ok: true, mode: 'alisten' }
    if (!this.config.wsUrl) return { ok: true, mode: 'http' }
    const pending = new Promise((resolve, reject) => {
      let settled = false
      const socket = new WebSocket(this.config.wsUrl)
      this.socket = socket
      const finish = (error, result) => {
        if (settled) return
        settled = true
        if (this.finishConnect === finish) this.finishConnect = null
        clearTimeout(this.connectTimer)
        this.connectTimer = null
        if (error) {
          socket.close()
          if (this.socket === socket) this.socket = null
          reject(error)
        } else resolve(result)
      }
      this.finishConnect = finish
      this.connectTimer = setTimeout(() => finish(new Error('点歌连接超时')), 5_000)
      socket.once('open', () => finish(null, { ok: true, mode: 'websocket' }))
      socket.once('error', (error) => finish(error))
    })
    // disconnect() can settle this promise with an error even when the caller
    // no longer awaits it; keep Node from surfacing an unhandled rejection.
    pending.catch(() => {})
    return pending
  }

  disconnect() {
    this.finishConnect?.(new Error('点歌连接已断开'))
    clearTimeout(this.connectTimer)
    this.connectTimer = null
    this.socket?.removeAllListeners?.()
    this.socket?.close?.()
    this.socket = null
  }

  async request(query, user) {
    if (this.config.mock) return { ok: true, title: query, queuedBy: user?.name || '', mock: true }
    const isAListen = this.config.provider === 'alisten'
    const url = new URL(this.config.requestPath || (isAListen ? '/music/pick' : '/api/request'), this.config.baseUrl)
    const body = isAListen
      ? {
          houseId: String(this.config.houseId || this.config.roomId || ''),
          password: String(this.config.password || ''),
          name: String(query || ''),
          source: String(this.config.source || 'wy')
        }
      : { query, user }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5_000)
    try {
      const response = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(`点歌失败 (${response.status})`)
      const data = await response.json().catch(() => ({}))
      if (data?.error) throw new Error(String(data.error))
      return { ...data, ok: data?.ok !== false, title: String(data?.title || data?.name || query || '') }
    } finally {
      clearTimeout(timer)
    }
  }

  async setVolume(volume) {
    const value = Math.max(0, Math.min(100, Math.round(Number(volume) || 80)))
    if (this.config.mock) return { ok: true, volume: value, mock: true, message: '模拟模式：音量已设为 ' + value }
    if (this.config.provider === 'alisten') return { ok: false, volume: value, message: 'AListen 点歌接口不提供音量控制，请在 AListen 服务中调整。' }
    try {
      const url = new URL('/api/volume', this.config.baseUrl)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5_000)
      try {
        const response = await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ volume: value }) })
        if (!response.ok) throw new Error(`点歌服务不支持音量接口 (${response.status})`)
        return { ok: true, volume: value, ...(await response.json().catch(() => ({}))) }
      } finally {
        clearTimeout(timer)
      }
    } catch (error) {
      return { ok: false, message: '音量调节失败：' + error.message }
    }
  }
}
