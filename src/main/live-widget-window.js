import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { loadPage } from './window-utils.js'

const PANELS = new Set(['live', 'ai', 'action', 'relationship'])

/** 直播悬浮组件与可拆分的四个内容窗。 */
export class LiveWidgetWindow {
  #window = null
  #detached = new Map()
  #width = 1120
  #height = 620

  constructor({ app, preloadPath, isDev }) {
    this.app = app
    this.preloadPath = preloadPath
    this.isDev = isDev
  }

  get window() { return this.#window }
  detachedPanels() { return [...this.#detached.keys()] }

  #options(bounds = {}, relationship = false) {
    const x = Number.isFinite(Number(bounds.x)) ? Math.round(Number(bounds.x)) : undefined
    const y = Number.isFinite(Number(bounds.y)) ? Math.round(Number(bounds.y)) : undefined
    return {
      width: relationship ? 280 : 380,
      height: relationship ? 330 : 480,
      x,
      y,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      autoHideMenuBar: true,
      title: '直播悬浮组件',
      webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true }
    }
  }

  #publishLayout() {
    const payload = { detached: this.detachedPanels() }
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('live:widget-layout', payload)
  }

  #loadDetached(win, panel) {
    if (this.isDev) return win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/live-widget.html?panel=${encodeURIComponent(panel)}`)
    return win.loadFile(join(this.app.getAppPath(), 'dist', 'live-widget.html'), { query: { panel } })
  }

  toggle() {
    if (this.#window && !this.#window.isDestroyed()) {
      const show = !this.#window.isVisible()
      if (show) {
        this.#window.show()
        for (const win of this.#detached.values()) if (!win.isDestroyed()) win.show()
      } else {
        this.#window.hide()
        for (const win of this.#detached.values()) if (!win.isDestroyed()) win.hide()
      }
      return this.#window
    }
    const win = new BrowserWindow({ ...this.#options(), width: this.#width, height: this.#height })
    this.#window = win
    win.center()
    loadPage(this.app, win, 'live-widget.html', this.isDev)
    win.on('closed', () => {
      if (this.#window !== win) return
      this.#window = null
      for (const panel of this.detachedPanels()) this.merge(panel)
    })
    return win
  }

  show() {
    if (!this.#window || this.#window.isDestroyed()) return this.toggle()
    this.#window.show()
    for (const win of this.#detached.values()) if (!win.isDestroyed()) win.show()
    return this.#window
  }

  detach(panel, bounds = {}) {
    const key = String(panel || '')
    if (!PANELS.has(key)) return false
    const existing = this.#detached.get(key)
    if (existing && !existing.isDestroyed()) {
      existing.show()
      existing.focus()
      return true
    }
    const win = new BrowserWindow(this.#options(bounds, key === 'relationship'))
    this.#detached.set(key, win)
    this.#publishLayout()
    this.#loadDetached(win, key)
    win.on('closed', () => {
      if (this.#detached.get(key) !== win) return
      this.#detached.delete(key)
      this.#publishLayout()
    })
    return true
  }

  merge(panel) {
    const key = String(panel || '')
    const win = this.#detached.get(key)
    if (!win) return false
    this.#detached.delete(key)
    if (!win.isDestroyed()) win.destroy()
    this.#publishLayout()
    return true
  }

  dispose() {
    for (const panel of this.detachedPanels()) this.merge(panel)
    if (this.#window && !this.#window.isDestroyed()) this.#window.destroy()
    this.#window = null
  }
}
