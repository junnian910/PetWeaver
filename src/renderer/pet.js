import { actionDefinitions, getAction } from '../main/core/action-registry.js'
import { createPetRenderer, VIDEO_CROSSFADE_MS } from './pet-renderer.js'
import { createPetGesture, createPetStroke, petRegionAt, releaseVelocity, updatePetGesture, updatePetStroke } from './pet-gesture.js'
import { createVoiceCapture } from './voice-capture.js'
import { createTtsLifecycle } from './tts-lifecycle.js'

const stage = document.querySelector('#stage')
const stack = document.querySelector('#pet-stack')
const bubble = document.querySelector('#bubble')
const listeningBubble = document.querySelector('#listening-bubble')
const startupNotice = document.querySelector('#startup-error')
const fallbackImages = [document.querySelector('#pet-image'), document.querySelector('#pet-image-next')]
const videoLayers = [...document.querySelectorAll('.pet-video-layer')]
const builtInExpressionSources = {
  neutral: `${import.meta.env.BASE_URL}assets/fafa-pet-final.png`,
  happy: `${import.meta.env.BASE_URL}assets/expressions/happy.png`,
  angry: `${import.meta.env.BASE_URL}assets/expressions/angry.png`,
  sad: `${import.meta.env.BASE_URL}assets/expressions/sad.png`,
  sleep: `${import.meta.env.BASE_URL}assets/expressions/sleep.png`,
  tossAirborne: `${import.meta.env.BASE_URL}assets/expressions/toss-airborne.png`,
  tossGrabbed: `${import.meta.env.BASE_URL}assets/expressions/toss-grabbed.png`,
  tossLanded: `${import.meta.env.BASE_URL}assets/expressions/toss-landed.png`
}

let config = await window.fafa.config.get()
let activePetPackage = await window.fafa.petPackages?.active?.().catch(() => null)
let expressionSources = expressionSourcesFor(activePetPackage)
let activeFallbackLayer = 0
let fallbackSwapToken = 0
let fallbackSource = expressionSources.neutral
let fallbackHideTimer = null
let bubbleTimer = null
let gesture = null
let pointerPassThrough = false
let physicsPhase = 'idle'
let physicsRecoverTimer = null
let playRequestToken = 0
let schedulerBusy = false
let startupNoticeTimer = null

function packageAssetUrl(petPackage, asset) {
  const value = String(asset || '')
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/')) return value
  if (petPackage?.source === 'external') return `${petPackage.assetBase || ''}${value}`
  return `${import.meta.env.BASE_URL}${value}`
}

function expressionSourcesFor(petPackage) {
  const configured = petPackage?.expressions || {}
  const neutral = configured.neutral ? packageAssetUrl(petPackage, configured.neutral) : builtInExpressionSources.neutral
  return Object.fromEntries(Object.keys(builtInExpressionSources).map((name) => [
    name,
    configured[name] ? packageAssetUrl(petPackage, configured[name]) : neutral
  ]))
}

function packageActionResolver(petPackage) {
  if (!petPackage?.actions) return undefined
  return (actionId) => {
    const requested = getAction(actionId) || getAction('idle_breath')
    const fallbackId = petPackage.renderer?.fallbackAction || 'idle_breath'
    let selectedId = petPackage.actions[requested.id] ? requested.id : fallbackId
    const visited = new Set()
    while (petPackage.actions[selectedId]?.assetAvailable === false && petPackage.actions[selectedId]?.fallback && !visited.has(selectedId)) {
      visited.add(selectedId)
      selectedId = petPackage.actions[selectedId].fallback
    }
    const packageAction = petPackage.actions[selectedId]
    const playableSemantic = getAction(selectedId) || getAction('idle_breath')
    if (!packageAction || !playableSemantic) return null
    const path = packageAssetUrl(petPackage, packageAction.asset)
    return {
      requested: { ...requested, assetStatus: petPackage.actions[requested.id] ? 'available' : 'pending' },
      playable: { ...playableSemantic, videoPath: path, loop: packageAction.loop === true },
      path
    }
  }
}

