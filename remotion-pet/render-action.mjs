import { getActionMotionSpec } from './src/action-specs.js'
import { renderAction } from './render-utils.mjs'

const actionId = process.argv.slice(2).find((argument) => argument !== '--')
if (!actionId || !getActionMotionSpec(actionId)) {
  throw new Error(`Usage: pnpm render:action -- <actionId>`)
}

renderAction(actionId)
