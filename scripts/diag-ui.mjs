const endpoint = process.argv[2] || 'http://127.0.0.1:9335'

async function pages() { return fetch(endpoint + '/json/list').then((r) => r.json()) }
async function connect(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const cb = pending.get(message.id)
    if (cb) { pending.delete(message.id); cb(message) }
  })
  const send = (method, params = {}) => new Promise((resolve) => {
    id += 1
    pending.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, send }
}
async function evaluate(connection, expression) {
  const response = await connection.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text)
  return response.result.result.value
}
async function disconnect(connection) {
  const closed = new Promise((resolve) => connection.socket.addEventListener('close', resolve, { once: true }))
  connection.socket.close()
  await closed
}

const settingsPage = (await pages()).find((p) => p.url.endsWith('/settings.html'))
if (!settingsPage) throw new Error('settings page not found')
const s = await connect(settingsPage)

const expression = [
  '(async () => {',
  '  const out = {}',
  "  out.navButtons = document.querySelectorAll('nav button').length",
  "  out.panels = document.querySelectorAll('section[data-panel]').length",
  "  out.titleBefore = document.querySelector('#page-title').textContent",
  "  document.querySelector('nav button[data-tab=live]').click()",
  "  out.livePanelActive = document.querySelector('section[data-panel=live]').classList.contains('active')",
  "  out.titleLive = document.querySelector('#page-title').textContent",
  "  out.consoleStatus = document.querySelector('#console-live-status')?.textContent",
  "  out.diagCards = document.querySelectorAll('#diagnostics .status').length",
  "  document.querySelector('nav button[data-tab=relationship]').click()",
  "  out.relCards = document.querySelectorAll('#relationship-status .relationship-card').length",
  "  document.querySelector('nav button[data-tab=actions]').click()",
  "  out.actionButtons = document.querySelectorAll('[data-test-action]').length",
  "  out.idleChecks = document.querySelectorAll('#idle-action-list input[data-idle-action]').length",
  "  out.customActionOptions = document.querySelectorAll('#custom-action-id option').length",
  "  document.querySelector('#language-toggle').click()",
  '  await new Promise((r) => setTimeout(r, 60))',
  "  out.titleEn = document.querySelector('#page-title').textContent",
  "  document.querySelector('#language-toggle').click()",
  '  await new Promise((r) => setTimeout(r, 60))',
  "  out.titleBack = document.querySelector('#page-title').textContent",
  "  const mockInput = document.querySelector('#mock-danmaku-input')",
  "  mockInput.value = '发发*跳舞'",
  "  document.querySelector('#mock-send-danmaku').click()",
  '  await new Promise((r) => setTimeout(r, 500))',
  "  out.toasts = [...document.querySelectorAll('.toast')].map((t) => t.textContent)",
  '  await window.fafa.live.toggleWidget()',
  '  return out',
  '})()'
].join('\n')
const state = await evaluate(s, expression)
await new Promise((r) => setTimeout(r, 900))
const widgetPage = (await pages()).find((p) => p.url.endsWith('/live-widget.html'))
state.widgetOpened = Boolean(widgetPage)
if (widgetPage) {
  const w = await connect(widgetPage)
  state.widgetTitle = await evaluate(w, "document.querySelector('.widget-title')?.textContent")
  state.widgetStatus = await evaluate(w, "document.querySelector('#widget-meta')?.textContent")
  state.widgetFeedEmpty = await evaluate(w, "document.querySelectorAll('#feed li').length")
  await disconnect(w)
}
console.log(JSON.stringify(state, null, 2))
await disconnect(s)