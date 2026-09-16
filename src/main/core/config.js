import { ACTION_IDS } from './action-registry.js'

const ALLOWED_COMMAND_ACTIONS = new Set([...ACTION_IDS, 'lottery_join', 'lottery_draw', 'game_rps', 'game_lots'])

export function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return patch === undefined ? structuredClone(base) : structuredClone(patch)
  if (!base || typeof base !== 'object') return patch === undefined ? base : patch
  if (!patch || typeof patch !== 'object') return structuredClone(base)
  const result = { ...structuredClone(base) }
  for (const [key, value] of Object.entries(patch)) result[key] = value && typeof value === 'object' && !Array.isArray(value) ? deepMerge(result[key] || {}, value) : structuredClone(value)
  return result
}

export function mergeDefaultCommands(existingCommands, defaultCommands) {
  const commands = []
  const actionIds = new Set()
  for (const command of Array.isArray(existingCommands) ? existingCommands : []) {
    try {
      const [normalized] = validateCommands([command])
      commands.push(normalized)
      actionIds.add(normalized.actionId)
    } catch {
      // Ignore malformed persisted entries and let the default action return.
    }
  }
  for (const defaultCommand of defaultCommands) {
    const duplicateAlias = commands.some((command) => command.actionId === defaultCommand.actionId && command.aliases.some((alias) => defaultCommand.aliases.includes(alias)))
    if (actionIds.has(defaultCommand.actionId) && !(defaultCommand.allowDuplicate && !duplicateAlias)) continue
    commands.push(structuredClone(defaultCommand))
    actionIds.add(defaultCommand.actionId)
  }
  return commands
}

export function migrateConfig(saved, defaults, defaultCommands) {
  const config = deepMerge(defaults, saved || {})
  config.version = defaults.version
  config.commands = mergeDefaultCommands(saved?.commands, defaultCommands)
  config.livePlatform = config.livePlatform === 'youtube' ? 'youtube' : 'bilibili'
  config.youtube = {
    videoId: String(config.youtube?.videoId || '').trim().slice(0, 300),
    liveChatId: String(config.youtube?.liveChatId || '').trim().slice(0, 200)
  }
  const activePackageId = String(config.pet?.activePackageId || 'fafa').trim().toLowerCase()
  config.pet = { activePackageId: /^[a-z0-9][a-z0-9-]{0,63}$/.test(activePackageId) ? activePackageId : 'fafa' }
  // v6 replaces the unused language selector with one persistent theme choice.
  const savedUi = config.ui && typeof config.ui === 'object' ? config.ui : {}
  config.ui = { theme: savedUi.theme === 'dark' ? 'dark' : 'light' }
  // v7: ASR 改为按住说话，且不再默认要求先喊唤醒词。
  const savedVoice = config.voice && typeof config.voice === 'object' ? config.voice : {}
  const pushToTalkKey = String(savedVoice.pushToTalkKey || 'F8').trim().toUpperCase()
  config.voice = {
    ...savedVoice,
    wakeWordEnabled: saved?.voice?.wakeWordEnabled === true,
    pushToTalkKey: /^(F(?:[1-9]|1[0-2])|[A-Z]|[0-9]|SPACE)$/.test(pushToTalkKey) ? pushToTalkKey : 'F8'
  }
  // v8: Live2D 与 VTube Studio 尚未开放。保留用户已导入的模型和接口参数，
  // 但统一回退到可用的视频动作模式，避免旧配置在新版本里误启用未完成入口。
  const savedAvatar = config.avatar && typeof config.avatar === 'object' ? config.avatar : {}
  const savedVtubeStudio = savedAvatar.vtubeStudio && typeof savedAvatar.vtubeStudio === 'object' ? savedAvatar.vtubeStudio : {}
  config.avatar = {
    ...savedAvatar,
    mode: 'video',
    vtubeStudio: { ...savedVtubeStudio, enabled: false }
  }
  // v5 removes the double-click trigger. Preserve existing user intent by
  // merging the legacy pool into single-click actions, without duplicates.
  const click = Array.isArray(config.actionAssign?.click) ? config.actionAssign.click : []
  const legacyDoubleClick = Array.isArray(saved?.actionAssign?.doubleClick) ? saved.actionAssign.doubleClick : []
  if (legacyDoubleClick.length) config.actionAssign.click = [...new Set([...click, ...legacyDoubleClick])]
  if (config.actionAssign && Object.hasOwn(config.actionAssign, 'doubleClick')) delete config.actionAssign.doubleClick
  return config
}

export function validateCommands(commands) {
  if (!Array.isArray(commands)) throw new Error('commands 必须是数组')
  return commands.map((command, index) => {
    if (!command || typeof command !== 'object') throw new Error(`第 ${index + 1} 条命令无效`)
    const aliases = Array.isArray(command.aliases) ? command.aliases.map((alias) => String(alias).trim()).filter(Boolean) : []
    if (!aliases.length) throw new Error(`第 ${index + 1} 条命令至少需要一个别名`)
    const actionId = String(command.actionId || '').trim()
    if (!ALLOWED_COMMAND_ACTIONS.has(actionId)) throw new Error(`未知动作 ID：${actionId}`)
    const priority = Number(command.priority)
    if (!Number.isFinite(priority) || priority < 0 || priority > 100) throw new Error(`第 ${index + 1} 条命令优先级无效`)
    const normalized = {
      ...structuredClone(command),
      aliases: [...new Set(aliases)],
      actionId,
      text: String(command.text || '').slice(0, 300),
      priority: Math.round(priority)
    }
    if (command.adminOnly) normalized.adminOnly = true
    else delete normalized.adminOnly
    return normalized
  })
}
