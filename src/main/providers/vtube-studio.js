import WebSocket from 'ws'

/**
 * VTube Studio 插件 API 客户端（仅使用官方 PublicAPI v1.0）。
 *
 * 连接参数默认 http://127.0.0.1:8001（ws://127.0.0.1:8001）。
 * VTube Studio 需要在“设置 → 插件”中允许插件连接。
 * 首次认证时 VTube Studio 会弹出“允许插件”对话框，用户点击允许后
 * 才能读取模型 / 表情 / 快捷键，这是官方安全机制，不是连接失败。
 */

const DEFAULT_TIMEOUT_MS = 10_000

export class VTubeStudioClient {
  constructor(config = {}, { WebSocketImpl = WebSocket, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.config = config || {}
    this.WebSocketImpl = WebSocketImpl
    this.timeoutMs = timeoutMs
    this.socket = null
    this.pending = new Map()
    this.requestSeq = 0
    this.authenticationToken = String(config?.authenticationToken || '')
  }

  #url() {
    const host = String(this.config.host || '127.0.0.1').replace(/^wss?:\/\//i, '').replace(/\/+$/, '')
    const port = Number(this.config.port || 8001)
    return `ws://${host}:${port}`
  }

  #nextRequestId() {
    this.requestSeq += 1
    return 'fafa-vts-' + Date.now() + '-' + this.requestSeq
  }

