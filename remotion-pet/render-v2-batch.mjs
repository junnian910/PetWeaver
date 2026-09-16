// render-v2-batch.mjs — additive batch renderer for the v2 motion recipes.
// Renders the full 27-action batch into asset-work/remotion-v2/batch/, plus the
// 5 top-level videos (idle/singing/sleeping/waking/waving-real) which live
// directly under their final names. Does NOT touch public/ or dist/.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const remotionCli = join(here, 'node_modules', '@remotion', 'cli', 'remotion-cli.js')
const batchDir = join(appRoot, 'asset-work', 'remotion-v2', 'batch')

const browserCandidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)

// Top-level videos live under public/assets/videos/ -> batch root uses the same
// basename (idle.webm, singing.webm, ...). All others go under actions/.
const TOP_LEVEL = new Set(['idle', 'singing', 'sleeping', 'waking', 'waving-real'])

const ACTIONS = [
  'idle', 'singing', 'sleeping', 'waking', 'waving-real',
  'emo_happy', 'emo_sleepy', 'act_chin', 'act_yawn', 'emo_surprise',
  'gift_thanks', 'emo_sad', 'idle_stare', 'emo_shy', 'idle_blink',
  'act_work', 'act_intro', 'special_hourly', 'act_rub_eye', 'gift_sc',
  'gift_guard', 'act_table', 'act_sneeze', 'emo_excited', 'act_stretch',
  'emo_shout', 'act_cover_ears',
]

function outputPathFor(actionId) {
  const filename = `${actionId}.webm`
  return TOP_LEVEL.has(actionId)
    ? join(appRoot, 'asset-work', 'remotion-v2', 'batch', 'top-level', filename)
    : join(batchDir, 'actions', filename)
}

function renderOne(actionId) {
  const out = outputPathFor(actionId)
  mkdirSync(dirname(out), { recursive: true })
  const browserExecutable = browserCandidates.find((candidate) => existsSync(candidate))
  const args = [
    remotionCli,
    'render',
    join(here, 'src', 'index-v2.jsx'),
    `V2-${actionId.replace(/_/g, '-')}`,
    out,
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
}

const filters = process.argv.slice(2).filter((a) => !a.startsWith('--'))
for (const actionId of ACTIONS) {
  if (filters.length && !filters.includes(actionId)) continue
  console.log(`Rendering ${actionId} -> ${outputPathFor(actionId)}`)
  renderOne(actionId)
}
console.log('Done. Outputs under', batchDir)
