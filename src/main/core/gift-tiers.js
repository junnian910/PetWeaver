/**
 * 按礼物单价（瓜子）分级反馈：普通 / 中等 / 大额 / 豪华。
 */
export function giftTierFor(price) {
  const value = Number(price)
  if (!Number.isFinite(value) || value <= 0) return 'normal'
  if (value >= 1_000_000) return 'super'
  if (value >= 100_000) return 'big'
  if (value >= 10_000) return 'medium'
  return 'normal'
}
