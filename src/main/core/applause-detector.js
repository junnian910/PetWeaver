const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min))
const clamp01 = (value) => clamp(value, 0, 1)

/**
 * 掌声彩蛋（音量包络启发式，后续可替换为 ML 模型——接口保持稳定）：
 * 上升沿穿过阈值记为一次拍手，窗口期内拍手次数达标即触发 applause。
 */
export function createApplauseState() {
  return { spikes: [], lastAbove: false, lastFireAt: Number.NEGATIVE_INFINITY }
}

export function applauseEventsFor(level01, config = {}, state = createApplauseState(), now = Date.now()) {
  if (config?.enabled !== true) return { events: [], state }
  const threshold = clamp(config.threshold ?? 60, 10, 95) / 100
  const required = clamp(config.spikesRequired ?? 6, 3, 30)
  const windowMs = clamp(config.windowMs ?? 3_000, 1_000, 10_000)
  const cooldownMs = clamp(config.cooldownMs ?? 30_000, 5_000, 300_000)
  const level = clamp01(level01)
  const above = level >= threshold
  const next = { ...state }
  if (above && !state.lastAbove) {
    next.spikes = [...state.spikes.filter((time) => now - time <= windowMs), now]
  }
  next.lastAbove = above
  const events = []
  if (next.spikes.length >= required && now - next.lastFireAt >= cooldownMs) {
    next.lastFireAt = now
    next.spikes = []
    events.push('applause')
  }
  return { events, state: next }
}
