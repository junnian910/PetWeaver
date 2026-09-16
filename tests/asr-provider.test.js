import { describe, expect, it, vi } from 'vitest'
import { AliyunRealtimeAsrProvider, createAsrProvider, extractSentenceText, OfflineAsrProvider } from '../src/main/providers/asr.js'

describe('ASR providers', () => {
  it('offline provider reports an unavailable test result and refuses sessions', async () => {
    const offline = new OfflineAsrProvider()
    expect(await offline.test()).toEqual({ ok: false, message: '当前为离线模式，未启用语音识别' })
    expect(() => offline.createSession()).toThrow('语音识别未启用')
  })

  it('factory selects offline when disabled or missing key', () => {
    expect(createAsrProvider({ enabled: false }, 'key')).toBeInstanceOf(OfflineAsrProvider)
    expect(createAsrProvider({ enabled: true }, '')).toBeInstanceOf(OfflineAsrProvider)
    expect(createAsrProvider({ enabled: true }, 'key')).toBeInstanceOf(AliyunRealtimeAsrProvider)
  })

  it('extracts sentences from both known result payload shapes', () => {
    expect(extractSentenceText({ payload: { output: { sentence: { text: '  你好世界  ' } } } })).toBe('你好世界')
    expect(extractSentenceText({ payload: { result: ' 另一种形态 ' } })).toBe('另一种形态')
    expect(extractSentenceText({ payload: { output: { sentence: { text: '' } } } })).toBe('')
    expect(extractSentenceText('not-json-at-all')).toBe('')
  })

  it('connectivity probe resolves ok after the first server message', async () => {
    vi.useFakeTimers()
    const fakeSocket = createFakeSocket()
    const provider = new AliyunRealtimeAsrProvider({ baseUrl: 'wss://example.test/api-ws/v1/inference/', model: 'm' }, 'key', { WebSocketImpl: function () { return fakeSocket } })
    const result = provider.test()
    const flushed = expect(result).resolves.toMatchObject({ ok: true })
    fakeSocket.emit('open')
    fakeSocket.emit('message', '{"payload":{}}')
    await flushed
    expect(fakeSocket.sent.some((frame) => frame.includes('"run-task"'))).toBe(true)
    vi.useRealTimers()
  })

  it('connectivity probe reports failures instead of hanging', async () => {
    vi.useFakeTimers()
    const fakeSocket = createFakeSocket()
    const provider = new AliyunRealtimeAsrProvider({}, 'key', { WebSocketImpl: function () { return fakeSocket } })
    const result = provider.test()
    const flushed = expect(result).resolves.toMatchObject({ ok: false })
    fakeSocket.emit('error', new Error('boom'))
    await flushed
    vi.useRealTimers()
  })

  it('buffers pcm written before the socket opens and flushes it in order', () => {
    const fakeSocket = createFakeSocket()
    const provider = new AliyunRealtimeAsrProvider({ model: 'm' }, 'key', { WebSocketImpl: function () { return fakeSocket } })
    const session = provider.createSession({})
    const first = Buffer.from([1])
    const second = Buffer.from([2])
    session.write(first)
    session.write(second)
    expect(fakeSocket.sent).toHaveLength(0)
    fakeSocket.emit('open')
    const buffers = fakeSocket.sent.filter((frame) => frame instanceof Buffer)
    expect(buffers).toEqual([first, second])
    session.end()
  })

  it('streaming session writes pcm buffers and reports final sentences', async () => {
    const fakeSocket = createFakeSocket()
    const provider = new AliyunRealtimeAsrProvider({ model: 'm' }, 'key', { WebSocketImpl: function () { return fakeSocket } })
    const finals = []
    const session = provider.createSession({ onFinal: (text) => finals.push(text) })
    fakeSocket.emit('open')
    session.write(Buffer.from([1, 2, 3]))
    fakeSocket.emit('message', JSON.stringify({ payload: { output: { sentence: { text: '听到啦' } } } }))
    session.end()
    expect(fakeSocket.sent.some((frame) => frame instanceof Buffer)).toBe(true)
    expect(finals).toEqual(['听到啦'])
    expect(fakeSocket.sent.at(-1)).toContain('finish-task')
  })
})

function createFakeSocket() {
  const listeners = new Map()
  return {
    sent: [],
    closed: false,
    on(event, handler) { listeners.set(event, handler) },
    emit(event, payload) { listeners.get(event)?.(payload) },
    send(frame) { this.sent.push(frame) },
    close() { this.closed = true }
  }
}
