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

const snap = '(async function () { const stack = document.querySelector("#pet-stack"); const stage = document.querySelector("#stage"); const cfg = await window.fafa.config.get(); const rect = stack.getBoundingClientRect(); return { transform: getComputedStyle(stack).transform, rect: { w: Math.round(rect.width), h: Math.round(rect.height) }, stageW: stage.clientWidth, stageH: stage.clientHeight, scale: cfg.scale, phase: stack.dataset.physicsPhase || "", classes: stage.className } })()'

console.log('before:', JSON.stringify(await evaluate(pet, snap)))
await evaluate(pet, 'window.fafa.window.toss(0, -18)')
await new Promise((resolve) => setTimeout(resolve, 400))
console.log('t400ms:', JSON.stringify(await evaluate(pet, snap)))
await new Promise((resolve) => setTimeout(resolve, 800))
console.log('t1200ms:', JSON.stringify(await evaluate(pet, snap)))
await new Promise((resolve) => setTimeout(resolve, 6000))
console.log('after:', JSON.stringify(await evaluate(pet, snap)))
pet.socket.close()