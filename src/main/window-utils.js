import { join } from 'node:path'

/**
 * Shared page loading for app windows. Development mode uses the Vite dev
 * server, production loads the built files inside the packaged app.
 */
export function loadPage(app, win, page, isDev) {
  if (isDev) return win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/${page}`)
  return win.loadFile(join(app.getAppPath(), 'dist', page))
}
