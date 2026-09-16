import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  ACTION_REGISTRY,
  EXTENSION_ACTION_IDS,
  PLANNED_ACTION_COUNT,
} from '../src/main/core/action-registry.js'

export const VIDEO_RULES = Object.freeze({
  width: 384,
  height: 416,
  fps: 60,
  minDuration: 1.6,
  maxDuration: 3.2,
  alphaThreshold: 8,
  maxCenterSpan: 3,
  maxFootSpan: 2,
  maxMotionCenterSpan: 64,
  maxMotionFootSpan: 28,
  maxEndDelta: 3,
})

const MOVING_ACTION_IDS = new Set([
  'idle_stare',
  'emo_happy', 'emo_shy', 'emo_angry', 'emo_sleepy', 'emo_sad', 'emo_excited',
  'emo_surprise', 'emo_aggrieved', 'act_stretch', 'act_spin', 'act_scratch',
  'act_flip_hair', 'act_yawn', 'act_table', 'act_lookaround', 'act_roll',
  'act_hop', 'act_chin', 'act_rub_eye', 'act_sneeze', 'act_dance', 'act_work',
  'act_ink', 'act_firework', 'act_intro', 'act_joke', 'gift_thanks', 'gift_sc',
  'gift_guard', 'special_hourly', 'special_lottery', 'state_move', 'state_observe',
  'state_talking',
])

const MOTION_LIMIT_OVERRIDES = new Map([
  ['act_spin', { center: 110, foot: 10 }],
  ['act_roll', { center: 100, foot: 26 }],
  // v0.2 程序化连续动画：待机类动作带呼吸/摇摆/点头微动，放宽静止中心/脚底限值。
  ['idle_breath', { center: 20, foot: 12 }],
  ['idle_blink', { center: 20, foot: 12 }],
  ['act_sing', { center: 30, foot: 14 }],
  ['act_sleep', { center: 20, foot: 12 }],
  ['act_wake', { center: 40, foot: 24 }],
  ['act_greet', { center: 46, foot: 12 }],
  ['emo_shout', { center: 36, foot: 24 }],
  ['act_cover_ears', { center: 20, foot: 14 }],
  // 回待机转场自带落定弹跳，按待机类动作限值放宽。
  ['transition_settle', { center: 20, foot: 12 }],
])

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..')

function executableName(name, platform = process.platform) {
  return platform === 'win32' ? `${name}.exe` : name
}

