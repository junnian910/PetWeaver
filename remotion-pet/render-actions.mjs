import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { RENDER_READY_ACTION_IDS } from './src/action-specs.js'
import { renderAction } from './render-utils.mjs'

const actionIds = [...RENDER_READY_ACTION_IDS]

for (const actionId of actionIds) {
  renderAction(actionId)
}

// 注册表使用根目录老路径的 5 个视频，批量渲染输出在 actions/ 下，渲完同步过去。
const ROOT_PATH_SYNC = Object.freeze({
  idle_breath: 'idle.webm',
  'waving-real': 'waving-real.webm',
  singing: 'singing.webm',
  sleeping: 'sleeping.webm',
  waking: 'waking.webm'
})

for (const [actionId, fileName] of Object.entries(ROOT_PATH_SYNC)) {
  if (!actionIds.includes(actionId)) continue
  copyFileSync(
    join(import.meta.dirname, '..', 'public', 'assets', 'videos', 'actions', `${actionId}.webm`),
    join(import.meta.dirname, '..', 'public', 'assets', 'videos', fileName)
  )
  console.log(`${fileName} synced from ${actionId}.webm`)
}
