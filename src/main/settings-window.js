import { BrowserWindow } from 'electron'
import { loadPage } from './window-utils.js'

/**
 * Owns the single settings window. Reuses an existing instance instead of
 * stacking duplicates.
 */
export class SettingsWindow {
  #window = null

  constructor({ app, preloadPath, isDev }) {
    this.app = app
    this.preloadPath = preloadPath
    this.isDev = isDev
  }

  get window() { return this.#window }

  open() {
    if (this.#window && !this.#window.isDestroyed()) {
      this.#window.show()
      return this.#window
    }
    const win = new BrowserWindow({
      width: 1080,
      height: 760,
      minWidth: 760,
      minHeight: 600,
      title: '发发设置',
      autoHideMenuBar: true,
      webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    this.#window = win
    loadPage(this.app, win, 'settings.html', this.isDev)
    win.on('closed', () => { this.#window = null })
    return win
  }
}
