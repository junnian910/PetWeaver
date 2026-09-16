// 直播悬浮组件：三列事件/AI/动作，右侧关系状态；只读展示。
const liveFeed = document.getElementById('live-feed')
const aiFeed = document.getElementById('ai-feed')
const actionFeed = document.getElementById('action-feed')
const meta = document.getElementById('widget-meta')
const foot = document.getElementById('widget-foot')
const dot = document.getElementById('status-dot')
const widget = document.querySelector('.widget')
const widgetGrid = document.querySelector('.widget-grid')
const widgetState = document.getElementById('widget-state')
const widgetStateKicker = document.getElementById('widget-state-kicker')
const widgetStateTitle = document.getElementById('widget-state-title')
const widgetStateDescription = document.getElementById('widget-state-description')
const widgetStateAction = document.getElementById('widget-state-action')
const widgetStatePreview = document.getElementById('widget-state-preview')
const mergeButton = document.getElementById('widget-merge')
const counts = { live: document.getElementById('live-count'), ai: document.getElementById('ai-count'), action: document.getElementById('action-count') }
const MAX_ITEMS = 80
let latestStatus = { live: 'disconnected' }
let hasRealtimeActivity = false
let previewing = false
const detachedPanel = new URLSearchParams(location.search).get('panel') || ''

if (detachedPanel) {
  document.body.classList.add('is-detached-widget')
  mergeButton.hidden = false
  document.getElementById('widget-close').hidden = true
}

function applyWidgetLayout({ detached = [] } = {}) {
  const detachedPanels = new Set(Array.isArray(detached) ? detached : [])
  for (const panel of document.querySelectorAll('[data-widget-panel]')) {
    const key = panel.dataset.widgetPanel
    panel.hidden = detachedPanel ? key !== detachedPanel : detachedPanels.has(key)
  }
}

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])) }
function clock(at) { const date = new Date(Number(at) || Date.now()); return date.toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 8) }
function color(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? '#' + number.toString(16).padStart(6, '0') : '' }

const labels = new Map()
window.fafa.pet.actions().then((list) => { for (const entry of list || []) labels.set(entry.id, entry.label) }).catch(() => {})
const STATUS_TEXT = { connected: '已连接直播间', connecting: '正在连接直播间…', reconnecting: '正在重连直播间…', mock: '模拟测试模式', error: '连接出错', disabled: '未开启直播连接', disconnected: '未连接直播间' }
const BADGES = { danmaku: '弹幕', gift: '礼物', superChat: 'SC', guard: '上舰', enter: '进场', status: '连接' }

