import { describe, expect, it } from 'vitest'
import { createVoiceReactionState, voiceEventsFor } from '../src/main/core/voice-reactions.js'

describe('voice reactions', () => {
  it('fires shout once above threshold then respects the cooldown', () => {
    const state = createVoiceReactionState(6000)
    let now = 1000
    const first = voiceEventsFor(0.6, { threshold: 35, sensitivity: 1 }, state, now)
    expect(first.events).toEqual(['shout'])
    expect(first.state).toBeDefined()
    now += 1000
    const second = voiceEventsFor(0.6, { threshold: 35, sensitivity: 1 }, first.state, now)
    expect(second.events).toEqual([])
    now += 6000
    const third = voiceEventsFor(0.6, { threshold: 35, sensitivity: 1 }, second.state, now)
    expect(third.events).toEqual(['shout'])
  })

  it('fires cover-ears after a sustained noisy streak and resets it', () => {
    const state = createVoiceReactionState(6000)
    const config = { threshold: 35, sensitivity: 1, coverAfterSeconds: 1.5 }
    let current = state
    let events = []
    let now = 0
    for (let tick = 0; tick < 40; tick += 1) {
      const result = voiceEventsFor(0.8, config, current, (now += 50))
      events.push(...result.events)
      current = result.state
    }
    expect(events).toContain('shout')
    expect(events).toContain('cover')
  })

  it('sensitivity scales loudness and silence decays the streak', () => {
    const state = createVoiceReactionState(6000)
    const loud = voiceEventsFor(0.2, { threshold: 35, sensitivity: 2 }, state, 1000)
    expect(loud.events).toEqual(['shout'])
    const quiet = voiceEventsFor(0, { threshold: 35 }, loud.state, 1000)
    expect(quiet.state.noisyStreak).toBe(0)
  })

  it('clamps invalid thresholds and reports normalized level', () => {
    const result = voiceEventsFor(0.5, { threshold: 999, sensitivity: 0 }, createVoiceReactionState(), 0)
    expect(result.events).toEqual([])
    expect(result.level).toBe(25)
    expect(result.thresholdPct).toBe(95)
  })
})
