const endpoint = process.argv[2] || 'http://127.0.0.1:9335'

async function pages() {
  return fetch(`${endpoint}/json/list`).then((response) => response.json())
}

async function connect(page) {
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once:true })
    socket.addEventListener('error', reject, { once:true })
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
    socket.send(JSON.stringify({ id:requestId, method, params }))
  })
  return { socket, send }
}

async function evaluate(connection, expression) {
  const response = await connection.send('Runtime.evaluate', {
    expression,
    awaitPromise:true,
    returnByValue:true
  })
  if (response.result?.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text)
  }
  return response.result.result.value
}

async function disconnect(connection) {
  const closed = new Promise((resolve) => connection.socket.addEventListener('close', resolve, { once:true }))
  connection.socket.close()
  await closed
}

const petPage = (await pages()).find((page) => page.url.endsWith('/pet.html'))
if (!petPage) throw new Error('找不到桌宠页面')
const pet = await connect(petPage)
let petState
for (let attempt = 0; attempt < 30; attempt += 1) {
  petState = await evaluate(pet, `(async () => {
  const config = await window.fafa.config.get()
  const layers = [...document.querySelectorAll('.pet-layer')]
  const visibleLayers = layers.filter((layer) => layer.classList.contains('visible') && getComputedStyle(layer).opacity !== '0')
  const visible = visibleLayers.at(-1)
  const rect = visible?.getBoundingClientRect()
  return {
    ready:document.readyState,
    layerCount:layers.length,
    visibleLayerCount:visibleLayers.length,
    mediaReady:visible instanceof HTMLVideoElement ? visible.readyState : visible?.complete,
    rect:rect && { left:rect.left, top:rect.top, width:rect.width, height:rect.height },
    interaction:config.interaction,
    api:{
      pointerPassThrough:typeof window.fafa.window.setPointerPassThrough,
      petMenu:typeof window.fafa.window.showPetMenu,
      toss:typeof window.fafa.window.toss
    }
  }
})()`)
  if (petState.mediaReady) break
  await new Promise((resolve) => setTimeout(resolve, 250))
}
await new Promise((resolve) => setTimeout(resolve, 450))
petState = await evaluate(pet, `(async () => {
  const config = await window.fafa.config.get()
  const layers = [...document.querySelectorAll('.pet-layer')]
  const visibleLayers = layers.filter((layer) => layer.classList.contains('visible') && getComputedStyle(layer).opacity !== '0')
  const visible = visibleLayers.at(-1)
  const rect = visible?.getBoundingClientRect()
  return {
    ready:document.readyState,
    layerCount:layers.length,
    visibleLayerCount:visibleLayers.length,
    mediaReady:visible instanceof HTMLVideoElement ? visible.readyState : visible?.complete,
    rect:rect && { left:rect.left, top:rect.top, width:rect.width, height:rect.height },
    interaction:config.interaction,
    api:{
      pointerPassThrough:typeof window.fafa.window.setPointerPassThrough,
      petMenu:typeof window.fafa.window.showPetMenu,
      toss:typeof window.fafa.window.toss
    }
  }
})()`)

if (!['interactive', 'complete'].includes(petState.ready) || petState.visibleLayerCount !== 1 || !petState.mediaReady) {
  throw new Error(`桌宠媒体层未就绪：${JSON.stringify(petState)}`)
}
if (Object.values(petState.api).some((type) => type !== 'function')) {
  throw new Error(`交互 API 不完整：${JSON.stringify(petState.api)}`)
}

