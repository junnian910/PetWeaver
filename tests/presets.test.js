import { describe, expect, it } from 'vitest'
import { applyPresetFields, findPreset, presetsFor, PROVIDER_PRESETS } from '../src/main/providers/presets.js'

describe('provider presets', () => {
  it('provides presets for tts, llm and asr with required fields', () => {
    for (const service of ['tts', 'llm', 'asr']) {
      const presets = presetsFor(service)
      expect(presets.length).toBeGreaterThanOrEqual(2)
      for (const preset of presets) {
        expect(preset.id).toBeTruthy()
        expect(preset.label).toBeTruthy()
        expect(preset.secretKey).toMatch(/ApiKey$/)
      }
      expect(presets.some((preset) => preset.id === 'custom')).toBe(true)
    }
  })

  it('ships the bailian endpoints and models the user only needs a key for', () => {
    const tts = findPreset('tts', 'aliyun-bailian')
    expect(tts.fields).toMatchObject({ baseUrl: 'https://dashscope.aliyuncs.com/api/v1', model: 'qwen3-tts-flash', voice: 'Cherry' })
    expect(tts.voicesFetchable).toBe(true)
    const llm = findPreset('llm', 'aliyun-bailian')
    expect(llm.fields).toMatchObject({ baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-flash' })
    const asr = findPreset('asr', 'aliyun-bailian')
    expect(asr.fields.model).toBe('paraformer-realtime-v2')
    expect(asr.secretKey).toBe('ttsApiKey')
  })

  it('falls back to the custom preset for unknown ids', () => {
    expect(findPreset('tts', 'not-real')?.id).toBe('custom')
    expect(findPreset('llm', '')?.id).toBe('custom')
  })

  it('applies preset fields over a section and keeps the preset id', () => {
    const section = { enabled: true, baseUrl: 'http://old', model: 'old-model', voice: 'old-voice' }
    const next = applyPresetFields(section, findPreset('tts', 'aliyun-bailian'))
    expect(next).toEqual({ enabled: true, preset: 'aliyun-bailian', baseUrl: 'https://dashscope.aliyuncs.com/api/v1', model: 'qwen3-tts-flash', voice: 'Cherry' })
    const custom = applyPresetFields(section, findPreset('tts', 'custom'))
    expect(custom).toEqual({ ...section, preset: 'custom' })
  })

  it('exposes the full catalog without mutation', () => {
    expect(PROVIDER_PRESETS.tts[0].fields.baseUrl).toBeTruthy()
    expect(() => { PROVIDER_PRESETS.tts = [] }).toThrow()
    expect(() => { PROVIDER_PRESETS.llm[0].fields.baseUrl = 'hacked' }).toThrow()
  })
})
