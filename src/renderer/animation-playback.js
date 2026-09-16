export const playbackPolicies = Object.freeze({
  idle: { frameMs: 180, order: [0, 1, 2, 3, 4, 5] },
  waving: { frameMs: 90, order: [0, 1, 2, 1, 3] },
  jumping: { frameMs: 90, order: ['idle', 0, 1, 2, 3, 4, 'idle'] },
  failed: { frameMs: 100, order: [0, 1, 2, 3, 4, 5, 6, 7] },
  waiting: { frameMs: 110, order: [0, 1, 2, 3, 4, 5] }
})

const FRAME_CENTER_X = 95.5
const lowerBodyAnchors = Object.freeze({
  idle: [98.32, 97.37, 95.27, 94.21, 94, 93.1],
  waving: [95.46, 95.8, 98.24, 95.68],
  jumping: [95, 95, 95, 95, 95],
  failed: [98.83, 98.36, 96.19, 93.66, 92.58, 92.18, 91.29, 91.77],
  waiting: [95.6, 96.46, 95.74, 95.48, 96.2, 95.81]
})

export function frameAnchorShift(state, frameIndex) {
  if (!Number.isInteger(frameIndex)) return 0
  const anchor = lowerBodyAnchors[state]?.[frameIndex]
  return Number.isFinite(anchor) ? FRAME_CENTER_X - anchor : 0
}

export function playbackFrameAt(state, frames, idleFrames, elapsedMs) {
  if (!frames?.length) return null
  const policy = playbackPolicies[state] || { frameMs: 180, order: frames.map((_, index) => index) }
  const slot = Math.floor(Math.max(0, elapsedMs) / policy.frameMs) % policy.order.length
  const frameIndex = policy.order[slot]
  if (frameIndex === 'idle') return { frame: idleFrames?.[0] || frames[0], slot, frameIndex }
  return { frame: frames[frameIndex % frames.length], slot, frameIndex }
}