function showStartupNotice(message, { sticky = false } = {}) {
  const line = startupNotice.querySelector('span')
  if (line && message) line.textContent = message
  startupNotice.classList.add('visible')
  clearTimeout(startupNoticeTimer)
  startupNoticeTimer = null
  if (!sticky) startupNoticeTimer = setTimeout(() => startupNotice.classList.remove('visible'), 5000)
}
function hideStartupNotice() {
  clearTimeout(startupNoticeTimer)
  startupNoticeTimer = null
  startupNotice.classList.remove('visible')
}

const ttsLifecycle = createTtsLifecycle({ stopAudio: (player) => player.pause?.() })

fallbackImages[0].dataset.source = fallbackSource
fallbackImages[0].src = fallbackSource
fallbackImages[0].classList.add('visible')
if (fallbackImages[0].complete && fallbackImages[0].naturalWidth) stack.classList.add('layout-ready')
else fallbackImages[0].addEventListener('load', () => stack.classList.add('layout-ready'), { once: true })
const initialDisplayName = String(activePetPackage?.displayName || '桌宠')
document.title = `${initialDisplayName}桌宠`
stage.setAttribute('aria-label', `${initialDisplayName}桌宠`)
fallbackImages[0].alt = initialDisplayName
if (activePetPackage?.warning) showStartupNotice(activePetPackage.warning, { sticky: true })

function setFallbackSource(source, { immediate = false } = {}) {
  clearTimeout(fallbackHideTimer)
  fallbackHideTimer = null
  const nextSource = source || expressionSources.neutral
  const current = fallbackImages[activeFallbackLayer]
  fallbackSource = nextSource
  if (current.dataset.source === nextSource && current.complete) {
    current.classList.add('visible')
    fallbackImages.filter((image) => image !== current).forEach((image) => image.classList.remove('visible'))
    videoLayers.forEach((video) => { video.pause(); video.classList.remove('visible') })
    if (immediate) stack.classList.add('layout-ready')
    return
  }
  const nextIndex = 1 - activeFallbackLayer
  const next = fallbackImages[nextIndex]
  const token = ++fallbackSwapToken
  next.classList.remove('visible')
  next.dataset.source = nextSource
  next.src = nextSource
  const reveal = () => {
    if (token !== fallbackSwapToken) return
    next.classList.add('visible')
    current.classList.remove('visible')
    videoLayers.forEach((video) => { video.pause(); video.classList.remove('visible') })
    activeFallbackLayer = nextIndex
    stack.classList.add('layout-ready')
  }
  if (next.complete && next.naturalWidth) reveal()
  else next.addEventListener('load', reveal, { once: true })
}

const renderer = createPetRenderer({
  container: stack,
  layers: videoLayers,
  assetBase: import.meta.env.BASE_URL,
  actionResolver: packageActionResolver(activePetPackage),
  onPhysicsPhase: (phase) => {
    if (phase === 'airborne' || phase === 'impact') setFallbackSource(expressionSources.tossAirborne, { immediate: true })
    if (phase === 'landed') {
      setFallbackSource(expressionSources.tossLanded, { immediate: true })
      clearTimeout(physicsRecoverTimer)
      physicsRecoverTimer = setTimeout(() => {
        if (physicsPhase !== 'landed') return
        physicsPhase = 'idle'
        window.fafa.window.setPhysicsPhase?.('idle')
        returnToIdle()
      }, 360)
    }
  },
  onLive2DUnavailable: (reason) => {
    showStartupNotice(`${reason}，已回退到视频渲染。`)
  }
})

async function reloadPetPackage() {
  const next = await window.fafa.petPackages?.active?.().catch(() => null)
  activePetPackage = next
  expressionSources = expressionSourcesFor(next)
  renderer.setActionResolver?.(packageActionResolver(next))
  const displayName = String(next?.displayName || '桌宠')
  document.title = `${displayName}桌宠`
  stage.setAttribute('aria-label', `${displayName}桌宠`)
  fallbackImages[0].alt = displayName
  setFallbackSource(expressionSources.neutral, { immediate: true })
  if (next?.warning) showStartupNotice(next.warning, { sticky: true })
  if ((config.avatar?.mode || 'video') === 'video' && physicsPhase === 'idle') {
    void playVideoAction('idle_breath', { loop: true, fadeMs: 260 })
  }
}

