import { parseHhmm } from './quiet-hours.js'

/**
 * 定时播报纯逻辑：整点判定 + 到点提醒筛选。
 */

export function isHourChimeTime(date = new Date()) {
  return date.getMinutes() === 0
}

export function parseReminderTime(value) {
  return parseHhmm(value)
}

/**
 * 返回当前时刻到点的启用提醒（时间按 HH:MM 精确匹配）。
 */
export function dueReminders(reminders, date = new Date()) {
  if (!Array.isArray(reminders)) return []
  const hour = date.getHours()
  const minute = date.getMinutes()
  return reminders.filter((reminder) => {
    if (!reminder || reminder.enabled === false) return false
    const time = parseReminderTime(reminder.time)
    if (!time) return false
    return time.hour === hour && time.minute === minute
  })
}
