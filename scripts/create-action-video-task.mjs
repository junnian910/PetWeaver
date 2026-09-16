import { buildActionVideoRequest } from './action-video-prompts.js'

const [actionId, ...args] = process.argv.slice(2)
const referenceIndex = args.indexOf('--reference-url')
const submit = args.includes('--submit')
const referenceUrl = referenceIndex >= 0 ? args[referenceIndex + 1] : ''

if (!actionId || !referenceUrl) {
  throw new Error('Usage: node scripts/create-action-video-task.mjs <action-id> --reference-url <https-url> [--submit]')
}

const request = buildActionVideoRequest(actionId, referenceUrl)
if (!submit) {
  console.log(JSON.stringify({ dryRun: true, actionId, request }, null, 2))
  process.exit(0)
}

const apiKey = process.env.APIMART_API_KEY
if (!apiKey) throw new Error('APIMART_API_KEY is required when --submit is used')

const response = await fetch('https://api.apimart.ai/v1/videos/generations', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(request)
})
const body = await response.json().catch(() => ({}))
if (!response.ok) throw new Error(`Video generation request failed (${response.status}): ${JSON.stringify(body)}`)
console.log(JSON.stringify({ actionId, task: body }, null, 2))
