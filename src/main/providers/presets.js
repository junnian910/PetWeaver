/**
 * Provider 预设注册表：设置页选择预设后自动填入接口地址/模型/音色，
 * 用户只需填写 API Key 即可测试。custom 预设保留用户手动配置的字段。
 */
export const PROVIDER_PRESETS = Object.freeze({
  tts: Object.freeze([
    {
      id: 'aliyun-bailian',
      label: '阿里云百炼',
      description: 'qwen3-tts-flash / cosyvoice-v3-flash（支持声音复刻）',
      fields: Object.freeze({ baseUrl: 'https://dashscope.aliyuncs.com/api/v1', model: 'qwen3-tts-flash', voice: 'Cherry' }),
      voicesFetchable: true,
      models: Object.freeze(['qwen3-tts-flash', 'qwen-tts-turbo', 'cosyvoice-v1', 'cosyvoice-v3-flash', 'qwen3-tts-vc']),
      secretKey: 'ttsApiKey'
    },
    {
      id: 'edge-tts',
      label: 'Edge TTS（免 Key）',
      description: '微软 Edge 在线音色，无需 API Key；音色固定为微软预设',
      fields: Object.freeze({ baseUrl: 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1', model: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural' }),
      voicesFetchable: true,
      models: Object.freeze(['edge-tts']),
      secretKey: 'ttsApiKey'
    },
    {
      id: 'voicebox',
      label: 'Voicebox（本地）',
      description: 'Qwen3-TTS 声音克隆/生成；音色填 Voicebox Profile ID',
      fields: Object.freeze({ baseUrl: 'http://127.0.0.1:17493', model: 'qwen', voice: '' }),
      voicesFetchable: true,
      models: Object.freeze(['qwen']),
      secretKey: 'ttsApiKey'
    },
    {
      id: 'custom',
      label: '自定义',
      description: '手动填写服务地址、模型与音色',
      fields: Object.freeze({}),
      voicesFetchable: false,
      models: Object.freeze([]),
      secretKey: 'ttsApiKey'
    }
  ]),
  llm: Object.freeze([
    {
      id: 'deepseek',
      label: 'DeepSeek',
      description: 'deepseek-chat（OpenAI 兼容）',
      fields: Object.freeze({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }),
      modelsFetchable: true,
      secretKey: 'llmApiKey'
    },
    {
      id: 'aliyun-bailian',
      label: '阿里云百炼（OpenAI 兼容）',
      description: 'qwen3.7-flash（低延迟对话）',
      fields: Object.freeze({ baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-flash' }),
      modelsFetchable: true,
      secretKey: 'llmApiKey'
    },
    {
      id: 'voicebox',
      label: 'Voicebox（本地 LLM）',
      description: 'Qwen3 单轮生成（0.6B / 1.7B / 4B）',
      fields: Object.freeze({ baseUrl: 'http://127.0.0.1:17493', model: '0.6B' }),
      modelsFetchable: true,
      secretKey: 'llmApiKey'
    },
    {
      id: 'custom',
      label: '自定义（OpenAI 兼容）',
      description: '手动填写服务地址与模型',
      fields: Object.freeze({}),
      modelsFetchable: true,
      secretKey: 'llmApiKey'
    }
  ]),
  asr: Object.freeze([
    {
      id: 'aliyun-bailian',
      label: '阿里云百炼',
      description: 'paraformer-realtime-v2 实时识别（与 TTS 共用百炼 Key）',
      fields: Object.freeze({ baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/', model: 'paraformer-realtime-v2' }),
      models: Object.freeze(['paraformer-realtime-v2', 'paraformer-realtime-v1', 'paraformer-v2', 'sensevoice-v1']),
      secretKey: 'ttsApiKey'
    },
    {
      id: 'voicebox',
      label: 'Voicebox（本地转写）',
      description: '上传音频到 Voicebox /transcribe',
      fields: Object.freeze({ baseUrl: 'http://127.0.0.1:17493', model: '' }),
      models: Object.freeze(['whisper']),
      secretKey: 'asrApiKey'
    },
    {
      id: 'custom',
      label: '自定义',
      description: '手动填写 WebSocket 地址与模型',
      fields: Object.freeze({}),
      models: Object.freeze([]),
      secretKey: 'asrApiKey'
    }
  ])
})

export function presetsFor(service) {
  return PROVIDER_PRESETS[service] || []
}

export function findPreset(service, id) {
  return presetsFor(service).find((preset) => preset.id === id) || presetsFor(service).find((preset) => preset.id === 'custom') || null
}

/**
 * 把预设的字段合并进配置段落：切换预设时覆盖接口字段，custom 预设
 * 保留用户手动填写的内容（由调用方决定是否覆盖）。
 */
export function applyPresetFields(section = {}, preset) {
  if (!preset) return { ...section }
  const next = { ...section, preset: preset.id }
  for (const [key, value] of Object.entries(preset.fields || {})) next[key] = value
  return next
}
