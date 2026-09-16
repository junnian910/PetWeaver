const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback
const positive = (value, fallback) => Math.max(1, Number.isFinite(Number(value)) ? Number(value) : fallback)

export function getVirtualDesktopBounds(displays) {
  const bounds = (displays ?? [])
    .map((display) => display?.bounds)
    .filter((item) => item && finite(item.width, 0) > 0 && finite(item.height, 0) > 0)
  if (!bounds.length) return { x:0, y:0, right:0, bottom:0 }
  return {
    x:Math.min(...bounds.map((item) => finite(item.x, 0))),
    y:Math.min(...bounds.map((item) => finite(item.y, 0))),
    right:Math.max(...bounds.map((item) => finite(item.x, 0) + positive(item.width, 1))),
    bottom:Math.max(...bounds.map((item) => finite(item.y, 0) + positive(item.height, 1)))
  }
}

export function getVirtualWorkAreaBounds(displays) {
  const bounds = (displays ?? [])
    .map((display) => display?.workArea || display?.bounds)
    .filter((item) => item && finite(item.width, 0) > 0 && finite(item.height, 0) > 0)
  if (!bounds.length) return { x: 0, y: 0, right: 0, bottom: 0 }
  return {
    x: Math.min(...bounds.map((item) => finite(item.x, 0))),
    y: Math.min(...bounds.map((item) => finite(item.y, 0))),
    right: Math.max(...bounds.map((item) => finite(item.x, 0) + positive(item.width, 1))),
    bottom: Math.max(...bounds.map((item) => finite(item.y, 0) + positive(item.height, 1)))
  }
}

export function getDisplayWorkAreas(displays) {
  return (displays ?? [])
    .map((display, index) => {
      const area = display?.workArea || display?.bounds
      if (!area || finite(area.width, 0) <= 0 || finite(area.height, 0) <= 0) return null
      return {
        id: display?.id ?? index,
        x: finite(area.x, 0),
        y: finite(area.y, 0),
        width: positive(area.width, 1),
        height: positive(area.height, 1),
        right: finite(area.x, 0) + positive(area.width, 1),
        bottom: finite(area.y, 0) + positive(area.height, 1)
      }
    })
    .filter(Boolean)
}

export function getWorkAreaForWindow(bounds, areas) {
  const candidates = areas?.length ? areas : [{ x: 0, y: 0, width: positive(bounds?.width, 420), height: positive(bounds?.height, 520), right: positive(bounds?.width, 420), bottom: positive(bounds?.height, 520) }]
  const centerX = finite(bounds?.x, candidates[0].x) + positive(bounds?.width, 420) / 2
  const centerY = finite(bounds?.y, candidates[0].y) + positive(bounds?.height, 520) / 2
  const containing = candidates.find((area) => centerX >= area.x && centerX <= area.right && centerY >= area.y && centerY <= area.bottom)
  if (containing) return containing
  return candidates.reduce((closest, area) => {
    const dx = centerX < area.x ? area.x - centerX : centerX > area.right ? centerX - area.right : 0
    const dy = centerY < area.y ? area.y - centerY : centerY > area.bottom ? centerY - area.bottom : 0
    const distance = dx * dx + dy * dy
    return distance < closest.distance ? { area, distance } : closest
  }, { area: candidates[0], distance: Number.POSITIVE_INFINITY }).area
}

export function getWorkAreaForPoint(point, areas) {
  const candidates = areas?.length ? areas : [{ x: 0, y: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 }]
  const containing = candidates.find((area) => point.x >= area.x && point.x < area.right && point.y >= area.y && point.y < area.bottom)
  if (containing) return containing
  return candidates.reduce((closest, area) => {
    const dx = point.x < area.x ? area.x - point.x : point.x > area.right ? point.x - area.right : 0
    const dy = point.y < area.y ? area.y - point.y : point.y > area.bottom ? point.y - area.bottom : 0
    const distance = dx * dx + dy * dy
    return distance < closest.distance ? { area, distance } : closest
  }, { area: candidates[0], distance: Number.POSITIVE_INFINITY }).area
}

export function clampWindowPositionToDisplays(x, y, size, displays, visibleInsets = {}) {
  const areas = Array.isArray(displays) && displays[0]?.bounds ? getDisplayWorkAreas(displays) : displays
  const width = positive(size?.width, 420)
  const height = positive(size?.height, 520)
  const target = getWorkAreaForWindow({ x: finite(x, 0), y: finite(y, 0), width, height }, areas)
  return clampWindowPosition(x, y, { width, height }, target, visibleInsets)
}

export function getPetMovementInsets(size, scale = 1) {
  const sourceWidth = 384
  const sourceHeight = 416
  const width = positive(size?.width, 420)
  const height = positive(size?.height, 520)
  const safeScale = Math.max(.1, Math.min(3, finite(scale, 1)))
  const fit = Math.min(width / sourceWidth, height / sourceHeight)
  const renderedWidth = sourceWidth * fit * safeScale
  const renderedHeight = sourceHeight * fit * safeScale
  const alphaLeft = 90
  const alphaTop = 44
  const alphaRight = 294
  const alphaBottom = 403
  return {
    left:Math.max(0, (width - renderedWidth) / 2 + alphaLeft * fit * safeScale),
    top:Math.max(0, height - renderedHeight + alphaTop * fit * safeScale),
    right:Math.max(0, (width - renderedWidth) / 2 + alphaRight * fit * safeScale),
    bottom:Math.max(0, height - renderedHeight + alphaBottom * fit * safeScale)
  }
}

export function clampWindowPosition(x, y, size, desktop, visibleInsets = {}) {
  const width = positive(size?.width, 420)
  const height = positive(size?.height, 520)
  const desktopX = finite(desktop?.x, 0)
  const desktopY = finite(desktop?.y, 0)
  const desktopRight = Math.max(desktopX, finite(desktop?.right, desktopX + width))
  const desktopBottom = Math.max(desktopY, finite(desktop?.bottom, desktopY + height))
  const leftInset = Math.max(0, finite(visibleInsets.left, 0))
  const topInset = Math.max(0, finite(visibleInsets.top, 0))
  const rightInset = Math.max(0, finite(visibleInsets.right, width))
  const bottomInset = Math.max(0, finite(visibleInsets.bottom, height))
  const minX = Math.ceil(desktopX - leftInset)
  const minY = Math.ceil(desktopY - topInset)
  const maxX = Math.max(minX, Math.floor(desktopRight - rightInset))
  const maxY = Math.max(minY, Math.floor(desktopBottom - bottomInset))
  const requestedX = finite(x, minX)
  const requestedY = finite(y, minY)
  return {
    x:Math.max(minX, Math.min(Math.round(requestedX), maxX)),
    y:Math.max(minY, Math.min(Math.round(requestedY), maxY))
  }
}

export function getResetPosition(display, size, scale = 1) {
  const area = display?.workArea || display?.bounds || { x: 0, y: 0, width: 1920, height: 1080 }
  const safeSize = { width: positive(size?.width, 420), height: positive(size?.height, 520) }
  const insets = getPetMovementInsets(safeSize, scale)
  return clampWindowPosition(area.x + positive(area.width, safeSize.width) - insets.right - 24, area.y + positive(area.height, safeSize.height) - insets.bottom - 24, safeSize, {
    x: finite(area.x, 0),
    y: finite(area.y, 0),
    right: finite(area.x, 0) + positive(area.width, safeSize.width),
    bottom: finite(area.y, 0) + positive(area.height, safeSize.height)
  }, insets)
}
