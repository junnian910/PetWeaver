import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

function readArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (item.startsWith('--')) values.set(item, argv[++index])
  }
  return values
}

function required(values, key) {
  const value = values.get(key)
  if (!value) throw new Error(`${key} is required`)
  return value
}

function packagePath(root, value) {
  const candidate = resolve(root, String(value || ''))
  const child = relative(root, candidate)
  if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error(`unsafe package path: ${value}`)
  return candidate
}

function numberFromRational(value) {
  const [numerator, denominator] = String(value || '').split('/').map(Number)
  return denominator ? numerator / denominator : Number(value)
}

function probe(ffprobe, filePath) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath], { encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr.trim() || `ffprobe exited with ${result.status}`)
  const data = JSON.parse(result.stdout)
  const stream = data.streams?.find((entry) => entry.codec_type === 'video') || data.streams?.[0] || {}
  return {
    codec: stream.codec_name,
    width: Number(stream.width),
    height: Number(stream.height),
    fps: numberFromRational(stream.avg_frame_rate || stream.r_frame_rate),
    duration: Number(data.format?.duration || stream.duration),
    alphaMode: String(stream.tags?.alpha_mode ?? stream.tags?.ALPHA_MODE ?? '')
  }
}

const values = readArgs(process.argv.slice(2))
const projectRoot = resolve(required(values, '--project-root'))
const runDir = resolve(required(values, '--run-dir'))
const ffprobe = resolve(required(values, '--ffprobe'))
const registryUrl = pathToFileURL(join(projectRoot, 'src', 'main', 'core', 'action-registry.js')).href
const { ACTION_REGISTRY } = await import(registryUrl)
const manifest = JSON.parse(readFileSync(join(runDir, 'pet.json'), 'utf8'))
const jobs = JSON.parse(readFileSync(join(runDir, 'jobs.json'), 'utf8'))
const issues = []
const results = []

if (manifest.schemaVersion !== 1) issues.push('pet.json schemaVersion must be 1')
if (manifest.renderer?.type !== 'video-actions') issues.push('renderer.type must be video-actions')
if (jobs.registryCount !== ACTION_REGISTRY.length) issues.push(`jobs registryCount=${jobs.registryCount}, expected ${ACTION_REGISTRY.length}`)
try {
  const neutralExpression = packagePath(runDir, manifest.expressions?.neutral)
  if (!existsSync(neutralExpression)) issues.push('expressions.neutral asset is missing')
} catch (error) {
  issues.push(`expressions.neutral: ${error.message}`)
}

const registryIds = ACTION_REGISTRY.map((entry) => entry.id)
const manifestIds = Object.keys(manifest.actions || {})
for (const id of registryIds) if (!manifestIds.includes(id)) issues.push(`manifest is missing action ${id}`)
for (const id of manifestIds) if (!registryIds.includes(id)) issues.push(`manifest has unknown action ${id}`)

for (const entry of ACTION_REGISTRY) {
  const action = manifest.actions?.[entry.id]
  const job = jobs.jobs?.find((candidate) => candidate.id === entry.id)
  const requiredAsset = entry.enabled !== false
  const result = { actionId: entry.id, required: requiredAsset, issues: [] }
  if (!action) {
    result.issues.push('missing manifest entry')
  } else {
    let videoPath
    try {
      videoPath = packagePath(runDir, action.asset)
    } catch (error) {
      result.issues.push(error.message)
    }
    if (videoPath && existsSync(videoPath)) {
      try {
        const metadata = probe(ffprobe, videoPath)
        result.metadata = metadata
        if (metadata.codec !== 'vp9') result.issues.push(`codec=${metadata.codec || 'unknown'}`)
        if (metadata.width !== 384 || metadata.height !== 416) result.issues.push(`size=${metadata.width}x${metadata.height}`)
        if (!Number.isFinite(metadata.fps) || Math.abs(metadata.fps - 60) > 0.01) result.issues.push(`fps=${metadata.fps}`)
        if (!Number.isFinite(metadata.duration) || metadata.duration < 1.6 || metadata.duration > 3.2) result.issues.push(`duration=${metadata.duration}`)
        if (metadata.alphaMode !== '1') result.issues.push(`alpha_mode=${metadata.alphaMode || 'missing'}`)
      } catch (error) {
        result.issues.push(`ffprobe failed: ${error.message}`)
      }
    } else if (requiredAsset && !action.fallback) {
      result.issues.push('required video is missing and no fallback is declared')
    } else if (requiredAsset && action.fallback && !manifest.actions?.[action.fallback]) {
      result.issues.push(`fallback target is missing: ${action.fallback}`)
    }
  }
  if (!job) result.issues.push('missing jobs.json entry')
  results.push(result)
  issues.push(...result.issues.map((message) => `${entry.id}: ${message}`))
}

const report = {
  ok: issues.length === 0,
  registryCount: ACTION_REGISTRY.length,
  requiredCount: ACTION_REGISTRY.filter((entry) => entry.enabled !== false).length,
  passedVideos: results.filter((result) => result.metadata && result.issues.length === 0).length,
  issues,
  results
}
mkdirSync(join(runDir, 'qa'), { recursive: true })
writeFileSync(join(runDir, 'qa', 'validation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ ok: report.ok, passedVideos: report.passedVideos, issueCount: issues.length }, null, 2))
if (!report.ok) process.exitCode = 1
