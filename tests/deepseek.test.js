import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeepSeekProvider } from '../src/main/providers/deepseek.js'

afterEach(() => vi.unstubAllGlobals())

describe('DeepSeekProvider', () => {
  it('lists models from the OpenAI-compatible endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => ({
      ok: true,
      json: async () => ({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }, { id: 'deepseek-chat' }] })
    })))
    const provider = new DeepSeekProvider({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }, 'key')
    expect(await provider.listModels()).toEqual(['deepseek-chat', 'deepseek-reasoner'])
    expect(String(fetch.mock.calls[0][0])).toBe('https://api.deepseek.com/models')
  })

  it('allows keyless local OpenAI-compatible servers and throws for empty model lists', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (String(options?.headers?.Authorization || '').length) throw new Error('should not require key for local server')
      return { ok: true, json: async () => ({ data: [] }) }
    }))
    const noKey = new DeepSeekProvider({ baseUrl: 'http://127.0.0.1:8000' }, '')
    await expect(noKey.listModels()).rejects.toThrow('模型列表为空')
    const withKey = new DeepSeekProvider({ baseUrl: 'https://api.deepseek.com' }, 'key')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })))
    await expect(withKey.listModels()).rejects.toThrow('模型列表为空')
  })

  it('sends reasoning_effort only when a reasoning level is configured', async () => {
    const bodies = []
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => { bodies.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ choices: [{ message: { content: '你好' } }] }) } }))
    const fast = new DeepSeekProvider({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', reasoning: 'none' }, 'key')
    await fast.reply([{ role: 'user', content: 'hi' }], {})
    const light = new DeepSeekProvider({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner', reasoning: 'light' }, 'key')
    await light.reply([{ role: 'user', content: 'hi' }], {})
    const deep = new DeepSeekProvider({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-reasoner', reasoning: 'deep' }, 'key')
    await deep.reply([{ role: 'user', content: 'hi' }], {})
    expect(bodies[0].reasoning_effort).toBeUndefined()
    expect(bodies[1].reasoning_effort).toBe('low')
    expect(bodies[2].reasoning_effort).toBe('high')
  })

  it('injects the persona and at most three local memories while limiting chat text', async () => {
    let body
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      body = JSON.parse(options.body)
      return { ok: true, json: async () => ({ choices: [{ message: { content: '👩‍💻'.repeat(50) } }] }) }
    }))
    const provider = new DeepSeekProvider({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen3.7-flash',
      personaPrompt: '保持俏皮',
      reasoning: 'none'
    }, 'key')
    const result = await provider.reply([{ role: 'user', content: '😀'.repeat(50) }], {
      personaPrompt: '自定义形象提示词',
      memories: Array.from({ length: 5 }, (_, index) => ({ prompt: '问题' + index, reply: '回答' + index }))
    })

    expect(body.model).toBe('qwen3.7-flash')
    expect(body.messages[0].content).toContain('自定义形象提示词')
    expect(body.messages[0].content).toContain('记忆3')
    expect(body.messages[0].content).not.toContain('记忆4')
    expect(body.messages[1].content).toBe('😀'.repeat(40))
    expect(result).toBe('👩‍💻'.repeat(40))
  })
})
