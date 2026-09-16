const endpoint = process.argv[2] || 'http://127.0.0.1:9336'
async function pages() { return fetch(endpoint + '/json/list').then((r) => r.json()) }
async function connect(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let requestId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const callback = pending.get(message.id)
    if (!callback) return
    pending.delete(message.id)
    callback(message)
  })
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

// 注入拖拽桩：不动真实窗口，只测渲染层
await evaluate(pet, '(function () { window.__fafaSmokeWindowApi = { startDrag: () => {}, endDrag: () => {}, toss: () => false, setPointerPassThrough: () => {} } })()')

// 拿到角色可见区域中心
const point = await evaluate(pet, '(function () { const layer = [...document.querySelectorAll(".pet-layer.visible")].at(-1); const rect = layer?.getBoundingClientRect(); return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height * 0.36) } : null })()')
console.log('drag point:', JSON.stringify(point))

await evaluate(pet, 'window.__fafaDiag.length = 0')
await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
await pet.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 })
for (const offset of [30, 60, 90, 120, 150, 180]) {
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + offset, y: point.y + 2, button: 'left', buttons: 1 })
  await new Promise((resolve) => setTimeout(resolve, 120))
}
await pet.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 180, y: point.y + 2, button: 'left', buttons: 0, clickCount: 1 })
await new Promise((resolve) => setTimeout(resolve, 600))

const samples = await evaluate(pet, 'window.__fafaDiag.map((s) => s)')
const during = samples.filter((s) => s.cls.includes('dragging'))
const before = samples.filter((s) => !s.cls.includes('dragging')).slice(0, 5)
const after = samples.filter((s) => !s.cls.includes('dragging')).slice(-5)
console.log('before:', JSON.stringify(before))
console.log('during:', JSON.stringify(during.slice(0, 5)), '...', JSON.stringify(during.slice(-3)))
console.log('after:', JSON.stringify(after))
pet.socket.close()