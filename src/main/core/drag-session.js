export function createCursorDragLoop({ readCursor, onCursor, onFailure = null, intervalMs = 16, setIntervalFn = setInterval, clearIntervalFn = clearInterval } = {}) {
  let timer = null
  const stop = () => {
    if (timer === null) return
    clearIntervalFn(timer)
    timer = null
  }
  const tick = () => {
    if (timer === null) return
    try {
      const cursor = readCursor()
      if (!Number.isFinite(cursor?.x) || !Number.isFinite(cursor?.y)) throw new Error('cursor unavailable')
      onCursor(cursor)
    } catch {
      stop()
      onFailure?.()
    }
  }
  return {
    start() {
      stop()
      timer = setIntervalFn(tick, intervalMs)
      tick()
    },
    stop,
    isRunning: () => timer !== null
  }
}
