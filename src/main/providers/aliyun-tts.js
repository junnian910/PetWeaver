export class AliyunTTSProvider {
  static FALLBACK_VOICES = Object.freeze(['Cherry', 'Serena', 'Ethan', 'Sunny', 'Chelsie', 'Luna'])
  static KNOWN_MODELS = Object.freeze(['qwen3-tts-flash', 'qwen-tts-turbo', 'cosyvoice-v1', 'cosyvoice-v3-flash', 'qwen3-tts-vc'])

  async listModels() { return [...AliyunTTSProvider.KNOWN_MODELS] }

  /**
   * 从百炼接口读取音色列表。接口不可用或未配置 Key 时抛出可读错误，
   * 由设置页回退到内置列表并允许手动输入自定义音色。
   */
  async listVoices() {
    if (!this.apiKey) throw new Error('百炼 API Key 未配置')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const url = new URL('/services/aigc/multimodal-generation/voices', this.config.baseUrl.replace(/\/$/, ''))
      url.searchParams.set('model', this.config.model)
      const response = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${this.apiKey}` } })
      if (!response.ok) throw new Error(`音色列表请求失败 (${response.status})`)
      const data = await response.json()
      const voices = extractVoiceIds(data)
      if (!voices.length) throw new Error('音色列表为空，请手动输入音色名')
      return voices
    } finally { clearTimeout(timer) }
  }

  constructor(config, apiKey) { this.config = config; this.apiKey = apiKey }

  async synthesize(text) {
    if (!this.apiKey) throw new Error('百炼 API Key 未配置')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/services/aigc/multimodal-generation/generation`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.config.model, input: { text: String(text).slice(0, 300), voice: this.config.voice, language_type: 'Chinese' } })
      })
      if (!response.ok) throw new Error(`TTS 请求失败 (${response.status})`)
      const data = await response.json()
      const audio = data.output?.audio
      if (audio?.url) return { type: 'url', value: audio.url }
      if (audio?.data) return { type: 'data', value: `data:audio/pcm;base64,${audio.data}` }
      return null
    } finally { clearTimeout(timer) }
  }
}

/**
 * 兼容音色列表接口的常见返回结构，提取音色 ID 列表。
 */
export function extractVoiceIds(data) {
  const candidates = [data?.data?.voices, data?.voices, data?.data?.voice_list, data?.voice_list]
  const list = candidates.find((item) => Array.isArray(item)) || []
  const ids = list
    .map((item) => item?.voice || item?.voice_id || item?.id || item?.name || null)
    .filter((id) => typeof id === 'string' && id.trim())
  return [...new Set(ids)]
}
