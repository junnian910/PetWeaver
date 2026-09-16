const TIME = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/

export function parseHhmm(value) {
  const match = TIME.exec(String(value || '').trim())
  if (!match) return null
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

function minutesOfDay(hhmm) {
  return hhmm.hour * 60 + hhmm.minute
}

/**
 * 勿扰时段判断：支持跨午夜区间（如 23:00 → 07:00）。
 */
export function isQuietNow(config, date = new Date()) {
  if (!config?.enabled) return false
  const start = parseHhmm(config.start)
  const end = parseHhmm(config.end)
  if (!start || !end) return false
  const now = date.getHours() * 60 + date.getMinutes()
  const from = minutesOfDay(start)
  const to = minutesOfDay(end)
  if (from === to) return false
  if (from < to) return now >= from && now < to
  return now >= from || now < to
}
