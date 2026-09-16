import { limitUnicode } from './text-limit.js'

export const AI_MEMORY_CAPACITY = 400
export const AI_MEMORY_RECALL_LIMIT = 3

function finiteVector(value) {
  if (!Array.isArray(value) && !(value instanceof Float32Array) && !(value instanceof Float64Array)) return null
  const vector = Array.from(value, Number)
  return vector.length && vector.every(Number.isFinite) ? vector : null
}

export function cosineSimilarity(left, right) {
  const a = finiteVector(left)
  const b = finiteVector(right)
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]
    leftNorm += a[index] * a[index]
    rightNorm += b[index] * b[index]
  }
  if (!leftNorm || !rightNorm) return 0
  return dot / Math.sqrt(leftNorm * rightNorm)
}

function normalizeRecord(record) {
  const vector = finiteVector(record?.vector || record?.embedding)
  const prompt = limitUnicode(record?.prompt, 40).trim()
  const reply = limitUnicode(record?.reply, 40).trim()
  if (!prompt || !reply || !vector) return null
  return {
    prompt,
    reply,
    at: Number.isFinite(Number(record?.at)) ? Number(record.at) : Date.now(),
    vector
  }
}

/**
 * Small bounded local memory store. A linear scan is intentional: 400 vectors
 * are cheap to search and avoiding an ANN dependency keeps the desktop build
 * simple and deterministic.
 */
export class AIMemoryStore {
  constructor({ store = null, capacity = AI_MEMORY_CAPACITY } = {}) {
    this.store = store
    this.capacity = Math.max(1, Math.round(Number(capacity) || AI_MEMORY_CAPACITY))
    const saved = this.store?.get?.('records', [])
    this.records = (Array.isArray(saved) ? saved : []).map(normalizeRecord).filter(Boolean).slice(-this.capacity)
  }

  add(record) {
    const normalized = normalizeRecord(record)
    if (!normalized) return false
    this.records.push(normalized)
    if (this.records.length > this.capacity) this.records.splice(0, this.records.length - this.capacity)
    this.store?.set?.('records', this.records)
    return true
  }

  search(vector, limit = AI_MEMORY_RECALL_LIMIT) {
    const query = finiteVector(vector)
    if (!query) return []
    const count = Math.max(0, Math.min(AI_MEMORY_RECALL_LIMIT, Math.round(Number(limit) || AI_MEMORY_RECALL_LIMIT)))
    return this.records
      .map((record) => ({ ...record, score: cosineSimilarity(query, record.vector) }))
      .sort((left, right) => right.score - left.score || right.at - left.at)
      .slice(0, count)
  }

  size() { return this.records.length }
  capacityLimit() { return this.capacity }
  snapshot() { return this.records.map((record) => ({ ...record, vector: [...record.vector] })) }
}

