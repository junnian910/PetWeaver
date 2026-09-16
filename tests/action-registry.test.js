import { describe, expect, it } from 'vitest'
import {
  ACTION_REGISTRY,
  ACTION_IDS,
  EXTENSION_ACTION_IDS,
  PLANNED_ACTIONS,
  PLANNED_ACTION_COUNT,
  actionDefinitions,
  getAction,
  isActionEnabled,
  resolvePlayableAction
} from '../src/main/core/action-registry.js'

describe('action registry', () => {
  it('contains exactly 40 planned actions and 3 extensions with expected categories', () => {
    expect(PLANNED_ACTION_COUNT).toBe(40)
    expect(PLANNED_ACTIONS).toHaveLength(40)
    expect(ACTION_REGISTRY).toHaveLength(44)
    expect(EXTENSION_ACTION_IDS).toEqual(['state_move', 'state_observe', 'state_talking', 'transition_settle'])
    expect(PLANNED_ACTIONS.every((action) => !EXTENSION_ACTION_IDS.includes(action.id))).toBe(true)
    expect(Object.groupBy(PLANNED_ACTIONS, (action) => action.category)).toEqual({
      idle: expect.any(Array),
      random: expect.any(Array),
      emotion: expect.any(Array),
      command: expect.any(Array),
      gift: expect.any(Array),
      special: expect.any(Array),
      voice: expect.any(Array)
    })
    expect(Object.fromEntries(Object.entries(Object.groupBy(PLANNED_ACTIONS, (action) => action.category)).map(([key, actions]) => [key, actions.length]))).toEqual({
      idle: 3,
      random: 12,
      emotion: 8,
      command: 10,
      gift: 3,
      special: 2,
      voice: 2
    })
    expect(EXTENSION_ACTION_IDS.every((id) => ['state', 'transition'].includes(getAction(id)?.category))).toBe(true)
    expect(getAction('transition_settle')?.category).toBe('transition')
  })

  it('has unique action IDs and video paths', () => {
    expect(new Set(ACTION_IDS).size).toBe(ACTION_IDS.length)
    expect(new Set(ACTION_REGISTRY.map((action) => action.videoPath)).size).toBe(ACTION_REGISTRY.length)
  })

  it('exposes all independent available videos with the expected paths', () => {
    const available = Object.fromEntries(ACTION_REGISTRY.filter((action) => action.assetStatus === 'available').map((action) => [action.id, action.videoPath]))
    expect(available).toEqual({
      idle_breath: 'assets/videos/idle.webm',
      idle_blink: 'assets/videos/actions/idle_blink.webm',
      idle_stare: 'assets/videos/actions/idle_stare.webm',
      act_stretch: 'assets/videos/actions/act_stretch.webm',
      act_spin: 'assets/videos/actions/act_spin.webm',
      act_scratch: 'assets/videos/actions/act_scratch.webm',
      act_flip_hair: 'assets/videos/actions/act_flip_hair.webm',
      act_yawn: 'assets/videos/actions/act_yawn.webm',
      act_table: 'assets/videos/actions/act_table.webm',
      act_lookaround: 'assets/videos/actions/act_lookaround.webm',
      act_roll: 'assets/videos/actions/act_roll.webm',
      act_hop: 'assets/videos/actions/act_hop.webm',
      act_chin: 'assets/videos/actions/act_chin.webm',
      act_rub_eye: 'assets/videos/actions/act_rub_eye.webm',
      act_sneeze: 'assets/videos/actions/act_sneeze.webm',
      emo_happy: 'assets/videos/actions/emo_happy.webm',
      emo_shy: 'assets/videos/actions/emo_shy.webm',
      emo_angry: 'assets/videos/actions/emo_angry.webm',
      emo_sleepy: 'assets/videos/actions/emo_sleepy.webm',
      emo_sad: 'assets/videos/actions/emo_sad.webm',
      emo_excited: 'assets/videos/actions/emo_excited.webm',
      emo_surprise: 'assets/videos/actions/emo_surprise.webm',
      emo_aggrieved: 'assets/videos/actions/emo_aggrieved.webm',
      act_sing: 'assets/videos/singing.webm',
      act_dance: 'assets/videos/actions/act_dance.webm',
      act_sleep: 'assets/videos/sleeping.webm',
      act_wake: 'assets/videos/waking.webm',
      act_work: 'assets/videos/actions/act_work.webm',
      act_ink: 'assets/videos/actions/act_ink.webm',
      act_firework: 'assets/videos/actions/act_firework.webm',
      act_intro: 'assets/videos/actions/act_intro.webm',
      act_greet: 'assets/videos/waving-real.webm',
      act_joke: 'assets/videos/actions/act_joke.webm',
      gift_thanks: 'assets/videos/actions/gift_thanks.webm',
      gift_sc: 'assets/videos/actions/gift_sc.webm',
      gift_guard: 'assets/videos/actions/gift_guard.webm',
      special_hourly: 'assets/videos/actions/special_hourly.webm',
      special_lottery: 'assets/videos/actions/special_lottery.webm',
      state_move: 'assets/videos/actions/state_move.webm',
      state_observe: 'assets/videos/actions/state_observe.webm',
      state_talking: 'assets/videos/actions/state_talking.webm',
      emo_shout: 'assets/videos/actions/emo_shout.webm',
      act_cover_ears: 'assets/videos/actions/act_cover_ears.webm',
      transition_settle: 'assets/videos/actions/transition_settle.webm'
    })
    expect(Object.values(available)).toHaveLength(44)
  })

  it('keeps all UTF-8 labels and Chinese command triggers intact', () => {
    const expectedLabels = {
      idle_breath: '待机呼吸', idle_blink: '待机眨眼', idle_stare: '待机发呆',
      act_stretch: '伸懒腰', act_spin: '转圈', act_scratch: '挠头', act_flip_hair: '甩头发', act_yawn: '打哈欠',
      act_table: '跺桌', act_lookaround: '左右张望', act_roll: '打滚', act_hop: '蹦跳', act_chin: '托腮', act_rub_eye: '揉眼睛', act_sneeze: '打喷嚏',
      emo_happy: '开心', emo_shy: '害羞', emo_angry: '生气', emo_sleepy: '困倦', emo_sad: '难过', emo_excited: '兴奋', emo_surprise: '惊讶', emo_aggrieved: '委屈',
      act_sing: '唱歌', act_dance: '跳舞', act_sleep: '睡觉', act_wake: '起床', act_work: '打工', act_ink: '涂地', act_firework: '放烟花', act_intro: '自我介绍', act_greet: '打招呼', act_joke: '讲笑话',
      gift_thanks: '感谢礼物', gift_sc: '感谢 SC', gift_guard: '感谢上舰', special_hourly: '整点彩蛋', special_lottery: '抽奖开奖',
      state_move: '移动状态', state_observe: '观察状态', state_talking: '说话状态',
      emo_shout: '大叫', act_cover_ears: '捂耳朵', transition_settle: '回待机转场'
    }
    expect(Object.fromEntries(ACTION_REGISTRY.map((action) => [action.id, action.label]))).toEqual(expectedLabels)
    expect(ACTION_REGISTRY.filter((action) => action.category === 'command').flatMap((action) => action.triggers)).toEqual([
      'command:唱歌', 'command:跳舞', 'command:睡觉', 'command:起床', 'command:打工',
      'command:涂地', 'command:放烟花', 'command:自我介绍', 'command:你好', 'command:嗨', 'command:讲笑话'
    ])
  })

  it('ships all actions including the v0.2 voice actions with available assets', () => {
    const pending = ACTION_REGISTRY.filter((action) => action.assetStatus === 'pending')
    expect(pending).toHaveLength(0)
    expect(ACTION_REGISTRY.every((action) => action.assetStatus === 'available')).toBe(true)
    expect(resolvePlayableAction('emo_shout').id).toBe('emo_shout')
    expect(resolvePlayableAction('act_cover_ears').id).toBe('act_cover_ears')
    expect(getAction('emo_shout').triggers).toEqual(['voice:shout'])
  })

  it('keeps act_intro registered but disabled so it is never invoked', () => {
    expect(getAction('act_intro').assetStatus).toBe('available')
    expect(getAction('act_intro').enabled).toBe(false)
    expect(isActionEnabled('act_intro')).toBe(false)
    expect(ACTION_REGISTRY.filter((action) => action.enabled === false).map((action) => action.id)).toEqual(['act_intro'])
    expect(isActionEnabled('act_cover_ears')).toBe(true)
  })

  it('returns independent action definition copies', () => {
    const definitions = actionDefinitions()
    expect(definitions).not.toBe(ACTION_REGISTRY)
    expect(definitions[0]).not.toBe(ACTION_REGISTRY[0])
    expect(definitions[0].triggers).not.toBe(ACTION_REGISTRY[0].triggers)

    definitions[0].label = 'changed'
    definitions[0].triggers.push('test-only')
    expect(ACTION_REGISTRY[0].label).toBe('待机呼吸')
    expect(ACTION_REGISTRY[0].triggers).toEqual(['idle'])
  })
})
