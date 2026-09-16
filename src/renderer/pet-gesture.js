const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0))

/**
 * 按点击位置区分身体区域：头 / 肚子 / 其他。rect 为可见角色层的
 * getBoundingClientRect() 结果，与 hitsHead 的判定保持一致。
 */
export function petRegionAt(clientX, clientY, rect) {
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return 'body'
  const x = Number(clientX)
  const y = Number(clientY)
  const centerX = rect.left + rect.width / 2
  const dx = Math.abs(x - centerX)
  if (y >= rect.top + rect.height * .19 && y <= rect.top + rect.height * .48 && dx <= rect.width * .22) return 'head'
  if (y >= rect.top + rect.height * .52 && y <= rect.top + rect.height * .88 && dx <= rect.width * .3) return 'belly'
  return 'body'
}

export function createPetStroke(point) {
  return {
    startX: point.clientX,
    startY: point.clientY,
    lastX: point.clientX,
    lastY: point.clientY,
    lastDirection: 0,
    reversals: 0,
    strokeDistance: 0,
    petted: false
  }
}

export function updatePetStroke(stroke, point, options = {}) {
  const dx = point.clientX - stroke.lastX
  const dy = point.clientY - stroke.lastY
  const totalY = point.clientY - stroke.startY
  stroke.lastX = point.clientX
  stroke.lastY = point.clientY
  if (Math.abs(dx) >= 1.5 && Math.abs(dx) >= Math.abs(dy) * .7) {
    const direction = Math.sign(dx)
    if (stroke.lastDirection && direction !== stroke.lastDirection) stroke.reversals += 1
    stroke.lastDirection = direction
    stroke.strokeDistance += Math.abs(dx)
  }
  const sensitivity = clamp(options.pettingSensitivity ?? 1, 0.5, 2)
  if (stroke.reversals >= 1 && stroke.strokeDistance >= 36 / sensitivity && Math.abs(totalY) <= 46) {
    stroke.petted = true
  }
  return stroke.petted
}

export function createPetGesture(point, { head = false, belly = false } = {}) {
  return {
    ...createPetStroke(point),
    pointerId: point.pointerId,
    headStart: head,
    bellyStart: belly,
    dragging: false,
    moved: false,
    samples: [sample(point)],
    startTime: Number(point.timeStamp ?? performance.now())
  }
}

export function updatePetGesture(gesture, point, options = {}) {
  const totalX = point.clientX - gesture.startX
  const totalY = point.clientY - gesture.startY
  const distance = Math.hypot(totalX, totalY)
  gesture.moved ||= distance > 4
  pushSample(gesture, point)

  if (gesture.dragging) return 'dragging'
  if (gesture.petted) return 'petting'

  if ((gesture.headStart || gesture.bellyStart) && options.pettingEnabled !== false) {
    if (updatePetStroke(gesture, point, options)) return 'pet'
    // A short one-way stroke is a petting candidate, not a window drag. Only
    // a clear vertical pull or a long deliberate move starts dragging.
    if (Math.abs(totalY) > 30 || distance > 92) {
      gesture.dragging = true
      return 'drag-start'
    }
    return 'pending'
  }

  gesture.lastX = point.clientX
  gesture.lastY = point.clientY

  if (distance > 6) {
    gesture.dragging = true
    return 'drag-start'
  }
  return 'pending'
}

export function releaseVelocity(gesture, point, strength = 1) {
  pushSample(gesture, point)
  const latest = gesture.samples.at(-1)
  const earliest = gesture.samples.find((entry) => latest.time - entry.time <= 120) || gesture.samples[0]
  const elapsed = Math.max(16, latest.time - earliest.time)
  const multiplier = clamp(strength, 0.4, 2) * 16 / elapsed
  const vx = (latest.screenX - earliest.screenX) * multiplier
  const vy = (latest.screenY - earliest.screenY) * multiplier
  return Math.hypot(vx, vy) >= 4 ? { vx, vy } : { vx:0, vy:0 }
}

function sample(point) {
  return {
    screenX: Number(point.screenX),
    screenY: Number(point.screenY),
    time: Number(point.timeStamp ?? performance.now())
  }
}

function pushSample(gesture, point) {
  const next = sample(point)
  const previous = gesture.samples.at(-1)
  if (!previous || next.time !== previous.time || next.screenX !== previous.screenX || next.screenY !== previous.screenY) {
    gesture.samples.push(next)
  }
  gesture.samples = gesture.samples.filter((entry) => next.time - entry.time <= 180).slice(-12)
}
