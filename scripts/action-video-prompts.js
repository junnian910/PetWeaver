const SHOT_LOCK = `
Single unbroken fixed orthographic full-body shot. Keep the exact same anime desktop-pet character from the reference: identical face, eyes, headset, hair, outfit, colors, proportions, and shoes. The character remains centered and fully visible; both shoes stay planted on the same baseline and must never be cropped. The whole area outside the character stays a perfectly flat #00FF00 chroma-green field in every frame: no floor, horizon, gradient, light spill, shadow, reflection, scenery, particles, props, captions, or additional characters. The camera never moves, pans, tilts, rolls, zooms, reframes, or changes focal length.
`

const MOTION_LOCK = `
Timeline is mandatory. At 0.0-0.7 seconds, hold the exact neutral standing reference pose. At 0.7-2.4 seconds, perform only the requested action as continuous physically connected motion. At 2.4-4.2 seconds, reverse or complete the motion and smoothly return every limb to the exact neutral reference pose. At 4.2-5.0 seconds, keep holding that neutral pose naturally. No jump cuts, pose snaps, freeze frames, abrupt reset, morphing, duplicated limbs, or hidden transitions. The final pose must match the first pose closely enough to cross-fade into the idle video without a visible cut.
`

const ANATOMY_LOCK = `
Preserve a single coherent character rig throughout the take. Keep the head, torso, arms, hands, legs, shoes, hair, and headset attached in their original proportions. Hands must have normal separated fingers and move only as required by the action. Use gentle ease-in and ease-out at every change of direction; the feet remain on the original baseline unless the requested action explicitly says to hop, roll, step, or spin. Do not invent a prop: mime the action with empty hands where appropriate.
`