function locatePython(env = process.env) {
  const configured = env.FAFA_PYTHON
  if (configured && existsSync(configured)) return resolve(configured)
  const bundled = env.USERPROFILE
    ? join(env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe')
    : null
  if (bundled && existsSync(bundled)) return bundled
  for (const name of ['python', 'python3']) {
    const found = executableFromPath(name, env)
    if (found) return found
  }
  throw new Error('找不到带 Pillow 的 Python；请设置 FAFA_PYTHON')
}

function pathEntries(env = process.env) {
  const value = env.PATH || env.Path || ''
  return value.split(';').filter(Boolean)
}

function executableFromPath(name, env = process.env, platform = process.platform) {
  const fileName = executableName(name, platform)
  const configured = env[`FAFA_${name.toUpperCase()}`] || env[name.toUpperCase()] || env[name]
  if (configured && existsSync(configured)) return resolve(configured)
  for (const directory of pathEntries(env)) {
    const candidate = join(directory, fileName)
    if (existsSync(candidate)) return resolve(candidate)
  }
  return null
}

function remotionCompositorCandidates(projectRoot, platform = process.platform) {
  const remotionRoot = join(projectRoot, 'remotion-pet', 'node_modules')
  const packageDirs = new Set()
  const directRoot = join(remotionRoot, '@remotion')
  if (existsSync(directRoot)) {
    for (const entry of readdirSync(directRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('compositor-')) packageDirs.add(join(directRoot, entry.name))
    }
  }
  const pnpmRoot = join(remotionRoot, '.pnpm')
  if (existsSync(pnpmRoot)) {
    for (const entry of readdirSync(pnpmRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('@remotion+compositor-')) {
        const packageName = entry.name.slice('@remotion+'.length).split('@')[0]
        packageDirs.add(join(pnpmRoot, entry.name, 'node_modules', '@remotion', packageName))
      }
    }
  }
  return [...packageDirs]
}

export function locateMediaTools({ projectRoot = PROJECT_ROOT, env = process.env, platform = process.platform } = {}) {
  const names = ['ffmpeg', 'ffprobe']
  const found = {}
  for (const name of names) {
    found[name] = executableFromPath(name, env, platform)
  }
  const compositorDirs = remotionCompositorCandidates(projectRoot, platform)
  for (const name of names) {
    if (found[name]) continue
    const fileName = executableName(name, platform)
    for (const directory of compositorDirs) {
      const candidate = join(directory, fileName)
      if (existsSync(candidate)) {
        found[name] = resolve(candidate)
        break
      }
    }
  }
  const missing = names.filter((name) => !found[name])
  if (missing.length) {
    throw new Error(`找不到 Remotion 内置媒体工具：${missing.join('、')}。请安装 remotion-pet 依赖，或设置 FAFA_FFMPEG/FAFA_FFPROBE。`)
  }
  return { ...found, python: locatePython(env) }
}

export function parseRational(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return Number.NaN
  const [numerator, denominator] = value.split('/').map(Number)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return Number.NaN
  return numerator / denominator
}

function durationFromMetadata(stream, format) {
  const values = [stream?.duration, format?.duration, stream?.tags?.DURATION, stream?.tags?.duration]
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string') continue
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
    const match = value.match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/)
    if (match) return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3])
  }
  return Number.NaN
}

export function parseProbeOutput(output) {
  const data = typeof output === 'string' ? JSON.parse(output) : output
  const streams = Array.isArray(data?.streams) ? data.streams : []
  const stream = streams.find((candidate) => candidate.codec_type === 'video') || streams[0] || {}
  const alphaMode = stream.tags?.alpha_mode ?? stream.tags?.ALPHA_MODE ?? null
  return {
    codec: stream.codec_name || null,
    width: Number(stream.width),
    height: Number(stream.height),
    fps: parseRational(stream.avg_frame_rate) || parseRational(stream.r_frame_rate),
    duration: durationFromMetadata(stream, data?.format),
    alphaMode: alphaMode == null ? null : String(alphaMode),
    pixelFormat: stream.pix_fmt || null,
    stream,
    format: data?.format || {},
  }
}

function registryEntries(registry = ACTION_REGISTRY, extensionIds = EXTENSION_ACTION_IDS) {
  const extensionSet = new Set(extensionIds)
  return registry.filter((entry) => !extensionSet.has(entry.id))
}

export function registryReleaseIssues(
  registry = ACTION_REGISTRY,
  { plannedCount = PLANNED_ACTION_COUNT, extensionIds = EXTENSION_ACTION_IDS } = {},
) {
  const planned = registryEntries(registry, extensionIds)
  const issues = []
  if (planned.length !== plannedCount) {
    issues.push(`策划动作数量为 ${planned.length}，应为 ${plannedCount}`)
  }
  for (const entry of planned) {
    if (entry.assetStatus !== 'available') issues.push(`${entry.id}: assetStatus=${entry.assetStatus}`)
    if (!entry.videoPath) issues.push(`${entry.id}: 缺少 videoPath`)
  }
  const paths = new Map()
  for (const entry of planned) {
    if (!entry.videoPath) continue
    const previous = paths.get(entry.videoPath)
    if (previous) issues.push(`视频路径重复：${previous} 与 ${entry.id} -> ${entry.videoPath}`)
    else paths.set(entry.videoPath, entry.id)
  }
  return issues
}

