import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildValidationTargets,
  parseProbeOutput,
  parseRational,
  registryReleaseIssues,
} from '../scripts/validate-action-videos.mjs'

describe('action video QA helpers', () => {
  it('parses probe rational fps, duration and VP9 alpha metadata', () => {
    const parsed = parseProbeOutput({
      streams: [{ codec_type: 'video', codec_name: 'vp9', width: 384, height: 416, avg_frame_rate: '60/1', tags: { alpha_mode: '1' } }],
      format: { duration: '2.008' },
    })
    expect(parseRational('60/1')).toBe(60)
    expect(parsed).toMatchObject({ codec: 'vp9', width: 384, height: 416, fps: 60, duration: 2.008, alphaMode: '1' })
  })

  it('rejects malformed rational values', () => {
    expect(Number.isNaN(parseRational('0/0'))).toBe(true)
    expect(Number.isNaN(parseRational('not-a-rate'))).toBe(true)
  })

  it('reports release status and independent path violations', () => {
    const registry = [
      { id: 'first', assetStatus: 'available', videoPath: 'assets/videos/first.webm' },
      { id: 'second', assetStatus: 'pending', videoPath: 'assets/videos/first.webm' },
      { id: 'state_move', assetStatus: 'pending', videoPath: 'assets/videos/state_move.webm' },
    ]
    const issues = registryReleaseIssues(registry, { plannedCount: 2, extensionIds: ['state_move'] })
    expect(issues).toEqual(expect.arrayContaining([
      'second: assetStatus=pending',
      expect.stringContaining('视频路径重复'),
    ]))
  })

  it('selects available videos and only existing pending videos in development mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'fafa-qa-test-'))
    try {
      mkdirSync(join(root, 'public'), { recursive: true })
      writeFileSync(join(root, 'public', 'pending.webm'), '')
      const registry = [
        { id: 'available', assetStatus: 'available', videoPath: 'available.webm' },
        { id: 'existing_pending', assetStatus: 'pending', videoPath: 'pending.webm' },
        { id: 'missing_pending', assetStatus: 'pending', videoPath: 'missing.webm' },
      ]
      const targets = buildValidationTargets({ registry, projectRoot: root, mode: 'development' })
      expect(targets.map((target) => target.actionId)).toEqual(['available', 'existing_pending'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
