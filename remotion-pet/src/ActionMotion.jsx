import React from 'react'
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { getActionMotionSpec } from './action-specs'

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const smoothstep = (value) => {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

export function poseTransition(poseCount, progress, mixWindow = null) {
  if (poseCount <= 1) return { from: 0, to: 0, mix: 0 }
  const position = clamp01(progress) * (poseCount - 1)
  const from = Math.min(poseCount - 1, Math.floor(position))
  const to = Math.min(poseCount - 1, from + 1)
  const local = position - from
  const start = Number.isFinite(mixWindow?.from) ? mixWindow.from : 0.72
  const end = Math.max(start + 0.01, Number.isFinite(mixWindow?.to) ? mixWindow.to : 1)
  return { from, to, mix: from === to ? 0 : smoothstep((local - start) / (end - start)) }
}

function sequenceMotion(action, t, phase) {
  const envelope = Math.sin(Math.PI * t)
  const pulse = Math.sin(phase)
  const fast = Math.sin(phase * 2)
  const state = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }
  if (action === 'act_hop') {
    const jump = Math.sin(Math.PI * t) ** 1.35
    state.y = -18 * jump
    state.scaleX = 1 + 0.035 * Math.sin(Math.PI * 2 * t)
    state.scaleY = 1 - 0.035 * Math.sin(Math.PI * 2 * t)
  } else if (action === 'act_roll') {
    state.x = 7 * Math.sin(Math.PI * 2 * t)
    state.y = -3 * envelope
    state.rotate = 7 * Math.sin(Math.PI * 2 * t)
  } else if (action === 'act_spin') {
    state.x = 3.5 * Math.sin(phase)
    state.y = -2.5 * envelope
    state.rotate = 5 * Math.sin(phase)
    state.scaleX = 1 - 0.045 * envelope
  } else if (action === 'act_sneeze') {
    const recoil = interpolate(t, [0, 0.38, 0.48, 0.62, 1], [0, 1, -1, 0.35, 0], { easing: Easing.inOut(Easing.cubic) })
    state.x = -5 * recoil
    state.y = 3 * Math.max(0, recoil)
    state.rotate = -2.5 * recoil
    state.scaleX = 1 + 0.035 * recoil
    state.scaleY = 1 - 0.035 * recoil
  } else if (action === 'act_dance') {
    state.x = 6 * fast * envelope
    state.y = -3 * Math.abs(fast) * envelope
    state.rotate = 3.2 * fast * envelope
  } else if (action === 'state_move') {
    state.x = 2.2 * pulse
    state.y = -3.2 * Math.abs(fast)
    state.rotate = 1.4 * pulse
  } else if (action === 'state_talking') {
    // 说话节奏：整数次谐波保证首尾帧连续，循环不跳变；姿势交叉淡化窗口见 spec.poseMix。
    const talk = Math.sin(phase * 3)
    state.x = 0.6 * pulse
    state.y = -1.7 * Math.abs(talk)
    state.rotate = 0.55 * talk + 0.28 * Math.sin(phase * 4)
    state.scaleX = 1 - 0.012 * talk
    state.scaleY = 1 + 0.012 * talk
  } else if (action === 'state_observe' || action === 'act_lookaround') {
    state.x = 3.5 * pulse
    state.rotate = 1.4 * pulse
  } else if (action === 'act_flip_hair') {
    state.x = 3 * pulse * envelope
    state.rotate = 3.5 * pulse * envelope
  } else if (action === 'act_firework') {
    state.y = -4 * Math.sin(Math.PI * t) ** 2
    const pop = Math.sin(Math.PI * clamp01((t - 0.42) / 0.35))
    state.scaleX = 1 + 0.025 * Math.max(0, pop)
    state.scaleY = state.scaleX
  } else if (action === 'act_ink') {
    state.x = 4.5 * Math.sin(Math.PI * 2 * t) * envelope
    state.rotate = 2.2 * Math.sin(Math.PI * 2 * t) * envelope
  } else if (action === 'act_joke') {
    state.y = -2.5 * Math.abs(fast) * envelope
    state.rotate = 1.5 * fast * envelope
  } else if (action === 'special_lottery') {
    state.x = 2.5 * fast * envelope
    state.y = -2.5 * Math.abs(fast) * envelope
  } else {
    state.x = 1.5 * pulse * envelope
    state.y = -1.6 * Math.abs(fast) * envelope
    state.rotate = 0.8 * pulse * envelope
  }
  return state
}

