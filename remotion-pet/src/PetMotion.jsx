import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion'

const pulse = (phase, count = 1) => Math.sin(phase * Math.PI * 2 * count)

const imageForMotion = {
  idle: 'fafa-pet-final.png',
  waving: 'happy.png',
  jumping: 'happy.png',
  failed: 'sad.png',
  waiting: 'fafa-pet-final.png',
}

export const PetMotion = ({ motion }) => {
  const frame = useCurrentFrame()
  const phase = frame / 120
  const idle = pulse(phase)
  let y = -0.75 * (idle + 1)
  let scaleY = 1 + idle * 0.002

  if (motion === 'waving') {
    const energy = pulse(phase, 3)
    y = -3 - Math.abs(energy) * 3
    scaleY = 1 + Math.abs(energy) * 0.006
  } else if (motion === 'jumping') {
    const jump = Math.pow(Math.sin(phase * Math.PI * 2), 2)
    y = -jump * 26
    scaleY = 1 - (1 - jump) * 0.006
  } else if (motion === 'failed') {
    const droop = (1 - Math.cos(phase * Math.PI * 2)) / 2
    y = droop * 5
    scaleY = 1 - droop * 0.007
  } else if (motion === 'waiting') {
    const breathe = pulse(phase)
    y = -2 - Math.abs(breathe) * 2
    scaleY = 1 + Math.abs(breathe) * 0.003
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Img
        src={staticFile(imageForMotion[motion] ?? imageForMotion.idle)}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 384,
          height: 384,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          transformOrigin: '50% 100%',
          translate: `0px ${y}px`,
          scale: `1 ${scaleY}`,
        }}
      />
    </AbsoluteFill>
  )
}
