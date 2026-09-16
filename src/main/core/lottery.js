export class Lottery {
  constructor(random = Math.random) {
    this.random = random
    this.participants = new Map()
  }

  join(user) {
    if (!user?.id) return false
    const existed = this.participants.has(String(user.id))
    this.participants.set(String(user.id), { id: String(user.id), name: user.name || `用户${user.id}` })
    return !existed
  }

  draw() {
    const entries = [...this.participants.values()]
    if (!entries.length) return null
    const roll = Number(this.random())
    const index = Number.isFinite(roll) ? Math.max(0, Math.min(entries.length - 1, Math.floor(roll * entries.length))) : 0
    const winner = entries[index]
    this.participants.clear()
    return winner
  }

  get size() { return this.participants.size }
}