function setDot(status) {
  dot.className = 'dot'
  if (status === 'connected') dot.classList.add('connected')
  else if (status === 'mock') dot.classList.add('mock')
  else if (status === 'connecting' || status === 'reconnecting') dot.classList.add('reconnecting')
  else if (status === 'error') dot.classList.add('error')
}
function renderWidgetState() {
  const live = latestStatus?.live || 'disconnected'
  const hasActivity = hasRealtimeActivity || previewing
  let state = 'disconnected'
  let kicker = '直播互动'
  let title = '连接直播间后，实时互动会显示在这里'
  let description = '完成直播连接后，发发会展示弹幕、AI 回答与触发动作。'
  let action = '打开直播设置'
  let actionVisible = true

  if (previewing) {
    state = 'live'
    actionVisible = false
  } else if (live === 'connecting' || live === 'reconnecting') {
    state = 'connecting'
    kicker = live === 'reconnecting' ? '正在恢复连接' : '正在建立连接'
    title = live === 'reconnecting' ? '正在重新连接直播间' : '正在连接直播间'
    description = '连接完成后，实时互动会自动显示在这里。'
    action = '查看直播设置'
  } else if (live === 'connected' || live === 'mock') {
    if (latestStatus?.livePaused) {
      state = 'ready'
      kicker = '直播互动已暂停'
      title = '已暂停接收新的互动'
      description = '恢复直播互动后，新的弹幕、礼物和动作会继续显示在这里。'
      action = '查看直播设置'
    } else if (hasActivity) {
      state = 'live'
      actionVisible = false
    } else {
      state = 'ready'
      kicker = live === 'mock' ? '模拟测试模式' : '直播连接正常'
      title = '已经准备好，等待第一条互动'
      description = '收到弹幕、礼物或 SC 后，发发的回应与动作会按时间显示。'
      actionVisible = false
    }
  } else if (live === 'error') {
    state = 'error'
    kicker = '连接需要检查'
    title = '暂时无法连接直播间'
    description = '检查房间号和连接配置后，再尝试重新连接。'
    action = '打开直播设置'
  }

  widget.dataset.state = state
  widgetState.hidden = detachedPanel || state === 'live'
  widgetGrid.hidden = detachedPanel ? false : state !== 'live'
  foot.hidden = detachedPanel || state !== 'live'
  widgetStateKicker.textContent = kicker
  widgetStateTitle.textContent = title
  widgetStateDescription.textContent = description
  widgetStateAction.textContent = action
  widgetStateAction.hidden = !actionVisible
  widgetStatePreview.hidden = !actionVisible
}
function renderStatus(status) {
  const previousLive = latestStatus?.live
  latestStatus = status || latestStatus
  const live = latestStatus?.live || 'disconnected'
  if ((live === 'connected' && previousLive !== 'connected') || (live === 'mock' && previousLive !== 'mock') || ['disabled', 'disconnected', 'error'].includes(live)) hasRealtimeActivity = false
  setDot(live)
  const parts = [STATUS_TEXT[live] || live]
  if (latestStatus?.livePaused) parts.push('已暂停')
  if (latestStatus?.currentTrack) parts.push('点歌：' + latestStatus.currentTrack)
  if (latestStatus?.lotteryParticipants > 0) parts.push('抽奖 ' + latestStatus.lotteryParticipants + ' 人')
  meta.textContent = parts.join(' · ')
  renderWidgetState()
}
function statusText(event) {
  if (event.status === 'reconnecting') return '重连中（' + Math.round((event.delay || 0) / 1000) + ' 秒后重试）'
  if (event.status === 'connected') return event.mode === 'mock' ? '已进入模拟测试模式' : '已连接直播间'
  if (event.status === 'error') return '连接出错' + (event.message ? '：' + event.message : '')
  return STATUS_TEXT[event.status] || event.status
}
function userHtml(event) {
  const medal = event.user?.fansMedal
  const medalHtml = medal && (medal.name || medal.level) ? '<span class="fans-medal"' + (color(medal.colorStart) ? ' style="--medal-color:' + color(medal.colorStart) + '"' : '') + '>' + esc(medal.name || '粉丝牌') + ' Lv.' + Number(medal.level || 0) + '</span>' : ''
  return medalHtml + '<span class="user">' + esc(event.user?.name || '观众') + '</span>'
}
function lineText(event) {
  if (event.type === 'status') return statusText(event)
  const user = userHtml(event)
  if (event.type === 'danmaku') return user + '：' + esc(event.text)
  if (event.type === 'superChat') return user + ' 的 SC：' + esc(event.text)
  if (event.type === 'gift') return user + ' 送出 ' + esc(event.giftName || '礼物') + ' ×' + Number(event.count || 1)
  if (event.type === 'guard') return user + ' 开通舰长 Lv.' + Number(event.level || 3)
  if (event.type === 'enter') return user + ' 进入房间'
  return esc(event.text || event.type || '')
}
function outcomeSuffix(outcome) { return ({ disabled: '（已关闭）', paused: '（已暂停）', blocked: '（已过滤）', 'rate-limited': '（限流）' }[outcome] || '') }
function trim(list) { while (list.children.length > MAX_ITEMS) list.removeChild(list.firstChild); list.scrollTop = list.scrollHeight }
function addRow(list, { badge = '事件', type = 'dim', html = '', at = Date.now() }) {
  const li = document.createElement('li')
  const badgeEl = document.createElement('span'); badgeEl.className = 'badge ' + type; badgeEl.textContent = badge
  const text = document.createElement('span'); text.className = 'text'; text.innerHTML = html
  const time = document.createElement('span'); time.className = 'clock'; time.textContent = clock(at)
  li.append(badgeEl, text, time); list.appendChild(li); trim(list)
}
function addLive(event) {
  if (!event) return
  const known = ['danmaku', 'gift', 'superChat', 'guard', 'enter'].includes(event.type)
  if (known) hasRealtimeActivity = true
  addRow(liveFeed, { badge: BADGES[event.type] || '事件', type: event.type === 'status' ? 'status' : known ? event.type : 'dim', html: lineText(event) + outcomeSuffix(event.outcome), at: event.at })
  counts.live.textContent = String(liveFeed.children.length)
  renderWidgetState()
}
function addAi(event) {
  if (!event) return
  hasRealtimeActivity = true
  const prompt = event.prompt ? '发发 ' + event.prompt : '发发'
  const html = '<strong>' + esc(event.user?.name || '观众') + '：' + esc(prompt) + '</strong><span class="ai-answer">' + esc(event.reply || '—') + '</span>'
  addRow(aiFeed, { badge: 'AI', type: 'dim', html, at: event.at })
  counts.ai.textContent = String(aiFeed.children.length)
  renderWidgetState()
}
function addAction(action) {
  if (!action || !['danmaku', 'gift', 'superChat', 'guard', 'llm', 'music', 'lottery', 'nickname', 'enter', 'session'].includes(action.source)) return
  hasRealtimeActivity = true
  const label = labels.get(action.actionId) || action.actionId || '动作'
  addRow(actionFeed, { badge: '动作', type: 'dim', html: '<strong>' + esc(label) + '</strong>' + (action.text ? '<span>' + esc(action.text) + '</span>' : ''), at: action.at || Date.now() })
  counts.action.textContent = String(actionFeed.children.length)
  foot.textContent = '刚刚触发：' + label + (action.text ? ' —— ' + action.text : '')
  renderWidgetState()
}
function renderRelationship(state = {}) {
  const intimacy = Math.max(0, Math.min(1000, Math.round(Number(state.intimacy) || 0)))
  document.getElementById('intimacy-stage').textContent = state.stage || '初见'
  document.getElementById('intimacy-value').value = String(intimacy)
  document.getElementById('intimacy-fill').style.width = Math.min(100, intimacy / 10) + '%'
  document.getElementById('relationship-note').textContent = '今日互动 ' + Math.max(0, Number(state.dailyInteractions) || 0) + ' 次 · 心情 ' + Math.max(0, Math.min(100, Number(state.mood) || 0))
}