const currentRect = await evaluate(pet, `(() => {
  const layers = [...document.querySelectorAll('.pet-layer')]
  const visible = layers.filter((layer) => layer.classList.contains('visible') && getComputedStyle(layer).opacity !== '0').at(-1)
  const rect = visible?.getBoundingClientRect()
  return rect && { left:rect.left, top:rect.top, width:rect.width, height:rect.height }
})()`)
if (!currentRect) throw new Error('当前角色没有可交互媒体层')
const headX = Math.round(currentRect.left + currentRect.width * .5)
const headY = Math.round(currentRect.top + currentRect.height * .32)
await evaluate(pet, `window.fafa.window.setPointerPassThrough(false)`)
await pet.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:headX, y:headY })
const headHit = await evaluate(pet, `document.querySelector('#stage').classList.contains('pet-hover')`)
if (!headHit) throw new Error('当前角色头部范围内没有可交互像素')
await new Promise((resolve) => setTimeout(resolve, 40))
for (const offset of [12, -12, 12]) {
  await evaluate(pet, `document.querySelector('#stage').dispatchEvent(new PointerEvent('pointermove', { bubbles:true, clientX:${headX + offset}, clientY:${headY}, pointerId:1, buttons:0 }))`)
  await new Promise((resolve) => setTimeout(resolve, 40))
}
let hoverPettingText = ''
for (let attempt = 0; attempt < 20 && !hoverPettingText.includes('舒服'); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 100))
  hoverPettingText = await evaluate(pet, `document.querySelector('#bubble')?.textContent || ''`)
}
if (!hoverPettingText.includes('舒服')) throw new Error('未按住鼠标的左右抚摸没有触发反馈')
await evaluate(pet, `(() => {
  window.__fafaSmokeEvents = []
  const stage = document.querySelector('#stage')
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    stage.addEventListener(type, (event) => window.__fafaSmokeEvents.push({
      type,
      x:event.clientX,
      y:event.clientY,
      button:event.button,
      buttons:event.buttons
    }), { capture:true })
  }
})()`)
await pet.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:headX, y:headY })
await pet.send('Input.dispatchMouseEvent', { type:'mousePressed', x:headX, y:headY, button:'left', buttons:1, clickCount:1 })
for (const offset of [26, -6, 30, -4]) {
  await pet.send('Input.dispatchMouseEvent', { type:'mouseMoved', x:headX + offset, y:headY, button:'left', buttons:1 })
}
await pet.send('Input.dispatchMouseEvent', { type:'mouseReleased', x:headX - 4, y:headY, button:'left', buttons:0, clickCount:1 })
let pettingText = ''
for (let attempt = 0; attempt < 20 && !pettingText.includes('舒服'); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 100))
  pettingText = await evaluate(pet, `document.querySelector('#bubble')?.textContent || ''`)
}
if (!pettingText.includes('舒服')) {
  const diagnostics = await evaluate(pet, `({
    events:window.__fafaSmokeEvents,
    hover:document.querySelector('#stage').classList.contains('pet-hover'),
    dragging:document.querySelector('#stage').classList.contains('dragging'),
    bubble:document.querySelector('#bubble')?.textContent || ''
  })`)
  throw new Error(`抚摸反馈未触发：${JSON.stringify(diagnostics)}`)
}