function playVideoAction(actionId, options = {}) {
  const requestToken = ++playRequestToken
  return renderer.play(actionId, options).then((ready) => {
    if (requestToken !== playRequestToken) return false
    if (ready && physicsPhase === 'idle') {
      hideStartupNotice()
      clearTimeout(fallbackHideTimer)
      fallbackHideTimer = setTimeout(() => {
        if (requestToken !== playRequestToken || physicsPhase !== 'idle') return
        fallbackImages.forEach((image) => image.classList.remove('visible'))
        fallbackHideTimer = null
      }, VIDEO_CROSSFADE_MS)
      stack.classList.add('layout-ready')
    } else if (!ready) {
      setFallbackSource(expressionSources.neutral, { immediate: true })
      showStartupNotice('视频动作暂不可用，角色已回退到待机画面。')
    }
    return ready
  })
}

function layout() {
  const scale = Number(config.scale || .52) / .52
  renderer.setScale(scale)
  const unscaledHeadY = stage.clientHeight - Math.min(stage.clientWidth, stage.clientHeight) + Math.min(stage.clientWidth, stage.clientHeight) * (53 / 1254)
  const scaledHeadY = stage.clientHeight + (unscaledHeadY - stage.clientHeight) * scale
  const bubbleBottom = Math.max(70, Math.min(stage.clientHeight - 100, stage.clientHeight - scaledHeadY + 8))
  const bubbleWidth = Math.max(190, Math.min(320, 260 * Math.max(.8, Math.min(1.2, scale))))
  bubble.style.setProperty('--bubble-bottom', `${bubbleBottom}px`)
  bubble.style.setProperty('--bubble-width', `${bubbleWidth}px`)
  stack.classList.add('layout-ready')
}

function say(text) {
  if (!text) return
  bubble.textContent = text
  bubble.classList.add('visible')
  clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), 5_000)
}

function expressionForAction(actionId) { return getAction(actionId)?.expression || 'neutral' }
function windowApi() { return import.meta.env.DEV && window.__fafaSmokeWindowApi ? window.__fafaSmokeWindowApi : window.fafa.window }

/* ---- 形象模式切换：视频 / 导入的 Live2D 贴图预览 / VTube Studio 外部窗口 ---- */
async function applyAvatarMode() {
  const mode = config.avatar?.mode || 'video'
  stage.classList.toggle('avatar-vts', mode === 'vts')
  if (mode === 'video') {
    if (physicsPhase === 'idle') void playVideoAction('idle_breath', { loop: true, fadeMs: 260 })
    return
  }
  if (mode === 'vts') {
    videoLayers.forEach((video) => { video.pause(); video.classList.remove('visible') })
    fallbackImages.forEach((image) => image.classList.remove('visible'))
    setPointerPassThrough(true)
    showStartupNotice('VTube Studio 模式：请在 VTube Studio 中显示角色，发发窗口只保留气泡和提示。')
    return
  }
  // Live2D 模式当前只做静态贴图预览，完整 Cubism 渲染 SDK 尚未接入。
  const preview = await window.fafa.avatar?.previewImage?.().catch(() => null)
  if (preview?.dataUrl) {
    videoLayers.forEach((video) => { video.pause(); video.classList.remove('visible') })
    setFallbackSource(preview.dataUrl, { immediate: true })
    showStartupNotice('Live2D 模型已载入（当前为贴图预览）。')
  } else {
    showStartupNotice('Live2D 模型未选择或没有可用贴图，仍使用视频动作。')
    if (physicsPhase === 'idle') void playVideoAction('idle_breath', { loop: true, fadeMs: 260 })
  }
}

// 动作结束后直接以“轻微模糊 → 清晰”的方式回到待机，避免滑入遮罩造成突兀位移。
function returnToIdle() {
  void playVideoAction('idle_breath', { loop: true, fadeMs: 260, restart: false })
}

