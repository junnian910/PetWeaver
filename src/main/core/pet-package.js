const PET_ID = /^[a-z0-9][a-z0-9-]{0,63}$/

function packagePath(value, field) {
  const path = String(value || '').replaceAll('\\', '/')
  if (!path || path.startsWith('/') || /^[a-zA-Z]:\//.test(path) || path.split('/').includes('..')) {
    throw new Error(`${field} 必须是角色包内的相对路径`)
  }
  return path
}

export function validatePetPackageManifest(input, { actionIds = [], requiredActionIds = actionIds } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('角色包清单必须是对象')
  const manifest = structuredClone(input)
  if (manifest.schemaVersion !== 1) throw new Error('角色包 schemaVersion 必须是 1')
  if (!PET_ID.test(String(manifest.id || ''))) throw new Error('角色包 id 格式无效')
  if (!String(manifest.displayName || '').trim()) throw new Error('角色包 displayName 不能为空')
  if (manifest.renderer?.type !== 'video-actions') throw new Error('当前仅支持 video-actions renderer')
  if (Number(manifest.renderer?.width) !== 384 || Number(manifest.renderer?.height) !== 416) {
    throw new Error('video-actions renderer 必须使用 384x416')
  }
  if (!manifest.actions || typeof manifest.actions !== 'object' || Array.isArray(manifest.actions)) {
    throw new Error('角色包 actions 必须是对象')
  }

  const allowed = new Set(actionIds)
  const required = new Set(requiredActionIds)
  const normalizedActions = {}
  for (const [id, raw] of Object.entries(manifest.actions)) {
    if (allowed.size && !allowed.has(id)) throw new Error(`角色包包含未知动作：${id}`)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`动作 ${id} 配置无效`)
    const fallback = raw.fallback ? String(raw.fallback) : null
    normalizedActions[id] = {
      ...raw,
      asset: packagePath(raw.asset, `动作 ${id} 的 asset`),
      fallback,
      enabled: raw.enabled !== false,
      loop: raw.loop === true,
      persistent: raw.persistent === true
    }
  }
  for (const id of required) {
    const action = normalizedActions[id]
    if (!action || action.enabled === false) throw new Error(`角色包缺少启用动作：${id}`)
  }
  for (const [id, action] of Object.entries(normalizedActions)) {
    if (action.fallback && !normalizedActions[action.fallback]) throw new Error(`动作 ${id} 的回退不存在：${action.fallback}`)
    const visited = new Set([id])
    let cursor = action
    while (cursor?.fallback) {
      if (visited.has(cursor.fallback)) throw new Error(`动作回退形成循环：${[...visited, cursor.fallback].join(' -> ')}`)
      visited.add(cursor.fallback)
      cursor = normalizedActions[cursor.fallback]
    }
  }
  manifest.actions = normalizedActions
  const expressions = manifest.expressions && typeof manifest.expressions === 'object' && !Array.isArray(manifest.expressions)
    ? manifest.expressions
    : {}
  manifest.expressions = {}
  for (const [name, asset] of Object.entries(expressions)) {
    manifest.expressions[String(name)] = packagePath(asset, `表情 ${name}`)
  }
  if (!manifest.expressions.neutral) manifest.expressions.neutral = 'references/canonical.png'
  manifest.renderer.fallbackAction = String(manifest.renderer.fallbackAction || 'idle_breath')
  if (!normalizedActions[manifest.renderer.fallbackAction]) throw new Error('renderer.fallbackAction 不存在')
  return manifest
}

export function createPetActionResolver(manifest, { assetBase = '', isAssetAvailable = () => true } = {}) {
  const actions = manifest.actions || {}
  const fallbackAction = manifest.renderer?.fallbackAction || 'idle_breath'
  return (requestedId) => {
    let id = actions[requestedId] ? requestedId : fallbackAction
    const visited = new Set()
    while (actions[id] && !isAssetAvailable(actions[id].asset) && actions[id].fallback && !visited.has(id)) {
      visited.add(id)
      id = actions[id].fallback
    }
    const action = actions[id] || actions[fallbackAction]
    return action ? { id, action, url: `${assetBase}${action.asset}` } : null
  }
}