window.fafa.live.onEvent((event) => addLive(event))
window.fafa.live.onAi((event) => addAi(event))
window.fafa.live.onWidgetLayout((layout) => applyWidgetLayout(layout))
window.fafa.services.onStatus((status) => { if (status) renderStatus(status) })
window.fafa.pet.onAction(addAction)
window.fafa.relationship.onChanged(renderRelationship)
window.fafa.services.status().then(renderStatus).catch(() => {})
window.fafa.live.overlay().then((snapshot) => {
  renderStatus(snapshot?.status)
  for (const event of snapshot?.events || []) addLive(event)
  for (const event of snapshot?.ai || []) addAi(event)
  for (const action of snapshot?.actions || []) addAction(action)
  renderRelationship(snapshot?.relationship)
}).catch(() => {})
document.getElementById('widget-close').addEventListener('click', () => window.fafa.live.toggleWidget())
mergeButton.addEventListener('click', () => { if (detachedPanel) window.fafa.live.mergePanel(detachedPanel) })
widgetStateAction.addEventListener('click', () => window.fafa.window.openSettings?.())
widgetStatePreview.addEventListener('click', () => {
  const at = Date.now()
  previewing = true
  addLive({ type: 'danmaku', user: { name: '测试观众' }, text: '发发，今天也要加油！', at })
  addAi({ user: { name: '测试观众' }, prompt: '今天也要加油！', reply: '好呀，我们一起加油！', at })
  addAction({ actionId: 'act_greet', text: '向大家打招呼', source: 'danmaku', at })
})
window.fafa.live.widgetLayout().then(applyWidgetLayout).catch(() => {})

let panelDrag = null
function finishPanelDrag() {
  panelDrag?.element.classList.remove('is-detaching')
  panelDrag = null
}
for (const element of document.querySelectorAll('[data-widget-panel]')) {
  element.addEventListener('pointerdown', (event) => {
    if (detachedPanel || event.button !== 0 || event.target.closest('button, input, a, select, textarea')) return
    panelDrag = { panel: element.dataset.widgetPanel, element, x: event.clientX, y: event.clientY, started: false }
  })
}
document.addEventListener('pointermove', (event) => {
  if (!panelDrag) return
  const distance = Math.hypot(event.clientX - panelDrag.x, event.clientY - panelDrag.y)
  if (distance < 12) return
  panelDrag.started = true
  panelDrag.element.classList.add('is-detaching')
  const nearEdge = event.clientX <= 16 || event.clientX >= innerWidth - 16 || event.clientY <= 16 || event.clientY >= innerHeight - 16
  if (!nearEdge) return
  const { panel } = panelDrag
  finishPanelDrag()
  void window.fafa.live.detachPanel(panel, { x: Math.round(event.screenX - 190), y: Math.round(event.screenY - 34) })
})
document.addEventListener('pointerup', finishPanelDrag)
document.addEventListener('pointercancel', finishPanelDrag)
renderWidgetState()
