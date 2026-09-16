import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

function safeString(value) {
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

/**
 * 主进程诊断日志：写入 userData/logs/main.log。日志失败绝不抛出，
 * 不联网、不发送任何数据，只落在本机。
 */
export function log(...parts) {
  try {
    const directory = join(app.getAppPath(), '..', 'logs')
    const fallback = join(app.getPath('userData'), 'logs')
    const target = (() => {
      try { mkdirSync(directory, { recursive: true }); return directory } catch { mkdirSync(fallback, { recursive: true }); return fallback }
    })()
    const line = new Date().toISOString() + ' ' + parts.map(safeString).join(' ') + String.fromCharCode(10)
    appendFileSync(join(target, 'main.log'), line)
  } catch { /* logging must never crash the app */ }
}