export function resolveVideoPath(projectRoot, videoPath) {
  if (typeof videoPath !== 'string' || !videoPath) return null
  const publicRoot = resolve(projectRoot, 'public')
  const candidate = resolve(publicRoot, videoPath.replace(/^[/\\]+/, ''))
  const relativePath = relative(publicRoot, candidate)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return null
  return candidate
}

export function buildValidationTargets({
  registry = ACTION_REGISTRY,
  projectRoot = PROJECT_ROOT,
  mode = 'development',
} = {}) {
  const release = mode === 'release'
  const planned = registryEntries(registry)
  const selected = release
    ? planned
    : registry.filter((entry) => entry.assetStatus === 'available' || (entry.assetStatus === 'pending' && resolveVideoPath(projectRoot, entry.videoPath) && existsSync(resolveVideoPath(projectRoot, entry.videoPath))))
  return selected.map((entry) => ({
    actionId: entry.id,
    videoPath: entry.videoPath,
    filePath: resolveVideoPath(projectRoot, entry.videoPath),
    assetStatus: entry.assetStatus,
    loop: entry.loop,
  }))
}

function runProbe(ffprobe, filePath) {
  const result = spawnSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error((result.stderr || '').trim() || `ffprobe 退出码 ${result.status}`)
  return parseProbeOutput(result.stdout)
}

function metadataIssues(metadata, actionId) {
  const issues = []
  if (metadata.codec !== 'vp9') issues.push(`${actionId}: codec=${metadata.codec || 'unknown'}，要求 VP9`)
  if (metadata.width !== VIDEO_RULES.width || metadata.height !== VIDEO_RULES.height) issues.push(`${actionId}: 分辨率=${metadata.width}x${metadata.height}，要求 ${VIDEO_RULES.width}x${VIDEO_RULES.height}`)
  if (!Number.isFinite(metadata.fps) || Math.abs(metadata.fps - VIDEO_RULES.fps) > 0.001) issues.push(`${actionId}: fps=${metadata.fps}，要求 ${VIDEO_RULES.fps}`)
  if (!Number.isFinite(metadata.duration) || metadata.duration < VIDEO_RULES.minDuration || metadata.duration > VIDEO_RULES.maxDuration) issues.push(`${actionId}: 时长=${metadata.duration}，要求 ${VIDEO_RULES.minDuration}-${VIDEO_RULES.maxDuration} 秒`)
  if (metadata.alphaMode !== '1') issues.push(`${actionId}: alpha_mode=${metadata.alphaMode || 'missing'}，要求 1`)
  return issues
}

function runProcess(command, args) {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, { windowsHide: true })
    const stderr = []
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', rejectProcess)
    child.on('close', (code) => {
      if (code === 0) resolveProcess()
      else rejectProcess(new Error(Buffer.concat(stderr).toString('utf8').trim() || `${command} 退出码 ${code}`))
    })
  })
}

