import { describe, expect, it } from 'vitest'
import { isQuietNow, parseHhmm } from '../src/main/core/quiet-hours.js'

const at = (hours, minutes) => new Date(2026, 7, 14, hours, minutes)

describe('quiet hours', () => {
  it('parses valid times and rejects garbage', () => {
    expect(parseHhmm('23:00')).toEqual({ hour: 23, minute: 0 })
    expect(parseHhmm('07:30')).toEqual({ hour: 7, minute: 30 })
    expect(parseHhmm('25:00')).toBeNull()
    expect(parseHhmm('nope')).toBeNull()
  })

  it('detects a normal evening window', () => {
    const config = { enabled: true, start: '22:00', end: '23:30' }
    expect(isQuietNow(config, at(22, 15))).toBe(true)
    expect(isQuietNow(config, at(23, 45))).toBe(false)
    expect(isQuietNow(config, at(12, 0))).toBe(false)
  })

  it('handles overnight windows spanning midnight', () => {
    const config = { enabled: true, start: '23:00', end: '07:00' }
    expect(isQuietNow(config, at(23, 30))).toBe(true)
    expect(isQuietNow(config, at(3, 0))).toBe(true)
    expect(isQuietNow(config, at(6, 59))).toBe(true)
    expect(isQuietNow(config, at(7, 0))).toBe(false)
    expect(isQuietNow(config, at(12, 0))).toBe(false)
  })

  it('ignores disabled or malformed configs', () => {
    expect(isQuietNow({ enabled: false, start: '23:00', end: '07:00' }, at(3, 0))).toBe(false)
    expect(isQuietNow({ enabled: true, start: 'bad', end: '07:00' }, at(3, 0))).toBe(false)
    expect(isQuietNow({ enabled: true, start: '10:00', end: '10:00' }, at(10, 0))).toBe(false)
  })
})
