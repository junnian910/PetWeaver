import { describe, expect, it } from 'vitest'
import { AI_MEMORY_CAPACITY, AIMemoryStore } from '../src/main/core/ai-memory.js'
import { limitUnicode } from '../src/main/core/text-limit.js'

class MemoryStore {
  constructor() { this.values = new Map() }
  get(key, fallback) { return this.values.has(key) ? this.values.get(key) : fallback }
  set(key, value) { this.values.set(key, structuredClone(value)) }
}

describe('local AI memory', () => {
  it('keeps the newest 400 successful conversations and persists them', () => {
    const store = new MemoryStore()
    const memory = new AIMemoryStore({ store })
    for (let index = 0; index < AI_MEMORY_CAPACITY + 5; index += 1) {
      expect(memory.add({ prompt: '问题' + index, reply: '回答' + index, at: index, vector: [1, index] })).toBe(true)
    }

    expect(memory.size()).toBe(400)
    expect(memory.snapshot()[0].prompt).toBe('问题5')
    expect(store.get('records', []).length).toBe(400)
  })

  it('returns the three closest memories in similarity order', () => {
    const memory = new AIMemoryStore()
    memory.add({ prompt: '同方向', reply: '一', at: 1, vector: [1, 0] })
    memory.add({ prompt: '垂直', reply: '二', at: 2, vector: [0, 1] })
    memory.add({ prompt: '相近', reply: '三', at: 3, vector: [0.9, 0.1] })
    memory.add({ prompt: '反方向', reply: '四', at: 4, vector: [-1, 0] })

    expect(memory.search([1, 0]).map((item) => item.prompt)).toEqual(['同方向', '相近', '垂直'])
    expect(memory.search([1, 0], 99)).toHaveLength(3)
  })

  it('limits grapheme clusters without splitting emoji sequences', () => {
    expect(limitUnicode('😀'.repeat(41), 40)).toBe('😀'.repeat(40))
    expect(limitUnicode('👩‍💻'.repeat(41), 40)).toBe('👩‍💻'.repeat(40))
  })
})
