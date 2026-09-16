import { describe, expect, it } from 'vitest'
import { EventDeduper, stableEventId } from '../src/main/core/event-dedup.js'
import { mapDanmaku, mapGift, mapGuard, mapSuperChat } from '../src/main/live/bilibili-adapter.js'

describe('event deduplication', () => {
  it('uses only real danmaku and guard identifiers', () => {
    expect(stableEventId({ type: 'danmaku', raw: { data: { msg_id: 'msg-1' } } })).toBe('msg-1')
    expect(stableEventId({ type: 'guard', raw: { data: { data: { guard_id: 'guard-1' } } } })).toBe('guard-1')
    expect(stableEventId({ type: 'guard', raw: { data: { data: { order_id: 'order-1' } } } })).toBe('order-1')
    expect(stableEventId({ type: 'danmaku', user: { id: 'u1' }, text: 'same' })).toBe('')
    expect(stableEventId({ type: 'guard', user: { id: 'u1' }, level: 3 })).toBe('')
  })

  it('does not manufacture IDs in Bilibili mappings', () => {
    const danmaku = mapDanmaku({ data: { info: [1, 'hello', ['uid-1', '观众']] } })
    const guard = mapGuard({ data: { data: { uid: 'uid-1', guard_level: 3, username: '观众' } } })
    expect(danmaku.id).toBe('')
    expect(guard.id).toBe('')
    expect(stableEventId(danmaku)).toBe('')
    expect(stableEventId(guard)).toBe('')

    expect(mapDanmaku({ data: { msg_id: 'msg-2', info: [1, 'hello', ['uid-1', '观众']] } }).id).toBe('msg-2')
    expect(mapGuard({ data: { data: { order_id: 'order-2', uid: 'uid-1', guard_level: 3 } } }).id).toBe('order-2')
  })

  it('ignores random transport IDs and uses real event IDs when available', () => {
    const randomId = '550e8400-e29b-41d4-a716-446655440000'
    const first = { type: 'danmaku', id: randomId, raw: { data: { msg_id: 'msg-3' } } }
    expect(stableEventId(first)).toBe('msg-3')
    expect(stableEventId({ type: 'danmaku', id: randomId, user: { id: 'u1' }, text: 'same' })).toBe('')
    expect(mapGift({ data: { uid: 'u1', uname: '观众', giftName: '小电视' } }).id).toBe('')
    expect(mapSuperChat({ data: { uid: 'u1', user_info: { uname: '观众' }, message: 'hello' } }).id).toBe('')
  })

  it('collapses real gift combos per user and gift without touching distinct senders or mock events', () => {
    let now = 0
    const deduper = new EventDeduper({ windowMs: 60_000, now: () => now })
    const comboA = { type: 'gift', user: { id: 'u1' }, raw: { data: { uid: 'u1', giftId: 6, giftName: '辣条' } } }
    const distinctSender = { type: 'gift', user: { id: 'u2' }, raw: { data: { uid: 'u2', giftId: 6, giftName: '辣条' } } }
    const distinctGift = { type: 'gift', user: { id: 'u1' }, raw: { data: { uid: 'u1', giftId: 39, giftName: '吃瓜' } } }
    const withOrderId = { type: 'gift', user: { id: 'u1' }, raw: { data: { order_id: 'order-1', uid: 'u1', giftId: 6 } } }
    const mock = { type: 'gift', id: '550e8400-e29b-41d4-a716-446655440000', user: { id: 'u1' }, giftName: '辣条' }

    expect(deduper.hasSeen(comboA)).toBe(false)
    expect(deduper.hasSeen(comboA)).toBe(true)
    expect(deduper.hasSeen(distinctSender)).toBe(false)
    expect(deduper.hasSeen(distinctGift)).toBe(false)
    expect(deduper.hasSeen(withOrderId)).toBe(false)
    expect(deduper.hasSeen(mock)).toBe(false)
    expect(deduper.hasSeen(mock)).toBe(false)
  })

  it('deduplicates repeated valid IDs without swallowing distinct or unidentifiable events', () => {
    let now = 0
    const deduper = new EventDeduper({ windowMs: 1_000, now: () => now })
    const first = { type: 'danmaku', raw: { data: { msg_id: 'm-1' } } }
    const second = { type: 'danmaku', raw: { data: { msg_id: 'm-2' } } }
    const unknown = { type: 'danmaku', user: { id: 'same' }, text: 'same' }

    expect(deduper.hasSeen(first)).toBe(false)
    expect(deduper.hasSeen(first)).toBe(true)
    expect(deduper.hasSeen(second)).toBe(false)
    expect(deduper.hasSeen(unknown)).toBe(false)
    expect(deduper.hasSeen(unknown)).toBe(false)
    now = 1_001
    expect(deduper.hasSeen(first)).toBe(false)
  })
})
