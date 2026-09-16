import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, normalize, relative, sep } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'

/**
 * Live2D 模型文件导入与扫描。
 *
 * 支持单文件（.moc3 / .model3.json / 贴图 / 动作 json）和 ZIP 压缩包。
 * ZIP 解析使用 Node 内置 zlib，不引入第三方依赖；ZIP64 与加密压缩包
 * 会被安全拒绝，避免解析到一半写出损坏文件。
 */

const MAX_ENTRY_COUNT = 4000
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
const MODEL_JSON_GLOB = /\.model3\.json$/i
const MOC3_GLOB = /\.moc3$/i
const TEXTURE_GLOB = /\.(png|webp|jpg|jpeg|bmp|gif)$/i
const MOTION_GLOB = /\.(motion3?\.json|motion\.json)$/i
const EXPRESSION_GLOB = /\.exp3?\.json$/i

export function sanitizeEntryName(name) {
  const normalized = normalize(String(name || '').replaceAll('\\', '/'))
  if (!normalized || normalized === '.') return ''
  if (normalized.startsWith('/') || normalized.includes(':') || normalized.includes('..')) return ''
  return normalized.split('/').filter(Boolean).join(sep)
}

export function isZipBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50
}

export function extractZipBuffer(buffer, destRoot) {
  const end = findEndOfCentralDirectory(buffer)
  if (!end) throw new Error('不是有效的 ZIP 压缩包')
  const entryCount = Math.min(buffer.readUInt16LE(end + 10), MAX_ENTRY_COUNT)
  let offset = buffer.readUInt32LE(end + 16)
  if (!Number.isInteger(offset) || offset < 0 || offset >= buffer.length) throw new Error('ZIP 中央目录偏移无效')
  let totalBytes = 0
  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('ZIP 中央目录损坏')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength

    const entryName = sanitizeEntryName(name)
    if (!entryName) continue
    const target = join(destRoot, entryName)
    if (!target.startsWith(destRoot + sep) && target !== destRoot) continue
    if (entryName.endsWith(sep)) {
      mkdirSync(target, { recursive: true })
      continue
    }
    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    if (dataStart + compressedSize > buffer.length) continue
    let content
    if (method === 0) {
      content = data
    } else if (method === 8) {
      content = inflateRawSync(data)
    } else {
      continue
    }
    totalBytes += content.length
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) throw new Error('压缩包解压后超过 512MB 限制')
    mkdirSync(target.slice(0, target.lastIndexOf(sep)), { recursive: true })
    writeFileSync(target, content)
  }
}

export function extractZipFile(filePath, destRoot) {
  return extractZipBuffer(readFileSync(filePath), destRoot)
}

function findEndOfCentralDirectory(buffer) {
  const minStart = Math.max(0, buffer.length - 65_557)
  for (let cursor = buffer.length - 22; cursor >= minStart; cursor--) {
    if (buffer.readUInt32LE(cursor) === 0x06054b50) {
      const commentLength = buffer.readUInt16LE(cursor + 20)
      if (cursor + 22 + commentLength === buffer.length) return cursor
    }
  }
  return null
}

export function scanModelDir(modelDir) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__MACOSX') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) files.push(path)
    }
  }
  if (existsSync(modelDir)) walk(modelDir)
  const modelJson = files.find((path) => MODEL_JSON_GLOB.test(path))
  const moc3 = files.find((path) => MOC3_GLOB.test(path))
  const textures = files.filter((path) => TEXTURE_GLOB.test(path)).map((path) => relative(modelDir, path)).sort()
  const motions = files.filter((path) => MOTION_GLOB.test(path)).map((path) => relative(modelDir, path)).sort()
  const expressions = files.filter((path) => EXPRESSION_GLOB.test(path)).map((path) => relative(modelDir, path)).sort()
  const manifest = modelJson ? readManifest(modelJson) : null
  return {
    modelJson: modelJson ? relative(modelDir, modelJson) : '',
    moc3: moc3 ? relative(modelDir, moc3) : '',
    textures,
    motions,
    expressions,
    textureCount: textures.length,
    motionCount: motions.length,
    expressionCount: expressions.length,
    manifest
  }
}

