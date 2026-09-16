import { app, dialog, net, protocol, screen, session } from 'electron'
import Store from 'electron-store'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { log } from './logger.js'
import { ConfigStore } from './config-store.js'
import { AppController } from './app-controller.js'
import { PetWindow } from './pet-window.js'
import { PetPhysics } from './pet-physics.js'
import { SettingsWindow } from './settings-window.js'
import { LiveWidgetWindow } from './live-widget-window.js'
import { MenuManager } from './menus.js'
import { registerIpc } from './ipc.js'
import { AvatarService } from './providers/avatar-service.js'
import { AIMemoryStore } from './core/ai-memory.js'
import { LocalEmbeddingProvider } from './providers/local-embedding.js'
import { PetPackageService } from './pet-package-service.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const preload = join(dirname, '../preload/preload.cjs')
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

protocol.registerSchemesAsPrivileged([{
  scheme: 'pet-resource',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}])

app.setAppUserModelId('com.fafa.desktop-pet')

process.on('uncaughtException', (error) => {
  log('UNCAUGHT', error?.stack || String(error))
  try { dialog.showErrorBox('发发出错了', String(error?.stack || error)) } catch { /* dialog may fail early */ }
})
app.on('render-process-gone', (_event, webContents, details) => {
  log('render-process-gone', details?.reason, details?.exitCode)
})

let quitting = false
let configStore, controller, petWindow, settingsWindow, liveWidget, physics, menus, avatarService, petPackageService, memoryStore, memoryEmbedder

// 单实例锁：重复启动时聚焦已有实例，避免开出多个无窗口进程。
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    log('second-instance')
    petWindow?.show()
  })

  app.whenReady().then(async () => {
    log('app-ready', process.versions.electron)
    try {
      // 桌宠需要采集麦克风响度做声音互动；只放行 media 权限，其余一律拒绝。
      // 必须在 app ready 之后才能访问 defaultSession。
      session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === 'media'))
      session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media')

      log('start', 'config-store')
      configStore = new ConfigStore()
      log('start', 'pet-package-service')
      petPackageService = new PetPackageService({ root: join(app.getPath('userData'), 'pets') })
      protocol.handle('pet-resource', (request) => {
        const resourcePath = petPackageService.resolveResource(request.url)
        if (!resourcePath) return new Response('Not Found', { status: 404 })
        return net.fetch(pathToFileURL(resourcePath).href, { headers: request.headers })
      })
      log('start', 'local-ai-memory')
      memoryStore = new AIMemoryStore({ store: new Store({ name: 'ai-memory', defaults: { records: [] }, clearInvalidConfig: true }) })
      memoryEmbedder = new LocalEmbeddingProvider()
      log('start', 'app-controller')
      controller = new AppController(configStore, { memoryStore, embedder: memoryEmbedder, petPackageService })
      log('start', 'avatar-service')
      avatarService = new AvatarService({ configStore, modelsRoot: join(app.getPath('userData'), 'avatar-models') })
      log('start', 'windows')
      petWindow = new PetWindow({ app, configStore, preloadPath: preload, isDev, isQuitting: () => quitting })
      settingsWindow = new SettingsWindow({ app, preloadPath: preload, isDev })
      liveWidget = new LiveWidgetWindow({ app, preloadPath: preload, isDev })
      physics = new PetPhysics({ petWindow, screen, configStore, controller })
      menus = new MenuManager({
        app,
        configStore,
        controller,
        petWindow,
        isDev,
        openSettings: () => settingsWindow.open(),
        resetPetPosition: () => physics.resetPosition(),
        toggleWidget: () => liveWidget?.toggle(),
        quit: () => { quitting = true; app.quit() }
      })
      log('start', 'ipc')
      const { toggleClickThrough } = registerIpc({ app, configStore, controller, petWindow, physics, settingsWindow, liveWidget, menus, avatarService, petPackageService })
      menus.setToggleClickThrough(toggleClickThrough)
      log('start', 'pet-window')
      petWindow.create()
      menus.createTray()
      log('start', 'apply-config')
      await controller.applyConfig()
      log('started-ok')
    } catch (error) {
      log('STARTUP-FAILED', error?.stack || String(error))
      try { dialog.showErrorBox('发发启动失败', String(error?.stack || error)) } catch { /* dialog may fail */ }
    }
  })
}

app.on('before-quit', () => {
  quitting = true
  physics?.dispose()
  controller?.dispose()
  avatarService?.dispose()
  petWindow?.dispose()
  liveWidget?.dispose()
  menus?.dispose()
})
app.on('window-all-closed', () => {})
app.on('activate', () => petWindow?.show())
