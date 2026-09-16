import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getActionMotionSpec } from './src/action-specs.js'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const outputDir = join(appRoot, 'public', 'assets', 'videos', 'actions')
const remotionCli = join(here, 'node_modules', '@remotion', 'cli', 'remotion-cli.js')
const stabilizer = join(appRoot, 'scripts', 'stabilize-action-video.py')
const pythonCandidates = [
  process.env.FAFA_PYTHON,
  join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe'),
  'python',
].filter(Boolean)

const browserCandidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)

function preparePublicFiles(actionId) {
  const spec = getActionMotionSpec(actionId)
  if (!spec) {
    throw new Error(`Unknown action id: ${actionId}`)
  }
  const poseFiles = spec.poseFiles || [spec.poseFile]
  for (const poseFile of poseFiles) {
    const sourcePose = join(appRoot, 'asset-work', 'action-batches', actionId, 'normalized', poseFile)
    const selectedPose = join(appRoot, 'asset-work', 'action-batches', actionId, 'selected.png')
    const targetPose = join(here, 'public', 'action-poses', poseFile)
    if (!existsSync(sourcePose) && !existsSync(selectedPose) && !existsSync(targetPose)) {
      throw new Error(`Missing approved pose for ${actionId}: ${sourcePose}`)
    }
    mkdirSync(dirname(targetPose), { recursive: true })
    if (existsSync(sourcePose)) copyFileSync(sourcePose, targetPose)
    else if (existsSync(selectedPose) && poseFiles.length === 1) copyFileSync(selectedPose, targetPose)
  }
  if (spec.basePoseId) {
    const baseSource = join(appRoot, 'asset-work', 'action-batches', spec.basePoseId, 'selected.png')
    const baseTarget = join(here, 'public', 'action-poses', `${spec.basePoseId}.png`)
    if (!existsSync(baseSource) && !existsSync(baseTarget)) {
      throw new Error(`Missing approved base pose for ${actionId}: ${baseSource}`)
    }
    if (existsSync(baseSource)) {
      copyFileSync(baseSource, baseTarget)
    }
  }
  return spec
}

function stabilizeVideo(outputPath) {
  const python = pythonCandidates.find((candidate) => candidate === 'python' || existsSync(candidate))
  if (!python) throw new Error('找不到 Alpha 帧稳定器 Python 运行时；请设置 FAFA_PYTHON')
  execFileSync(python, [stabilizer, join(here, 'node_modules', '.pnpm', '@remotion+compositor-win32-x64-msvc@4.0.506', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe'), outputPath], { cwd: appRoot, stdio: 'inherit' })
}

export function renderAction(actionId) {
  preparePublicFiles(actionId)
  mkdirSync(outputDir, { recursive: true })
  const browserExecutable = browserCandidates.find((candidate) => existsSync(candidate))
  const args = [
    remotionCli,
    'render',
    join(here, 'src', 'index.jsx'),
    'Fafa-Action',
    join(outputDir, `${actionId}.webm`),
    `--props=${JSON.stringify({ action: actionId })}`,
    '--codec=vp9',
    '--image-format=png',
    '--pixel-format=yuva420p',
    '--crf=12',
    '--concurrency=50%',
    '--overwrite',
  ]
  if (browserExecutable) {
    args.push(`--browser-executable=${browserExecutable}`)
  }
  execFileSync(process.execPath, args, { cwd: here, stdio: 'inherit' })
  stabilizeVideo(join(outputDir, `${actionId}.webm`))
}
