/**
 * Limit user-facing text by Unicode grapheme clusters rather than UTF-16 code
 * units. This keeps emoji, combining marks and joined character sequences
 * intact when the chat contract says "40 characters".
 */
export function limitUnicode(value, max = 40) {
  const text = String(value ?? '')
  const length = Math.max(0, Number(max) || 0)
  if (!length) return ''
  if (typeof Intl?.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...segmenter.segment(text)].slice(0, length).map((entry) => entry.segment).join('')
  }
  return Array.from(text).slice(0, length).join('')
}

