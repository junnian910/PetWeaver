import { Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'

/**
 * Owns the tray icon and the right-click pet menu. All destructive or
 * config-touching actions are injected from the application wiring.
 */
export class MenuManager {
  constructor({ app, configStore, controller, petWindow, isDev, openSettings, resetPetPosition, toggleWidget, quit }) {
    this.app = app
    this.configStore = configStore
    this.controller = controller
    this.petWindow = petWindow
    this.isDev = isDev
    this.openSettings = openSettings
    this.resetPetPosition = resetPetPosition
    this.toggleWidget = toggleWidget
    this.quit = quit
    this.tray = null
    this.toggleClickThrough = null
  }

  setToggleClickThrough(fn) { this.toggleClickThrough = fn }

  createTray() {
    const iconPath = this.isDev
      ? join(this.app.getAppPath(), 'public/assets/fafa-pet-final.png')
      : join(this.app.getAppPath(), 'dist/assets/fafa-pet-final.png')
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 })
    const tray = new Tray(icon)
    tray.setToolTip('发发')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示发发', click: () => this.petWindow.show() },
      { label: '设置', click: () => this.openSettings() },
      { label: '直播悬浮组件', click: () => this.toggleWidget?.() },
      { label: '切换点击穿透 (Ctrl+Alt+F)', click: () => this.toggleClickThrough?.() },
      { label: '说句话', click: () => this.controller.triggerLocal('act_greet', '今天也一起加油吧！') },
      { type: 'separator' },
      { label: '退出', click: () => this.quit() }
    ]))
    tray.on('double-click', () => this.petWindow.show())
    this.tray = tray
    return tray
  }

  showPetMenu() {
    const config = this.configStore.getAll()
    const menu = Menu.buildFromTemplate([
      { label: '打个招呼', click: () => this.controller.triggerTest('act_greet', '你好呀～', 2600) },
      { label: '跳一下', click: () => this.controller.triggerTest('act_dance', '一起蹦起来～', 2600) },
      { label: '睡觉', click: () => this.controller.triggerTest('act_sleep', '呼噜……', 2600) },
      { type: 'separator' },
      { label: (config.clickThrough ? '✓ ' : '') + '锁定点击穿透', click: () => this.toggleClickThrough?.() },
      { label: '回到主屏幕', click: () => this.resetPetPosition() },
      { label: '设置', click: () => this.openSettings() },
      { label: '直播悬浮组件', click: () => this.toggleWidget?.() },
      { type: 'separator' },
      { label: '隐藏发发', click: () => this.petWindow.hide() },
      { label: '退出', click: () => this.quit() }
    ])
    menu.popup({ window: this.petWindow.window })
  }

  dispose() {
    this.tray?.destroy()
    this.tray = null
  }
}
