import { BilibiliAdapter } from './bilibili-adapter.js'
import { YouTubeAdapter } from './youtube-adapter.js'

export function createLiveAdapter({ platform = 'bilibili', mock = false, bilibili = {}, youtube = {} } = {}) {
  if (platform === 'youtube') return new YouTubeAdapter({ ...youtube, mock })
  if (platform === 'bilibili') return new BilibiliAdapter({ ...bilibili, mock })
  throw new Error(`不支持的直播平台：${platform}`)
}
