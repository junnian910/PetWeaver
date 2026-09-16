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

const measure = '(function () { const layer = [...document.querySelectorAll(".pet-layer.visible")].at(-1); if (!layer) return null; const rect = layer.getBoundingClientRect(); const srcW = layer.videoWidth || layer.naturalWidth; const srcH = layer.videoHeight || layer.naturalHeight; let minX = srcW, maxX = -1, minY = srcH, maxY = -1; const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1; const ctx = canvas.getContext("2d", { willReadFrequently: true }); const step = Math.max(1, Math.floor(Math.min(srcW, srcH) / 64)); for (let y = 0; y < srcH; y += step) for (let x = 0; x < srcW; x += step) { ctx.clearRect(0, 0, 1, 1); ctx.drawImage(layer, x, y, 1, 1, 0, 0, 1, 1); if (ctx.getImageData(0, 0, 1, 1).data[3] >= 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y } } const fit = Math.min(rect.width / srcW, rect.height / srcH); const visibleW = Math.round((maxX - minX) * fit); const visibleH = Math.round((maxY - minY) * fit); return { tag: layer.tagName, srcW, srcH, rectW: Math.round(rect.width), rectH: Math.round(rect.height), visibleW, visibleH, source: layer.dataset.source || layer.dataset.actionId } })()'

const before = await evaluate(pet, measure)
console.log('before toss:', JSON.stringify(before))

// 触发真实甩飞（不注入桩），等 airborne fallback 出现
await evaluate(pet, 'delete window.__fafaSmokeWindowApi; window.fafa.window.toss(0, -18)')
await new Promise((resolve) => setTimeout(resolve, 700))
const airborne = await evaluate(pet, measure)
console.log('airborne:', JSON.stringify(airborne))

// 等落地恢复
await new Promise((resolve) => setTimeout(resolve, 6000))
const after = await evaluate(pet, measure)
console.log('after landed:', JSON.stringify(after))
pet.socket.close()