import { describe, expect, it } from 'vitest'
import { filterLiveText, normalizeLiveText } from '../src/main/core/safety.js'

describe('live text safety', () => {
  it('normalizes control characters, whitespace and length', () => {
    expect(normalizeLiveText('  你好\u0000  世界  ')).toBe('你好 世界')
    expect(normalizeLiveText('x'.repeat(500)).length).toBe(300)
  })

  it('blocks text matching any keyword case-insensitively', () => {
    expect(filterLiveText('你好呀', ['广告'])).toEqual({ blocked: false, text: '你好呀' })
    expect(filterLiveText('加微信 123', ['微信', 'QQ'])).toEqual({ blocked: true, text: '' })
    expect(filterLiveText('V我50', ['v我'])).toEqual({ blocked: true, text: '' })
  })

  it('ignores empty keywords', () => {
    expect(filterLiveText('正常弹幕', ['', '  ', null])).toEqual({ blocked: false, text: '正常弹幕' })
    expect(filterLiveText('', [])).toEqual({ blocked: false, text: '' })
  })
})
