import React from 'react'
import { Composition } from 'remotion'
import { LifeMotion } from './LifeMotion'

// Additive v2 compositions (pilot + full batch). Lives alongside Root.jsx.
const actions = [
  'idle', 'singing', 'sleeping', 'waking', 'waving-real',
  'emo_happy', 'emo_sleepy', 'act_chin', 'act_yawn', 'emo_surprise',
  'gift_thanks', 'emo_sad', 'idle_stare', 'emo_shy', 'idle_blink',
  'act_work', 'act_intro', 'special_hourly', 'act_rub_eye', 'gift_sc',
  'gift_guard', 'act_table', 'act_sneeze', 'emo_excited', 'act_stretch',
  'emo_shout', 'act_cover_ears',
]

const idFor = (action) => `V2-${action.replace(/_/g, '-')}`

export const RootV2 = () => (
  <>
    {actions.map((action) => (
      <Composition
        key={action}
        id={idFor(action)}
        component={LifeMotion}
        defaultProps={{ recipe: action }}
        width={384}
        height={416}
        fps={60}
        durationInFrames={120}
      />
    ))}
  </>
)
