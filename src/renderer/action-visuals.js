import { getAction, resolvePlayableAction } from '../main/core/action-registry.js'

export function videoStateForAction(actionId = '') {
  return getAction(actionId)?.id || null
}

export function videoPathForAction(actionId = '') {
  return resolvePlayableAction(actionId)?.videoPath || null
}

export function expressionMotionForAction(actionId = '') {
  return getAction(actionId)?.expression || 'neutral'
}
