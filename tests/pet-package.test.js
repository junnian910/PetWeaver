import { describe, expect, it } from 'vitest'
import { createPetActionResolver, validatePetPackageManifest } from '../src/main/core/pet-package.js'

function manifest() {
  return {
    schemaVersion: 1,
    id: 'sample-pet',
    displayName: 'Sample Pet',
    renderer: { type: 'video-actions', width: 384, height: 416, fallbackAction: 'idle_breath' },
    actions: {
      idle_breath: { asset: 'videos/idle_breath.webm', loop: true },
      act_wave: { asset: 'videos/act_wave.webm', fallback: 'idle_breath' }
    }
  }
}

describe('pet package contract', () => {
  it('validates portable paths and resolves package-local action assets', () => {
    const valid = validatePetPackageManifest(manifest(), { actionIds: ['idle_breath', 'act_wave'], requiredActionIds: ['idle_breath'] })
    const resolve = createPetActionResolver(valid, { assetBase: 'pet://sample-pet/' })

    expect(resolve('idle_breath')).toMatchObject({ id: 'idle_breath', url: 'pet://sample-pet/videos/idle_breath.webm' })
    expect(resolve('act_wave')).toMatchObject({ id: 'act_wave', url: 'pet://sample-pet/videos/act_wave.webm' })
    expect(resolve('missing')).toMatchObject({ id: 'idle_breath' })

    const resolveMissingAsset = createPetActionResolver(valid, { isAssetAvailable: (asset) => !asset.includes('act_wave') })
    expect(resolveMissingAsset('act_wave')).toMatchObject({ id: 'idle_breath' })
  })

  it('rejects escaped paths, missing coverage and fallback cycles', () => {
    const escaped = manifest()
    escaped.actions.act_wave.asset = '../outside.webm'
    expect(() => validatePetPackageManifest(escaped)).toThrow('相对路径')

    expect(() => validatePetPackageManifest(manifest(), { actionIds: ['idle_breath', 'act_wave'], requiredActionIds: ['missing'] })).toThrow('缺少启用动作')

    const cyclic = manifest()
    cyclic.actions.idle_breath.fallback = 'act_wave'
    expect(() => validatePetPackageManifest(cyclic)).toThrow('形成循环')
  })
})