function restoreAfterAudio(completed) {
  if (physicsPhase !== 'idle') return
  const restoringIdle = completed.resumeActionId === 'idle_breath'
  renderer.setExpression(restoringIdle ? 'neutral' : expressionForAction(completed.actionId))
  if (restoringIdle) { returnToIdle(); return }
  void playVideoAction(completed.resumeActionId, {
    loop: completed.resumeLoop,
    schedulerId: completed.instanceId
  })
}

function playAudio({ instanceId, audio }) {
  if (!audio?.value || !ttsLifecycle.canStartAudio(instanceId)) return
  const player = new Audio(audio.value)
  player.volume = Number(config.volume ?? .8)
  player.playbackRate = Number(config.tts?.speed ?? 1) || 1
  if (!ttsLifecycle.acceptAudio(instanceId, player)) return
  const finish = () => {
    const completed = ttsLifecycle.finishAudio(instanceId, player, { schedulerBusy })
    if (completed) restoreAfterAudio(completed)
  }
  player.addEventListener('ended', finish, { once: true })
  player.addEventListener('error', finish, { once: true })
  let playback
  try {
    playback = player.play?.()
  } catch {
    finish()
    return
  }
  const started = () => {
    const result = ttsLifecycle.markAudioPlaying(instanceId, player)
    if (result?.enterTalking && physicsPhase === 'idle') {
      void playVideoAction('state_talking', { loop: true, schedulerId: instanceId })
    }
  }
  if (playback?.then) playback.then(started, finish)
  else started()
}

layout()
addEventListener('resize', layout)
void playVideoAction('idle_breath', { loop: true })
void applyAvatarMode()

// 麦克风响度采集：按配置启停，响度以约 15Hz 节流上报主进程驱动语音反应。
let voiceCapture = null
let voiceCaptureErrorShown = false
let pushToTalkActive = false
function applyVoiceCapture() {
  voiceCapture?.stop()
  voiceCapture = null
  window.fafa.voice?.pcmEnd?.()
  const voice = config.voice
  if (!voice || !voice.enabled) return
  const asrEnabled = Boolean(config.asr?.enabled)
  let lastSentAt = 0
  voiceCapture = createVoiceCapture({
    deviceId: voice.deviceId || '',
    onLevel: (level) => {
      const now = performance.now()
      if (now - lastSentAt < 66) return
      lastSentAt = now
      window.fafa.voice.level(level * 100)
    },
    onPcm16k: asrEnabled ? (chunk) => { if (pushToTalkActive) window.fafa.voice.pcm(chunk) } : null,
    onError: () => {
      if (voiceCaptureErrorShown) return
      voiceCaptureErrorShown = true
      showStartupNotice('麦克风不可用或未授权，声音互动未启动。')
    }
  })
  void voiceCapture.start().catch(() => {})
}
applyVoiceCapture()
window.fafa.voice?.onPushToTalk?.(({ active } = {}) => {
  const next = Boolean(active)
  if (pushToTalkActive === next) return
  pushToTalkActive = next
  listeningBubble?.classList.toggle('visible', next)
  if (!next) window.fafa.voice?.pcmEnd?.()
})

