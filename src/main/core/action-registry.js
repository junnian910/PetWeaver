const available = (videoPath, options = {}) => ({
  videoPath,
  assetStatus: 'available',
  fallback: null,
  ...options
})

const pending = (id, options = {}) => ({
  videoPath: `assets/videos/actions/${id}.webm`,
  assetStatus: 'pending',
  fallback: 'idle_breath',
  ...options
})

const action = (id, category, label, options = {}) => Object.freeze({
  id,
  category,
  label,
  loop: false,
  interruptible: true,
  triggers: [],
  expression: 'neutral',
  priority: 50,
  enabled: true,
  ...options
})

export const ACTION_REGISTRY = Object.freeze([
  action('idle_breath', 'idle', '待机呼吸', { ...available('assets/videos/idle.webm'), loop: true, triggers: ['idle'] }),
  action('idle_blink', 'idle', '待机眨眼', { ...available('assets/videos/actions/idle_blink.webm'), triggers: ['idle-random'], expression: 'sleep' }),
  action('idle_stare', 'idle', '待机发呆', { ...available('assets/videos/actions/idle_stare.webm'), triggers: ['idle-random'] }),

  action('act_stretch', 'random', '伸懒腰', { ...available('assets/videos/actions/act_stretch.webm'), triggers: ['idle-random'] }),
  action('act_spin', 'random', '转圈', { ...available('assets/videos/actions/act_spin.webm'), triggers: ['idle-random'] }),
  action('act_scratch', 'random', '挠头', { ...available('assets/videos/actions/act_scratch.webm'), triggers: ['idle-random'] }),
  action('act_flip_hair', 'random', '甩头发', { ...available('assets/videos/actions/act_flip_hair.webm'), triggers: ['idle-random'] }),
  action('act_yawn', 'random', '打哈欠', { ...available('assets/videos/actions/act_yawn.webm'), triggers: ['idle-random'], expression: 'sleep' }),
  action('act_table', 'random', '跺桌', { ...available('assets/videos/actions/act_table.webm'), triggers: ['idle-random'] }),
  action('act_lookaround', 'random', '左右张望', { ...available('assets/videos/actions/act_lookaround.webm'), triggers: ['idle-random'] }),
  action('act_roll', 'random', '打滚', { ...available('assets/videos/actions/act_roll.webm'), triggers: ['idle-random'] }),
  action('act_hop', 'random', '蹦跳', { ...available('assets/videos/actions/act_hop.webm'), triggers: ['idle-random'] }),
  action('act_chin', 'random', '托腮', { ...available('assets/videos/actions/act_chin.webm'), triggers: ['idle-random'] }),
  action('act_rub_eye', 'random', '揉眼睛', { ...available('assets/videos/actions/act_rub_eye.webm'), triggers: ['idle-random'], expression: 'sleep' }),
  action('act_sneeze', 'random', '打喷嚏', { ...available('assets/videos/actions/act_sneeze.webm'), triggers: ['idle-random'] }),

  action('emo_happy', 'emotion', '开心', { ...available('assets/videos/actions/emo_happy.webm'), triggers: ['emotion:happy'], expression: 'happy', priority: 45 }),
  action('emo_shy', 'emotion', '害羞', { ...available('assets/videos/actions/emo_shy.webm'), triggers: ['emotion:shy'], expression: 'happy', priority: 45 }),
  action('emo_angry', 'emotion', '生气', { ...available('assets/videos/actions/emo_angry.webm'), triggers: ['emotion:angry'], expression: 'angry', priority: 45 }),
  action('emo_sleepy', 'emotion', '困倦', { ...available('assets/videos/actions/emo_sleepy.webm'), triggers: ['emotion:sleepy'], expression: 'sleep', priority: 45 }),
  action('emo_sad', 'emotion', '难过', { ...available('assets/videos/actions/emo_sad.webm'), triggers: ['emotion:sad'], expression: 'sad', priority: 45 }),
  action('emo_excited', 'emotion', '兴奋', { ...available('assets/videos/actions/emo_excited.webm'), triggers: ['emotion:excited'], expression: 'happy', priority: 45 }),
  action('emo_surprise', 'emotion', '惊讶', { ...available('assets/videos/actions/emo_surprise.webm'), triggers: ['emotion:surprise'], expression: 'happy', priority: 45 }),
  action('emo_aggrieved', 'emotion', '委屈', { ...available('assets/videos/actions/emo_aggrieved.webm'), triggers: ['emotion:aggrieved'], expression: 'sad', priority: 45 }),

  action('act_sing', 'command', '唱歌', { ...available('assets/videos/singing.webm'), triggers: ['command:唱歌'], priority: 50 }),
  action('act_dance', 'command', '跳舞', { ...available('assets/videos/actions/act_dance.webm'), triggers: ['command:跳舞'], expression: 'happy', priority: 50 }),
  action('act_sleep', 'command', '睡觉', { ...available('assets/videos/sleeping.webm'), triggers: ['command:睡觉'], expression: 'sleep', persistent: true, priority: 50 }),
  action('act_wake', 'command', '起床', { ...available('assets/videos/waking.webm'), triggers: ['command:起床'], expression: 'happy', priority: 50 }),
  action('act_work', 'command', '打工', { ...available('assets/videos/actions/act_work.webm'), triggers: ['command:打工'], priority: 50 }),
  action('act_ink', 'command', '涂地', { ...available('assets/videos/actions/act_ink.webm'), triggers: ['command:涂地'], priority: 50 }),
  action('act_firework', 'command', '放烟花', { ...available('assets/videos/actions/act_firework.webm'), triggers: ['command:放烟花'], expression: 'happy', priority: 60 }),
  // 2026-08 停用：资源与注册项保留，但不再被任何入口调用；设置页预览置黑。
  action('act_intro', 'command', '自我介绍', { ...available('assets/videos/actions/act_intro.webm'), triggers: ['command:自我介绍'], priority: 50, enabled: false }),
  action('act_greet', 'command', '打招呼', { ...available('assets/videos/waving-real.webm'), triggers: ['command:你好', 'command:嗨'], expression: 'happy', priority: 50 }),
  action('act_joke', 'command', '讲笑话', { ...available('assets/videos/actions/act_joke.webm'), triggers: ['command:讲笑话'], priority: 50 }),

  action('gift_thanks', 'gift', '感谢礼物', { ...available('assets/videos/actions/gift_thanks.webm'), triggers: ['gift:common'], expression: 'happy', priority: 70 }),
  action('gift_sc', 'gift', '感谢 SC', { ...available('assets/videos/actions/gift_sc.webm'), triggers: ['gift:superChat'], expression: 'happy', priority: 80 }),
  action('gift_guard', 'gift', '感谢上舰', { ...available('assets/videos/actions/gift_guard.webm'), triggers: ['gift:guard'], expression: 'happy', priority: 90 }),

  action('special_hourly', 'special', '整点彩蛋', { ...available('assets/videos/actions/special_hourly.webm'), triggers: ['special:hourly'], priority: 55 }),
  action('special_lottery', 'special', '抽奖开奖', { ...available('assets/videos/actions/special_lottery.webm'), triggers: ['special:lottery'], priority: 100 }),

  action('state_move', 'state', '移动状态', { ...available('assets/videos/actions/state_move.webm'), loop: true, triggers: ['state:move'] }),
  action('state_observe', 'state', '观察状态', { ...available('assets/videos/actions/state_observe.webm'), loop: true, triggers: ['state:observe'] }),
  action('state_talking', 'state', '说话状态', { ...available('assets/videos/actions/state_talking.webm'), loop: true, triggers: ['state:talking'] }),

  // 系统转场：动作结束后回待机前播放的落定动画，不进设置页、不可被指令触发。
  action('transition_settle', 'transition', '回待机转场', { ...available('assets/videos/actions/transition_settle.webm'), priority: 0 }),

  // v0.2 语音互动动作：程序化连续动画素材已生成。
  action('emo_shout', 'voice', '大叫', { ...available('assets/videos/actions/emo_shout.webm'), triggers: ['voice:shout'], expression: 'angry', priority: 60 }),
  action('act_cover_ears', 'voice', '捂耳朵', { ...available('assets/videos/actions/act_cover_ears.webm'), triggers: ['voice:noisy'], expression: 'sad', priority: 55 })
])