export function readManifest(manifestPath) {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
    return {
      version: parsed?.Version ?? parsed?.version ?? 0,
      name: String(parsed?.Name || parsed?.name || ''),
      model: String(parsed?.FileReferences?.Moc || parsed?.FileReferences?.moc || ''),
      textures: Array.isArray(parsed?.FileReferences?.Textures) ? parsed.FileReferences.Textures : [],
      expressions: Array.isArray(parsed?.FileReferences?.Expressions) ? parsed.FileReferences.Expressions.map((entry) => ({ name: entry?.Name, file: entry?.File })) : [],
      motions: extractMotionGroups(parsed?.FileReferences?.Motions)
    }
  } catch {
    return null
  }
}

function extractMotionGroups(motions) {
  if (!motions || typeof motions !== 'object') return []
  return Object.entries(motions).map(([name, entries]) => ({
    name,
    files: (Array.isArray(entries) ? entries : []).map((entry) => ({
      file: entry?.File || '',
      fadeIn: Number(entry?.FadeInTime || 0),
      fadeOut: Number(entry?.FadeOutTime || 0)
    }))
  }))
}

export function importAvatarFile({ filePath, destRoot }) {
  const ext = extname(filePath || '').toLowerCase()
  const stamp = Date.now()
  const modelId = 'model-' + stamp + '-' + randomUUID().slice(0, 8)
  const originalName = basename(filePath || 'model')
  const modelDir = join(destRoot, modelId)
  mkdirSync(modelDir, { recursive: true })
  if (ext === '.zip') extractZipFile(filePath, modelDir)
  else copyFileSync(filePath, join(modelDir, originalName))
  return finishImportedModel({ modelDir, modelId, originalName })
}

/**
 * 把同一次多选导入（通常是一个目录里的 model3.json + moc3 + 贴图）
 * 合并成同一个模型记录，避免每个文件都变成一个独立模型。
 */
export function importAvatarFiles({ filePaths = [], destRoot }) {
  const list = filePaths.filter((path) => path && existsSync(path))
  if (!list.length) throw new Error('没有可导入的文件')
  const stamp = Date.now()
  const modelId = 'model-' + stamp + '-' + randomUUID().slice(0, 8)
  const originalName = basename(list[0] || 'model')
  const modelDir = join(destRoot, modelId)
  mkdirSync(modelDir, { recursive: true })
  for (const filePath of list) {
    const ext = extname(filePath).toLowerCase()
    if (ext === '.zip') extractZipFile(filePath, modelDir)
    else copyFileSync(filePath, join(modelDir, basename(filePath)))
  }
  return finishImportedModel({ modelDir, modelId, originalName })
}

function finishImportedModel({ modelDir, modelId, originalName }) {
  const scanned = scanModelDir(modelDir)
  const manifestName = scanned.manifest?.name || ''
  const name = manifestName || originalName.replace(/\.[^.]+$/, '') || modelId
  return {
    id: modelId,
    name,
    sourceName: originalName,
    path: modelDir,
    importedAt: Date.now(),
    ...scanned
  }
}

export function assertModelDirInside(destRoot, modelDir) {
  const root = normalize(destRoot) + sep
  const target = normalize(modelDir)
  if (target !== normalize(destRoot) && !target.startsWith(root)) throw new Error('模型路径越界')
}

export function describeModel(model) {
  const parts = []
  if (model?.modelJson) parts.push('model3.json')
  if (model?.moc3) parts.push('moc3')
  parts.push(model?.textureCount ? `${model.textureCount} 张贴图` : '无贴图')
  parts.push(model?.motionCount ? `${model.motionCount} 组动作` : '无动作文件')
  parts.push(model?.expressionCount ? `${model.expressionCount} 个表情文件` : '未发现独立表情文件')
  return parts.join('，')
}
