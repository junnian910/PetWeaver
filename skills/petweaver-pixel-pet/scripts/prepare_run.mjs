import { mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function readArgs(argv) {
  const values = new Map()
  const flags = new Set()
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) continue
    if (item === '--include-disabled') flags.add(item)
    else values.set(item, argv[++index])
  }
  return { values, flags }
}

function required(values, key) {
  const value = values.get(key)
  if (!value) throw new Error(`${key} is required`)
  return value
}

function safeRelative(value) {
  const normalized = String(value || '').replaceAll('\\', '/')
  if (!normalized || isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`unsafe package path: ${value}`)
  }
  return normalized
}

function actionPrompt({ entry, direction, style, chromaKey }) {
  const timeline = entry.loop
    ? 'Show eight evenly spaced phases of a seamless loop. The eighth pose must connect naturally back to the first pose without duplicating it exactly.'
    : 'Pose 1 is the canonical neutral stance. Poses 2-6 perform the requested action as continuous physical motion. Pose 7 recovers. Pose 8 returns close to the canonical neutral stance.'
  return `Create one coherent ${style} animation sheet for the exact same character in the attached canonical reference.

PetWeaver action: ${entry.id}
Category: ${entry.category}
Action direction: ${direction}

Layout: exactly eight complete full-body poses arranged as four columns by two rows, read left-to-right then top-to-bottom. Keep every pose isolated inside its own invisible cell with generous empty background. Do not draw a grid, border, label, number, arrow, caption, or watermark.

Timeline: ${timeline}

Identity lock: preserve the canonical face, eyes, silhouette, proportions, palette, markings, clothing, props, pixel density, outline weight, and shading in all eight poses. Keep a stable bottom-center registration unless the requested action explicitly requires a jump, roll, or travel motion.

Background: perfectly flat ${chromaKey} across the whole canvas, without gradient, light spill, texture, floor, shadow, reflection, scenery, particles, or extra characters.

Rendering: crisp hard-edged pixel art suitable for normalization to a 128x128 frame. No painterly anti-aliasing, blur, glow, motion streaks, detached effects, duplicated limbs, cropped body parts, or overlapping poses.`
}

const { values, flags } = readArgs(process.argv.slice(2))
const projectRoot = resolve(required(values, '--project-root'))
const outputParent = resolve(required(values, '--output-dir'))
const petId = required(values, '--pet-id')
const displayName = required(values, '--display-name').trim()
const description = String(values.get('--description') || '').trim()
const style = String(values.get('--style') || 'pixel-art').trim()
const chromaKey = String(values.get('--chroma-key') || '#FF00FF').toUpperCase()
const includeDisabled = flags.has('--include-disabled')

if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(petId)) throw new Error('pet-id must match [a-z0-9][a-z0-9-]{0,63}')
if (!/^#[0-9A-F]{6}$/.test(chromaKey)) throw new Error('chroma-key must be #RRGGBB')

const registryUrl = pathToFileURL(join(projectRoot, 'src', 'main', 'core', 'action-registry.js')).href
const promptsUrl = pathToFileURL(join(projectRoot, 'scripts', 'action-video-prompts.js')).href
const { ACTION_REGISTRY } = await import(registryUrl)
const { ACTION_DIRECTIONS } = await import(promptsUrl)

const fallbackDirections = {
  transition_settle: 'Make one small soft landing-and-settle motion that resolves into the exact canonical neutral idle pose.'
}
const missingDirections = ACTION_REGISTRY
  .filter((entry) => entry.enabled !== false)
  .filter((entry) => !ACTION_DIRECTIONS[entry.id] && !fallbackDirections[entry.id])
  .map((entry) => entry.id)
if (missingDirections.length) throw new Error(`enabled actions without storyboard directions: ${missingDirections.join(', ')}`)

const root = resolve(outputParent, petId)
for (const directory of ['references', 'prompts', 'sheets', 'frames', 'videos', 'qa']) {
  mkdirSync(join(root, directory), { recursive: true })
}

const actions = {}
const jobs = []
for (const entry of ACTION_REGISTRY) {
  const enabled = entry.enabled !== false
  const requiredAsset = enabled || includeDisabled
  const direction = ACTION_DIRECTIONS[entry.id] || fallbackDirections[entry.id]
  const promptPath = safeRelative(`prompts/${entry.id}.md`)
  const sheetPath = safeRelative(`sheets/${entry.id}.png`)
  const framesPath = safeRelative(`frames/${entry.id}`)
  const videoPath = safeRelative(`videos/${entry.id}.webm`)
  writeFileSync(join(root, promptPath), `${actionPrompt({ entry, direction, style, chromaKey })}\n`, 'utf8')
  actions[entry.id] = {
    label: entry.label,
    category: entry.category,
    asset: videoPath,
    loop: Boolean(entry.loop),
    persistent: Boolean(entry.persistent),
    enabled,
    fallback: entry.fallback || (enabled ? null : 'idle_breath')
  }
  jobs.push({
    id: entry.id,
    label: entry.label,
    category: entry.category,
    enabled,
    required: requiredAsset,
    status: requiredAsset ? 'pending' : 'optional',
    promptFile: promptPath,
    sheetPath,
    framesPath,
    videoPath,
    frameCount: 8
  })
  mkdirSync(join(root, framesPath), { recursive: true })
}

const manifest = {
  schemaVersion: 1,
  id: petId,
  displayName,
  version: '0.1.0',
  description,
  runtime: { minimumVersion: '0.4.0' },
  style: { preset: style, chromaKey },
  renderer: { type: 'video-actions', width: 384, height: 416, fallbackAction: 'idle_breath' },
  persona: { prompt: '' },
  expressions: {
    neutral: 'frames/idle_breath/00.png',
    happy: 'frames/idle_breath/00.png',
    angry: 'frames/idle_breath/00.png',
    sad: 'frames/idle_breath/00.png',
    sleep: 'frames/idle_breath/00.png',
    tossAirborne: 'frames/idle_breath/00.png',
    tossGrabbed: 'frames/idle_breath/00.png',
    tossLanded: 'frames/idle_breath/00.png'
  },
  actions
}
const runManifest = {
  schemaVersion: 1,
  petId,
  projectRoot,
  registryCount: ACTION_REGISTRY.length,
  generatedAt: new Date().toISOString(),
  canonicalReference: 'references/canonical.png',
  jobs
}
writeFileSync(join(root, 'pet.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
writeFileSync(join(root, 'jobs.json'), `${JSON.stringify(runManifest, null, 2)}\n`, 'utf8')
writeFileSync(join(root, 'prompts', 'canonical.md'), `Create one centered full-body ${style} desktop-pet character on a perfectly flat ${chromaKey} background. Preserve all user-provided identity cues. Use crisp hard edges and coherent pixel density, with no text, scenery, floor, shadow, glow, detached effects, or extra characters. The character must remain readable after normalization into a 128x128 frame.\n`, 'utf8')

console.log(JSON.stringify({ runDir: root, actionCount: ACTION_REGISTRY.length, requiredJobs: jobs.filter((job) => job.required).length, optionalJobs: jobs.filter((job) => !job.required).length }, null, 2))