export const ActionMotion = ({ action }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / Math.max(1, durationInFrames - 1)
  const phase = t * Math.PI * 2
  const spec = getActionMotionSpec(action)
  if (!spec) {
    throw new Error(`Unknown action motion: ${action}`)
  }
  const poseFiles = spec.poseFiles ?? [spec.poseFile]
  const pose = poseTransition(poseFiles.length, t, spec.poseMix)
  let x = 0
  let y = 0
  let rotate = 0
  let scaleX = 1
  let scaleY = 1

  if (spec.motion === 'breath') {
    // 待机呼吸：2s 一个周期，首尾帧变换为 0，循环无缝。
    const breath = Math.sin(phase)
    y = -1.4 * (1 - Math.cos(phase)) / 2
    scaleX = 1 + breath * 0.003
    scaleY = 1 - breath * 0.003
  } else if (spec.motion === 'wave') {
    x = Math.sin(phase * 2) * 2
    rotate = Math.sin(phase * 2) * 1.2
  } else if (spec.motion === 'sing') {
    y = -2 * Math.abs(Math.sin(phase * 2))
    rotate = Math.sin(phase * 2) * 0.8
    scaleX = 1 - Math.abs(Math.sin(phase)) * 0.008
    scaleY = 1 + Math.abs(Math.sin(phase)) * 0.012
  } else if (spec.motion === 'sleep') {
    rotate = Math.sin(phase) * 0.18
    scaleX = 1 + Math.sin(phase) * 0.002
    scaleY = 1 - Math.sin(phase) * 0.002
  } else if (spec.motion === 'wake') {
    scaleX = 1 - Math.abs(Math.sin(phase)) * 0.002
    scaleY = 1 + Math.abs(Math.sin(phase)) * 0.004
  } else if (spec.motion === 'stare') {
    x = Math.sin(phase) * 2
    rotate = Math.sin(phase) * 0.35
  } else if (spec.motion === 'settle') {
    // 回待机转场：轻落定弹跳。动画集中在 t∈[0,0.38]，其后完全静止在底图上，
    // 首尾帧变换为 0，与待机视频首帧逐像素一致，切换无缝。
    const settleT = clamp01(t / 0.38)
    const env = Math.sin(Math.PI * settleT)
    const bounce = interpolate(settleT, [0, 0.3, 0.62, 0.85, 1], [0, 1, -0.55, 0.22, 0], {
      easing: Easing.inOut(Easing.quad),
    })
    scaleY = 1 - 0.05 * bounce
    scaleX = 1 + 0.03 * bounce
    y = -4.5 * env * Math.max(0, bounce)
    rotate = 1.6 * env * Math.sin(Math.PI * 2 * settleT)
  } else if (spec.motion === 'happy') {
    const bounce = interpolate(t, [0, 0.22, 0.46, 0.7, 1], [0, -5, 0, -3.5, 0], {
      easing: Easing.inOut(Easing.quad),
    })
    y = bounce
    scaleX = 1 + Math.abs(bounce) * 0.0008
    scaleY = 1 - Math.abs(bounce) * 0.0008
  } else if (spec.motion === 'shy') {
    x = Math.sin(phase) * 1.8
    rotate = Math.sin(phase) * 0.8
    y = (1 - Math.cos(phase)) * 1.2
  } else if (spec.motion === 'angry') {
    const envelope = Math.sin(t * Math.PI) ** 2
    x = Math.sin(phase * 8) * 2.5 * envelope
    rotate = Math.sin(phase * 8) * 0.7 * envelope
    scaleY = 1 + envelope * 0.003
  } else if (spec.motion === 'sleepy') {
    const breath = Math.sin(phase)
    y = (1 - Math.cos(phase)) * 0.3
    scaleX = 1 + breath * 0.0015
    scaleY = 1 - breath * 0.0015
  } else if (spec.motion === 'sad') {
    const sway = Math.sin(phase)
    x = sway * 1.5
    y = (1 - Math.cos(phase)) * 0.8
    rotate = sway * 0.6
  } else if (spec.motion === 'excited') {
    const bounce = interpolate(t, [0, 0.14, 0.28, 0.44, 0.58, 0.74, 1], [0, -8, 0, -6, 0, -4, 0], {
      easing: Easing.inOut(Easing.quad),
    })
    y = bounce
    scaleX = 1 + Math.abs(bounce) * 0.001
    scaleY = 1 - Math.abs(bounce) * 0.001
  } else if (spec.motion === 'surprise') {
    const pop = interpolate(t, [0, 0.12, 0.22, 0.38, 0.58, 1], [0, -5, 1.5, 0, 1, 0], {
      easing: Easing.out(Easing.quad),
    })
    y = pop
    scaleX = 1 + Math.max(0, -pop) * 0.002
    scaleY = 1 + Math.max(0, -pop) * 0.002
  } else if (spec.motion === 'aggrieved') {
    const fidget = Math.sin(phase * 4)
    x = fidget * 1.8
    rotate = fidget * 0.7
    y = (1 - Math.cos(phase * 2)) * 0.4
  } else if (spec.motion === 'stretch') {
    const reach = interpolate(t, [0, 0.2, 0.46, 0.7, 1], [0, -5, -0.6, -4, 0], {
      easing: Easing.inOut(Easing.quad),
    })
    y = reach
    scaleY = 1 + Math.max(0, -reach) * 0.0012
  } else if (spec.motion === 'scratch') {
    const scratch = Math.sin(phase * 3)
    x = scratch * 1.8
    y = (1 - Math.cos(phase * 3)) * 0.5
    rotate = scratch * 0.8
  } else if (spec.motion === 'yawn') {
    const breath = Math.sin(phase)
    y = (1 - Math.cos(phase)) * 1
    rotate = breath * 0.5
    scaleX = 1 + breath * 0.0015
    scaleY = 1 - breath * 0.0015
  } else if (spec.motion === 'chin') {
    const nod = interpolate(t, [0, 0.2, 0.42, 0.68, 0.86, 1], [0, 2.5, 0.2, 1.8, 0.2, 0], {
      easing: Easing.inOut(Easing.quad),
    })
    x = Math.sin(phase * 1.5) * 1
    y = nod
    rotate = -nod * 0.12
  } else if (spec.motion === 'sequence') {
    const motion = sequenceMotion(action, t, phase)
    x = motion.x
    y = motion.y
    rotate = motion.rotate
    scaleX = motion.scaleX
    scaleY = motion.scaleY
  }

  // 眨眼改为纯 squash 形变：不再交叉两张几何不一致的姿势图，
  // 待机↔眨眼↔发呆全程同一张底图，杜绝切换闪变。
  if (spec.motion === 'blink') {
    const blinkWindow = interpolate(t, [0, 0.4, 0.45, 0.52, 0.57, 1], [0, 0, 1, 1, 0, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
    scaleY = scaleY - 0.045 * blinkWindow
    scaleX = scaleX + 0.02 * blinkWindow
  }

  const imageStyle = {
    position: 'absolute',
    inset: 0,
    width: 384,
    height: 416,
    objectFit: 'contain',
    transformOrigin: '50% 100%',
    transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`,
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {spec.motion === 'sequence' && pose.from !== pose.to ? (
        <>
          <Img src={staticFile(`action-poses/${poseFiles[pose.from]}`)} style={{ ...imageStyle, opacity: 1 - pose.mix }} />
          <Img src={staticFile(`action-poses/${poseFiles[pose.to]}`)} style={{ ...imageStyle, opacity: pose.mix }} />
        </>
      ) : (
        <Img src={staticFile(`action-poses/${poseFiles[pose.from]}`)} style={imageStyle} />
      )}
    </AbsoluteFill>
  )
}
