const { contextBridge, ipcRenderer, webUtils } = require('electron')

const listen = (channel, callback) => {
  const handler = (_event, value) => callback(value)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('fafa', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (patch) => ipcRenderer.invoke('config:update', patch),
    setSecret: (name, value) => ipcRenderer.invoke('secret:set', { name, value }),
    onChanged: (callback) => listen('config:changed', callback)
  },
  window: {
    startDrag: () => ipcRenderer.invoke('window:drag-start'),
    endDrag: () => ipcRenderer.invoke('window:drag-end'),
    toss: (vx, vy) => ipcRenderer.invoke('window:toss', { vx, vy }),
    onTossPhase: (callback) => listen('window:toss-phase', callback),
    setPhysicsPhase: (phase) => ipcRenderer.send('window:physics-phase', String(phase || 'idle')),
    resetPosition: () => ipcRenderer.invoke('window:reset-position'),
    undock: () => ipcRenderer.invoke('window:undock'),
    onDock: (callback) => listen('window:docked', callback),
    onUndock: (callback) => listen('window:undocked', callback),
    previewScale: (scale) => ipcRenderer.send('window:preview-scale', Number(scale) || 1),
    onPreviewScale: (callback) => listen('window:preview-scale', callback),
    toggleClickThrough: () => ipcRenderer.invoke('window:toggle-through'),
    setPointerPassThrough: (enabled) => ipcRenderer.send('window:pointer-pass-through', Boolean(enabled)),
    showPetMenu: () => ipcRenderer.invoke('window:pet-menu'),
    openSettings: () => ipcRenderer.invoke('window:open-settings')
  },
  pet: {
    trigger: (actionId, text = '') => ipcRenderer.invoke('pet:trigger', { actionId, text }),
    test: (actionId, text = '', durationMs = 2200) => ipcRenderer.invoke('pet:test', { actionId, text, durationMs }),
    actions: () => ipcRenderer.invoke('pet:actions'),
    stop: () => ipcRenderer.invoke('pet:stop'),
    onAction: (callback) => listen('pet:action', callback),
    onAudio: (callback) => listen('pet:action-audio', callback),
    onIdle: (callback) => listen('pet:idle', callback)
  },
  petPackages: {
    list: () => ipcRenderer.invoke('pet-package:list'),
    active: () => ipcRenderer.invoke('pet-package:active'),
    openFolder: () => ipcRenderer.invoke('pet-package:open-folder')
  },
  services: {
    status: () => ipcRenderer.invoke('service:status'),
    mock: (event) => ipcRenderer.invoke('live:mock', event),
    test: (name) => ipcRenderer.invoke('service:test', name),
    onStatus: (callback) => listen('service:status', callback),
    voiceTranscript: (text) => ipcRenderer.invoke('test:voice-transcript', String(text || '')),
    musicRequest: (query) => ipcRenderer.invoke('test:music-request', String(query || '')),
    musicVolume: (volume) => ipcRenderer.invoke('test:music-volume', Number(volume) || 80)
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke('app:open-external', String(url || ''))
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    ttsVoices: () => ipcRenderer.invoke('providers:tts-voices'),
    ttsModels: () => ipcRenderer.invoke('providers:tts-models'),
    ttsSynthesize: (text) => ipcRenderer.invoke('providers:tts-synthesize', String(text || '')),
    llmReply: (message) => ipcRenderer.invoke('providers:llm-reply', String(message || '')),
    llmModels: () => ipcRenderer.invoke('providers:llm-models'),
    asrModels: () => ipcRenderer.invoke('providers:asr-models')
  },
  voiceSamples: {
    list: () => ipcRenderer.invoke('voice-sample:list'),
    importDialog: () => ipcRenderer.invoke('voice-sample:import-dialog'),
    importPaths: (paths) => ipcRenderer.invoke('voice-sample:import-paths', paths),
    remove: (id) => ipcRenderer.invoke('voice-sample:remove', String(id || '')),
    filePaths: (files) => {
      try { return [...(files || [])].map((file) => webUtils.getPathForFile(file)).filter(Boolean) }
      catch { return [] }
    }
  },
  avatar: {
    status: () => ipcRenderer.invoke('avatar:status'),
    listModels: () => ipcRenderer.invoke('avatar:list-models'),
    importDialog: () => ipcRenderer.invoke('avatar:import-dialog'),
    importPaths: (paths) => ipcRenderer.invoke('avatar:import-paths', paths),
    removeModel: (id) => ipcRenderer.invoke('avatar:remove-model', String(id || '')),
    inspectModel: (id) => ipcRenderer.invoke('avatar:inspect-model', String(id || '')),
    previewImage: () => ipcRenderer.invoke('avatar:preview-image'),
    openFolder: () => ipcRenderer.invoke('avatar:open-folder'),
    test: (mode) => ipcRenderer.invoke('avatar:test', String(mode || 'video')),
    vtsTest: () => ipcRenderer.invoke('avatar:vts-test'),
    vtsAuthenticate: () => ipcRenderer.invoke('avatar:vts-authenticate'),
    vtsModels: () => ipcRenderer.invoke('avatar:vts-models'),
    vtsCurrentModel: () => ipcRenderer.invoke('avatar:vts-current-model'),
    vtsExpressions: () => ipcRenderer.invoke('avatar:vts-expressions'),
    vtsHotkeys: () => ipcRenderer.invoke('avatar:vts-hotkeys'),
    vtsActivateExpression: (file) => ipcRenderer.invoke('avatar:vts-activate-expression', String(file || '')),
    vtsTriggerHotkey: (id) => ipcRenderer.invoke('avatar:vts-trigger-hotkey', String(id || '')),
    vtsLoadModel: (id) => ipcRenderer.invoke('avatar:vts-load-model', String(id || '')),
    filePaths: (files) => {
      try { return [...(files || [])].map((file) => webUtils.getPathForFile(file)).filter(Boolean) }
      catch { return [] }
    }
  },
  voice: {
    level: (level) => ipcRenderer.send('voice:level', Number(level) || 0),
    pcm: (chunk) => ipcRenderer.send('voice:pcm', chunk),
    pcmEnd: () => ipcRenderer.send('voice:pcm-end'),
    testPcm: (chunk) => ipcRenderer.send('voice:test-pcm', chunk),
    testPcmEnd: () => ipcRenderer.send('voice:test-pcm-end'),
    onLevel: (callback) => listen('voice:level', callback),
    onPushToTalk: (callback) => listen('voice:push-to-talk', callback),
    onTranscript: (callback) => listen('voice:transcript', callback),
    onTestResult: (callback) => listen('test:voice-result', callback)
  },
  relationship: {
    get: () => ipcRenderer.invoke('relationship:get'),
    reset: () => ipcRenderer.invoke('relationship:reset'),
    onChanged: (callback) => listen('relationship:changed', callback)
  },
  live: {
    pause: () => ipcRenderer.invoke('live:pause'),
    resume: () => ipcRenderer.invoke('live:resume'),
    reconnect: () => ipcRenderer.invoke('live:reconnect'),
    timeline: () => ipcRenderer.invoke('live:timeline'),
    clearActions: () => ipcRenderer.invoke('live:clear-actions'),
    overlay: () => ipcRenderer.invoke('live:overlay'),
    toggleWidget: () => ipcRenderer.invoke('live:toggle-widget'),
    showWidget: () => ipcRenderer.invoke('live:show-widget'),
    widgetLayout: () => ipcRenderer.invoke('live:widget-layout'),
    detachPanel: (panel, bounds) => ipcRenderer.invoke('live:detach-panel', String(panel || ''), bounds || {}),
    mergePanel: (panel) => ipcRenderer.invoke('live:merge-panel', String(panel || '')),
    onEvent: (callback) => listen('live:event', callback),
    onAi: (callback) => listen('live:ai', callback),
    onWidgetLayout: (callback) => listen('live:widget-layout', callback)
  },
  onNotice: (callback) => listen('app:notice', callback)
})
