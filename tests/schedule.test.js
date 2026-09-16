import { describe, expect, it } from 'vitest'
import { dueReminders, isHourChimeTime, parseReminderTime } from '../src/main/core/schedule.js'

describe('schedule helpers', () => {
  it('detects hour chime minutes', () => {
    expect(isHourChimeTime(new Date(2026, 7, 14, 12, 0))).toBe(true)
    expect(isHourChimeTime(new Date(2026, 7, 14, 12, 1))).toBe(false)
  })

  it('parses reminder times and rejects garbage', () => {
    expect(parseReminderTime('08:30')).toEqual({ hour: 8, minute: 30 })
    expect(parseReminderTime('25:00')).toBeNull()
  })

  it('selects only enabled due reminders at the current minute', () => {
    const date = new Date(2026, 7, 14, 14, 30)
    const reminders = [
      { id: 'a', time: '14:30', text: '现在', enabled: true },
      { id: 'b', time: '14:31', text: '还早', enabled: true },
      { id: 'c', time: '14:30', text: '关闭', enabled: false },
      { id: 'd', time: 'bad', text: '无效', enabled: true }
    ]
    expect(dueReminders(reminders, date).map((item) => item.id)).toEqual(['a'])
    expect(dueReminders(null, date)).toEqual([])
  })
})
