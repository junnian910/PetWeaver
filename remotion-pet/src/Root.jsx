import React from 'react'
import { Composition } from 'remotion'
import { PetMotion } from './PetMotion'
import { ActionMotion } from './ActionMotion'

const motions = ['idle', 'waving', 'jumping', 'failed', 'waiting']
const actions = ['waving-real', 'singing', 'sleeping', 'waking']

export const Root = () => (
  <>
    {motions.map((motion) => (
      <Composition
        key={motion}
        id={`Fafa-${motion}`}
        component={PetMotion}
        defaultProps={{ motion }}
        width={384}
        height={416}
        fps={60}
        durationInFrames={120}
      />
    ))}
    {actions.map((action) => (
      <Composition
        key={action}
        id={`Fafa-${action}`}
        component={ActionMotion}
        defaultProps={{ action }}
        width={384}
        height={416}
        fps={60}
        durationInFrames={120}
      />
    ))}
    <Composition
      id="Fafa-Action"
      component={ActionMotion}
      defaultProps={{ action: 'idle_blink' }}
      width={384}
      height={416}
      fps={60}
      durationInFrames={120}
    />
  </>
)
