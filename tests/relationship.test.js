import { describe, expect, it } from 'vitest'
import {
  applyInteraction, applyMoodDecay, createRelationshipState, DAILY_CAP,
  normalizeRelationship, relationshipStage
} from '../src/main/core/relationship.js'

describe('relationship system', () => {
  it('maps intimacy to stages', () => {
    expect(relationshipStage(0)).toBe('初见')
    expect(relationshipStage(100)).toBe('熟悉')
    expect(relationshipStage(300)).toBe('亲密')
    expect(relationshipStage(700)).toBe('家人')
  })

  it('accumulates intimacy and mood per interaction kind', () => {
    let state = createRelationshipState()
    state = applyInteraction(state, 'pet', 1000)
    expect(state.intimacy).toBe(2)
    expect(state.mood).toBe(6)
    state = applyInteraction(state, 'gift', 2000)
    expect(state.intimacy).toBe(5)
    expect(state.mood).toBe(18)
    expect(state.dailyInteractions).toBe(5)
  })

  it('caps daily interactions and resets on a new date', () => {
    let state = createRelationshipState()
    for (let index = 0; index < 100; index += 1) state = applyInteraction(state, 'click', 1000 + index)
    expect(state.dailyInteractions).toBe(DAILY_CAP)
    expect(state.intimacy).toBe(DAILY_CAP)
    const nextDay = applyInteraction(state, 'click', 2000, new Date(2026, 7, 15))
    expect(nextDay.dailyInteractions).toBe(1)
    expect(nextDay.intimacy).toBe(DAILY_CAP + 1)
  })

  it('decays mood every 6 hours without going negative', () => {
    const state = { ...createRelationshipState(), mood: 25, moodUpdatedAt: 1_000 }
    const decayed = applyMoodDecay(state, 1_000 + 6 * 60 * 60 * 1000)
    expect(decayed.mood).toBe(15)
    expect(decayed.moodUpdatedAt).toBe(1_000 + 6 * 60 * 60 * 1000)
    const bottom = applyMoodDecay({ ...state, mood: 5 }, 1_000 + 3 * 6 * 60 * 60 * 1000)
    expect(bottom.mood).toBe(0)
  })

  it('writes the previous day into the growth diary on rollover', () => {
    let state = createRelationshipState()
    state = applyInteraction(state, 'gift', 1000, new Date(2026, 7, 14))
    state = applyInteraction(state, 'gift', 1100, new Date(2026, 7, 14))
    state = applyInteraction(state, 'pet', 2000, new Date(2026, 7, 15))
    expect(state.dailyInteractions).toBe(2)
    expect(state.diary).toHaveLength(1)
    expect(state.diary[0]).toEqual({ date: '2026-8-14', interactions: 6, intimacyGain: 6 })
  })

  it('caps the diary at the latest 30 entries', () => {
    let state = createRelationshipState()
    for (let day = 1; day <= 35; day += 1) {
      state = applyInteraction(state, 'click', day, new Date(2026, 7, day))
    }
    expect(state.diary).toHaveLength(30)
    expect(state.diary.at(-1).date).toBe('2026-9-3')
  })

  it('normalizes malformed persisted states', () => {
    const normalized = normalizeRelationship({ intimacy: -50, mood: 999, dailyInteractions: 'bad' })
    expect(normalized.intimacy).toBe(0)
    expect(normalized.mood).toBe(100)
    expect(normalized.dailyInteractions).toBe(0)
    expect(normalized.stage).toBe('初见')
  })
})
