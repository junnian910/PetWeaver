export function createTtsLifecycle({ stopAudio = (player) => player?.pause?.() } = {}) {
  let sequence = 0
  let active = null

  const snapshot = () => active ? { ...active } : null

  function beginAction({ instanceId, actionId, hasDedicatedVideo, loop = false }) {
    if (active?.player) stopAudio(active.player)
    active = {
      token: ++sequence,
      instanceId,
      actionId,
      hasDedicatedVideo: Boolean(hasDedicatedVideo),
      loop: Boolean(loop),
      player: null,
      audioState: 'idle'
    }
    return snapshot()
  }

  function isCurrent(instanceId) {
    return active?.instanceId === instanceId
  }

  function canStartAudio(instanceId) {
    return isCurrent(instanceId) && active.audioState === 'idle'
  }

  function acceptAudio(instanceId, player) {
    if (!canStartAudio(instanceId)) return false
    active.player = player
    active.audioState = 'pending'
    return snapshot()
  }

  function markAudioPlaying(instanceId, player) {
    if (!isCurrent(instanceId) || active.player !== player || active.audioState !== 'pending') return false
    active.audioState = 'playing'
    return { ...snapshot(), enterTalking: !active.hasDedicatedVideo }
  }

  function finishAudio(instanceId, player, { schedulerBusy = false } = {}) {
    if (!isCurrent(instanceId) || active.player !== player) return null
    const finished = snapshot()
    active = null
    stopAudio(player)
    return {
      ...finished,
      exitTalking: finished.audioState === 'playing' && !finished.hasDedicatedVideo,
      resumeActionId: schedulerBusy ? finished.actionId : 'idle_breath',
      resumeLoop: schedulerBusy ? finished.loop : true
    }
  }

  function hasActiveAudio() {
    return active?.audioState === 'pending' || active?.audioState === 'playing'
  }

  function cancel() {
    if (active?.player) stopAudio(active.player)
    active = null
    sequence += 1
  }

  return {
    beginAction,
    isCurrent,
    canStartAudio,
    acceptAudio,
    markAudioPlaying,
    finishAudio,
    hasActiveAudio,
    cancel
  }
}
