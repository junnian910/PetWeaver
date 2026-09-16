/**
 * 自定义音色导入服务：把用户选择的音频文件复制到发发自己的
 * voice-samples 目录，并登记到 config.tts.customVoices。
 *
 * 导入的音色会出现在设置页 TTS「音色」下拉框里，供支持参考音频 /
 * 声音克隆的服务使用（Edge TTS 官方预设音色无法克隆，会回退默认音色）。
 */
import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { log } from '../logger.js'

export const VOICE_SAMPLE_EXTENSIONS = Object.freeze(['wav', 'mp3', 'ogg', 'flac', 'webm', 'm4a', 'aac', 'opus'])

function hasVoiceSampleExtension(path) {
  const name = basename(String(path || ''))
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return false
  return VOICE_SAMPLE_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase())
}

function sanitizeName(name) {
  return String(name || '').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim().slice(0, 60) || 'voice'
}

export class VoiceSampleService {
  constructor({ configStore, root }) {
    this.configStore = configStore
    this.root = root
  }

  list() {
    const voices = this.configStore.getAll().tts?.customVoices
    return Array.isArray(voices) ? voices : []
  }

  /**
   * 复制音频文件进 voice-samples 目录并写入配置，返回完整音色列表。
   * 同名文件会覆盖旧条目（按 name 去重），避免反复导入堆积。
   */
  async importPaths(paths = []) {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : []
    if (!list.length) throw new Error('没有可导入的文件')
    await mkdir(this.root, { recursive: true })

    const existing = this.list()
    const byName = new Map(existing.map((voice) => [voice.name, { ...voice }]))

    for (const source of list) {
      if (!hasVoiceSampleExtension(source)) throw new Error('不支持的音频格式：' + basename(String(source)) + '（支持 ' + VOICE_SAMPLE_EXTENSIONS.join(' / ') + '）')
      const original = basename(String(source))
      const dot = original.lastIndexOf('.')
      const name = sanitizeName(dot > 0 ? original.slice(0, dot) : original)
      const extension = dot > 0 ? original.slice(dot).toLowerCase() : '.wav'
      // 同名覆盖时保留原 id：fileName 不变，直接原地覆盖，不会堆积旧文件；
      // 旧 id 失效会让设置页已渲染的删除按钮失效。
      const previous = byName.get(name)
      const id = previous?.id || 'sample-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
      const fileName = id + extension
      const target = join(this.root, fileName)
      if (previous?.path && previous.path !== target) await rm(previous.path, { force: true }).catch(() => {})
      await copyFile(String(source), target)
      const size = await stat(target).then((info) => info.size).catch(() => 0)
      byName.set(name, { id, name, fileName, path: target, size, importedAt: new Date().toISOString() })
      log('voice-sample-imported', name, size)
    }

    const next = [...byName.values()]
    this.configStore.update({ tts: { customVoices: next } })
    return next
  }

  async remove(id) {
    const targetId = String(id || '')
    const next = this.list().filter((voice) => voice.id !== targetId)
    const removed = this.list().find((voice) => voice.id === targetId)
    this.configStore.update({ tts: { customVoices: next } })
    if (removed?.path) await rm(removed.path, { force: true }).catch(() => {})
    log('voice-sample-removed', targetId)
    return next
  }
}
