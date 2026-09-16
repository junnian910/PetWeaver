import { describe, expect, it } from 'vitest'
import { expressionMotionForAction, videoPathForAction, videoStateForAction } from '../src/renderer/action-visuals.js'

describe('action visuals', () => {
  it('keeps the semantic action ID as the visual state', () => {
    expect(videoStateForAction('act_greet')).toBe('act_greet')
    expect(videoStateForAction('act_sing')).toBe('act_sing')
    expect(videoStateForAction('act_sleep')).toBe('act_sleep')
    expect(videoStateForAction('act_wake')).toBe('act_wake')
    expect(videoStateForAction('gift_guard')).toBe('gift_guard')
    expect(videoStateForAction('missing-action')).toBeNull()
  })

  it('uses the registered independent video paths', () => {
    expect(videoPathForAction('idle_breath')).toBe('assets/videos/idle.webm')
    expect(videoPathForAction('act_greet')).toBe('assets/videos/waving-real.webm')
    expect(videoPathForAction('act_sing')).toBe('assets/videos/singing.webm')
    expect(videoPathForAction('act_sleep')).toBe('assets/videos/sleeping.webm')
    expect(videoPathForAction('act_wake')).toBe('assets/videos/waking.webm')
    expect(videoPathForAction('act_dance')).toBe('assets/videos/actions/act_dance.webm')
  })

  it('gives standalone expressions distinct motion profiles', () => {
    expect(expressionMotionForAction('emo_happy')).toBe('happy')
    expect(expressionMotionForAction('emo_angry')).toBe('angry')
    expect(expressionMotionForAction('emo_sad')).toBe('sad')
    expect(expressionMotionForAction('act_sleep')).toBe('sleep')
  })
})
