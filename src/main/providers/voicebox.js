/**
 * Voicebox 本地服务 Provider。
 *
 * Voicebox 是一个本机运行的 Qwen3-TTS 声音克隆/生成服务，同时也提供
 * /transcribe（STT）和 /llm/generate（本地 LLM）接口。
 *
 * 这里按“发发”现有 Provider 接口实现：
 * - TTS: synthesize(text) => { type: 'data'|'url', value }
 * - ASR: test() + createSession({ onFinal, onError })
 * - LLM: listModels() + reply(messages, context)
 */

const DEFAULT_TIMEOUT_MS = 30_000

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '')
}

function toBuffer(chunk) {
  if (Buffer.isBuffer(chunk)) return chunk
  if (chunk instanceof ArrayBuffer) return Buffer.from(chunk)
  if (ArrayBuffer.isView(chunk)) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }
  return Buffer.from(chunk)
}

/**
 * 把 16kHz 单声道 16bit PCM 块拼成 WAV Buffer。
 */
export function pcmChunksToWav(chunks, { sampleRate = 16000, channels = 1, bitsPerSample = 16 } = {}) {
  const pcm = Buffer.concat(chunks.map((chunk) => toBuffer(chunk)))
  const blockAlign = channels * bitsPerSample / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  pcm.copy(buffer, 44)

  return buffer
}

export class VoiceboxTTSProvider {
  constructor(config = {}) {
    this.config = config
    this.baseUrl = normalizeBaseUrl(config.baseUrl)
  }

  async listModels() {
    if (!this.baseUrl) throw new Error('Voicebox 服务地址未配置')
    return ['qwen']
  }

  /**
   * 读取 Voicebox 里的声音 Profile，作为“音色”列表返回。
   */
  async listVoices() {
    if (!this.baseUrl) throw new Error('Voicebox 服务地址未配置')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch(`${this.baseUrl}/profiles`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Voicebox 音色列表请求失败 (${response.status})`)
      const data = await response.json()
      const profiles = Array.isArray(data) ? data : []
      const ids = profiles.map((profile) => profile?.id || profile?.name).filter((id) => typeof id === 'string' && id.trim())
      return [...new Set(ids)]
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 使用 Voicebox /generate/stream 生成 WAV 音频并返回 data URL。
   * 配置里的 voice 字段保存 Voicebox 的 profile_id。
   */
  async synthesize(text) {
    if (!this.baseUrl) throw new Error('Voicebox 服务地址未配置')
    const profileId = String(this.config.voice || '').trim()
    if (!profileId) throw new Error('Voicebox 音色未配置（请填写 Profile ID）')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
    try {
      const body = {
        profile_id: profileId,
        text: String(text || '').slice(0, 5000),
        language: String(this.config.language || 'zh'),
        engine: String(this.config.engine || 'qwen'),
        model_size: String(this.config.modelSize || this.config.model || '1.7B')
      }
      const response = await fetch(`${this.baseUrl}/generate/stream`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        let message = `Voicebox TTS 请求失败 (${response.status})`
        try {
          const errorData = await response.json()
          if (errorData?.detail) message += `：${typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)}`
        } catch { /* ignore body parse errors */ }
        throw new Error(message)
      }
      const arrayBuffer = await response.arrayBuffer()
      if (!arrayBuffer.byteLength) throw new Error('Voicebox TTS 返回空音频')
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      return { type: 'data', value: `data:audio/wav;base64,${base64}` }
    } finally {
      clearTimeout(timer)
    }
  }
}

export class VoiceboxAsrProvider {
  constructor(config = {}) {
    this.config = config
    this.baseUrl = normalizeBaseUrl(config.baseUrl)
  }

  async test() {
    if (!this.baseUrl) return { ok: false, message: 'Voicebox 服务地址未配置' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    try {
      const response = await fetch(`${this.baseUrl}/health`, { signal: controller.signal })
      if (!response.ok) return { ok: false, message: `Voicebox 服务状态异常 (${response.status})` }
      return { ok: true, message: 'Voicebox 服务连接成功' }
    } catch (error) {
      return { ok: false, message: `Voicebox 连接失败：${error?.message || error}` }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * 由于 Voicebox 的 /transcribe 是“上传完整音频文件”接口，
   * 这里先把流式 PCM 缓冲起来，end() 时转成 WAV 一次性识别。
   */
  createSession({ onFinal = null, onError = null } = {}) {
    if (!this.baseUrl) throw new Error('Voicebox 服务地址未配置')
    const chunks = []
    let ended = false

    const finishWithError = (message) => {
      if (ended) return
      ended = true
      onError?.(new Error(message))
    }

    return {
      write(buffer) {
        if (ended) return
        chunks.push(toBuffer(buffer))
      },
      async end() {
        if (ended) return
        ended = true
        if (!chunks.length) {
          onError?.(new Error('没有可识别的音频数据'))
          return
        }
        try {
          const wav = pcmChunksToWav(chunks)
          const form = new FormData()
          form.append('file', new Blob([wav], { type: 'audio/wav' }), 'fafa-capture.wav')
          if (this.config.language) form.append('language', String(this.config.language))
          if (this.config.model) form.append('model', String(this.config.model))

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
          try {
            const response = await fetch(`${this.baseUrl}/transcribe`, {
              method: 'POST',
              signal: controller.signal,
              body: form
            })
            if (!response.ok) {
              let message = `Voicebox 转写失败 (${response.status})`
              try {
                const errorData = await response.json()
                if (errorData?.detail) message += `：${typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)}`
              } catch { /* ignore */ }
              throw new Error(message)
            }
            const data = await response.json()
            const text = String(data?.text || '').trim()
            if (text) onFinal?.(text)
          } finally {
            clearTimeout(timer)
          }
        } catch (error) {
          finishWithError(`Voicebox 转写失败：${error?.message || error}`)
        }
      }
    }
  }
}

export class VoiceboxLLMProvider {
  constructor(config = {}) {
    this.config = config
    this.baseUrl = normalizeBaseUrl(config.baseUrl)
  }

  async listModels() {
    if (!this.baseUrl) throw new Error('Voicebox 服务地址未配置')
    return ['0.6B', '1.7B', '4B']
  }

  /**
   * 把发发的多轮 messages 映射成 Voicebox 的单轮 prompt/system。
   * 适合本地轻量回复；复杂多轮仍建议继续用 DeepSeek。
   */
  async reply(messages = [], context = {}) {
    if (!this.baseUrl) throw new Error('Voicebox 服务地址未配置')
    const list = Array.isArray(messages) ? messages : []
    const systemMessage = list.find((item) => item?.role === 'system')
    const userMessage = [...list].reverse().find((item) => item?.role === 'user')
    const prompt = String(userMessage?.content || list.at(-1)?.content || '').slice(0, 300)
    const system = String(systemMessage?.content || `你是发发，一位元气墨鱼系女孩。回答要俏皮、少于60个汉字。直播间：${context.roomId || '离线'}`).slice(0, 1000)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(`${this.baseUrl}/llm/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          system,
          model_size: String(this.config.model || '0.6B'),
          max_tokens: 120,
          temperature: 0.8
        })
      })
      if (!response.ok) throw new Error(`Voicebox LLM 请求失败 (${response.status})`)
      const data = await response.json()
      return String(data?.text || '').trim().slice(0, 120)
    } finally {
      clearTimeout(timer)
    }
  }
}
