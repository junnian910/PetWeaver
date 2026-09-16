import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PetPackageService } from '../src/main/pet-package-service.js'

const roots = []
afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true })
})

function baseManifest(id, asset = 'videos/idle.webm') {
  return {
    schemaVersion: 1,
    id,
    displayName: id === 'fafa' ? '发发' : '测试角色',
    version: '0.1.0',
    renderer: { type: 'video-actions', width: 384, height: 416, fallbackAction: 'idle_breath' },
    expressions: { neutral: 'references/canonical.png' },
    actions: { idle_breath: { asset, enabled: true, loop: true, fallback: null } }
  }
}

function createService() {
  const root = mkdtempSync(join(tmpdir(), 'petweaver-pets-'))
  roots.push(root)
  return new PetPackageService({
    root,
    actionRegistry: [{ id: 'idle_breath', enabled: true }],
    builtInManifest: baseManifest('fafa', 'assets/idle.webm')
  })
}

function writePackage(service, id, manifest = baseManifest(id)) {
  const directory = join(service.root, id)
  mkdirSync(join(directory, 'videos'), { recursive: true })
  mkdirSync(join(directory, 'references'), { recursive: true })
  writeFileSync(join(directory, 'pet.json'), JSON.stringify(manifest), 'utf8')
  writeFileSync(join(directory, 'videos', 'idle.webm'), 'video', 'utf8')
  writeFileSync(join(directory, 'references', 'canonical.png'), 'image', 'utf8')
  return directory
}

describe('PetPackageService', () => {
  it('discovers a complete external package and exposes only declared resources', () => {
    const service = createService()
    const directory = writePackage(service, 'test-pet')

    expect(service.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'fafa', source: 'builtin', valid: true }),
      expect.objectContaining({ id: 'test-pet', source: 'external', valid: true })
    ]))
    expect(service.active('test-pet')).toMatchObject({ id: 'test-pet', source: 'external', assetBase: 'pet-resource://test-pet/' })
    expect(service.resolveResource('pet-resource://test-pet/videos/idle.webm')).toBe(join(directory, 'videos', 'idle.webm'))
    expect(service.resolveResource('pet-resource://test-pet/undeclared.txt')).toBeNull()
    expect(service.resolveResource('pet-resource://test-pet/%2e%2e/secret.txt')).toBeNull()
  })

  it('reports invalid packages and safely falls back to the built-in role', () => {
    const service = createService()
    const invalid = baseManifest('wrong-id')
    const directory = join(service.root, 'broken')
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'pet.json'), JSON.stringify(invalid), 'utf8')

    expect(service.list()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'broken', valid: false })]))
    expect(service.active('broken')).toMatchObject({ id: 'fafa', source: 'builtin', warning: expect.stringContaining('无法加载') })
  })

  it('allows a missing action file only when an available fallback is declared', () => {
    const root = mkdtempSync(join(tmpdir(), 'petweaver-pets-'))
    roots.push(root)
    const builtIn = baseManifest('fafa', 'assets/idle.webm')
    builtIn.actions.act_wave = { asset: 'assets/wave.webm', enabled: true, fallback: null }
    const service = new PetPackageService({
      root,
      actionRegistry: [{ id: 'idle_breath', enabled: true }, { id: 'act_wave', enabled: true }],
      builtInManifest: builtIn
    })
    const external = baseManifest('fallback-pet')
    external.actions.act_wave = { asset: 'videos/missing-wave.webm', enabled: true, fallback: 'idle_breath' }
    writePackage(service, 'fallback-pet', external)

    const active = service.active('fallback-pet')
    expect(active.warning).toBeUndefined()
    expect(active.actions.act_wave.assetAvailable).toBe(false)
    expect(active.actions.idle_breath.assetAvailable).toBe(true)
  })
})
