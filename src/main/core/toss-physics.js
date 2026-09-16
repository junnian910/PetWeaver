const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function createTossState(vx, vy) {
  const speedScale = .65
  return { vx:clamp((Number(vx) || 0) * speedScale, -30, 30), vy:clamp((Number(vy) || 0) * speedScale, -30, 30) }
}

export function advanceToss(state, bounds, area) {
  let vx = state.vx * .985
  let vy = state.vy * .995 + .72
  let x = bounds.x + vx
  let y = bounds.y + vy
  let impact = null

  if (x < area.x || x + bounds.width > area.x + area.width) {
    x = clamp(x, area.x, area.x + area.width - bounds.width)
    vx *= -.64
    impact = 'side'
  }
  if (y < area.y) {
    y = area.y
    vy = Math.abs(vy) * .58
    impact = 'top'
  }

  const floor = area.y + area.height - bounds.height
  if (y >= floor) {
    y = floor
    impact = 'floor'
    vx *= .36
    if (Math.abs(vy) < 8 || (Math.abs(vy) < 3.5 && Math.abs(vx) < 1.2)) {
      return { x:Math.round(x), y:Math.round(y), vx:0, vy:0, impact, landed:true }
    }
    vy = -Math.abs(vy) * .08
  }

  return { x:Math.round(x), y:Math.round(y), vx, vy, impact, landed:false }
}
