import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LocalEmbeddingProvider, LOCAL_MEMORY_MODEL_ID } from '../src/main/providers/local-embedding.js'

describe('bundled local MiniLM embedding', () => {
  it('loads the offline model and produces a normalized 384-dimension vector', async () => {
    const provider = new LocalEmbeddingProvider({ modelRoot: fileURLToPath(new URL('../models', import.meta.url)) })
    expect(provider.modelId).toBe(LOCAL_MEMORY_MODEL_ID)
    expect(provider.available()).toBe(true)
    const vector = await provider.embed('直播间测试')
    expect(vector).toHaveLength(384)
    expect(vector.every(Number.isFinite)).toBe(true)
  }, 30_000)
})
