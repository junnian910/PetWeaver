export const DOCK_THRESHOLD_PX = 12

/**
 * 判断角色可见边缘是否贴到工作区边缘（用于贴边收纳）。
 * insets 是角色透明边距修正，可见边缘 = 窗口边缘 + inset。
 */
export function dockEdgeFor(bounds, insets, area, threshold = DOCK_THRESHOLD_PX) {
  if (!bounds || !area) return null
  const leftInset = Math.max(0, Number(insets?.left) || 0)
  const rightInset = Math.max(0, Number(insets?.right) || 0)
  const topInset = Math.max(0, Number(insets?.top) || 0)
  const bottomInset = Math.max(0, Number(insets?.bottom) || 0)
  const width = Math.max(1, Number(bounds.width) || 1)
  const height = Math.max(1, Number(bounds.height) || 1)
  const visibleLeft = Number(bounds.x) + leftInset
  const visibleRight = Number(bounds.x) + width - rightInset
  const visibleTop = Number(bounds.y) + topInset
  const visibleBottom = Number(bounds.y) + height - bottomInset
  const distances = [
    { edge: 'left', distance: visibleLeft - area.x },
    { edge: 'right', distance: area.x + area.width - visibleRight },
    { edge: 'top', distance: visibleTop - area.y },
    { edge: 'bottom', distance: area.y + area.height - visibleBottom }
  ].filter((item) => Number.isFinite(item.distance))
  if (!distances.length) return null
  const closest = distances.reduce((best, item) => (item.distance < best.distance ? item : best), distances[0])
  if (closest.distance > threshold) return null
  return closest.edge
}
