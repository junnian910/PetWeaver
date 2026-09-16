import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { GlobalKeyboardListener } = require('node-global-key-listener')
const VALID_KEYS = /^(F(?:[1-9]|1[0-2])|[A-Z]|[0-9]|SPACE)$/

export function normalizePushToTalkKey(value) {
  const key = String(value || '').trim().toUpperCase()
  return VALID_KEYS.test(key) ? key : 'F8'
}

export function createPushToTalk({ onStateChange = () => {}, Listener = GlobalKeyboardListener } = {}) {
  let listener = null
  let config = null
  let active = false

  const sendState = (next) => {
    if (active === next) return
    active = next
    onStateChange({ active, key: normalizePushToTalkKey(config?.voice?.pushToTalkKey) })
  }
  const stop = () => {
    sendState(false)
    listener?.kill?.()
    listener = null
  }
  const shouldListen = () => Boolean(config?.voice?.enabled && config?.asr?.enabled)
  const start = () => {
    if (listener || !shouldListen()) return
    const next = new Listener({ windows: { onError: () => {} } })
    listener = next
    Promise.resolve(next.addListener((event) => {
      if (normalizePushToTalkKey(event?.name) !== normalizePushToTalkKey(config?.voice?.pushToTalkKey)) return false
      if (event?.state === 'DOWN') sendState(true)
      if (event?.state === 'UP') sendState(false)
      return false
    })).catch(() => {
      if (listener === next) stop()
    })
  }

  return {
    sync(nextConfig) {
      config = nextConfig || null
      if (shouldListen()) start()
      else stop()
    },
    dispose: stop,
    get active() { return active }
  }
}