  async connect() {
    if (this.socket && this.socket.readyState === 1) return this.socket
    if (this.socket) await this.disconnect()
    const url = this.#url()
    const socket = new this.WebSocketImpl(url)
    this.socket = socket
    return new Promise((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => finish(reject, new Error('VTube Studio 连接超时（10 秒）')), this.timeoutMs)
      const finish = (fn, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn(value)
      }
      socket.on('open', () => finish(resolve, socket))
      socket.on('error', (error) => finish(reject, new Error('VTube Studio 连接失败：' + String(error?.message || error))))
      socket.on('close', () => {
        if (!settled) finish(reject, new Error('VTube Studio 连接被关闭'))
        this.socket = null
      })
    })
  }

  async disconnect() {
    const socket = this.socket
    this.socket = null
    this.pending.forEach(({ reject }) => reject(new Error('VTube Studio 连接已断开')))
    this.pending.clear()
    if (!socket) return
    try { socket.close?.() } catch { /* already closed */ }
  }

  /**
   * 发送一条插件 API 请求并等待同 requestID 的响应。
   */
  request(messageType, data = {}) {
    const send = (socket) => new Promise((resolve, reject) => {
      const requestID = this.#nextRequestId()
      const payload = {
        apiName: 'VTubeStudioPublicAPI',
        apiVersion: '1.0',
        requestID,
        messageType,
        data
      }
      const timer = setTimeout(() => {
        this.pending.delete(requestID)
        reject(new Error('VTube Studio 请求超时：' + messageType))
      }, this.timeoutMs)
      const onMessage = (raw) => {
        let message
        try { message = JSON.parse(String(raw)) } catch { return }
        if (message?.requestID !== requestID) return
        clearTimeout(timer)
        this.pending.delete(requestID)
        socket.off?.('message', onMessage)
        if (message.messageType === 'APIError') {
          reject(new Error(String(message?.data?.message || 'VTube Studio API 返回错误')))
          return
        }
        resolve({ message, data: message?.data || {} })
      }
      this.pending.set(requestID, { reject, onMessage, timer })
      socket.on('message', onMessage)
      try {
        socket.send(JSON.stringify(payload))
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(requestID)
        reject(error)
      }
    })
    if (this.socket && this.socket.readyState === 1) return send(this.socket)
    return this.connect().then(send)
  }

  /**
   * 基础连通性探测。未认证不算失败，会返回 authenticated:false，
   * 设置页据此显示黄色信号灯并提示用户去 VTube Studio 点击允许。
   */
  async test() {
    const result = await this.request('APIStateRequest')
    const state = result.data
    const message = state.currentSessionAuthenticated
      ? `已连接 VTube Studio ${state.vTubeStudioVersion || ''}，插件已认证`
      : 'VTube Studio 在线，但插件尚未认证（请在 VTube Studio 弹窗中点击允许）'
    return {
      ok: Boolean(state.active),
      authenticated: Boolean(state.currentSessionAuthenticated),
      version: String(state.vTubeStudioVersion || ''),
      message
    }
  }

  async authenticate(token = '') {
    let authenticationToken = String(token || '')
    if (!authenticationToken) {
      const tokenResult = await this.request('AuthenticationTokenRequest', {
        pluginName: String(this.config.pluginName || 'PetWeaver'),
        pluginDeveloper: String(this.config.pluginDeveloper || 'Fafa')
      })
      authenticationToken = String(tokenResult.data.authenticationToken || '')
    }
    if (!authenticationToken) throw new Error('VTube Studio 未返回认证令牌')
    const authResult = await this.request('AuthenticationRequest', {
      pluginName: String(this.config.pluginName || 'PetWeaver'),
      pluginDeveloper: String(this.config.pluginDeveloper || 'Fafa'),
      authenticationToken
    })
    if (authResult.data.authenticated) this.authenticationToken = authenticationToken
    return {
      ok: Boolean(authResult.data.authenticated),
      message: authResult.data.authenticated ? '插件认证成功' : '插件认证失败：' + String(authResult.data.reason || 'VTube Studio 拒绝了认证'),
      token: authResult.data.authenticated ? authenticationToken : ''
    }
  }

  async availableModels() {
    const result = await this.request('AvailableModelsRequest')
    return (result.data.availableModels || []).map((model) => ({
      id: String(model.modelID || model.modelId || ''),
      name: String(model.modelName || ''),
      loaded: Boolean(model.modelLoaded)
    }))
  }

  async currentModel() {
    const result = await this.request('CurrentModelRequest')
    const data = result.data || {}
    return {
      name: String(data.modelName || ''),
      id: String(data.modelID || data.modelId || ''),
      loaded: Boolean(data.modelLoaded),
      live2DModelName: String(data.live2DModelName || ''),
      availableModels: Array.isArray(data.availableModels) ? data.availableModels : []
    }
  }

  async expressions() {
    const result = await this.request('ExpressionStateRequest', { details: true })
    return (result.data.expressions || []).map((expression) => ({
      name: String(expression.name || ''),
      file: String(expression.file || ''),
      active: Boolean(expression.active),
      deactivateWhenKeyReleased: Boolean(expression.deactivateWhenKeyReleased),
      usedInHotkeys: Array.isArray(expression.usedInHotkeys) ? expression.usedInHotkeys : []
    }))
  }

  async hotkeys() {
    const result = await this.request('HotkeysInCurrentModelRequest')
    return (result.data.hotkeys || []).map((hotkey) => ({
      id: String(hotkey.hotkeyID || hotkey.id || ''),
      name: String(hotkey.name || hotkey.file || ''),
      file: String(hotkey.file || ''),
      type: String(hotkey.type || '')
    }))
  }

  async activateExpression(file, active = true) {
    const result = await this.request('ExpressionActivationRequest', {
      expressionFile: String(file || ''),
      active: Boolean(active)
    })
    return { ok: true, message: result.message?.messageType === 'ExpressionActivationResponse' ? '表情已发送' : '表情发送完成' }
  }

  async triggerHotkey(id) {
    const result = await this.request('HotkeyTriggerRequest', { hotkeyID: String(id || '') })
    return { ok: true, message: result.message?.messageType === 'HotkeyTriggerResponse' ? '快捷键已触发' : '快捷键发送完成' }
  }

  async loadModel(id) {
    const result = await this.request('ModelLoadRequest', { modelID: String(id || '') })
    return {
      ok: Boolean(result.data.modelLoaded),
      message: result.data.modelLoaded ? '模型已载入' : '模型载入失败'
    }
  }
}
