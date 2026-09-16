export class UserCooldown {
  constructor(cooldownMs = 30_000, maxEntries = 2_000) {
    this.cooldownMs = cooldownMs
    this.maxEntries = maxEntries
    this.seen = new Map()
  }

  allow(userId, now = Date.now()) {
    const key = String(userId || 'anonymous')
    const previous = this.seen.get(key) ?? 0
    if (now - previous < this.cooldownMs) return false
    this.seen.set(key, now)
    if (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value
      this.seen.delete(oldest)
    }
    return true
  }
}

export class SlidingWindowLimiter {
  constructor(max = 20, windowMs = 10_000) {
    this.max = max
    this.windowMs = windowMs
    this.events = []
  }

  allow(now = Date.now()) {
    this.events = this.events.filter((time) => now - time < this.windowMs)
    if (this.events.length >= this.max) return false
    this.events.push(now)
    return true
  }
}
