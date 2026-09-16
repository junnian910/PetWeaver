import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { ACTION_REGISTRY } from './core/action-registry.js'
import { validatePetPackageManifest } from './core/pet-package.js'
import { createFafaPetManifest } from './pets/fafa.js'

function packageFile(directory, asset) {
  const candidate = resolve(directory, asset)
  if (!existsSync(candidate)) return null
  const realDirectory = realpathSync(directory)
  const realCandidate = realpathSync(candidate)
  const child = relative(realDirectory, realCandidate)
  return child && !child.startsWith('..') && !isAbsolute(child) ? realCandidate : null
}

function publicPackage(manifest, source, warning = '', directory = '') {
  const copy = structuredClone(manifest)
  for (const action of Object.values(copy.actions || {})) {
    action.assetAvailable = source === 'builtin' || Boolean(packageFile(directory, action.asset))
  }
  return {
    ...copy,
    source,
    assetBase: source === 'builtin' ? '' : `pet-resource://${manifest.id}/`,
    ...(warning ? { warning } : {})
  }
}

export class PetPackageService {
  constructor({ root, actionRegistry = ACTION_REGISTRY, builtInManifest = createFafaPetManifest() } = {}) {
    if (!root) throw new Error('角色包目录不能为空')
    this.root = resolve(root)
    this.actionRegistry = actionRegistry
    this.actionIds = actionRegistry.map((entry) => entry.id)
    this.requiredActionIds = actionRegistry.filter((entry) => entry.enabled !== false).map((entry) => entry.id)
    this.builtInManifest = validatePetPackageManifest(builtInManifest, {
      actionIds: this.actionIds,
      requiredActionIds: this.requiredActionIds
    })
    mkdirSync(this.root, { recursive: true })
  }

  list() {
    const entries = [{
      id: this.builtInManifest.id,
      displayName: this.builtInManifest.displayName,
      version: this.builtInManifest.version || '',
      source: 'builtin',
      valid: true
    }]
    for (const item of readdirSync(this.root, { withFileTypes: true })) {
      if (!item.isDirectory()) continue
      const manifestPath = join(this.root, item.name, 'pet.json')
      if (!existsSync(manifestPath)) continue
      try {
        const { manifest } = this.#readExternal(item.name, { verifyAssets: true })
        entries.push({ id: manifest.id, displayName: manifest.displayName, version: manifest.version || '', source: 'external', valid: true })
      } catch (error) {
        entries.push({ id: item.name, displayName: item.name, version: '', source: 'external', valid: false, error: String(error?.message || error) })
      }
    }
    return entries
  }

  active(requestedId = 'fafa') {
    const id = String(requestedId || 'fafa')
    if (id === this.builtInManifest.id) return publicPackage(this.builtInManifest, 'builtin')
    try {
      const { manifest, directory } = this.#readExternal(id, { verifyAssets: true })
      return publicPackage(manifest, 'external', '', directory)
    } catch (error) {
      return publicPackage(this.builtInManifest, 'builtin', `角色包 ${id} 无法加载：${String(error?.message || error)}`)
    }
  }

  resolveResource(requestUrl) {
    let parsed
    try { parsed = new URL(requestUrl) } catch { return null }
    let id
    let requested
    try {
      id = decodeURIComponent(parsed.hostname || '')
      requested = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '').replaceAll('\\', '/')
    } catch {
      return null
    }
    if (!id || id === this.builtInManifest.id) return null
    let packageData
    try { packageData = this.#readExternal(id, { verifyAssets: false }) } catch { return null }
    const allowed = new Set([
      ...Object.values(packageData.manifest.actions).map((action) => action.asset),
      ...Object.values(packageData.manifest.expressions || {})
    ])
    if (!allowed.has(requested)) return null
    return packageFile(packageData.directory, requested)
  }

  #readExternal(directoryName, { verifyAssets }) {
    const directory = resolve(this.root, directoryName)
    const child = relative(this.root, directory)
    if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('角色包目录越界')
    const manifestPath = join(directory, 'pet.json')
    if (!existsSync(manifestPath)) throw new Error('缺少 pet.json')
    const realRoot = realpathSync(this.root)
    const realDirectory = realpathSync(directory)
    const realChild = relative(realRoot, realDirectory)
    if (!realChild || realChild.startsWith('..') || isAbsolute(realChild)) throw new Error('角色包目录越界')
    const realManifestPath = packageFile(realDirectory, 'pet.json')
    if (!realManifestPath) throw new Error('pet.json 不能指向角色包目录之外')
    const input = JSON.parse(readFileSync(realManifestPath, 'utf8'))
    if (input.id !== directoryName) throw new Error(`角色包 id 必须与目录名一致：${directoryName}`)
    const manifest = validatePetPackageManifest(input, {
      actionIds: this.actionIds,
      requiredActionIds: this.requiredActionIds
    })
    if (verifyAssets) {
      for (const asset of new Set([manifest.expressions.neutral])) {
        if (!packageFile(realDirectory, asset)) throw new Error(`缺少必需资源：${asset}`)
      }
      for (const id of this.requiredActionIds) {
        const visited = new Set()
        let cursor = id
        let available = false
        while (cursor && !visited.has(cursor)) {
          visited.add(cursor)
          const action = manifest.actions[cursor]
          if (action && packageFile(realDirectory, action.asset)) {
            available = true
            break
          }
          cursor = action?.fallback || ''
        }
        if (!available) throw new Error(`动作缺少可播放资源：${id}`)
      }
    }
    return { manifest, directory: realDirectory }
  }
}
