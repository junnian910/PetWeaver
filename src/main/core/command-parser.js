// 弹幕规则：「发发」与指令之间用至少一个空格或符号（* ，）分隔，
// 「*」只是占位示意，不是字面字符。无分隔符的「发发好」不算指令，交给「喊名字」反应。
const PREFIX = /^(发发|fafa|fuafua)(?:[,，*]|\s+)(?:[,，*]|\s)*/i
const MUSIC = /^点歌(?:[,，*]|\s+)(?:[,，*]|\s)*(.+)$/i

export function normalizeCommandText(text) {
  return String(text ?? '').trim().replace(/\s+/g, ' ').slice(0, 200)
}

// 弹幕专用：必须带「发发」前缀（或点歌）才触发。
export function parseCommand(text, commands) {
  const normalized = normalizeCommandText(text)
  const music = normalized.match(MUSIC)
  if (music) {
    const query = music[1].trim().slice(0, 100)
    return query ? { type: 'music', query } : null
  }
  if (!PREFIX.test(normalized)) return null
  const body = normalized.replace(PREFIX, '').trim().toLowerCase()
  if (!body) return null
  const command = commands.find((item) => item.aliases.some((alias) => body === alias.toLowerCase()))
  return command ? { type: 'command', ...command } : { type: 'unknown', prompt: body }
}

// 主播语音专用：不需要「发发」前缀，直接按别名匹配；带前缀也会被剥离。
export function parseDirectCommand(text, commands) {
  const normalized = normalizeCommandText(text)
  const music = normalized.match(/^点歌\s*[,，*]?\s*(.+)$/i)
  if (music) {
    const query = music[1].trim().slice(0, 100)
    return query ? { type: 'music', query } : null
  }
  const body = normalized.replace(/^(发发|fafa|fuafua)\s*[,，*]?\s*/i, '').trim().toLowerCase()
  if (!body) return null
  const command = commands.find((item) => item.aliases.some((alias) => body === alias.toLowerCase()))
  return command ? { type: 'command', ...command } : null
}