window.fafa.pet.onAction((action) => {
  const entry = getAction(action.actionId) || getAction('idle_breath')
  const hasDedicatedVideo = Boolean(activePetPackage?.actions?.[entry.id]?.asset)
  schedulerBusy = true
  ttsLifecycle.beginAction({
    instanceId: action.instanceId,
    actionId: entry.id,
    hasDedicatedVideo,
    loop: entry.loop
  })
  if (physicsPhase !== 'idle') return
  say(action.text)
  renderer.setExpression(expressionForAction(entry.id))
  void playVideoAction(entry.id, { ...action, loop: entry.loop })
})
window.fafa.pet.onAudio(({ instanceId, audio }) => {
  playAudio({ instanceId, audio })
})
window.fafa.pet.onIdle(() => {
  schedulerBusy = false
  if (physicsPhase !== 'idle') return
  if (ttsLifecycle.hasActiveAudio()) return
  renderer.setExpression('neutral')
  returnToIdle()
})
window.fafa.config.onChanged((next) => {
  const previous = config
  config = next
  if (next.clickThrough || !next.interaction?.transparentHitThrough) setPointerPassThrough(false)
  layout()
  const voiceChanged = previous.voice?.enabled !== next.voice?.enabled || previous.voice?.deviceId !== next.voice?.deviceId || previous.asr?.enabled !== next.asr?.enabled
  if (!next.voice?.enabled || !next.asr?.enabled) {
    pushToTalkActive = false
    listeningBubble?.classList.remove('visible')
  }
  if (voiceChanged) applyVoiceCapture()
  const petPackageChanged = previous.pet?.activePackageId !== next.pet?.activePackageId
  if (petPackageChanged) void reloadPetPackage()
  const avatarChanged = previous.avatar?.mode !== next.avatar?.mode || previous.avatar?.live2d?.activeModelId !== next.avatar?.live2d?.activeModelId || previous.avatar?.vtubeStudio?.enabled !== next.avatar?.vtubeStudio?.enabled
  if (avatarChanged) void applyAvatarMode()
})
window.fafa.window.onTossPhase((phase) => {
  physicsPhase = phase
  renderer.setPhysicsPhase(phase)
  window.fafa.window.setPhysicsPhase?.(phase)
})

// 贴边收纳：主进程判定贴边后发 docked；双击图标恢复。
let docked = false
window.fafa.window.onDock?.(({ edge } = {}) => {
  docked = true
  stage.classList.add('docked')
  stage.dataset.dockEdge = String(edge || '')
})
window.fafa.window.onUndock?.(() => {
  docked = false
  stage.classList.remove('docked')
  delete stage.dataset.dockEdge
})

// 设置页角色尺寸滑条拖动时的实时预览（不写配置，松手自动保存才落盘）
window.fafa.window.onPreviewScale?.((scale) => renderer.setScale(scale))

const hitCanvas = document.createElement('canvas')
hitCanvas.width = 1
hitCanvas.height = 1
const hitContext = hitCanvas.getContext('2d', { willReadFrequently: true })
function visiblePetLayer() {
  return [...document.querySelectorAll('.pet-layer.visible')].reverse().find((layer) => getComputedStyle(layer).opacity !== '0')
}

function layerGeometry(layer, sourceWidth, sourceHeight) {
  const rect = layer.getBoundingClientRect()
  const style = getComputedStyle(layer)
  const scaleX = Math.max(.01, Number(style.getPropertyValue('--pose-scale-x')) || 1)
  const scaleY = Math.max(.01, Number(style.getPropertyValue('--pose-scale-y')) || 1)
  const fit = Math.min(rect.width / scaleX / sourceWidth, rect.height / scaleY / sourceHeight)
  const renderedWidth = sourceWidth * fit * scaleX
  const renderedHeight = sourceHeight * fit * scaleY
  return { rect, fit, scaleX, scaleY, left: rect.left + (rect.width - renderedWidth) / 2, top: rect.bottom - renderedHeight, renderedWidth, renderedHeight }
}

function sourceSize(layer) {
  return layer instanceof HTMLVideoElement ? { width: layer.videoWidth, height: layer.videoHeight } : { width: layer.naturalWidth, height: layer.naturalHeight }
}

function hitsPet(clientX, clientY) {
  const layer = visiblePetLayer()
  if (!layer || !hitContext) return false
  const { width, height } = sourceSize(layer)
  if (!width || !height) return false
  const geometry = layerGeometry(layer, width, height)
  if (clientX < geometry.left || clientX >= geometry.left + geometry.renderedWidth || clientY < geometry.top || clientY >= geometry.top + geometry.renderedHeight) return false
  const facing = Number(getComputedStyle(stack).getPropertyValue('--facing')) < 0 ? -1 : 1
  const localX = Math.min(width - 1, Math.max(0, Math.floor((clientX - geometry.left) / (geometry.fit * geometry.scaleX))))
  const sourceX = facing < 0 ? width - 1 - localX : localX
  const sourceY = Math.min(height - 1, Math.max(0, Math.floor((clientY - geometry.top) / (geometry.fit * geometry.scaleY))))
  try {
    hitContext.clearRect(0, 0, 1, 1)
    hitContext.drawImage(layer, sourceX, sourceY, 1, 1, 0, 0, 1, 1)
    return hitContext.getImageData(0, 0, 1, 1).data[3] >= 24
  } catch { return false }
}

