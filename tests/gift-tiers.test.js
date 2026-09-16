import { describe, expect, it } from 'vitest'
import { giftTierFor } from '../src/main/core/gift-tiers.js'

describe('gift tiers', () => {
  it('buckets gift prices into reaction tiers', () => {
    expect(giftTierFor(100)).toBe('normal')
    expect(giftTierFor(9_999)).toBe('normal')
    expect(giftTierFor(10_000)).toBe('medium')
    expect(giftTierFor(100_000)).toBe('big')
    expect(giftTierFor(1_000_000)).toBe('super')
  })

  it('treats missing and invalid prices as normal', () => {
    expect(giftTierFor(undefined)).toBe('normal')
    expect(giftTierFor(0)).toBe('normal')
    expect(giftTierFor(Number.NaN)).toBe('normal')
  })
})
