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
const snap = '(function () { const stack = document.querySelector("#pet-stack"); const rect = stack.getBoundingClientRect(); return { stageW: document.querySelector("#stage").clientWidth, stageH: document.querySelector("#stage").clientHeight, rectH: Math.round(rect.height), transform: getComputedStyle(stack).transform } })()'
const before = await evaluate(pet, snap)
console.log('before toss:', JSON.stringify(before))
await evaluate(pet, 'window.fafa.window.toss(5, -15)')
await new Promise((resolve) => setTimeout(resolve, 2500))
const during = await evaluate(pet, snap)
console.log('during toss:', JSON.stringify(during))
await new Promise((resolve) => setTimeout(resolve, 5000))
const after = await evaluate(pet, snap)
console.log('after toss:', JSON.stringify(after))
pet.socket.close()