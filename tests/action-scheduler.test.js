import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionScheduler } from '../src/main/core/action-scheduler.js'

afterEach(() => vi.useRealTimers())

describe('ActionScheduler', () => {
  it('interrupts lower-priority actions', () => { vi.useFakeTimers(); const scheduler=new ActionScheduler(); const played=[]; scheduler.on('action',a=>played.push(a.actionId)); scheduler.request({actionId:'idle',priority:1,durationMs:1000}); scheduler.request({actionId:'gift',priority:9,durationMs:1000}); expect(played).toEqual(['idle','gift']); vi.useRealTimers() })
  it('clears queued actions by predicate without stopping the current one', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler()
    const played = []
    scheduler.on('action', (action) => played.push(action.actionId))
    scheduler.request({ actionId: 'act_work', priority: 30, durationMs: 400, source: 'mouse' })
    scheduler.request({ actionId: 'gift_thanks', priority: 20, durationMs: 300, source: 'gift' })
    scheduler.request({ actionId: 'idle_blink', priority: 10, durationMs: 300, source: 'danmaku' })
    const removed = scheduler.clearQueue((action) => action.source !== 'mouse')
    expect(removed).toBe(2)
    expect(scheduler.current.actionId).toBe('act_work')
    vi.advanceTimersByTime(500)
    expect(played).toEqual(['act_work'])
    vi.useRealTimers()
  })
  it('queues lower-priority actions', () => { vi.useFakeTimers(); const scheduler=new ActionScheduler({ actionGapMs: 0 }); const played=[]; scheduler.on('action',a=>played.push(a.actionId)); scheduler.request({actionId:'gift',priority:9,durationMs:300}); scheduler.request({actionId:'idle',priority:1,durationMs:300}); vi.advanceTimersByTime(300); expect(played).toEqual(['gift','idle']); vi.useRealTimers() })

  it('finishes the interrupted current action before urgent, then resumes queued work', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler({ actionGapMs: 0 })
    const events = []
    scheduler.on('action', (action) => events.push(['action', action.actionId]))
    scheduler.on('finished', ({ action, reason }) => events.push(['finished', action.actionId, reason]))
    scheduler.on('idle', () => events.push(['idle']))

    scheduler.request({ actionId: 'act_work', priority: 20, durationMs: 500 })
    scheduler.request({ actionId: 'idle_blink', priority: 10, durationMs: 500 })
    scheduler.request({ actionId: 'gift_guard', priority: 90, durationMs: 500 })

    expect(events).toEqual([
      ['action', 'act_work'],
      ['finished', 'act_work', 'interrupted'],
      ['action', 'gift_guard']
    ])
    expect(scheduler.current.actionId).toBe('gift_guard')

    vi.advanceTimersByTime(500)
    expect(events).toEqual([
      ['action', 'act_work'],
      ['finished', 'act_work', 'interrupted'],
      ['action', 'gift_guard'],
      ['finished', 'gift_guard', 'completed'],
      ['action', 'idle_blink']
    ])
    expect(events).not.toContainEqual(['idle'])
  })

  it('does not let an interrupted action timer finish the urgent action', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler()
    const finished = []
    scheduler.on('finished', (event) => finished.push({ actionId: event.action.actionId, reason: event.reason }))

    scheduler.request({ actionId: 'act_work', priority: 20, durationMs: 500 })
    vi.advanceTimersByTime(200)
    scheduler.request({ actionId: 'gift_guard', priority: 90, durationMs: 1000 })

    vi.advanceTimersByTime(300)
    expect(scheduler.current.actionId).toBe('gift_guard')
    expect(finished).toEqual([{ actionId: 'act_work', reason: 'interrupted' }])

    vi.advanceTimersByTime(700)
    expect(finished).toEqual([
      { actionId: 'act_work', reason: 'interrupted' },
      { actionId: 'gift_guard', reason: 'completed' }
    ])
  })

  it('keeps persistent sleep active until wake, a higher priority action, or stop', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler({ actionGapMs: 0 })
    const finished = []
    scheduler.on('finished', (event) => finished.push({ actionId: event.action.actionId, reason: event.reason }))

    scheduler.request({ actionId: 'act_sleep', durationMs: 300 })
    vi.advanceTimersByTime(1000)
    expect(scheduler.current.actionId).toBe('act_sleep')

    scheduler.request({ actionId: 'act_work', priority: 20, durationMs: 300 })
    expect(scheduler.current.actionId).toBe('act_sleep')
    expect(scheduler.queue).toHaveLength(1)

    scheduler.request({ actionId: 'act_wake', priority: 50, durationMs: 300 })
    expect(finished).toEqual([{ actionId: 'act_sleep', reason: 'interrupted' }])
    expect(scheduler.current.actionId).toBe('act_wake')

    vi.advanceTimersByTime(300)
    expect(scheduler.current.actionId).toBe('act_work')
    expect(finished).toEqual([
      { actionId: 'act_sleep', reason: 'interrupted' },
      { actionId: 'act_wake', reason: 'completed' }
    ])

    vi.advanceTimersByTime(300)
    scheduler.request({ actionId: 'act_sleep' })
    scheduler.request({ actionId: 'gift_guard', priority: 90, durationMs: 300 })
    expect(finished).toContainEqual({ actionId: 'act_sleep', reason: 'interrupted' })
    expect(scheduler.current.actionId).toBe('gift_guard')
  })

  it('stops the current action and clears queued actions', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler()
    const finished = []
    scheduler.on('finished', (event) => finished.push({ actionId: event.action.actionId, reason: event.reason }))

    scheduler.request({ actionId: 'act_sleep' })
    scheduler.request({ actionId: 'act_work', priority: 20 })
    scheduler.stop()

    expect(scheduler.current).toBeNull()
    expect(scheduler.queue).toEqual([])
    expect(finished).toEqual([{ actionId: 'act_sleep', reason: 'stopped' }])
  })

  it('normalizes non-finite priority and duration values', () => {
    const scheduler = new ActionScheduler()

    scheduler.request({ actionId: 'act_work', priority: Number.NaN, durationMs: Number.POSITIVE_INFINITY })
    expect(scheduler.current.priority).toBe(50)
    expect(scheduler.current.durationMs).toBe(2200)

    scheduler.stop()
    scheduler.request({ actionId: 'act_work', priority: Number.NEGATIVE_INFINITY, durationMs: Number.NaN })
    expect(scheduler.current.priority).toBe(50)
    expect(scheduler.current.durationMs).toBe(2200)
  })

  it('keeps a reentrant finished listener from overtaking an interrupting action', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler({ actionGapMs: 0 })
    const events = []
    scheduler.on('action', (action) => {
      events.push(['action', action.actionId])
      if (action.actionId === 'gift_guard') scheduler.request({ actionId: 'act_wake', priority: 50, durationMs: 100 })
    })
    scheduler.on('finished', ({ action, reason }) => {
      events.push(['finished', action.actionId, reason])
      if (action.actionId === 'act_work') scheduler.request({ actionId: 'act_sing', priority: 95, durationMs: 100 })
    })

    scheduler.request({ actionId: 'act_work', priority: 20, durationMs: 100 })
    scheduler.request({ actionId: 'gift_guard', priority: 90, durationMs: 100 })

    expect(events.slice(0, 5)).toEqual([
      ['action', 'act_work'],
      ['finished', 'act_work', 'interrupted'],
      ['action', 'gift_guard'],
      ['finished', 'gift_guard', 'interrupted'],
      ['action', 'act_sing']
    ])
    expect(scheduler.current.actionId).toBe('act_sing')

    vi.advanceTimersByTime(300)
    expect(scheduler.current.actionId).toBe('act_wake')
    vi.advanceTimersByTime(300)
    expect(scheduler.current).toBeNull()
  })

  it('returns to idle and waits out the action gap before the next queued action', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler()
    const events = []
    scheduler.on('action', (action) => events.push(['action', action.actionId]))
    scheduler.on('idle', () => events.push(['idle']))

    scheduler.request({ actionId: 'act_work', priority: 20, durationMs: 400 })
    scheduler.request({ actionId: 'idle_blink', priority: 10, durationMs: 300 })

    vi.advanceTimersByTime(400)
    expect(events).toEqual([['action', 'act_work'], ['idle']])
    vi.advanceTimersByTime(999)
    expect(events).toEqual([['action', 'act_work'], ['idle']])
    vi.advanceTimersByTime(1)
    expect(events).toEqual([['action', 'act_work'], ['idle'], ['action', 'idle_blink']])
    vi.useRealTimers()
  })

  it('queues requests that arrive during the cooldown gap', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler()
    const played = []
    scheduler.on('action', (action) => played.push(action.actionId))

    scheduler.request({ actionId: 'act_work', priority: 20, durationMs: 300 })
    vi.advanceTimersByTime(300)
    expect(played).toEqual(['act_work'])

    scheduler.request({ actionId: 'act_greet', priority: 50, durationMs: 300 })
    expect(played).toEqual(['act_work'])
    expect(scheduler.current).toBeNull()

    vi.advanceTimersByTime(1000)
    expect(played).toEqual(['act_work', 'act_greet'])
    vi.useRealTimers()
  })

  it('does not queue duplicate action ids back to back', () => {
    vi.useFakeTimers()
    const scheduler = new ActionScheduler({ actionGapMs: 0 })
    const played = []
    scheduler.on('action', (action) => played.push(action.actionId))
    scheduler.request({ actionId: 'emo_happy', priority: 45, durationMs: 200 })
    for (let i = 0; i < 5; i += 1) scheduler.request({ actionId: 'emo_happy', priority: 45, durationMs: 200, text: 'pet' + i })
    vi.advanceTimersByTime(5000)
    expect(played).toEqual(['emo_happy'])
    vi.useRealTimers()
  })
})
