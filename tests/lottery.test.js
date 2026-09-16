import { describe, expect, it } from 'vitest'
import { Lottery } from '../src/main/core/lottery.js'

describe('Lottery', () => {
  it('deduplicates users and clears after draw', () => { const lottery=new Lottery(()=>.99); expect(lottery.join({id:'1',name:'A'})).toBe(true); expect(lottery.join({id:'1',name:'A'})).toBe(false); lottery.join({id:'2',name:'B'}); expect(lottery.draw()).toEqual({id:'2',name:'B'}); expect(lottery.size).toBe(0) })
  it('returns null without participants', () => expect(new Lottery().draw()).toBeNull())
  it('clamps out-of-range and non-finite randomness instead of picking undefined', () => {
    const one = new Lottery(() => 1)
    one.join({ id: '1', name: 'A' })
    one.join({ id: '2', name: 'B' })
    expect(one.draw()).toEqual({ id: '2', name: 'B' })
    const negative = new Lottery(() => -3)
    negative.join({ id: '1', name: 'A' })
    expect(negative.draw()).toEqual({ id: '1', name: 'A' })
    const nan = new Lottery(() => NaN)
    nan.join({ id: '1', name: 'A' })
    nan.join({ id: '2', name: 'B' })
    expect(nan.draw()).toEqual({ id: '1', name: 'A' })
  })
})
