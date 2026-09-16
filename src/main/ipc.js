import { BrowserWindow, dialog, globalShortcut, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { PROVIDER_PRESETS } from './providers/presets.js'
import { VOICE_SAMPLE_EXTENSIONS, VoiceSampleService } from './providers/voice-samples.js'
import { createPushToTalk } from './push-to-talk.js'

export function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}

function wireController(controller) {
  controller.on('action', (action) => broadcast('pet:action', action))
  controller.on('action-audio', (payload) => broadcast('pet:action-audio', payload))
  controller.on('idle', () => broadcast('pet:idle'))
  controller.on('status', (status) => broadcast('service:status', status))
  controller.on('notice', (message) => broadcast('app:notice', message))
  controller.on('live-event', (event) => broadcast('live:event', event))
  controller.on('ai-reply', (event) => broadcast('live:ai', event))
  controller.on('test-voice-result', (result) => broadcast('test:voice-result', result))
  controller.on('voice-transcript', (text) => broadcast('voice:transcript', text))
  controller.on('relationship', (state) => broadcast('relationship:changed', state))
}

/**
 * Registers the complete preload-facing IPC surface plus the global shortcut.
 * Returns the shared click-through toggle so the menu manager can reuse it.
 */
export function registerIpc({ app, configStore, controller, petWindow, physics, settingsWindow, liveWidget, menus, avatarService, petPackageService }) {
  const voiceSamples = new VoiceSampleService({ configStore, root: join(app.getPath('userData'), 'voice-samples') })
  const pushToTalk = createPushToTalk({ onStateChange: (state) => broadcast('voice:push-to-talk', state) })
  pushToTalk.sync(configStore.getAll())
  const toggleClickThrough = () => {
    const next = !configStore.getAll().clickThrough
    configStore.update({ clickThrough: next })
    petWindow.setClickThrough(next)
    broadcast('config:changed', configStore.getAll())
  }

  ipcMain.handle('config:get', () => configStore.getAll())
  ipcMain.handle('config:update', async (_event, patch) => {
    const config = configStore.update(patch)
    petWindow?.setAlwaysOnTop(config.alwaysOnTop)
    petWindow?.setClickThrough(config.clickThrough)
    app.setLoginItemSettings({ openAtLogin: config.launchAtLogin })
    await controller.applyConfig()
    pushToTalk.sync(config)
    broadcast('config:changed', config)
    return config
  })
  ipcMain.handle('secret:set', (_event, { name, value }) => configStore.setSecret(name, value))
  ipcMain.handle('window:drag-start', () => physics.startDrag())
  ipcMain.handle('window:drag-end', () => physics.stopDrag())
  ipcMain.handle('window:undock', () => physics.undock())
  ipcMain.handle('window:toss', (_event, velocity) => physics.toss(velocity))
  ipcMain.handle('window:reset-position', () => physics.resetPosition())
  ipcMain.handle('window:toggle-through', toggleClickThrough)
  ipcMain.on('window:pointer-pass-through', (_event, enabled) => petWindow.setPointerPassThrough(enabled))
  ipcMain.on('window:physics-phase', (_event, phase) => {
    const next = String(phase || 'idle')
    controller?.setIdleGate({ physicsPhase: next, tossing: next !== 'idle' })
  })
  ipcMain.handle('window:pet-menu', () => menus.showPetMenu())
  ipcMain.handle('window:open-settings', () => { settingsWindow.open(); return true })
  ipcMain.handle('pet:trigger', (_event, { actionId, text }) => controller.triggerLocal(actionId, text))
  ipcMain.handle('pet:test', (_event, { actionId, text, durationMs }) => controller.triggerTest(actionId, text, durationMs))
  ipcMain.handle('pet:actions', () => controller.getActions())
  ipcMain.handle('pet:stop', () => controller.stopActions())
  ipcMain.handle('pet-package:list', () => petPackageService.list())
  ipcMain.handle('pet-package:active', () => petPackageService.active(configStore.getAll().pet?.activePackageId))
  ipcMain.handle('pet-package:open-folder', () => shell.openPath(petPackageService.root))
  ipcMain.handle('service:status', () => controller.getStatus())
  ipcMain.handle('service:test', (_event, name) => controller.testService(name))
  ipcMain.handle('relationship:get', () => controller.getRelationship())
  ipcMain.handle('relationship:reset', () => controller.resetRelationship())
  ipcMain.handle('live:pause', () => controller.pauseLive())
  ipcMain.handle('live:resume', () => controller.resumeLive())
  ipcMain.handle('live:reconnect', () => controller.reconnectLive())
  ipcMain.handle('live:timeline', () => controller.getLiveTimeline())
  ipcMain.handle('live:overlay', () => controller.getLiveOverlaySnapshot())
  ipcMain.handle('live:clear-actions', () => controller.clearLiveActions())
  ipcMain.handle('live:toggle-widget', () => { liveWidget?.toggle(); return true })
  ipcMain.handle('live:show-widget', () => { liveWidget?.show(); return true })
  ipcMain.handle('live:widget-layout', () => ({ detached: liveWidget?.detachedPanels?.() || [] }))
  ipcMain.handle('live:detach-panel', (_event, panel, bounds) => liveWidget?.detach(panel, bounds) || false)
  ipcMain.handle('live:merge-panel', (_event, panel) => liveWidget?.merge(panel) || false)
  ipcMain.handle('providers:list', () => PROVIDER_PRESETS)
  ipcMain.handle('providers:tts-voices', () => controller.listTtsVoices())
  ipcMain.handle('providers:tts-models', () => controller.listTtsModels())
  ipcMain.handle('providers:tts-synthesize', (_event, text) => controller.tts.synthesize(String(text || '').slice(0, 300)))
  ipcMain.handle('providers:llm-models', () => controller.listLlmModels())
  ipcMain.handle('providers:llm-reply', async (_event, message) => {
    return controller.testLlmReply(message)
  })
  ipcMain.handle('providers:asr-models', () => controller.listAsrModels())
  ipcMain.handle('voice-sample:list', () => voiceSamples.list())
  ipcMain.handle('voice-sample:import-dialog', async () => {
    const win = settingsWindow?.window
    const options = {
      title: '导入自定义音色（音频参考文件）',
      buttonLabel: '导入',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '音频文件', extensions: [...VOICE_SAMPLE_EXTENSIONS] },
        { name: '所有文件', extensions: ['*'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths.length) return { canceled: true, voices: voiceSamples.list() }
    return { canceled: false, voices: await voiceSamples.importPaths(result.filePaths) }
  })
  ipcMain.handle('voice-sample:import-paths', (_event, paths) => voiceSamples.importPaths(paths))
  ipcMain.handle('voice-sample:remove', (_event, id) => voiceSamples.remove(id))
  ipcMain.handle('avatar:status', () => avatarService.status())
  ipcMain.handle('avatar:list-models', () => avatarService.listModels())
  ipcMain.handle('avatar:import-dialog', async () => {
    const win = settingsWindow?.window
    const options = {
      title: '导入 Live2D 模型（支持 ZIP 压缩包）',
      buttonLabel: '导入',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Live2D 模型', extensions: ['zip', 'moc3', 'json', 'png', 'webp', 'jpg', 'jpeg'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths.length) return { canceled: true, models: avatarService.listModels() }
    return { canceled: false, models: avatarService.importPaths(result.filePaths) }
  })
  ipcMain.handle('avatar:import-paths', (_event, paths) => avatarService.importPaths(paths))
  ipcMain.handle('avatar:remove-model', (_event, id) => avatarService.removeModel(String(id || '')))
  ipcMain.handle('avatar:inspect-model', (_event, id) => avatarService.inspectModel(String(id || '')))
  ipcMain.handle('avatar:preview-image', () => avatarService.activePreview())
  ipcMain.handle('avatar:open-folder', async () => {
    const result = await shell.openPath(avatarService.modelsRoot)
    return result ? { ok: false, message: String(result) } : { ok: true }
  })
  ipcMain.handle('avatar:test', (_event, mode) => avatarService.test(String(mode || 'video')))
  ipcMain.handle('avatar:vts-test', () => avatarService.vtsTest())
  ipcMain.handle('avatar:vts-authenticate', () => avatarService.vtsAuthenticate())
  ipcMain.handle('avatar:vts-models', () => avatarService.vtsModels())
  ipcMain.handle('avatar:vts-current-model', () => avatarService.vtsCurrentModel())
  ipcMain.handle('avatar:vts-expressions', () => avatarService.vtsExpressions())
  ipcMain.handle('avatar:vts-hotkeys', () => avatarService.vtsHotkeys())
  ipcMain.handle('avatar:vts-activate-expression', (_event, file) => avatarService.vtsActivateExpression(String(file || ''), true))
  ipcMain.handle('avatar:vts-trigger-hotkey', (_event, id) => avatarService.vtsTriggerHotkey(String(id || '')))
  ipcMain.handle('avatar:vts-load-model', (_event, id) => avatarService.vtsLoadModel(String(id || '')))
  ipcMain.on('voice:level', (_event, level) => {
    controller.handleVoiceLevel(level)
    broadcast('voice:level', Math.max(0, Math.min(100, Number(level) || 0)))
  })
  ipcMain.on('window:preview-scale', (_event, scale) => {
    broadcast('window:preview-scale', Math.max(0.1, Math.min(3, Number(scale) || 1)))
  })
  ipcMain.on('voice:pcm', (_event, chunk) => controller.feedAsrPcm(chunk))
  ipcMain.on('voice:pcm-end', () => controller.stopAsrSession())
  ipcMain.on('voice:test-pcm', (_event, chunk) => controller.feedTestAsrPcm(chunk))
  ipcMain.on('voice:test-pcm-end', () => controller.stopTestAsrSession())
  ipcMain.handle('live:mock', (_event, event) => controller.handleLiveEvent({ ...event, id: crypto.randomUUID() }))
  ipcMain.handle('test:voice-transcript', (_event, text) => controller.simulateVoiceText(String(text || '')))
  ipcMain.handle('test:music-request', (_event, query) => controller.testMusicRequest(String(query || '')))
  ipcMain.handle('test:music-volume', (_event, volume) => controller.testMusicVolume(Number(volume) || 80))
  ipcMain.handle('app:open-external', (_event, url) => {
    const target = String(url || '').trim()
    if (!/^https?:\/\//i.test(target)) return false
    shell.openExternal(target)
    return true
  })

  globalShortcut.register('CommandOrControl+Alt+F', toggleClickThrough)
  app.once('before-quit', () => pushToTalk.dispose())
  wireController(controller)

  return { toggleClickThrough }
}
