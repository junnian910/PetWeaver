import { describe, expect, it, vi } from 'vitest'
import { createLiveAdapter } from '../src/main/live/adapter-factory.js'
import { YouTubeAdapter, mapYouTubeMessage, parseYouTubeVideoId } from '../src/main/live/youtube-adapter.js'

function message(type, details = {}) {
  return {
    id: `${type}-1`,
    snippet: { type, ...details },
    authorDetails: { channelId: 'channel-1', displayName: 'Viewer', isChatSponsor: true }
  }
}

describe('YouTube live adapter', () => {
  it('maps public chat, paid messages, stickers and memberships to the shared event contract', () => {
    expect(mapYouTubeMessage(message('textMessageEvent', { textMessageDetails: { messageText: 'hello' } }))).toMatchObject({ type: 'danmaku', text: 'hello', user: { id: 'channel-1', name: 'Viewer' } })
    expect(mapYouTubeMessage(message('superChatEvent', { superChatDetails: { userComment: 'great', amountMicros: '2500000', currency: 'USD' } }))).toMatchObject({ type: 'superChat', text: 'great', price: 2.5, currency: 'USD' })
    expect(mapYouTubeMessage(message('superStickerEvent', { superStickerDetails: { superStickerMetadata: { altText: 'GG' }, amountMicros: '1000000' } }))).toMatchObject({ type: 'gift', giftName: 'GG', price: 1 })
    expect(mapYouTubeMessage(message('newSponsorEvent', { newSponsorDetails: { memberLevelName: 'Gold' } }))).toMatchObject({ type: 'guard', level: 1, membership: 'Gold' })
    expect(mapYouTubeMessage(message('giftEvent', { giftDetails: { giftName: 'Rose', comboCount: 3, jewelsAmount: 10 } }))).toMatchObject({ type: 'gift', giftName: 'Rose', count: 3, jewels: 10 })
    expect(mapYouTubeMessage(message('chatEndedEvent'))).toBeNull()
  })

  it('accepts normal, short and live YouTube URLs', () => {
    expect(parseYouTubeVideoId('abcdefghijk')).toBe('abcdefghijk')
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk')
    expect(parseYouTubeVideoId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk')
    expect(parseYouTubeVideoId('https://www.youtube.com/live/abcdefghijk?feature=share')).toBe('abcdefghijk')
    expect(parseYouTubeVideoId('invalid!')).toBe('')
  })

  it('resolves a live chat ID from the public video ID before polling', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [{ liveStreamingDetails: { activeLiveChatId: 'chat-auto' } }] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ nextPageToken: 'next', pollingIntervalMillis: 5000, items: [] }) })
    const adapter = new YouTubeAdapter({ videoId: 'https://youtu.be/abcdefghijk', apiKey: 'key', fetchImpl, setTimeoutFn: vi.fn(() => 1), clearTimeoutFn: vi.fn() })

    await adapter.connect()

    expect(fetchImpl.mock.calls[0][0].pathname).toBe('/youtube/v3/videos')
    expect(fetchImpl.mock.calls[1][0].searchParams.get('liveChatId')).toBe('chat-auto')
    adapter.disconnect()
  })

  it('skips old history, respects YouTube polling intervals and emits new messages', async () => {
    const replies = [
      { nextPageToken: 'next-1', pollingIntervalMillis: 2500, items: [message('textMessageEvent', { textMessageDetails: { messageText: 'old' } })] },
      { nextPageToken: 'next-2', pollingIntervalMillis: 3000, items: [message('textMessageEvent', { textMessageDetails: { messageText: 'new' } })] }
    ]
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => replies.shift() }))
    let scheduled
    const events = []
    const adapter = new YouTubeAdapter({
      liveChatId: 'chat-1',
      apiKey: 'key-1',
      fetchImpl,
      setTimeoutFn: (callback, delay) => { scheduled = { callback, delay }; return 1 },
      clearTimeoutFn: vi.fn()
    })
    adapter.on('event', (event) => events.push(event))

    await adapter.connect()
    expect(events).toEqual([expect.objectContaining({ type: 'status', status: 'connecting' }), expect.objectContaining({ type: 'status', status: 'connected' })])
    expect(scheduled.delay).toBe(2500)

    scheduled.callback()
    await vi.waitFor(() => expect(events.some((event) => event.type === 'danmaku' && event.text === 'new')).toBe(true))
    expect(fetchImpl.mock.calls[1][0].searchParams.get('pageToken')).toBe('next-1')
    expect(scheduled.delay).toBe(3000)
    adapter.disconnect()
  })

  it('creates the requested platform without changing the Bilibili default', () => {
    expect(createLiveAdapter({ platform: 'youtube', youtube: { liveChatId: 'x', apiKey: 'y' } })).toBeInstanceOf(YouTubeAdapter)
    expect(createLiveAdapter({ bilibili: { roomId: '1' } }).constructor.name).toBe('BilibiliAdapter')
    expect(() => createLiveAdapter({ platform: 'unknown' })).toThrow('不支持的直播平台')
  })
})