await evaluate(pet, `window.fafa.window.openSettings()`)
await new Promise((resolve) => setTimeout(resolve, 500))
const settingsPage = (await pages()).find((page) => page.url.endsWith('/settings.html'))
if (!settingsPage) throw new Error('设置页未打开')
const settings = await connect(settingsPage)
await evaluate(settings, `window.fafa.live.showWidget?.()`)
let widgetPage
for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 100))
  widgetPage = (await pages()).find((page) => page.url.endsWith('/live-widget.html'))
  if (widgetPage) {
    const probe = await connect(widgetPage)
    const panelCount = await evaluate(probe, `document.querySelectorAll('[data-widget-panel]').length`)
    await disconnect(probe)
    if (panelCount === 4) break
  }
}
if (!widgetPage) throw new Error('首页预览入口未打开桌面悬浮组件')
const widget = await connect(widgetPage)
let widgetState
for (let attempt = 0; attempt < 20; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 100))
  widgetState = await evaluate(widget, `({
    ready:document.readyState,
    panelCount:document.querySelectorAll('[data-widget-panel]').length,
    settingsAction:document.querySelector('#widget-state-action')?.textContent?.trim(),
    previewAction:document.querySelector('#widget-state-preview')?.textContent?.trim()
  })`)
  if (['interactive', 'complete'].includes(widgetState.ready) && widgetState.panelCount === 4 && widgetState.previewAction === '预览互动效果') break
}
if (!['interactive', 'complete'].includes(widgetState.ready) || widgetState.panelCount !== 4 || widgetState.settingsAction !== '打开直播设置' || widgetState.previewAction !== '预览互动效果') {
  throw new Error(`桌面悬浮组件预览状态异常：${JSON.stringify(widgetState)}`)
}
const previewState = await evaluate(widget, `(async () => {
  const settingsAction = document.querySelector('#widget-state-action')
  const previewAction = document.querySelector('#widget-state-preview')
  const settingsRect = settingsAction?.getBoundingClientRect()
  const previewRect = previewAction?.getBoundingClientRect()
  previewAction?.click()
  await new Promise((resolve) => setTimeout(resolve, 300))
  return {
    previewBelow:Boolean(settingsRect && previewRect && previewRect.top >= settingsRect.bottom + 4),
    gridVisible:!document.querySelector('.widget-grid')?.hidden,
    liveRows:document.querySelector('#live-feed')?.children.length || 0,
    aiRows:document.querySelector('#ai-feed')?.children.length || 0,
    actionRows:document.querySelector('#action-feed')?.children.length || 0
  }
})()`)
await disconnect(widget)
if (!previewState.previewBelow || !previewState.gridVisible || previewState.liveRows < 1 || previewState.aiRows < 1 || previewState.actionRows < 1) {
  throw new Error(`桌面悬浮组件互动预览异常：${JSON.stringify(previewState)}`)
}
const settingsState = await evaluate(settings, `(async () => {
  document.querySelector('[data-tab="avatar"]')?.click()
  document.querySelector('[data-panel="avatar"]')?.classList.add('active')
  const unavailableCards = [...document.querySelectorAll('[data-avatar-unavailable]')]
  const unavailableCardShape = unavailableCards.length === 2 && unavailableCards.every((card) => card.tagName === 'BUTTON' && card.getAttribute('aria-disabled') === 'true')
  const unavailableDialog = document.querySelector('#avatar-unavailable-dialog')
  unavailableCards[0]?.click()
  await new Promise((resolve) => setTimeout(resolve, 30))
  const unavailableDialogOpened = Boolean(unavailableDialog?.open) && unavailableDialog?.querySelector('h3')?.textContent?.trim() === '暂未完成'
  unavailableDialog?.close()
  document.querySelector('[data-tab="general"]')?.click()
  document.querySelector('[data-panel="general"]')?.classList.add('active')
  const toggleRow = document.querySelector('[data-panel="general"] .toggle-row')
  const toggleInput = toggleRow?.querySelector('input[type="checkbox"]')
  const toggleBefore = Boolean(toggleInput?.checked)
  toggleRow?.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:1, clientY:1 }))
  const blankRowDoesNotToggle = Boolean(toggleInput) && toggleInput.checked === toggleBefore
  document.querySelector('[data-tab="ai"]')?.click()
  // DevTools clicks do not always advance a hidden native window's paint cycle.
  // Make the inspected panel explicit so geometry below reflects the AI form.
  document.querySelector('[data-panel="ai"]')?.classList.add('active')
  await new Promise((resolve) => setTimeout(resolve, 100))
  const aiGrid = document.querySelector('[data-panel="ai"] .field-grid.three')
  const aiInputs = [...document.querySelectorAll('[data-panel="ai"] .field input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), [data-panel="ai"] .field select')]
  return {
    ready:document.readyState,
    transparentHitThrough:Boolean(document.querySelector('[name="transparentHitThrough"]')),
    pettingEnabled:Boolean(document.querySelector('[name="pettingEnabled"]')),
    pettingSensitivity:Boolean(document.querySelector('[name="pettingSensitivity"]')),
    tossEnabled:Boolean(document.querySelector('[name="tossEnabled"]')),
    tossStrength:Boolean(document.querySelector('[name="tossStrength"]')),
    actionButtons:document.querySelectorAll('[data-test-action]').length,
    unavailableCardShape,
    unavailableDialogOpened,
    blankRowDoesNotToggle,
    themeToggle:Boolean(document.querySelector('#theme-toggle')),
    languageToggleRemoved:!document.querySelector('#language-toggle'),
    noHorizontalOverflow:document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    actionAssignmentIdsRemoved:document.querySelectorAll('[data-panel="assign"] .idle-check small').length === 0,
    aiFieldsReflowed:Boolean(aiGrid) && getComputedStyle(aiGrid).gridTemplateColumns.trim().split(/\\s+/).length <= 2,
    aiControlsPresent:aiInputs.length > 0,
    readableInputText:(() => {
      const input = document.querySelector('input:not([type="checkbox"]):not([type="range"])')
      if (!input) return false
      const style = getComputedStyle(input)
      return style.color !== 'rgba(0, 0, 0, 0)' && style.caretColor !== 'rgba(0, 0, 0, 0)'
    })()
  }
})()`)
await disconnect(settings)
await disconnect(pet)

if (!['interactive', 'complete'].includes(settingsState.ready) || Object.entries(settingsState).some(([key, value]) => key !== 'ready' && key !== 'actionButtons' && !value)) {
  throw new Error(`设置页交互控件不完整：${JSON.stringify(settingsState)}`)
}

console.log(JSON.stringify({ pet:petState, hoverPettingText, pettingText, widget:widgetState, preview:previewState, settings:settingsState }, null, 2))