export async function analyzeAlphaStability({ filePath, ffmpeg, python, tempParent = tmpdir() }) {
  const tempDir = await mkdtemp(join(tempParent, 'fafa-action-'))
  try {
    await runProcess(ffmpeg, ['-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', filePath, '-map', '0:v:0', '-an', '-vsync', '0', join(tempDir, 'frame-%04d.png')])
    const analysis = spawnSync(python, [join(SCRIPT_DIR, 'analyze-alpha-frames.py'), tempDir, String(VIDEO_RULES.alphaThreshold)], {
      encoding: 'utf8',
      windowsHide: true,
    })
    if (analysis.error) throw analysis.error
    if (analysis.status !== 0) throw new Error((analysis.stderr || '').trim() || `Python 退出码 ${analysis.status}`)
    return JSON.parse(analysis.stdout)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function validateTarget(target, tools) {
  const issues = []
  if (!target.filePath) issues.push(`${target.actionId}: videoPath 不在 public 目录内`)
  else if (!existsSync(target.filePath)) issues.push(`${target.actionId}: 文件不存在 ${target.filePath}`)
  if (issues.length) return { ...target, issues }
  let metadata
  try {
    metadata = runProbe(tools.ffprobe, target.filePath)
    issues.push(...metadataIssues(metadata, target.actionId))
  } catch (error) {
    issues.push(`${target.actionId}: ffprobe 失败：${error.message}`)
    return { ...target, issues }
  }
  try {
    const stability = await analyzeAlphaStability({ filePath: target.filePath, ffmpeg: tools.ffmpeg, python: tools.python })
    const moving = MOVING_ACTION_IDS.has(target.actionId)
    const override = MOTION_LIMIT_OVERRIDES.get(target.actionId)
    const centerLimit = override?.center ?? (moving ? VIDEO_RULES.maxMotionCenterSpan : VIDEO_RULES.maxCenterSpan)
    const footLimit = override?.foot ?? (moving ? VIDEO_RULES.maxMotionFootSpan : VIDEO_RULES.maxFootSpan)
    if (stability.centerSpanX > centerLimit || stability.centerSpanY > centerLimit) issues.push(`${target.actionId}: 中心运动=${stability.centerSpanX.toFixed(2)}x${stability.centerSpanY.toFixed(2)} px，要求 <=${centerLimit}`)
    if (stability.footSpan > footLimit) issues.push(`${target.actionId}: 脚底运动=${stability.footSpan.toFixed(2)} px，要求 <=${footLimit}`)
    if (target.loop && (stability.endCenterDeltaX > VIDEO_RULES.maxEndDelta || stability.endCenterDeltaY > VIDEO_RULES.maxEndDelta || stability.endFootDelta > VIDEO_RULES.maxEndDelta)) issues.push(`${target.actionId}: 首尾未归位 center=${stability.endCenterDeltaX.toFixed(2)}x${stability.endCenterDeltaY.toFixed(2)} foot=${stability.endFootDelta.toFixed(2)} px`)
    return { ...target, metadata, stability, issues }
  } catch (error) {
    issues.push(`${target.actionId}: Alpha/稳定性检查失败：${error.message}`)
    return { ...target, metadata, issues }
  }
}

export async function validateActionVideos({ projectRoot = PROJECT_ROOT, mode = 'development', registry = ACTION_REGISTRY, tools = null } = {}) {
  const release = mode === 'release'
  const registryIssues = release ? registryReleaseIssues(registry) : []
  const selectedTools = tools || locateMediaTools({ projectRoot })
  const targets = buildValidationTargets({ registry, projectRoot, mode })
  const results = []
  for (const target of targets) results.push(await validateTarget(target, selectedTools))
  const issues = [...registryIssues, ...results.flatMap((result) => result.issues)]
  if (release) {
    for (const entry of registryEntries(registry)) {
      if (!targets.some((target) => target.actionId === entry.id)) issues.push(`${entry.id}: 未进入发布检查`)
    }
  }
  return { mode, tools: selectedTools, registryIssues, results, issues, passed: issues.length === 0 }
}

async function main() {
  const mode = process.argv.includes('--release') ? 'release' : 'development'
  try {
    const report = await validateActionVideos({ mode })
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`动作视频 QA：${report.results.length} 个文件，${report.passed ? '通过' : `发现 ${report.issues.length} 个问题`}`)
      for (const result of report.results) {
        const stability = result.stability
        const metrics = stability ? `center=${stability.centerSpanX.toFixed(1)}x${stability.centerSpanY.toFixed(1)} foot=${stability.footSpan.toFixed(1)}` : 'stability=n/a'
        console.log(`${result.issues.length ? 'FAIL' : 'PASS'} ${result.actionId} ${metrics}`)
      }
      for (const issue of report.issues) console.error(`- ${issue}`)
    }
    if (!report.passed) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