export const ACTION_DIRECTIONS = Object.freeze({
  idle_breath: 'Keep the neutral standing pose and make only a slow, subtle breathing cycle: chest rises slightly, chest falls slightly, then hold neutral.',
  act_greet: 'Raise one hand to shoulder height, make two small friendly side-to-side waves with separated fingers, lower the hand, and return to neutral.',
  act_sing: 'Make calm natural singing motions: mouth opens and closes gently for one short phrase while one open hand gives two small rhythmic gestures, then rest neutral.',
  act_sleep: 'Yawn once, lower the head and shoulders into a calm sleepy resting stance without leaving frame, then gently rise back to the original neutral standing pose.',
  act_wake: 'Start with a small sleepy head tilt, stretch both shoulders and arms briefly, open the eyes fully, and settle into the original neutral standing pose.',
  idle_blink: 'Make one slow natural blink only: eyelids lower, close briefly, and reopen while the head and body remain still.',
  idle_stare: 'Make a tiny attentive breathing motion and one subtle eye movement, then settle back into the unchanged neutral pose.',
  emo_happy: 'Smile warmly, lift the shoulders slightly, make one small pleased bounce, then relax back to neutral.',
  emo_shy: 'Tilt the head down slightly, bring one hand near the cheek with a shy smile, then lower it and return to neutral.',
  emo_angry: 'Briefly knit the brows and put both hands on the hips with a small frustrated stomp, then calm down and return to neutral.',
  emo_sleepy: 'Make one sleepy yawn, rub one eye once, and settle back into the neutral standing pose.',
  emo_sad: 'Lower the gaze, let the shoulders sink gently, take one small sigh-like motion, then recover to neutral.',
  emo_excited: 'Clench both fists close to the chest, make one controlled excited bounce, then return to neutral without moving the feet.',
  emo_surprise: 'Open the eyes wide, raise both hands briefly to shoulder height, then lower them and return to neutral.',
  emo_aggrieved: 'Puff the cheeks slightly, cross the arms for one brief sulky beat, then uncross them and return to neutral.',
  act_stretch: 'Raise both arms smoothly above the head, lengthen the torso in one clear full-body stretch, then lower both arms slowly.',
  act_spin: 'Turn the whole body once clockwise in place while both feet stay on the baseline, then finish facing forward in the neutral pose.',
  act_scratch: 'Lift the right hand to the side of the head, make two small clear scratching motions, then lower the hand.',
  act_flip_hair: 'Turn the head gently left and then right, creating one clear hair flip while the torso stays centered, then face forward again.',
  act_yawn: 'Cover the mouth with one hand for one visible yawn, lower the hand, blink once, and return to neutral.',
  act_table: 'Bend both elbows and make two distinct, light downward palm taps in front of the lower torso; hands must separate between taps, then relax.',
  act_lookaround: 'Look left, return through center, look right, return through center, with small natural head and eye movement only.',
  act_roll: 'Crouch down continuously, make one compact sideways floor roll while remaining fully in frame, stand up smoothly, and return to neutral.',
  act_hop: 'Bend the knees, make one small vertical hop with both feet leaving and returning to the same baseline, then absorb the landing gently.',
  act_chin: 'Rest the chin in one hand with the elbow supported by the other hand, think for one beat, then lower both hands.',
  act_rub_eye: 'Raise one hand, rub one eye in two small circles, blink, and lower the hand back to neutral.',
  act_sneeze: 'Build up with a small inhale and shoulder lift, make one clear sneeze into the bent elbow, recover and return to neutral.',
  act_dance: 'Perform a short two-count dance: step weight left with arms open, shift weight right with arms crossing, then return both feet and arms to neutral.',
  act_work: 'Hold both forearms separately in front of the waist and mime typing on an invisible keyboard: make six clearly alternating fingertip key presses, left and right hands moving independently, then lower both hands.',
  act_ink: 'Kneel or lean forward briefly and make one clear painting gesture on an invisible surface with one hand, then stand upright and return to neutral.',
  act_firework: 'Raise one hand as if holding a tiny sparkler, trace one small glowing-free circular flourish without creating a real prop, lower the hand, and return to neutral.',
  act_intro: 'Place one hand on the chest, smile, make one small friendly wave with the other hand, lower it, and return to neutral.',
  act_joke: 'Make one playful storytelling gesture with both hands, pause for a small cheerful smile, then lower both hands back to neutral.',
  gift_thanks: 'Bring both open palms together at chest height, bend the upper body forward in one clear grateful bow, rise smoothly, separate the hands, and return to neutral.',
  gift_sc: 'Place one hand on the heart, make one appreciative open-palm gesture toward the viewer, then lower the hand and return to neutral.',
  gift_guard: 'Make one respectful salute-like gesture: hand to forehead, small upright bow, hand down, then return to neutral.',
  special_hourly: 'Look upward at an imaginary clock, make one delighted small celebratory fist pump, then return to neutral.',
  special_lottery: 'Clasp both hands excitedly, make one small anticipation bounce, open both hands in a reveal gesture, then settle back to neutral.',
  state_move: 'Walk in place with four gentle alternating steps while the character remains centered in frame, then return both feet to the neutral stance.',
  state_observe: 'Make a slow curious scan: head and eyes left, center, right, center, with a tiny attentive lean that resolves to neutral.',
  state_talking: 'Make gentle speaking motions: small natural mouth movement, two calm open-palm hand gestures at waist height, then rest both hands in neutral.',
  emo_shout: 'Lean forward slightly, open the mouth for one short clear shout, raise both hands near the shoulders, then relax back to neutral.',
  act_cover_ears: 'Raise both hands to cover both ears, hold for one clear beat, lower both hands, and return to neutral.'
})

export const ACTION_VIDEO_NEGATIVE_PROMPT = [
  'black background', 'purple background', 'blue background', 'gradient background', 'floor', 'shadow', 'reflection', 'scenery',
  'camera movement', 'zoom', 'crop', 'missing feet', 'extra object', 'extra character', 'text', 'watermark',
  'jump cut', 'pose snap', 'abrupt reset', 'freeze frame', 'duplicated limb', 'extra fingers', 'distorted hands', 'distorted face', 'body morph'
].join(', ')

export function buildActionVideoPrompt(actionId) {
  const direction = ACTION_DIRECTIONS[actionId]
  if (!direction) throw new Error(`No storyboard prompt is defined for action: ${actionId}`)
  return `${SHOT_LOCK}\n${ANATOMY_LOCK}\n${MOTION_LOCK}\nRequested action: ${direction}`.replace(/\s+\n/g, '\n').trim()
}

export function buildActionVideoRequest(actionId, imageUrl) {
  if (!/^https:\/\/.+/.test(String(imageUrl))) throw new Error('A public HTTPS reference image URL is required')
  return {
    model: 'wan2.6-i2v-flash',
    image_url: imageUrl,
    prompt: buildActionVideoPrompt(actionId),
    negative_prompt: ACTION_VIDEO_NEGATIVE_PROMPT,
    resolution: '720p',
    duration: 5,
    audio: false
  }
}
