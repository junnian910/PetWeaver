import React from 'react'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { getLifeRecipe, getLifeImage } from './life-motion'

// LifeMotion — layers additive procedural motion recipes over a pose image,
// anchored at bottom-center. The pose defaults to the action-specific pose
// (via getLifeImage), falling back to the canonical fafa-pet-final.png.
export const LifeMotion = ({ recipe, image }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / Math.max(1, durationInFrames - 1)

  const recipeFn = getLifeRecipe(recipe)
  if (!recipeFn) {
    throw new Error(`Unknown life recipe: ${recipe}`)
  }
  const s = recipeFn(t)
  const imagePath = image || getLifeImage(recipe)

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <Img
        src={staticFile(imagePath)}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 384,
          height: 416,
          objectFit: 'contain',
          objectPosition: 'center bottom',
          transformOrigin: '50% 100%',
          transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rotate}deg) scale(${s.scaleX}, ${s.scaleY})`,
        }}
      />
    </AbsoluteFill>
  )
}