function interactionHit(clientX, clientY) {
  return hitsPet(clientX, clientY)
}

function setPointerPassThrough(enabled) {
  const next = Boolean(enabled && config.interaction?.transparentHitThrough && !config.clickThrough && !gesture)
  if (next === pointerPassThrough) return
  pointerPassThrough = next
  windowApi().setPointerPassThrough(next)
}

function beginWindowDrag() {
  if (!gesture || gesture.windowDragging) return
  // state_move is reserved for a future autonomous/programmatic movement
  // source. Ordinary drag and toss keep the current video, frame, and scale.
  gesture.windowDragging = true
  stage.classList.add('dragging')
  // Grabbing the pet cancels an in-flight toss. The main process clears its
  // physics timer on drag-start, so reset our phase here too — otherwise the
  // airborne fallback image and the physics gate would stay stuck forever.
  if (physicsPhase !== 'idle') {
    physicsPhase = 'idle'
    clearTimeout(physicsRecoverTimer)
    physicsRecoverTimer = null
    renderer.setPhysicsPhase('idle')
    window.fafa.window.setPhysicsPhase?.('idle')
  }
  // A normal drag never changes the video, scale, container transform, or
  // toss expression. The main process only follows the cursor.
  windowApi().startDrag()
}

// 悬停命中检测按帧节流：穿透转发模式下鼠标在整个屏幕移动都会触发 pointermove，
// 不节流会让命中计算与视频解码互相抢占主线程，表现为摆动中突然卡一下。
let lastPointerPosition = { x: 0, y: 0, timeStamp: 0 }
let hoverCheckFrame = 0
let hoverStroke = null
let lastHoverPetAt = 0
const HOVER_PET_COOLDOWN_MS = 900
function trackHoverPetting(point) {
  const hit = interactionHit(point.x, point.y)
  const rect = visiblePetLayer()?.getBoundingClientRect()
  const region = petRegionAt(point.x, point.y, rect)
  const strokePoint = { clientX: point.x, clientY: point.y, timeStamp: point.timeStamp }
  const staysInActiveRegion = Boolean(hoverStroke && hoverStroke.region === region)
  if ((!hit && !staysInActiveRegion) || (region !== 'head' && region !== 'belly') || config.interaction?.pettingEnabled === false) {
    hoverStroke = null
    return
  }
  if (!hoverStroke || hoverStroke.region !== region) {
    hoverStroke = createPetStroke(strokePoint)
    hoverStroke.region = region
    return
  }
  const now = Number(point.timeStamp) || performance.now()
  if (lastHoverPetAt && now - lastHoverPetAt < HOVER_PET_COOLDOWN_MS) return
  if (!updatePetStroke(hoverStroke, strokePoint, config.interaction)) return
  lastHoverPetAt = now
  if (region === 'belly') triggerAssigned('belly', 'emo_shy', '别、别挠我肚子啦！')
  else triggerAssigned('petting', 'emo_happy', '好舒服呀，再摸摸～')
  hoverStroke = null
}
function queueHoverCheck() {
  if (hoverCheckFrame) return
  hoverCheckFrame = requestAnimationFrame(() => {
    hoverCheckFrame = 0
    if (gesture) return
    const hit = interactionHit(lastPointerPosition.x, lastPointerPosition.y)
    stage.classList.toggle('pet-hover', hit)
    setPointerPassThrough(!hit)
  })
}

