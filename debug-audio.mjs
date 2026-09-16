// 调试 v2：解析每个二进制帧的 Path 字段 + 正确偏移(hl+2)合并，验证 MP3 有效性
import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'
import { buildWsUrl, defaultHeaders, speechConfigMessage, ssmlMessage } from './src/main/providers/edge-tts.js'

const t0 = Date.now()
const ws = new WebSocket(buildWsUrl(), { headers: defaultHeaders(), perMessageDeflate: true })
const chunks = []
let frames = 0
ws.on('open', () => { ws.send(speechConfigMessage()); ws.send(ssmlMessage('发发语音测试成功', 'zh-CN-XiaoxiaoNeural', 1)) })
ws.on('message', (data, isBinary) => {
  if (!isBinary) return
  frames++
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const hl = buf.readUInt16BE(0)
  // header 文本：从偏移 2 开始，长度 hl（edge-tts-universal 语义）；若超出则截断
  const headerEnd = Math.min(buf.length, hl + 2)
  const headerText = buf.subarray(2, headerEnd).toString('latin1')
  const path = (headerText.match(/Path:([A-Za-z.]+)/) || [])[1] || '?'
  const contentType = (headerText.match(/Content-Type:([A-Za-z0-9/+-]+)/) || [])[1] || '?'
  const audioStart = hl + 2 // 正确偏移（edge-tts-universal / Python 一致）
  console.log(`frame#${frames} len=${buf.length} hl=${hl} path=${path} contentType=${contentType} audioLen=${buf.length - audioStart}`)
  if (frames <= 2) console.log(`   headerText=${JSON.stringify(headerText.slice(0, 80))}`)
  if (path === 'audio') chunks.push(buf.slice(audioStart))
})
ws.on('close', (code) => {
  console.log('close', code, 'audio frames:', chunks.length)
  writeMerged()
  process.exit(0)
})
function writeMerged() {
  const merged = Buffer.concat(chunks)
  writeFileSync('tmp/out-correct.mp3', merged)
  console.log(`out-correct.mp3: ${merged.length} bytes`)
  console.log(`head hex: ${merged.subarray(0, 16).toString('hex')}`)
  console.log(`head ascii: ${JSON.stringify(merged.subarray(0, 16).toString('latin1'))}`)
}
setTimeout(() => { console.log('timeout; audio frames:', chunks.length); writeMerged(); process.exit(0) }, 20000)
