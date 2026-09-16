const endpoint = process.argv[2] || 'http://127.0.0.1:9336'

async function pages() {
  return fetch(endpoint + '/json/list').then((response) => response.json())
}

async function connect(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let requestId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const callback = pending.get(message.id)
    if (!callback) return
    pending.delete(message.id)
    callback(message)
  })
  const send = (method, params = {}) => new Promise((resolve) => {
    requestId += 1
    pending.set(requestId, resolve)
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
  return { socket, send }
}

async function evaluate(connection, expression) {
  const response = await connection.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text)
  }
  return response.result.result.value
}

const petPage = (await pages()).find((page) => page.url.endsWith('/pet.html'))
if (!petPage) throw new Error('pet page not found')
const pet = await connect(petPage)

const micExpression = [
  '(async () => {',
  "  const report = {}",
  '  try {',
  '    const devices = await navigator.mediaDevices.enumerateDevices()',
  "    report.devices = devices.map((d) => ({ kind: d.kind, id: d.deviceId.slice(0, 8), label: d.label || '(no label)' }))",
  '  } catch (error) { report.enumerateError = String(error) }',
  '  try {',
  "    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })",
  "    report.getUserMedia = 'ok'",
  '    const track = stream.getAudioTracks()[0]',
  '    report.track = track ? { label: track.label, muted: track.muted, readyState: track.readyState, settings: track.getSettings() } : null',
  '    const ctx = new AudioContext()',
  '    const src = ctx.createMediaStreamSource(stream)',
  '    const analyser = ctx.createAnalyser()',
  '    src.connect(analyser)',
  '    const data = new Uint8Array(analyser.frequencyBinCount)',
  '    const levels = []',
  '    await new Promise((resolve) => setTimeout(resolve, 400))',
  '    for (let i = 0; i < 5; i += 1) {',
  '      analyser.getByteTimeDomainData(data)',
  '      let sum = 0',
  '      for (const v of data) { const s = (v - 128) / 128; sum += s * s }',
  '      levels.push(Math.sqrt(sum / data.length))',
  '      await new Promise((resolve) => setTimeout(resolve, 200))',
  '    }',
  "    report.rmsSamples = levels.map((v) => v.toFixed(3))",
  '    track.stop(); ctx.close()',
  "  } catch (error) { report.getUserMedia = 'FAILED'; report.error = String(error) }",
  '  return report',
  '})()'
].join('\n')

const micProbe = await evaluate(pet, micExpression)

const diagExpression = [
  '(function () {',
  '  if (window.__fafaDiag) return',
  '  window.__fafaDiag = []',
  "  const stack = document.querySelector('#pet-stack')",
  '  const sample = () => {',
  "    const layer = [...document.querySelectorAll('.pet-layer.visible')].at(-1)",
  '    const rect = stack.getBoundingClientRect()',
  '    window.__fafaDiag.push({',
  '      t: Math.round(performance.now()),',
  "      cls: document.querySelector('#stage').className,",
  "      transform: getComputedStyle(stack).transform,",
  '      rect: { w: Math.round(rect.width), h: Math.round(rect.height) },',
  '      layer: layer ? (layer.tagName + ":" + (layer.dataset.actionId || layer.dataset.source || "img")) : null,',
  '      phase: stack.dataset.physicsPhase || ""',
  '    })',
  '    if (window.__fafaDiag.length > 2000) window.__fafaDiag.shift()',
  '  }',
  '  setInterval(sample, 60)',
  '})()'
].join('\n')

await evaluate(pet, diagExpression)

console.log(JSON.stringify({ mic: micProbe, diagInstalled: true }, null, 2))
pet.socket.close()
