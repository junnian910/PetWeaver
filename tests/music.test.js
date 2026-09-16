import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const wsState = vi.hoisted(() => ({ instances: [] }))

vi.mock('ws', () => ({ default: class MockWebSocket extends EventEmitter {
  constructor(url) {
    super()
    this.url = url
    this.closeCalls = 0
    wsState.instances.push(this)
  }
  close() { this.closeCalls += 1 }
} }))

import { MusicProvider } from '../src/main/providers/music.js'

afterEach(() => {
  vi.useRealTimers()
  wsState.instances.length = 0
  vi.restoreAllMocks()
})

describe('MusicProvider', () => {
  it('disconnects an old connection before a new apply/connect', async () => {
    const provider = new MusicProvider({ wsUrl: 'ws://old' })
    const first = provider.connect()
    const oldSocket = wsState.instances[0]
    oldSocket.emit('open')
    await first

    const second = provider.connect()
    expect(oldSocket.closeCalls).toBe(1)
    const newSocket = wsState.instances[1]
    newSocket.emit('open')
    await expect(second).resolves.toEqual({ ok: true, mode: 'websocket' })
  })

  it('sets volume in mock mode without touching the network', async () => {
    const provider = new MusicProvider({ mock: true })
    await expect(provider.setVolume(65)).resolves.toMatchObject({ ok: true, volume: 65, mock: true })
    await expect(provider.setVolume(200)).resolves.toMatchObject({ ok: true, volume: 100 })
  })

  it('maps an AListen request to POST /music/pick', async () => {
    let request
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      request = { url: String(url), options }
      return { ok: true, json: async () => ({ name: '夜に駆ける' }) }
    }))
    const provider = new MusicProvider({
      provider: 'alisten',
      baseUrl: 'http://127.0.0.1:8080',
      requestPath: '/music/pick',
      houseId: '房间-1',
      source: 'wy',
      password: 'secret'
    })

    await expect(provider.request('夜に駆ける', { id: 'u1', name: '观众' })).resolves.toMatchObject({ title: '夜に駆ける' })
    expect(request.url).toBe('http://127.0.0.1:8080/music/pick')
    expect(JSON.parse(request.options.body)).toEqual({ houseId: '房间-1', password: 'secret', name: '夜に駆ける', source: 'wy' })
    vi.unstubAllGlobals()
  })

  it('surfaces an AListen JSON error even when the HTTP status is 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ error: '房间密码错误' }) })))
    const provider = new MusicProvider({ provider: 'alisten', baseUrl: 'http://127.0.0.1:8080', houseId: 'room' })
    await expect(provider.request('歌曲', { name: '观众' })).rejects.toThrow('房间密码错误')
    vi.unstubAllGlobals()
  })

  it('reports gracefully when the bot has no volume endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    const provider = new MusicProvider({ mock: false, baseUrl: 'http://127.0.0.1:5555' })
    const result = await provider.setVolume(50)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('不支持音量接口')
    vi.unstubAllGlobals()
  })

  it('closes and clears the socket and timer on WebSocket timeout', async () => {
    vi.useFakeTimers()
    const provider = new MusicProvider({ wsUrl: 'ws://timeout' })
    const pending = provider.connect()
    const socket = wsState.instances[0]
    const rejection = expect(pending).rejects.toThrow('点歌连接超时')

    await vi.advanceTimersByTimeAsync(5_000)
    await rejection
    expect(socket.closeCalls).toBe(1)
    expect(provider.socket).toBeNull()
    expect(provider.connectTimer).toBeNull()
  })

  it('clears socket and timer on WebSocket error', async () => {
    const provider = new MusicProvider({ wsUrl: 'ws://error' })
    const pending = provider.connect()
    const socket = wsState.instances[0]
    const error = new Error('connection failed')
    socket.emit('error', error)

    await expect(pending).rejects.toBe(error)
    expect(socket.closeCalls).toBe(1)
    expect(provider.socket).toBeNull()
    expect(provider.connectTimer).toBeNull()
  })

  it('aborts HTTP requests after five seconds', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const provider = new MusicProvider({ baseUrl: 'http://127.0.0.1:5555', requestPath: '/api/request' })
    const pending = provider.request('夜に駆ける', { id: '1', name: '观众' })
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    await vi.advanceTimersByTimeAsync(5_000)
    await rejection
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('makes disconnect idempotent', async () => {
    const provider = new MusicProvider({ wsUrl: 'ws://close' })
    const pending = provider.connect()
    const socket = wsState.instances[0]
    const rejection = expect(pending).rejects.toThrow('点歌连接已断开')
    provider.disconnect()
    provider.disconnect()

    expect(socket.closeCalls).toBe(1)
    expect(provider.socket).toBeNull()
    await rejection
  })
})
