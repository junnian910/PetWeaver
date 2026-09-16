const LINES = ['我听见啦！', '今天也要元气满满～', '墨水已经装满，随时出发！', '要不要一起涂地？']

export class OfflineLLMProvider {
  async reply() { return LINES[Math.floor(Math.random() * LINES.length)] }
}

export class OfflineTTSProvider {
  async synthesize() { return null }
}
