const endpoint = process.argv[2] || 'http://127.0.0.1:9336'
async function pages() { return fetch(endpoint + '/json/list').then((r) => r.json()) }
async function connect(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let requestId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); const callback = pending.get(message.id); if (!callback) return; pending.delete(message.id); callback(message) })
  const send = (method, params = {}) => new Promise((resolve) => { requestId += 1; pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })) })
  return { socket, send }
}
async function evaluate(connection, expression) {
  const response = await connection.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text)
  return response.result.result.value
}
const settingsPage = (await pages()).find((page) => page.url.endsWith('/settings.html'))
if (!settingsPage) throw new Error('settings page not found')
const pet = await connect(settingsPage)
const probe = await evaluate(pet, '(function () { const detail = document.querySelector("#llm-detail"); if (!detail) return { found: false }; const cs = getComputedStyle(detail); const input = document.querySelector("input[name=llmEnabled]"); return { found: true, className: detail.className, maxHeight: cs.maxHeight, opacity: cs.opacity, llmEnabled: input ? input.checked : null, collapseRuleApplied: cs.maxHeight !== "none" } })()')
console.log(JSON.stringify(probe, null, 2))
pet.socket.close()