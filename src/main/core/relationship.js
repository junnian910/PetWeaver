const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min))

export const RELATIONSHIP_STAGES = Object.freeze(['初见', '熟悉', '亲密', '家人'])
export const DAILY_CAP = 50
export const MOOD_DECAY_STEP_MS = 6 * 60 * 60 * 1000
export const MOOD_DECAY_AMOUNT = 10

// 不同互动来源带来的亲密度/情绪增益
export const INTERACTION_GAINS = Object.freeze({
  pet: { intimacy: 2, mood: 6 },
  click: { intimacy: 1, mood: 4 },
  drag: { intimacy: 1, mood: 2 },
  toss: { intimacy: 2, mood: 6 },
  danmaku: { intimacy: 1, mood: 3 },
  gift: { intimacy: 3, mood: 12 },
  superChat: { intimacy: 5, mood: 15 },
  guard: { intimacy: 8, mood: 18 },
  voice: { intimacy: 2, mood: 6 }
})

export function createRelationshipState() {
  return { intimacy: 0, dailyInteractions: 0, lastDate: '', stage: '初见', mood: 0, moodUpdatedAt: 0, diary: [] }
}

export const DIARY_CAP = 30

export function relationshipStage(intimacy) {
  if (intimacy >= 700) return '家人'
  if (intimacy >= 300) return '亲密'
  if (intimacy >= 100) return '熟悉'
  return '初见'
}

export function normalizeRelationship(saved) {
  const merged = { ...createRelationshipState(), ...(saved || {}) }
  merged.intimacy = clamp(merged.intimacy, 0, 100_000)
  merged.dailyInteractions = clamp(merged.dailyInteractions, 0, DAILY_CAP)
  merged.mood = clamp(merged.mood, 0, 100)
  merged.moodUpdatedAt = clamp(merged.moodUpdatedAt, 0, Number.MAX_SAFE_INTEGER)
  merged.stage = relationshipStage(merged.intimacy)
  merged.diary = (Array.isArray(merged.diary) ? merged.diary : [])
    .filter((entry) => entry && typeof entry.date === 'string' && Number.isFinite(Number(entry.interactions)))
    .slice(-DIARY_CAP)
    .map((entry) => ({ date: String(entry.date), interactions: clamp(entry.interactions, 0, DAILY_CAP), intimacyGain: clamp(entry.intimacyGain ?? 0, 0, DAILY_CAP) }))
  return merged
}

function dateKey(date) {
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
}

/**
 * 记录一次有效互动：跨日重置每日计数，每日计数/亲密度有上限防刷，
 * 短期情绪即时提升。返回新状态（不可变）。
 */
export function applyInteraction(state, kind, now = Date.now(), date = new Date(now)) {
  const next = normalizeRelationship(state)
  const key = dateKey(date)
  if (next.lastDate !== key) {
    // 跨日：把昨天写进成长日记，再开始新的一天。
    if (next.lastDate) {
      next.diary = [
        ...next.diary,
        { date: next.lastDate, interactions: next.dailyInteractions, intimacyGain: next.dailyInteractions }
      ].slice(-DIARY_CAP)
    }
    next.lastDate = key
    next.dailyInteractions = 0
  }
  const gain = INTERACTION_GAINS[kind] || { intimacy: 1, mood: 2 }
  const countable = Math.max(0, Math.min(gain.intimacy, DAILY_CAP - next.dailyInteractions))
  next.dailyInteractions += countable
  next.intimacy = clamp(next.intimacy + countable, 0, 100_000)
  next.stage = relationshipStage(next.intimacy)
  next.mood = clamp(next.mood + gain.mood, 0, 100)
  next.moodUpdatedAt = now
  return next
}

/**
 * 短期情绪随时间衰减：每 6 小时降 10 点，最低 0。
 */
export function applyMoodDecay(state, now = Date.now()) {
  const next = normalizeRelationship(state)
  const elapsed = now - next.moodUpdatedAt
  if (elapsed < MOOD_DECAY_STEP_MS) return next
  const steps = Math.floor(elapsed / MOOD_DECAY_STEP_MS)
  next.mood = Math.max(0, next.mood - steps * MOOD_DECAY_AMOUNT)
  next.moodUpdatedAt = now - (elapsed % MOOD_DECAY_STEP_MS)
  return next
}
