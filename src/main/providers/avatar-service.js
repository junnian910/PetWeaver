import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describeModel, importAvatarFile, importAvatarFiles, scanModelDir } from './live2d-assets.js'
import { VTubeStudioClient } from './vtube-studio.js'

/**
 * 形象源管理：视频动作（默认）/ 导入的 Live2D 模型 / VTube Studio 插件。
 *
 * Live2D 模型只保存在 userData/avatar-models 下，设置页只能通过 IPC
 * 触发导入与删除，渲染进程永远拿不到任意文件系统路径。
 */
export class AvatarService {
  constructor({ configStore, modelsRoot }) {
    this.configStore = configStore
    this.modelsRoot = modelsRoot
    mkdirSync(this.modelsRoot, { recursive: true })
    this.vts = null
    this.vtsConfigKey = ''
    this.vtsAuthenticated = false
  }

  #avatar() { return this.configStore.getAll().avatar || {} }
  #live2d() { return this.#avatar().live2d || {} }
  #vtsConfig() { return this.#avatar().vtubeStudio || {} }

  #vtsClient() {
    const config = this.#vtsConfig()
    const key = JSON.stringify({ host: config.host, port: config.port, pluginName: config.pluginName, pluginDeveloper: config.pluginDeveloper })
    if (!this.vts || this.vtsConfigKey !== key) {
      this.vts?.disconnect?.()
      this.vts = new VTubeStudioClient(config)
      this.vtsConfigKey = key
      this.vtsAuthenticated = false
    }
    return this.vts
  }

  async #authenticatedVts() {
    const token = this.configStore.getSecret('vtsAuthToken')
    if (!token) throw new Error('VTube Studio 插件尚未认证，请先点击「请求插件认证」')
    const client = this.#vtsClient()
    if (!this.vtsAuthenticated) {
      try {
        const result = await client.authenticate(token)
        if (!result.ok) throw new Error(result.message || 'VTube Studio 认证失败')
        this.vtsAuthenticated = true
      } catch (error) {
        this.configStore.setSecret('vtsAuthToken', '')
        this.vtsAuthenticated = false
        throw new Error('VTube Studio 认证已失效，请重新请求插件认证：' + String(error?.message || error))
      }
    }
    return client
  }

  status() {
    const avatar = this.#avatar()
    const live2d = avatar.live2d || {}
    const vts = avatar.vtubeStudio || {}
    const active = (live2d.models || []).find((model) => model.id === live2d.activeModelId)
    return {
      mode: avatar.mode || 'video',
      live2d: {
        mode: avatar.mode === 'live2d' ? 'ready' : 'off',
        modelCount: (live2d.models || []).length,
        activeModel: active?.name || '',
        valid: Boolean(active?.modelJson || active?.moc3)
      },
      vtubeStudio: {
        mode: avatar.mode === 'vts' ? (vts.enabled ? 'ready' : 'warn') : 'off',
        enabled: Boolean(vts.enabled),
        configured: Boolean(vts.host && vts.port),
        host: String(vts.host || '127.0.0.1'),
        port: Number(vts.port || 8001)
      }
    }
  }

  listModels() {
    const models = this.#live2d().models || []
    return models.map((model) => {
      const fresh = existsSync(model.path) ? scanModelDir(model.path) : null
      return fresh ? { ...model, ...fresh } : model
    })
  }

  /**
   * 通过主进程文件对话框导入模型；也可接收拖拽区域上报的绝对路径。
   * 返回更新后的模型列表。
   */
  importPaths(paths = []) {
    const list = (Array.isArray(paths) ? paths : []).filter(Boolean).map(String)
    if (!list.length) return []
    const imported = []
    const groups = new Map()
    for (const path of list) {
      if (!existsSync(path)) continue
      const ext = extname(path).toLowerCase()
      if (!['.zip', '.moc3', '.json', '.png', '.webp', '.jpg', '.jpeg'].includes(ext)) continue
      const dir = ext === '.zip' ? 'zip:' + path : path.slice(0, Math.max(0, path.lastIndexOf('\\'), path.lastIndexOf('/')))
      if (!groups.has(dir)) groups.set(dir, [])
      groups.get(dir).push(path)
    }
    for (const [key, group] of groups) {
      if (key.startsWith('zip:')) imported.push(importAvatarFile({ filePath: group[0], destRoot: this.modelsRoot }))
      else imported.push(importAvatarFiles({ filePaths: group, destRoot: this.modelsRoot }))
    }
    if (!imported.length) throw new Error('没有可导入的文件（支持 ZIP / moc3 / model3.json / 贴图）')
    const current = this.#live2d()
    const existing = Array.isArray(current.models) ? current.models : []
    const merged = [...existing, ...imported]
    const activeModelId = current.activeModelId && merged.some((model) => model.id === current.activeModelId) ? current.activeModelId : imported[0].id
    this.#updateAvatar({
      ...this.#avatar(),
      live2d: { ...current, models: merged, activeModelId }
    })
    return this.listModels()
  }

  removeModel(id) {
    const current = this.#live2d()
    const models = (current.models || []).filter((model) => model.id !== id)
    const removed = (current.models || []).find((model) => model.id === id)
    if (removed?.path) {
      try { rmSync(removed.path, { recursive: true, force: true }) } catch { /* best effort */ }
    }
    this.#updateAvatar({
      ...this.#avatar(),
      live2d: {
        ...current,
        models,
        activeModelId: current.activeModelId === id ? (models[0]?.id || '') : current.activeModelId
      }
    })
    return this.listModels()
  }

  inspectModel(id) {
    const model = this.listModels().find((entry) => entry.id === id)
    if (!model) throw new Error('模型不存在，请重新导入')
    return {
      ...model,
      description: describeModel(model),
      manifest: model.manifest || null,
      textures: model.textures || [],
      motions: model.motions || [],
      expressions: model.expressions || []
    }
  }

  /**
   * 返回当前活动模型的预览贴图 data URL（渲染层不可直接读本地文件）。
   */
  activePreview() {
    const live2d = this.#live2d()
    const model = (live2d.models || []).find((entry) => entry.id === live2d.activeModelId)
    if (!model?.path) return null
    const scan = existsSync(model.path) ? scanModelDir(model.path) : null
    const texture = scan?.textures?.[0] || model.textures?.[0]
    if (!texture) return null
    const file = join(model.path, texture)
    if (!existsSync(file)) return null
    try {
      const ext = extname(file).toLowerCase()
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/bmp'
      return { name: basename(file), mime, dataUrl: `data:${mime};base64,${readFileSync(file).toString('base64')}` }
    } catch {
      return null
    }
  }

  #updateAvatar(patch) {
    this.configStore.update({ avatar: patch })
    this.vtsConfigKey = ''
    this.vtsAuthenticated = false
    return this.configStore.getAll().avatar
  }

  async vtsTest() {
    const result = await this.#vtsClient().test()
    if (result.ok && !result.authenticated && this.configStore.getSecret('vtsAuthToken')) {
      try {
        await this.#authenticatedVts()
        return this.#vtsClient().test()
      } catch (error) {
        return { ...result, authenticated: false, message: error.message }
      }
    }
    return result
  }

  async vtsAuthenticate() {
    const result = await this.#vtsClient().authenticate()
    if (!result.ok) return result
    this.configStore.setSecret('vtsAuthToken', result.token)
    this.vtsAuthenticated = true
    return { ok: true, message: result.message }
  }

  async vtsModels() {
    return (await this.#authenticatedVts()).availableModels()
  }

  async vtsCurrentModel() {
    return (await this.#authenticatedVts()).currentModel()
  }

  async vtsExpressions() {
    return (await this.#authenticatedVts()).expressions()
  }

  async vtsHotkeys() {
    return (await this.#authenticatedVts()).hotkeys()
  }

  async vtsActivateExpression(file, active = true) {
    return (await this.#authenticatedVts()).activateExpression(file, active)
  }

  async vtsTriggerHotkey(id) {
    return (await this.#authenticatedVts()).triggerHotkey(id)
  }

  async vtsLoadModel(id) {
    return (await this.#authenticatedVts()).loadModel(id)
  }

  async test(mode) {
    if (mode === 'vts') return this.vtsTest()
    if (mode === 'live2d') {
      const live2d = this.#live2d()
      const model = (live2d.models || []).find((entry) => entry.id === live2d.activeModelId)
      if (!model) return { ok: false, message: '尚未导入并选择 Live2D 模型' }
      const inspect = this.inspectModel(model.id)
      if (!inspect.modelJson && !inspect.moc3) return { ok: false, message: '模型缺少 model3.json 或 moc3 文件' }
      return { ok: true, message: `模型校验通过：${inspect.description}` }
    }
    return { ok: true, message: '当前使用视频动作渲染，状态正常' }
  }

  dispose() {
    if (this.vts) void this.vts.disconnect().catch(() => {})
  }
}
