const endpoint = process.argv[2] || 'http://127.0.0.1:9336'
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const phase = (message) => console.error(`[runtime-actions-smoke] ${message}`)
const pages = () => fetch(`${endpoint}/json/list`).then((response) => response.json())

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
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  })
  return {
    socket,
    send(method, params = {}) {
      id += 1
      return new Promise((resolve) => {
        pending.set(id, resolve)
        socket.send(JSON.stringify({ id, method, params }))
      })
    }
  }
}

async function evaluate(connection, expression) {
  const response = await connection.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.result.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text)
  }
  return response.result.result.value
}

async function snapshot(pet) {
  return evaluate(pet, `(() => {
    const layers = [...document.querySelectorAll('.pet-video-layer')]
    const visible = layers.filter((layer) => layer.classList.contains('visible'))
    const rendered = layers.filter((layer) => Number(getComputedStyle(layer).opacity) > 0.001)
    const layer = visible[0]
    const rect = layer?.getBoundingClientRect()
    const stack = document.querySelector('#pet-stack')
    return {
      visibleCount: visible.length,
      renderedCount: rendered.length,
      opacitySum: rendered.reduce((sum, video) => sum + Number(getComputedStyle(video).opacity), 0),
      actionId: layer?.dataset.actionId || null,
      assetStatus: layer?.dataset.assetStatus || null,
      readyState: layer?.readyState ?? null,
      width: layer?.videoWidth ?? null,
      height: layer?.videoHeight ?? null,
      src: layer?.currentSrc || layer?.src || null,
      currentTime: layer?.currentTime ?? null,
      rect: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      stageRect: document.querySelector('#stage')?.getBoundingClientRect().toJSON() || null,
      petScale: getComputedStyle(stack).getPropertyValue('--pet-scale').trim(),
      physicsPhase: stack?.dataset.physicsPhase || 'idle',
      layers: layers.map((video) => ({
        id: video.id,
        classes: video.className,
        actionId: video.dataset.actionId || null,
        readyState: video.readyState,
        opacity: Number(getComputedStyle(video).opacity),
        src: video.currentSrc || video.src || null
      })),
      fallbackVisible: [...document.querySelectorAll('img.pet-layer.visible')].map((image) => image.id)
    }
  })()`)
}

async function waitForAction(pet, actionId) {
  let result = null
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await delay(80)
    result = await snapshot(pet)
    if (result.visibleCount === 1 && result.actionId === actionId && result.readyState >= 2) return result
  }
  throw new Error(`动作视频未切换到 ${actionId}：${JSON.stringify(result)}`)
}

function assertVideoSnapshot(result, expectedActionId = null) {
  if (result.visibleCount !== 1 || result.renderedCount < 1 || result.opacitySum <= 0.001 || result.readyState < 2 || result.width !== 384 || result.height !== 416) {
    throw new Error(`动作视频层异常：${JSON.stringify(result)}`)
  }
  if (expectedActionId && result.actionId !== expectedActionId) {
    throw new Error(`动作语义 ID 异常：expected=${expectedActionId} actual=${JSON.stringify(result)}`)
  }
}

const petPage = (await pages()).find((page) => page.url.endsWith('/pet.html'))
if (!petPage) throw new Error('找不到桌宠页面')
const transportStubExpected = petPage.url.startsWith('http://') || petPage.url.startsWith('https://')
const pet = await connect(petPage)
let settings = null

