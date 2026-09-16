import { BrowserWindow, screen } from 'electron'
import { clampWindowPositionToDisplays, getPetMovementInsets, getVirtualWorkAreaBounds } from './core/window-movement.js'
import { loadPage } from './window-utils.js'
import { log } from './logger.js'

export const PET_WINDOW_SIZE = Object.freeze({ width: 420, height: 520 })
const BOUNDS_SAVE_DELAY_MS = 250

/**
 * Owns the transparent, frameless desktop-pet window: creation, saved-position
 * restore/persist, click-through and pointer pass-through toggles.
 */
export class PetWindow {
  #window = null
  #boundsSaveTimer = null
  #moveSize = null

  constructor({ app, configStore, preloadPath, isDev, isQuitting = () => false }) {
    this.app = app
    this.configStore = configStore
    this.preloadPath = preloadPath
    this.isDev = isDev
    this.isQuitting = isQuitting
    this.screen = screen
  }

  get window() { return this.#window }
  get isDestroyed() { return !this.#window || this.#window.isDestroyed() }

  #scale() { return this.configStore.getAll().scale / .52 }

  create() {
    const config = this.configStore.getAll()
    const displays = this.screen.getAllDisplays()
    const desktop = getVirtualWorkAreaBounds(displays)
    const insets = getPetMovementInsets(PET_WINDOW_SIZE, this.#scale())
    const fallbackPosition = clampWindowPositionToDisplays(
      desktop.right - insets.right - 24,
      desktop.bottom - insets.bottom - 24,
      PET_WINDOW_SIZE,
      displays,
      insets
    )
    const fallback = { ...PET_WINDOW_SIZE, ...fallbackPosition }
    const bounds = this.#restoredBounds(config) || fallback
    const win = new BrowserWindow({
      ...bounds,
      useContentSize: true,
      transparent: true,
      frame: false,
      thickFrame: false,
      roundedCorners: false,
      resizable: false,
      hasShadow: false,
      show: false,
      alwaysOnTop: config.alwaysOnTop,
      skipTaskbar: true,
      backgroundColor: '#00000000',
      title: '发发桌宠',
      webPreferences: { preload: this.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    this.#window = win
    win.webContents.on('did-fail-load', (_event, code, description, url) => log('pet did-fail-load', code, description, url))
    win.webContents.on('preload-error', (_event, path, error) => log('preload-error', path, error?.message))
    win.webContents.on('console-message', (...args) => {
      const detail = args.slice(1).map((item) => String(item)).join(' | ')
      log('pet-console', detail.slice(0, 500))
    })
    loadPage(this.app, win, 'pet.html', this.isDev)
    win.setHasShadow(false)
    win.once('ready-to-show', () => win.showInactive())
    win.on('move', () => this.#scheduleBoundsSave(win))
    win.on('close', (event) => {
      if (!this.isQuitting()) {
        event.preventDefault()
        win.hide()
      }
    })
    win.on('closed', () => {
      this.#clearBoundsSave()
      this.#moveSize = null
      this.#window = null
    })
    this.setClickThrough(config.clickThrough)
    return win
  }

  #restoredBounds(config) {
    const saved = this.configStore.store.get('windowBounds')
    if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return null
    const position = clampWindowPositionToDisplays(
      saved.x,
      saved.y,
      PET_WINDOW_SIZE,
      this.screen.getAllDisplays(),
      getPetMovementInsets(PET_WINDOW_SIZE, config.scale / .52)
    )
    return { ...PET_WINDOW_SIZE, ...position }
  }

  #scheduleBoundsSave(win) {
    clearTimeout(this.#boundsSaveTimer)
    this.#boundsSaveTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return
      const [x, y] = win.getPosition()
      this.configStore.store.set('windowBounds', { x, y, width: PET_WINDOW_SIZE.width, height: PET_WINDOW_SIZE.height })
    }, BOUNDS_SAVE_DELAY_MS)
  }

  #clearBoundsSave() {
    clearTimeout(this.#boundsSaveTimer)
    this.#boundsSaveTimer = null
  }

  show() { this.#window?.show() }
  hide() { this.#window?.hide() }
  getBounds() { return this.#window.getBounds() }

  /**
   * 用固定尺寸的 setBounds 移动窗口：useContentSize 窗口反复 setPosition
   * 会导致边界逐帧漂移（窗口越移越大，宠物随之放大）。每次都用同一组
   * width/height，尺寸永远钉死。
   */
  setPosition(x, y, animate = false) {
    const win = this.#window
    if (!win) return
    if (!this.#moveSize) this.#moveSize = win.getSize()
    const [width, height] = this.#moveSize
    const bounds = { x: Math.round(x), y: Math.round(y), width, height }
    try { win.setBounds(bounds, Boolean(animate)) } catch { win.setPosition(Math.round(x), Math.round(y), Boolean(animate)) }
  }
  setAlwaysOnTop(enabled) { this.#window?.setAlwaysOnTop(Boolean(enabled)) }
  setClickThrough(enabled) { this.#window?.setIgnoreMouseEvents(Boolean(enabled), { forward: true }) }
  setPointerPassThrough(enabled) {
    if (this.isDestroyed || this.configStore.getAll().clickThrough) return
    this.#window.setIgnoreMouseEvents(Boolean(enabled), { forward: true })
  }
  send(channel, payload) { this.#window?.webContents.send(channel, payload) }

  dispose() {
    this.#clearBoundsSave()
  }
}
