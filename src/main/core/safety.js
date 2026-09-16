const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/**
 * 文本规范化：去控制字符、合并空白、限制长度（用于弹幕/SC/语音转写）。
 */
export function normalizeLiveText(text) {
  return String(text ?? '').replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, 300)
}

/**
 * 敏感词过滤：命中任意关键词（不区分大小写）返回 blocked。
 */
export function filterLiveText(text, keywords) {
  const normalized = normalizeLiveText(text)
  if (!normalized) return { blocked: false, text: '' }
  for (const keyword of keywords || []) {
    const needle = normalizeLiveText(keyword)
    if (needle && normalized.toLowerCase().includes(needle.toLowerCase())) {
      return { blocked: true, text: '' }
    }
  }
  return { blocked: false, text: normalized }
}
