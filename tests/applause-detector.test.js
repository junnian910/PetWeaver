import { describe, expect, it } from 'vitest'
import { applauseEventsFor, createApplauseState } from '../src/main/core/applause-detector.js'

describe('applause detector', () => {
  const config = { enabled: true, threshold: 60, spikesRequired: 4, windowMs: 3000, cooldownMs: 30000 }

  it('counts rising-edge spikes and fires after enough claps', () => {
    let state = createApplauseState()
    const events = []
    let now = 1000
    for (let clap = 0; clap < 5; clap += 1) {
      state = applauseEventsFor(0.2, config, state, (now += 300)).state
      const result = applauseEventsFor(0.8, config, state, (now += 50))
      state = result.state
      events.push(...result.events)
    }
    expect(events.filter((event) => event === 'applause')).toHaveLength(1)
  })

  it('drops spikes outside the window', () => {
    let state = createApplauseState()
    let now = 0
    state = applauseEventsFor(0.8, config, state, (now += 100)).state
    state = applauseEventsFor(0.2, config, state, (now += 100)).state
    state = applauseEventsFor(0.8, config, state, (now += 100)).state
    state = applauseEventsFor(0.2, config, state, (now += 100)).state
    // 超过窗口期的下一次拍手，之前的尖峰已过期
    const result = applauseEventsFor(0.8, config, state, (now += 4000))
    expect(result.events).toEqual([])
    expect(result.state.spikes).toHaveLength(1)
  })

  it('respects the cooldown between applause fires', () => {
    let state = createApplauseState()
    let now = 0
    let fires = 0
    for (let round = 0; round < 2; round += 1) {
      for (let clap = 0; clap < 4; clap += 1) {
        state = applauseEventsFor(0.2, config, state, (now += 200)).state
        const result = applauseEventsFor(0.8, config, state, (now += 50))
        state = result.state
        if (result.events.length) fires += 1
      }
      now += 200
    }
    expect(fires).toBe(1)
  })

  it('ignores levels when disabled', () => {
    const state = createApplauseState()
    const result = applauseEventsFor(0.9, { enabled: false, threshold: 60 }, state, 1000)
    expect(result.events).toEqual([])
  })
})