try {
  let ready = null
  for (let attempt = 0; attempt < 30; attempt += 1) {
    ready = await evaluate(pet, `({
      documentReady: document.readyState,
      stage: Boolean(document.querySelector('#stage')),
      preload: typeof window.fafa?.window?.onTossPhase === 'function',
      title: document.title,
      html: document.documentElement?.outerHTML.slice(0, 300) || ''
    })`)
    if (ready.stage && ready.preload) break
    await delay(100)
  }
  if (!ready?.stage || !ready?.preload) throw new Error(`桌宠页面未就绪：${JSON.stringify(ready)}`)

  phase('instrument')
  await evaluate(pet, `(() => {
    window.__runtimeSmoke = { tossPhases: [], pointerEvents: [], pointerId: null }
    const stage = document.querySelector('#stage')
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      stage.addEventListener(type, (event) => {
        window.__runtimeSmoke.pointerEvents.push({ type, pointerId: event.pointerId, x: event.clientX, y: event.clientY })
        if (type === 'pointerdown') window.__runtimeSmoke.pointerId = event.pointerId
      }, { capture: true })
    }
    window.fafa.window.onTossPhase((phase) => window.__runtimeSmoke.tossPhases.push(phase))
  })()`)

  const actionIds = ['act_greet', 'act_sing', 'act_sleep', 'act_wake', 'idle_blink', 'idle_stare', 'emo_happy', 'emo_shy', 'emo_angry']
  const actionResults = []
  for (const actionId of actionIds) {
    phase(`action:${actionId}`)
    await evaluate(pet, `window.fafa.pet.test(${JSON.stringify(actionId)}, '', 900)`)
    const result = await waitForAction(pet, actionId)
    assertVideoSnapshot(result, actionId)
    actionResults.push(result)
  }

  const rapidSamples = []
  for (const actionId of ['act_greet', 'act_sing', 'emo_happy', 'idle_blink', 'act_wake', 'emo_shy']) {
    phase(`rapid:${actionId}`)
    await evaluate(pet, `window.fafa.pet.test(${JSON.stringify(actionId)}, '', 1200)`)
    await delay(45)
    const result = await snapshot(pet)
    if (result.visibleCount !== 1 || result.renderedCount < 1 || result.opacitySum <= 0.001 || result.readyState < 2 || result.width !== 384 || result.height !== 416) {
      throw new Error(`快速切换出现黑屏或双层：${JSON.stringify(result)}`)
    }
    rapidSamples.push({ requested: actionId, ...result })
  }
  const rapidFinal = await waitForAction(pet, 'emo_shy')
  assertVideoSnapshot(rapidFinal, 'emo_shy')

  const point = await evaluate(pet, `(() => {
    const layer = [...document.querySelectorAll('.pet-video-layer.visible')][0]
    const rect = layer?.getBoundingClientRect()
    return rect && { x: Math.round(rect.left + rect.width * .5), y: Math.round(rect.top + rect.height * .36) }
  })()`)
  if (!point) throw new Error('找不到可用于拖动冒烟的角色区域')

  await evaluate(pet, `(() => {
    window.__runtimeSmoke.dragCalls = { start: 0, end: 0, toss: 0 }
    const startDrag = () => { window.__runtimeSmoke.dragCalls.start += 1 }
    const endDrag = () => { window.__runtimeSmoke.dragCalls.end += 1 }
    const toss = () => { window.__runtimeSmoke.dragCalls.toss += 1; return false }
    window.__fafaSmokeWindowApi = { startDrag, endDrag, toss, setPointerPassThrough: () => {} }
  })()`)
  phase(transportStubExpected ? 'drag:transport-stub' : 'drag:production-transport')
  await evaluate(pet, `window.fafa.pet.test('emo_shy', '', 5000)`)
  await waitForAction(pet, 'emo_shy')
  await evaluate(pet, `(() => { window.__runtimeSmoke.tossPhases = []; window.__runtimeSmoke.pointerEvents = []; window.__runtimeSmoke.pointerId = null })()`)
  const dragBefore = await snapshot(pet)
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
  await pet.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 })
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 58, y: point.y + 2, button: 'left', buttons: 1 })
  await delay(80)
  const dragDuring = await snapshot(pet)
  for (const offset of [4, 6, 8]) {
    await delay(70)
    await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 58 + offset, y: point.y + 2, button: 'left', buttons: 1 })
  }
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 66, y: point.y + 2, button: 'left', buttons: 0, clickCount: 1 })
  await delay(180)
  const dragAfter = await snapshot(pet)
  const dragPhases = await evaluate(pet, `window.__runtimeSmoke.tossPhases`)
  const sameFrameSource = dragBefore.src === dragDuring.src && dragDuring.src === dragAfter.src
  const sameScale = dragBefore.petScale === dragDuring.petScale && dragDuring.petScale === dragAfter.petScale
  const relativeSize = (result) => ({ width: result.rect.width / result.stageRect.width, height: result.rect.height / result.stageRect.height })
  const beforeRelativeSize = relativeSize(dragBefore)
  const sameSize = [dragDuring, dragAfter].every((result) => {
    const nextRelativeSize = relativeSize(result)
    return Math.abs(nextRelativeSize.width - beforeRelativeSize.width) < 0.001 && Math.abs(nextRelativeSize.height - beforeRelativeSize.height) < 0.001
  })
  if (!sameFrameSource || !sameScale || !sameSize || dragPhases.length || dragAfter.visibleCount !== 1) {
    throw new Error(`普通拖动改变了画面或误触发 toss：${JSON.stringify({ dragBefore, dragDuring, dragAfter, dragPhases })}`)
  }

  await evaluate(pet, `(() => { window.__runtimeSmoke.tossPhases = []; window.__runtimeSmoke.pointerEvents = []; window.__runtimeSmoke.pointerId = null })()`)
  phase('pointercancel')
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
  await pet.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 })
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 58, y: point.y + 2, button: 'left', buttons: 1 })
  await delay(60)
  await evaluate(pet, `(() => {
    const stage = document.querySelector('#stage')
    const pointerId = window.__runtimeSmoke.pointerId
    stage.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId, clientX: ${point.x + 58}, clientY: ${point.y + 2}, button: 0, buttons: 0 }))
  })()`)
  await pet.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 58, y: point.y + 2, button: 'left', buttons: 0, clickCount: 1 })
  await delay(120)
  const cancelState = await evaluate(pet, `({ phases:window.__runtimeSmoke.tossPhases, dragging:document.querySelector('#stage').classList.contains('dragging'), calls:window.__runtimeSmoke.dragCalls })`)
  const invalidTransportCalls = transportStubExpected && (cancelState.calls.toss !== 0 || cancelState.calls.start !== 2 || cancelState.calls.end !== 2)
  if (cancelState.phases.length || cancelState.dragging || invalidTransportCalls) throw new Error(`pointercancel 未能只取消拖动：${JSON.stringify(cancelState)}`)

  await evaluate(pet, `delete window.__fafaSmokeWindowApi`)
  await evaluate(pet, `window.fafa.window.resetPosition()`)
  await delay(250)
  await evaluate(pet, `window.__runtimeSmoke.tossPhases = []`)
  phase('toss')
  await evaluate(pet, `window.fafa.window.toss(0, -18)`)
  for (let elapsed = 0; elapsed < 10_000; elapsed += 250) {
    await delay(250)
    if (await evaluate(pet, `window.__runtimeSmoke.tossPhases.includes('landed')`)) break
  }
  const tossPhases = await evaluate(pet, `window.__runtimeSmoke.tossPhases`)
  if (!tossPhases.includes('airborne') || !tossPhases.includes('landed') || tossPhases.filter((phase) => phase === 'landed').length !== 1) {
    throw new Error(`真实 toss 阶段异常：${JSON.stringify(tossPhases)}`)
  }

  const tossSources = ['toss-grabbed.png', 'toss-airborne.png', 'toss-landed.png']
  const tossResults = []
  for (const filename of tossSources) {
    tossResults.push(await evaluate(pet, `(async () => {
      const image = new Image()
      image.src = './assets/expressions/${filename}'
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      const corners = [3, (canvas.width - 1) * 4 + 3, ((canvas.height - 1) * canvas.width) * 4 + 3, (canvas.width * canvas.height - 1) * 4 + 3].map((index) => pixels[index])
      return { filename: '${filename}', width: image.naturalWidth, height: image.naturalHeight, corners }
    })()`))
  }
  if (tossResults.some((result) => result.width !== 1254 || result.height !== 1254 || result.corners.some(Boolean))) {
    throw new Error(`甩飞素材失败：${JSON.stringify(tossResults)}`)
  }

  await evaluate(pet, `window.fafa.window.openSettings()`)
  phase('settings')
  await delay(500)
  const settingsPage = (await pages()).find((page) => page.url.endsWith('/settings.html'))
  if (!settingsPage) throw new Error('设置页未打开')
  settings = await connect(settingsPage)
  const settingsState = await evaluate(settings, `(async () => {
    const actions = await window.fafa.pet.actions()
    return {
      ready: document.readyState,
      registryCount: actions.length,
      actionButtons: document.querySelectorAll('[data-test-action]').length,
      actionIds: [...document.querySelectorAll('[data-test-action]')].map((button) => button.dataset.testAction)
    }
  })()`)
  if (!['interactive', 'complete'].includes(settingsState.ready) || settingsState.registryCount !== 43 || settingsState.actionButtons !== 43 || settingsState.actionIds.length !== 43) {
    throw new Error(`设置页动作测试清单异常：${JSON.stringify(settingsState)}`)
  }

  console.log(JSON.stringify({ actionResults, rapidSamples, rapidFinal, dragTransport: 'renderer-side IPC stub; system cursor drag unavailable in this environment', drag: { before: dragBefore, during: dragDuring, after: dragAfter }, dragPhases, cancelState, tossPhases, tossResults, settings: settingsState }, null, 2))
} finally {
  settings?.socket.close()
  pet.socket.close()
}
