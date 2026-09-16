import { afterEach, describe, expect, it, vi } from 'vitest'
import { EDGE_TTS_VOICES, EdgeTTSProvider, defaultHeaders, ssmlMessage, speechConfigMessage } from '../src/main/providers/edge-tts.js'

afterEach(() => vi.unstubAllGlobals())

function createFakeSocket() {
  const listeners = new Map()
  return {
    sent: [],
    closed: false,
    on(event, handler) { listeners.set(event, handler) },
    emit(event, ...args) { listeners.get(event)?.(...args) },
    send(frame) { this.sent.push(frame) },
    close() { this.closed = true }
  }
}

describe('EdgeTTSProvider', () => {
  it('lists bundled Microsoft preset voices and edge-tts model', async () => {
    const provider = new EdgeTTSProvider({})
    expect(await provider.listModels()).toEqual(['edge-tts'])
    expect(await provider.listVoices()).toContain('zh-CN-XiaoxiaoNeural')
    expect(EDGE_TTS_VOICES.length).toBeGreaterThan(5)
  })

  it('builds valid websocket text frames without leaking XML characters', () => {
    expect(speechConfigMessage()).toContain('Path:speech.config')
    expect(speechConfigMessage()).toContain('audio-24khz-48kbitrate-mono-mp3')
    const ssml = ssmlMessage('你好 <3 & 再见', 'zh-CN-XiaoxiaoNeural', 1.5)
    expect(ssml).toContain('Path:ssml')
    expect(ssml).toContain('rate=\'50%\'')
    expect(ssml).toContain('你好 &lt;3 &amp; 再见')
  })

  it('collects binary audio frames and returns a data URL', async () => {
    const fakeSocket = createFakeSocket()
    const provider = new EdgeTTSProvider({ voice: 'zh-CN-XiaoxiaoNeural' }, { WebSocketImpl: function () { return fakeSocket } })
    const promise = provider.synthesize('测试')
    fakeSocket.emit('open')
    expect(fakeSocket.sent).toHaveLength(2)
    fakeSocket.emit('message', Buffer.from([1, 2, 3]), true)
    fakeSocket.emit('message', 'Path:turn.end\r\n', false)
    const result = await promise
    expect(result.type).toBe('data')
    expect(result.value).toBe('data:audio/mpeg;base64,' + Buffer.from([1, 2, 3]).toString('base64'))
    expect(fakeSocket.closed).toBe(true)
  })

  it('rejects when the websocket closes without audio', async () => {
    const fakeSocket = createFakeSocket()
    const provider = new EdgeTTSProvider({}, { WebSocketImpl: function () { return fakeSocket } })
    const promise = provider.synthesize('测试')
    fakeSocket.emit('open')
    fakeSocket.emit('close')
    await expect(promise).rejects.toThrow('未返回音频')
  })

  it('retries a transient ECONNRESET before returning audio', async () => {
    const first = createFakeSocket()
    const second = createFakeSocket()
    const sockets = [first, second]
    let calls = 0
    const provider = new EdgeTTSProvider({}, { WebSocketImpl: function () {
      const socket = sockets[calls++]
      queueMicrotask(() => {
        if (socket === first) socket.emit('error', Object.assign(new Error('socket reset'), { code: 'ECONNRESET' }))
        else {
          socket.emit('open')
          socket.emit('message', Buffer.from([4, 5, 6]), true)
          socket.emit('message', 'Path:turn.end\r\n', false)
        }
      })
      return socket
    } })

    await expect(provider.synthesize('重试测试')).resolves.toMatchObject({ type: 'data' })
    expect(calls).toBe(2)
  })

  it('uses the browser-like headers required by the read-aloud endpoint', () => {
    const headers = defaultHeaders()
    expect(headers.Origin).toContain('chrome-extension://')
    expect(headers['User-Agent']).toContain('Edg/')
  })

  it('supports a self-hosted Edge-TTS HTTP server via /v1/audio/speech', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/voices')) return { ok: true, json: async () => [{ shortName: 'zh-CN-YunxiNeural' }] }
      return { ok: true, arrayBuffer: async () => Buffer.from([9, 8, 7]) }
    }))
    const provider = new EdgeTTSProvider({ baseUrl: 'http://127.0.0.1:8000', voice: 'zh-CN-XiaoxiaoNeural' })
    expect(await provider.listVoices()).toContain('zh-CN-YunxiNeural')
    const result = await provider.synthesize('你好')
    expect(result.value).toBe('data:audio/mpeg;base64,' + Buffer.from([9, 8, 7]).toString('base64'))
    expect(String(fetch.mock.calls.at(-1)[0])).toContain('/v1/audio/speech')
  })
})
