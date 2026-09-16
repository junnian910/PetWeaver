import { afterEach, describe, expect, it, vi } from 'vitest'
import { BilibiliAdapter } from '../src/main/live/bilibili-adapter.js'

function createFakeClient() {
  const listeners = new Map()
  return {
    listeners,
    closes: 0,
    on(event, handler) { listeners.set(event, handler) },
    emit(event, payload) { listeners.get(event)?.(payload) },
    removeAllListeners() { listeners.clear() },
    close() { this.closes += 1 }
  }
}

afterEach(() => vi.useRealTimers())

describe('BilibiliAdapter', () => {
  it('emits a mock connected status without creating a client', async () => {
    const adapter = new BilibiliAdapter({ roomId: '', mock: true })
    const events = []
    adapter.on('event', (event) => events.push(event))
    await adapter.connect()
    expect(events).toEqual([{ type: 'status', status: 'connected', mode: 'mock' }])
  })

  it('creates exactly one client per connect and disposes the previous one', async () => {
    const clients = []
    const adapter = new BilibiliAdapter({ roomId: '123', getConfImpl: async () => ({}), clientFactory: (roomId) => { const client = createFakeClient(); client.roomId = roomId; clients.push(client); return client } })
    await adapter.connect()
    await adapter.connect()
    expect(clients).toHaveLength(2)
    expect(clients[0].listeners.size).toBe(0)
    expect(clients[1].roomId).toBe(123)
    adapter.disconnect()
  })

  it('surfaces connection errors as status events', async () => {
    const adapter = new BilibiliAdapter({ roomId: '123', getConfImpl: async () => ({}), clientFactory: () => createFakeClient() })
    const events = []
    adapter.on('event', (event) => events.push(event))
    await adapter.connect()
    adapter.client.emit('error', new Error('boom'))
    expect(events).toEqual([{ type: 'status', status: 'error', message: 'boom' }])
    adapter.disconnect()
  })

  it('reconnects with backoff, resets retries on open, and creates a single replacement', async () => {
    vi.useFakeTimers()
    const clients = []
    const adapter = new BilibiliAdapter({ roomId: '123', getConfImpl: async () => ({}), clientFactory: () => { const client = createFakeClient(); clients.push(client); return client } })
    const events = []
    adapter.on('event', (event) => events.push(event))
    await adapter.connect()
    expect(clients).toHaveLength(1)

    adapter.client.emit('close')
    expect(events.at(-1)).toEqual({ type: 'status', status: 'reconnecting', delay: 1_000 })
    vi.advanceTimersByTime(1_000)
    await Promise.resolve()
    await Promise.resolve()
    expect(clients).toHaveLength(2)

    clients[1].emit('open')
    expect(events.at(-1)).toEqual({ type: 'status', status: 'connected' })
    clients[1].emit('close')
    expect(events.at(-1)).toEqual({ type: 'status', status: 'reconnecting', delay: 1_000 })

    // A second close of the same client must not schedule a second timer.
    const before = events.length
    clients[1].emit('close')
    expect(events.length).toBe(before)
    adapter.disconnect()
    vi.advanceTimersByTime(60_000)
    expect(clients).toHaveLength(2)
  })

  it('stops reconnecting after disconnect', async () => {
    vi.useFakeTimers()
    const clients = []
    const adapter = new BilibiliAdapter({ roomId: '123', getConfImpl: async () => ({}), clientFactory: () => { const client = createFakeClient(); clients.push(client); return client } })
    await adapter.connect()
    adapter.client.emit('close')
    adapter.disconnect()
    vi.advanceTimersByTime(60_000)
    expect(clients).toHaveLength(1)
  })

  it('forwards danmaku, gift, super chat and guard payloads as unified events', async () => {
    const adapter = new BilibiliAdapter({ roomId: '123', getConfImpl: async () => ({}), clientFactory: () => createFakeClient() })
    const events = []
    adapter.on('event', (event) => events.push(event))
    await adapter.connect()
    adapter.client.emit('DANMU_MSG', { data: { msg_id: 'm-1', info: [1, '你好', ['u1', '观众']] } })
    adapter.client.emit('SEND_GIFT', { data: { uid: 'u2', uname: '老板', giftName: '辣条', num: 3 } })
    adapter.client.emit('SUPER_CHAT_MESSAGE', { data: { id: 'sc-1', uid: 'u3', user_info: { uname: 'SC' }, message: 'hi', price: 30 } })
    adapter.client.emit('GUARD_BUY', { data: { guard_id: 'g-1', uid: 'u4', username: '舰长', guard_level: 3 } })
    expect(events.map((event) => event.type)).toEqual(['danmaku', 'gift', 'superChat', 'guard'])
    expect(events[0].user).toEqual({ id: 'u1', name: '观众' })
    expect(events[1]).toMatchObject({ user: { id: 'u2', name: '老板' }, giftName: '辣条', count: 3 })
    adapter.disconnect()
  })
})
