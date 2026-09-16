import { describe, expect, it } from 'vitest'
import { SlidingWindowLimiter, UserCooldown } from '../src/main/core/rate-limiter.js'

describe('rate limits', () => {
  it('applies per-user cooldown', () => { const limiter=new UserCooldown(1000); expect(limiter.allow('1',1000)).toBe(true); expect(limiter.allow('1',1500)).toBe(false); expect(limiter.allow('1',2000)).toBe(true) })
  it('applies a global sliding window', () => { const limiter=new SlidingWindowLimiter(2,1000); expect(limiter.allow(0)).toBe(true); expect(limiter.allow(1)).toBe(true); expect(limiter.allow(2)).toBe(false); expect(limiter.allow(1001)).toBe(true) })
})
