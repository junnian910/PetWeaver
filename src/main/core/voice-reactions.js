const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const clamp01 = (value) => clamp(Number(value) || 0, 0, 1)

/**
 * 麦克风音量 → 桌宠反应的纯逻辑。level01 为 0..1 归一化响度。
 * - 超过大叫阈值 → 'shout'（每次触发后进入冷却）
 * - 持续超过大叫阈值一段时间 → 'cover'（捂耳朵，进入冷却）
 * 状态对象由调用方持有，便于跨调用累计。
 */
export function createVoiceReactionState(cooldownMs = 6000) {
  return { noisyStreak: 0, lastShoutAt: Number.NEGATIVE_INFINITY, lastCoverAt: Number.NEGATIVE_INFINITY, cooldownMs: clamp(cooldownMs, 500, 120_000) }
}

export function voiceEventsFor(level01, config = {}, state = createVoiceReactionState(), now = Date.now()) {
  const threshold = clamp(Number(config.threshold ?? 35), 1, 95) / 100
  const sensitivity = clamp(Number(config.sensitivity ?? 1), 0.5, 2)
  const scaled = clamp01(level01 * sensitivity)
  const cooldownMs = clamp(Number(state.cooldownMs ?? 6000), 500, 120_000)
  const coverAfterTicks = Math.round(clamp(Number(config.coverAfterSeconds ?? 1.5), 0.5, 10) * 20) // ~50ms/tick

  const events = []
  let { noisyStreak, lastShoutAt, lastCoverAt } = state
  if (scaled >= threshold) {
    noisyStreak += 1
    if (now - lastShoutAt >= cooldownMs) {
      events.push('shout')
      lastShoutAt = now
    }
    if (noisyStreak >= coverAfterTicks && now - lastCoverAt >= cooldownMs) {
      events.push('cover')
      lastCoverAt = now
      noisyStreak = 0
    }
  } else {
    noisyStreak = Math.max(0, noisyStreak - 1)
  }
  return {
    events,
    state: { noisyStreak, lastShoutAt, lastCoverAt, cooldownMs },
    level: Math.round(scaled * 100),
    thresholdPct: Math.round(threshold * 100)
  }
}
