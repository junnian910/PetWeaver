import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/logger.js', () => ({ log: vi.fn() }))

import { VOICE_SAMPLE_EXTENSIONS, VoiceSampleService } from '../src/main/providers/voice-samples.js'

function makeService() {
  const tmp = mkdtempSync(join(tmpdir(), 'vs-test-'))
  const src = join(tmp, 'demo.wav')
  writeFileSync(src, Buffer.from([0, 1, 2, 3]))
  let stored = { tts: { customVoices: [] } }
  const configStore = {
    getAll: () => stored,
    update: (patch) => { stored = { ...stored, tts: { ...stored.tts, ...patch.tts } }; return stored }
  }
  const service = new VoiceSampleService({ configStore, root: join(tmp, 'samples') })
  return { service, src, bad: join(tmp, 'bad.txt'), tmp }
}

describe('VoiceSampleService', () => {
  it('imports audio files into the samples root and registers them', async () => {
    const { service, src } = makeService()
    const list = await service.importPaths([src])
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('demo')
    expect(existsSync(list[0].path)).toBe(true)
    expect(VOICE_SAMPLE_EXTENSIONS).toContain('wav')
  })

  it('deduplicates re-imports by name and removes files on delete', async () => {
    const { service, src } = makeService()
    const first = await service.importPaths([src])
    const second = await service.importPaths([src])
    expect(second).toHaveLength(1)
    const after = await service.remove(first[0].id)
    expect(after).toHaveLength(0)
    expect(existsSync(first[0].path)).toBe(false)
  })

  it('rejects unsupported file extensions', async () => {
    const { service, bad } = makeService()
    await expect(service.importPaths([bad])).rejects.toThrow('不支持的音频格式')
  })
})
