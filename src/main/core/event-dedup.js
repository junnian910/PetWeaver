export function stableEventId(event) {
  if (!event) return ''
  if (event.type === 'danmaku') {
    return firstStableId(event.raw?.data?.msg_id, event.raw?.data?.data?.msg_id, event.raw?.msg_id) || fallbackEventId(event)
  }
  if (event.type === 'gift') {
    const rawData = event.raw?.data?.data || event.raw?.data || null
    if (rawData) {
      // Prefer a unique order id when the payload provides one.
      const unique = firstStableId(rawData.order_id)
      if (unique) return unique
      // Real combo sends repeat with the same user and gift type. Collapse
      // them per (user, gift) instead of per gift type, which previously let
      // every sender of the same gift share one dedup bucket.
      const uid = firstStableId(rawData.uid, event.user?.id)
      const giftKey = firstStableId(rawData.tid, rawData.giftId, rawData.giftName)
      if (uid || giftKey) return `gift:${uid || 'anon'}:${giftKey || 'unknown'}`
    }
    return fallbackEventId(event)
  }
  if (event.type === 'superChat') {
    return firstStableId(event.raw?.data?.data?.id, event.raw?.data?.id) || fallbackEventId(event)
  }
  if (event.type === 'guard') {
    return firstStableId(event.raw?.data?.data?.guard_id, event.raw?.data?.data?.order_id, event.raw?.data?.guard_id, event.raw?.data?.order_id) || fallbackEventId(event)
  }
  return ''
}

function firstStableId(...values) {
  const value = values.find((candidate) => candidate !== undefined && candidate !== null && String(candidate))
  return value === undefined ? '' : String(value)
}

function fallbackEventId(event) {
  const id = String(event.id || '')
  return isRandomUuid(id) ? '' : id
}

function isRandomUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export class EventDeduper {
  constructor({ windowMs = 60_000, now = () => Date.now() } = {}) {
    this.windowMs = windowMs
    this.now = now
    this.seen = new Map()
  }

  hasSeen(event) {
    const id = stableEventId(event)
    if (!id) return false
    const now = this.now()
    for (const [key, time] of this.seen) if (now - time > this.windowMs) this.seen.delete(key)
    const key = `${event.type || 'event'}:${id}`
    if (this.seen.has(key)) return true
    this.seen.set(key, now)
    return false
  }
}
