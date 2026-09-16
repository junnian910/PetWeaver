import { describe, expect, it, vi } from 'vitest'

vi.mock('electron-store', () => ({ default: class MockStore {
  constructor(options = {}) { this.store = structuredClone(options.defaults || {}) }
  get(key) { return this.store[key] }
  set(key, value) { this.store[key] = structuredClone(value) }
  delete(key) { delete this.store[key] }
} }))

vi.mock('electron', () => ({ safeStorage: {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(value),
  decryptString: (value) => value.toString()
} }))

import { ConfigStore } from '../src/main/config-store.js'
import { deepMerge, migrateConfig, validateCommands } from '../src/main/core/config.js'
import { defaultCommands, defaults } from '../src/main/defaults.js'

class MemoryStore {
  constructor(value = {}) { this.store = structuredClone(value) }
  get(key) { return this.store[key] }
  set(key, value) { this.store[key] = structuredClone(value) }
  delete(key) { delete this.store[key] }
}

describe('configuration', () => {
  it('deep-merges nested music defaults without dropping untouched fields', () => {
    const merged = deepMerge(defaults, { music: { enabled: true } })

    expect(merged.music).toEqual({ ...defaults.music, enabled: true })
    expect(merged.tts).toEqual(defaults.tts)
    expect(merged.interaction).toEqual(defaults.interaction)
  })

  it('keeps YouTube credentials separate from public live configuration', () => {
    const store = new MemoryStore({ version: 1, commands: [] })
    const secrets = new MemoryStore()
    const configStore = new ConfigStore({ store, secretStore: secrets })

    configStore.update({ livePlatform: 'youtube', youtube: { videoId: 'abcdefghijk', liveChatId: 'chat-1' } })
    configStore.setSecret('youtubeApiKey', 'secret-key')

    expect(configStore.getAll()).toMatchObject({ livePlatform: 'youtube', youtube: { videoId: 'abcdefghijk', liveChatId: 'chat-1', hasKey: true } })
    expect(store.store.youtube).toEqual({ videoId: 'abcdefghijk', liveChatId: 'chat-1' })
    expect(JSON.stringify(store.store)).not.toContain('secret-key')
  })

  it('persists a safe active role-package ID and rejects malformed IDs during migration', () => {
    const store = new MemoryStore({ version: 1, commands: [] })
    const configStore = new ConfigStore({ store, secretStore: new MemoryStore() })

    expect(configStore.update({ pet: { activePackageId: 'my-pixel-pet' } }).pet.activePackageId).toBe('my-pixel-pet')
    expect(migrateConfig({ pet: { activePackageId: '../outside' }, commands: [] }, defaults, defaultCommands).pet.activePackageId).toBe('fafa')
  })

  it('migrates v1 by appending missing action IDs without replacing user commands', () => {
    const custom = { aliases: ['跳舞自定义'], actionId: 'act_dance', text: '保留我的文案', priority: 77 }
    const migrated = migrateConfig({ version: 1, commands: [custom] }, defaults, defaultCommands)

    expect(migrated.version).toBe(8)
    expect(migrated.commands.find((command) => command.actionId === 'act_dance')).toEqual(custom)
    expect(migrated.commands.map((command) => command.actionId)).toEqual(expect.arrayContaining(defaultCommands.map((command) => command.actionId)))
    expect(migrated.commands.filter((command) => command.actionId === 'act_dance')).toHaveLength(1)
  })

  it('normalizes valid commands and rejects unsafe command input', () => {
    const normalized = validateCommands([{ aliases: ['  跳舞 ', '跳舞', ''], actionId: ' act_dance ', text: 'x'.repeat(400), priority: 20.6, adminOnly: 0 }])
    expect(normalized).toEqual([{ aliases: ['跳舞'], actionId: 'act_dance', text: 'x'.repeat(300), priority: 21 }])
    expect(() => validateCommands([{ aliases: ['未知'], actionId: 'not-real', priority: 1 }])).toThrow('未知动作 ID')
    expect(() => validateCommands([{ aliases: [], actionId: 'act_dance', priority: 1 }])).toThrow('至少需要一个别名')
    expect(() => validateCommands([{ aliases: ['跳舞'], actionId: 'act_dance', priority: Number.NaN }])).toThrow('优先级无效')
    expect(() => validateCommands('not-an-array')).toThrow('必须是数组')
  })

  it('ships the current action preset wording in fresh configuration', () => {
    const migrated = migrateConfig({ version: 1, commands: [] }, defaults, defaultCommands)
    expect(migrated.commands.find((command) => command.aliases.includes('唱歌'))?.text).toBe('啦啦啦啦啦啦~落泪')
    expect(migrated.commands.find((command) => command.aliases.includes('起床'))?.text).toBe('叮铃铃，叮铃铃。发发喊你起床打喷啦！')
    expect(migrated.commands.find((command) => command.aliases.includes('开心'))?.text).toBe('今天超开心！')
  })

  it('merges legacy double-click assignments into deduplicated single clicks', () => {
    const migrated = migrateConfig({
      version: 4,
      actionAssign: { click: ['act_greet'], doubleClick: ['act_greet', 'act_dance'] },
      commands: []
    }, defaults, defaultCommands)

    expect(migrated.actionAssign.click).toEqual(['act_greet', 'act_dance'])
    expect(migrated.actionAssign).not.toHaveProperty('doubleClick')
  })

  it('migrates the removed language preference to a safe persistent theme', () => {
    expect(migrateConfig({ version: 5, ui: { language: 'en' }, commands: [] }, defaults, defaultCommands).ui).toEqual({ theme: 'light' })
    expect(migrateConfig({ version: 5, ui: { language: 'zh', theme: 'dark' }, commands: [] }, defaults, defaultCommands).ui).toEqual({ theme: 'dark' })
  })

  it('keeps nested defaults when ConfigStore updates only one music field', () => {
    const store = new MemoryStore({ version: 1, music: { enabled: false, baseUrl: 'http://custom' }, commands: [] })
    const secrets = new MemoryStore()
    const configStore = new ConfigStore({ store, secretStore: secrets })

    const updated = configStore.update({ music: { enabled: true } })
    expect(updated.music).toEqual({ ...defaults.music, enabled: true, baseUrl: 'http://custom' })
    expect(updated.commands.map((command) => command.actionId)).toEqual(expect.arrayContaining(defaultCommands.map((command) => command.actionId)))
  })

  it('persists the avatar section while preserving the imported model list', () => {
    const store = new MemoryStore({ version: 1, commands: [] })
    const secrets = new MemoryStore()
    const configStore = new ConfigStore({ store, secretStore: secrets })
    const model = { id: 'm1', name: '模型', path: 'C:/fafa/avatar-models/m1', modelJson: 'a.model3.json', moc3: 'a.moc3', textures: [], motions: [], expressions: [], textureCount: 0, motionCount: 0, expressionCount: 0, importedAt: 1 }
    const first = configStore.update({ avatar: { mode: 'live2d', live2d: { models: [model], activeModelId: 'm1' } } })
    expect(first.avatar.live2d.models).toEqual([model])
    expect(first.avatar.live2d.activeModelId).toBe('m1')
    expect(first.avatar.mode).toBe('video')
    expect(first.avatar.vtubeStudio.enabled).toBe(false)

    const second = configStore.update({ avatar: { live2d: { activeModelId: 'm1' } } })
    expect(second.avatar.live2d.models).toEqual([model])
  })

  it('persists and resets relationship state in its own store', () => {
    const store = new MemoryStore({ version: 1, commands: [] })
    const secrets = new MemoryStore()
    const relationship = new MemoryStore()
    const configStore = new ConfigStore({ store, secretStore: secrets, relationshipStore: relationship })

    const updated = configStore.setRelationship({ intimacy: 42, mood: 30 })
    expect(updated.intimacy).toBe(42)
    expect(relationship.store.state.intimacy).toBe(42)
    expect(updated.stage).toBe('初见')

    const loaded = new ConfigStore({ store, secretStore: secrets, relationshipStore: relationship }).getRelationship()
    expect(loaded.intimacy).toBe(42)

    const reset = configStore.resetRelationship()
    expect(reset.intimacy).toBe(0)
    expect(reset.dailyInteractions).toBe(0)
  })

  it('drops malformed persisted commands during migration before they reach the parser', () => {
    const store = new MemoryStore({
      version: 1,
      commands: [
        { aliases: ['坏动作'], actionId: 'not-real', text: '不应执行', priority: 100 },
        { aliases: ['跳舞自定义'], actionId: 'act_dance', text: '保留', priority: 77 }
      ]
    })
    const configStore = new ConfigStore({ store, secretStore: new MemoryStore() })

    const commands = configStore.getAll().commands
    expect(commands.some((command) => command.actionId === 'not-real')).toBe(false)
    expect(commands.find((command) => command.actionId === 'act_dance')).toMatchObject({ aliases: ['跳舞自定义'], text: '保留' })
  })
})
