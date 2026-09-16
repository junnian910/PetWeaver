// render-v2-pilot.mjs — additive pilot renderer.
// Renders the three v2 pilot compositions into asset-work/remotion-v2/pilot/.
// Does NOT touch public/ or dist/; does not run the public-oriented stabilizer.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const remotionCli = join(here, 'node_modules', '@remotion', 'cli', 'remotion-cli.js')
const outputDir = join(appRoot, 'asset-work', 'remotion-v2', 'pilot')

const browserCandidates = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
].filter(Boolean)

const COMPOSITIONS = [
  { id: 'Pilot-IdleBreath', actionId: 'idle_breath' },
  { id: 'Pilot-EmoHappy', actionId: 'emo_happy' },
  { id: 'Pilot-ActStretch', actionId: 'act_stretch' },
]

function renderOne(id, actionId) {
  mkdirSync(outputDir, { recursive: true })
  const browserExecutable = browserCandidates.find((candidate) => existsSync(candidate))
  const args = [
    remotionCli,
    'render',
    join(here, 'src', 'index-v2.jsx'),
    id,
    join(outputDir, `${actionId}.webm`),
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
for (const { id, actionId } of COMPOSITIONS) {
  if (filters.length && !filters.includes(actionId) && !filters.includes(id)) continue
  console.log(`Rendering ${id} -> ${actionId}.webm`)
  renderOne(id, actionId)
}
console.log('Done. Outputs in', outputDir)
