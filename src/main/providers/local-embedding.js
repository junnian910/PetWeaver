import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { limitUnicode } from '../core/text-limit.js'

export const LOCAL_MEMORY_MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

function defaultModelRoot() {
  const packagedRoot = process.resourcesPath ? join(process.resourcesPath, 'models') : ''
  const developmentRoot = join(process.cwd(), 'models')
  return packagedRoot && existsSync(packagedRoot) ? packagedRoot : developmentRoot
}

function localWasmPaths() {
  const roots = [
    process.resourcesPath ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@huggingface', 'transformers', 'dist') : '',
    join(process.cwd(), 'node_modules', '@huggingface', 'transformers', 'dist'),
  ].filter(Boolean)
  const root = roots.find((candidate) => existsSync(join(candidate, 'ort-wasm-simd-threaded.jsep.mjs')))
  if (!root) return null
  return {
    mjs: pathToFileURL(join(root, 'ort-wasm-simd-threaded.jsep.mjs')).href,
    wasm: pathToFileURL(join(root, 'ort-wasm-simd-threaded.jsep.wasm')).href,
  }
}

/**
 * Lazy, offline-only MiniLM feature extractor. No network fallback is allowed:
 * the installer must carry the model files, otherwise memory retrieval simply
 * remains disabled while chat continues to work.
 */
export class LocalEmbeddingProvider {
  constructor({ modelId = LOCAL_MEMORY_MODEL_ID, modelRoot = defaultModelRoot(), dtype = 'q8' } = {}) {
    this.modelId = modelId
    this.modelRoot = modelRoot
    this.dtype = dtype
    this.extractor = null
    this.loading = null
    this.lastError = ''
  }

  modelPath() { return join(this.modelRoot, ...this.modelId.split('/')) }

  available() {
    const root = this.modelPath()
    return existsSync(join(root, 'config.json')) &&
      existsSync(join(root, 'tokenizer.json')) &&
      (existsSync(join(root, 'onnx', 'model_quantized.onnx')) || existsSync(join(root, 'onnx', 'model.onnx')))
  }

  status() {
    return { modelId: this.modelId, available: this.available(), loaded: Boolean(this.extractor), error: this.lastError }
  }

  async #load() {
    if (this.extractor) return this.extractor
    if (this.loading) return this.loading
    this.loading = (async () => {
      if (!this.available()) throw new Error('本地 MiniLM 模型文件不存在')
      const { env, pipeline } = await import('@huggingface/transformers')
      env.allowRemoteModels = false
      env.allowLocalModels = true
      env.localModelPath = this.modelRoot
      const wasmPaths = localWasmPaths()
      if (wasmPaths && env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = wasmPaths
      this.extractor = await pipeline('feature-extraction', this.modelId, { dtype: this.dtype })
      this.lastError = ''
      return this.extractor
    })().catch((error) => {
      this.lastError = String(error?.message || error)
      throw error
    }).finally(() => { this.loading = null })
    return this.loading
  }

  async embed(text) {
    const extractor = await this.#load()
    const output = await extractor(limitUnicode(text, 200), { pooling: 'mean', normalize: true })
    if (output?.data) return Array.from(output.data, Number)
    const nested = output?.tolist?.()
    const vector = Array.isArray(nested?.[0]) ? nested[0] : nested
    return Array.from(vector || [], Number)
  }
}
