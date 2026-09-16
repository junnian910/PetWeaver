export function gestureEndOutcome(kind, gesture, velocity = { vx: 0, vy: 0 }, { tossEnabled = true } = {}) {
  if (kind === 'cancel') return { type: 'cancel', toss: false, velocity: { vx: 0, vy: 0 } }
  if (!gesture?.windowDragging) return { type: gesture?.petted ? 'pet' : 'click', toss: false, velocity: { vx: 0, vy: 0 } }
  const hasVelocity = Number(velocity.vx) !== 0 || Number(velocity.vy) !== 0
  const toss = Boolean(tossEnabled && hasVelocity)
  return { type: toss ? 'toss' : 'drag', toss, velocity: toss ? velocity : { vx: 0, vy: 0 } }
}
