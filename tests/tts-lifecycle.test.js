import { describe, expect, it, vi } from 'vitest'
import { createTtsLifecycle } from '../src/renderer/tts-lifecycle.js'

const action = (instanceId, overrides = {}) => ({
  instanceId,
  actionId: 'act_work',
  hasDedicatedVideo: false,
  loop: false,
  ...overrides
})

describe('TTS lifecycle', () => {
  it('does not enter talking until Audio playback actually starts', () => {
    const lifecycle = createTtsLifecycle()
    const player = { pause: vi.fn() }

    lifecycle.beginAction(action('one'))
    expect(lifecycle.hasActiveAudio()).toBe(false)
    lifecycle.acceptAudio('one', player)
    expect(lifecycle.hasActiveAudio()).toBe(true)
    expect(lifecycle.markAudioPlaying('one', player)).toMatchObject({ enterTalking: true })

    expect(lifecycle.finishAudio('one', player, { schedulerBusy: true })).toMatchObject({
      exitTalking: true,
      resumeActionId: 'act_work',
      resumeLoop: false
    })
    expect(player.pause).toHaveBeenCalledTimes(1)
    expect(lifecycle.hasActiveAudio()).toBe(false)
  })

  it('keeps a dedicated action visual and restores idle after audio ends', () => {
    const lifecycle = createTtsLifecycle()
    const player = { pause: vi.fn() }

    lifecycle.beginAction(action('one', { actionId: 'act_greet', hasDedicatedVideo: true, loop: true }))
    lifecycle.acceptAudio('one', player)
    expect(lifecycle.markAudioPlaying('one', player)).toMatchObject({ enterTalking: false })
    expect(lifecycle.finishAudio('one', player, { schedulerBusy: false })).toMatchObject({
      exitTalking: false,
      resumeActionId: 'idle_breath',
      resumeLoop: true
    })
  })

  it('stops the old player and ignores stale callbacks after an interruption', () => {
    const lifecycle = createTtsLifecycle()
    const oldPlayer = { pause: vi.fn() }
    const newPlayer = { pause: vi.fn() }

    lifecycle.beginAction(action('old'))
    lifecycle.acceptAudio('old', oldPlayer)
    lifecycle.markAudioPlaying('old', oldPlayer)
    lifecycle.beginAction(action('new', { actionId: 'act_greet', hasDedicatedVideo: true }))

    expect(oldPlayer.pause).toHaveBeenCalledTimes(1)
    expect(lifecycle.finishAudio('old', oldPlayer, { schedulerBusy: false })).toBeNull()
    expect(lifecycle.canStartAudio('old')).toBe(false)
    expect(lifecycle.acceptAudio('new', newPlayer)).toBeTruthy()
  })
})
