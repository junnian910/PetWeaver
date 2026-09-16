import { describe, expect, it } from 'vitest'
import { createPushToTalk, normalizePushToTalkKey } from '../src/main/push-to-talk.js'

class FakeKeyboardListener {
  static instances = []

  constructor() {
    this.listener = null
    this.killed = false
    FakeKeyboardListener.instances.push(this)
  }

  addListener(listener) {
    this.listener = listener
    return Promise.resolve()
  }

  kill() { this.killed = true }
  emit(name, state) { return this.listener?.({ name, state }) }
}

describe('push to talk', () => {
  it('normalizes only safe single-key bindings', () => {
    expect(normalizePushToTalkKey('f8')).toBe('F8')
    expect(normalizePushToTalkKey('space')).toBe('SPACE')
    expect(normalizePushToTalkKey('ctrl+f8')).toBe('F8')
  })

  it('streams only while the configured key is held and stops when disabled', async () => {
    FakeKeyboardListener.instances = []
    const states = []
    const pushToTalk = createPushToTalk({ onStateChange: (state) => states.push(state), Listener: FakeKeyboardListener })

    pushToTalk.sync({ voice: { enabled: false, pushToTalkKey: 'F8' }, asr: { enabled: true } })
    expect(FakeKeyboardListener.instances).toHaveLength(0)
    pushToTalk.sync({ voice: { enabled: true, pushToTalkKey: 'F8' }, asr: { enabled: true } })
    await Promise.resolve()
    const listener = FakeKeyboardListener.instances[0]
    listener.emit('F7', 'DOWN')
    listener.emit('F8', 'DOWN')
    listener.emit('F8', 'UP')
    expect(states).toEqual([{ active: true, key: 'F8' }, { active: false, key: 'F8' }])

    pushToTalk.sync({ voice: { enabled: false, pushToTalkKey: 'F8' }, asr: { enabled: true } })
    expect(listener.killed).toBe(true)
  })
})
