import Store from 'electron-store'
import { safeStorage } from 'electron'
import { defaults, defaultCommands } from './defaults.js'
import { deepMerge, migrateConfig, validateCommands } from './core/config.js'
import { createRelationshipState, normalizeRelationship } from './core/relationship.js'

const PUBLIC_KEYS = ['roomId', 'broadcasterUid', 'scale', 'volume', 'alwaysOnTop', 'clickThrough', 'launchAtLogin', 'liveEnabled', 'liveMock', 'livePlatform', 'youtube', 'pet', 'interaction', 'tts', 'llm', 'asr', 'voice', 'music', 'quietHours', 'dock', 'schedule', 'liveEvents', 'safety', 'applause', 'commands', 'idleSet', 'actionAssign', 'avatar', 'ui']

export class ConfigStore {
  constructor({ store = new Store({ name: 'config', defaults, clearInvalidConfig: true }), secretStore = new Store({ name: 'secrets' }), relationshipStore = new Store({ name: 'relationship', defaults: { state: createRelationshipState() } }), safeStorageImpl = safeStorage } = {}) {
    this.store = store
    this.secretStore = secretStore
    this.relationshipStore = relationshipStore
    this.safeStorage = safeStorageImpl
    this.#persist(migrateConfig(this.store.store, defaults, defaultCommands))
    this.relationshipStore.set('state', normalizeRelationship(this.relationshipStore.get('state')))
  }

  getAll() {
    const config = migrateConfig(this.store.store, defaults, defaultCommands)
    config.tts = { ...config.tts, hasKey: Boolean(this.secretStore.get('ttsApiKey')) }
    config.llm = { ...config.llm, hasKey: Boolean(this.secretStore.get('llmApiKey')) }
    config.asr = { ...config.asr, hasKey: Boolean(this.secretStore.get('asrApiKey') || this.secretStore.get('ttsApiKey')) }
    config.youtube = { ...config.youtube, hasKey: Boolean(this.secretStore.get('youtubeApiKey')) }
    return config
  }

  update(patch) {
    if (!patch || typeof patch !== 'object') throw new Error('配置补丁无效')
    const allowedPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => PUBLIC_KEYS.includes(key)))
    if (Object.hasOwn(allowedPatch, 'commands')) allowedPatch.commands = validateCommands(allowedPatch.commands)
    const next = migrateConfig(deepMerge(this.store.store, allowedPatch), defaults, defaultCommands)
    if (Object.hasOwn(allowedPatch, 'commands')) next.commands = validateCommands(next.commands)
    this.#persist(next)
    return this.getAll()
  }

  setSecret(name, plaintext) {
    if (!['ttsApiKey', 'llmApiKey', 'asrApiKey', 'bilibiliCookie', 'youtubeApiKey', 'vtsAuthToken', 'musicPassword'].includes(name)) throw new Error('Unknown secret')
    if (!plaintext) {
      this.secretStore.delete(name)
      return
    }
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储不可用')
    this.secretStore.set(name, this.safeStorage.encryptString(String(plaintext)).toString('base64'))
  }

  getSecret(name) {
    const encoded = this.secretStore.get(name)
    if (!encoded || !this.safeStorage.isEncryptionAvailable()) return ''
    try { return this.safeStorage.decryptString(Buffer.from(encoded, 'base64')) } catch { return '' }
  }

  getRelationship() {
    return normalizeRelationship(this.relationshipStore.get('state'))
  }

  setRelationship(state) {
    this.relationshipStore.set('state', normalizeRelationship(state))
    return this.getRelationship()
  }

  resetRelationship() {
    this.relationshipStore.set('state', createRelationshipState())
    return this.getRelationship()
  }

  #persist(config) {
    for (const key of ['version', ...PUBLIC_KEYS]) {
      if (!Object.hasOwn(config, key)) continue
      const value = key === 'tts' || key === 'llm' || key === 'asr' ? Object.fromEntries(Object.entries(config[key]).filter(([nestedKey]) => nestedKey !== 'hasKey')) : config[key]
      this.store.set(key, value)
    }
  }
}