stage.addEventListener('dragstart', (event) => event.preventDefault())
function assignedPool(group) {
  const list = Array.isArray(config.actionAssign?.[group]) ? config.actionAssign[group] : []
  return list.filter((id) => actionDefinitions().some((a) => a.id === id && a.enabled !== false))
}
function pickAssigned(group, fallback) {
  const pool = assignedPool(group)
  if (!pool.length) return fallback
  return pool[Math.floor(Math.random() * pool.length)]
}
function triggerAssigned(group, fallback, text) {
  window.fafa.pet.trigger(pickAssigned(group, fallback), text)
}

stage.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !interactionHit(event.clientX, event.clientY)) return
  const restoredFromDock = docked
  // 贴边收纳后仍然可以直接按住小图标拖出来，不必先双击恢复。
  if (docked) {
    window.fafa.window.undock?.()
    docked = false
    stage.classList.remove('docked')
    delete stage.dataset.dockEdge
  }
  setPointerPassThrough(false)
  hoverStroke = null
  const rect = visiblePetLayer()?.getBoundingClientRect()
  const region = petRegionAt(event.clientX, event.clientY, rect)
  gesture = createPetGesture(event, { head: region === 'head', belly: region === 'belly' })
  gesture.region = region
  gesture.suppressClick = restoredFromDock
  stage.setPointerCapture(event.pointerId)
  event.preventDefault()
})
stage.addEventListener('pointermove', (event) => {
  lastPointerPosition = { x: event.clientX, y: event.clientY, timeStamp: event.timeStamp }
  if (!gesture) {
    trackHoverPetting(lastPointerPosition)
    queueHoverCheck()
    return
  }
  if (event.pointerId !== gesture.pointerId) return
  const result = updatePetGesture(gesture, event, config.interaction)
  if (result === 'drag-start') beginWindowDrag()
  if (result === 'pet') {
    if (gesture.region === 'belly') triggerAssigned('belly', 'emo_shy', '别、别挠我肚子啦！')
    else triggerAssigned('petting', 'emo_happy', '好舒服呀，再摸摸～')
  }
})

function cancelGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return
  const finished = gesture
  gesture = null
  stage.classList.remove('dragging')
  if (finished.windowDragging) windowApi().endDrag()
  // pointercancel only cancels. It never starts a toss or a landed phase.
  setPointerPassThrough(!interactionHit(event.clientX, event.clientY))
}

function finishGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return
  const finished = gesture
  gesture = null
  stage.classList.remove('dragging')
  if (finished.windowDragging) {
    windowApi().endDrag()
    if (config.interaction?.tossEnabled) {
      const velocity = releaseVelocity(finished, event, config.interaction.tossStrength)
      if (velocity.vx || velocity.vy) {
        renderer.setFacing(velocity.vx < 0 ? -1 : 1)
        windowApi().toss(velocity.vx, velocity.vy)
      }
    }
  } else if (!finished.petted && !finished.windowDragging && !finished.suppressClick) {
    // Every single click uses the click assignment, including head and belly.
    // Petting is emitted only after an actual back-and-forth stroke.
    triggerAssigned('click', 'act_stretch', '呀，被拍了一下！')
  }
  setPointerPassThrough(!interactionHit(event.clientX, event.clientY))
}

stage.addEventListener('pointerup', finishGesture)
stage.addEventListener('pointercancel', cancelGesture)
document.addEventListener('pointerup', finishGesture, true)
document.addEventListener('pointercancel', cancelGesture, true)
stage.addEventListener('pointerleave', () => {
  if (!gesture) {
    hoverStroke = null
    stage.classList.remove('pet-hover')
    setPointerPassThrough(true)
  }
})
stage.addEventListener('pointerenter', (event) => {
  if (gesture) return
  lastPointerPosition = { x: event.clientX, y: event.clientY, timeStamp: event.timeStamp }
  queueHoverCheck()
})
stage.addEventListener('contextmenu', (event) => { event.preventDefault(); if (interactionHit(event.clientX, event.clientY)) window.fafa.window.showPetMenu() })

// Make the transparent part of a freshly opened pet window pass mouse input
// through immediately; a later pointer move switches it off only on alpha pixels.
setPointerPassThrough(true)

// Keep the registry available to devtools smoke checks without exposing any
// additional privileged API.
window.__fafaActionCount = actionDefinitions().length
