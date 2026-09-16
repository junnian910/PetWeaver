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
const petPage = (await pages()).find((page) => page.url.endsWith('/pet.html'))
if (!petPage) throw new Error('pet page not found')
const pet = await connect(petPage)
const expression = '(async function () { const report = {}; const config = await window.fafa.config.get(); report.voiceConfig = config.voice; report.asrEnabled = config.asr ? config.asr.enabled : null; report.notice = document.querySelector("#startup-error").textContent; window.__levels = []; const original = window.fafa.voice.level; window.fafa.voice.level = (value) => { window.__levels.push({ t: Math.round(performance.now()), v: Math.round(value * 100) / 100 }); if (window.__levels.length > 400) window.__levels.shift(); original(value) }; await new Promise((resolve) => setTimeout(resolve, 3000)); window.fafa.voice.level = original; report.levels = window.__levels; return report })()'
const probe = await evaluate(pet, expression)
console.log(JSON.stringify(probe, null, 2))
pet.socket.close()