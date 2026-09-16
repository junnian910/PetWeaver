import { ACTION_REGISTRY } from '../core/action-registry.js'

export function createFafaPetManifest() {
  return {
    schemaVersion: 1,
    id: 'fafa',
    displayName: '发发',
    version: '0.3.0',
    description: 'PetWeaver 内置示例角色。',
    runtime: { minimumVersion: '0.4.0' },
    renderer: { type: 'video-actions', width: 384, height: 416, fallbackAction: 'idle_breath' },
    persona: { prompt: '你是发发，元气、亲切、俏皮的桌面宠物。' },
    expressions: {
      neutral: 'assets/fafa-pet-final.png',
      happy: 'assets/expressions/happy.png',
      angry: 'assets/expressions/angry.png',
      sad: 'assets/expressions/sad.png',
      sleep: 'assets/expressions/sleep.png',
      tossAirborne: 'assets/expressions/toss-airborne.png',
      tossGrabbed: 'assets/expressions/toss-grabbed.png',
      tossLanded: 'assets/expressions/toss-landed.png'
    },
    actions: Object.fromEntries(ACTION_REGISTRY.map((entry) => [entry.id, {
      label: entry.label,
      category: entry.category,
      asset: entry.videoPath,
      loop: Boolean(entry.loop),
      persistent: Boolean(entry.persistent),
      enabled: entry.enabled !== false,
      fallback: entry.fallback || null
    }]))
  }
}