export const PLANNED_ACTION_COUNT = 40
export const EXTENSION_ACTION_IDS = Object.freeze(['state_move', 'state_observe', 'state_talking', 'transition_settle'])
export const PLANNED_ACTIONS = Object.freeze(ACTION_REGISTRY.filter((entry) => !EXTENSION_ACTION_IDS.includes(entry.id)))
export const ACTION_IDS = Object.freeze(ACTION_REGISTRY.map((entry) => entry.id))

const byId = new Map(ACTION_REGISTRY.map((entry) => [entry.id, entry]))

export function getAction(actionId) {
  return byId.get(String(actionId || '')) || null
}

export function isKnownAction(actionId) {
  return byId.has(String(actionId || ''))
}

export function resolvePlayableAction(actionId) {
  let entry = getAction(actionId) || getAction('idle_breath')
  const visited = new Set()
  while (entry?.assetStatus !== 'available' && entry?.fallback && !visited.has(entry.id)) {
    visited.add(entry.id)
    entry = getAction(entry.fallback) || getAction('idle_breath')
  }
  return entry || getAction('idle_breath')
}

export function actionDefinitions() {
  return ACTION_REGISTRY.map((entry) => ({ ...entry, triggers: [...entry.triggers] }))
}

export function isActionEnabled(actionId) {
  const entry = getAction(actionId)
  return Boolean(entry && entry.enabled !== false)
}
