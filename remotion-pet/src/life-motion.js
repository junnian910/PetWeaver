import { Easing } from 'remotion'

// life-motion.js — additive procedural motion recipes layered over a static pose.
// Each recipe is a pure function of normalized time t in [0, 1], with t=0 and t=1
// visually identical (seamless loop). Returns a state object:
//
//   state = { x, y, rotate (deg), scaleX, scaleY }
//
// transform-origin = bottom center. All oscillators use INTEGER cycles so the
// loop seam stays closed; a continuous multi-cycle bob keeps per-frame diff above
// the audit threshold even at slow gesture turning points.

export const clamp01 = (v) => Math.max(0, Math.min(1, v))

// Full sine period 0 -> 0 -> 0 across [0,1]; loop-safe for integer cycles.
export const loopSine = (t, cycles = 1) => Math.sin(clamp01(t) * Math.PI * 2 * cycles)

// 1 -> -1 -> 1 cosine; continuous, loop-safe for integer cycles.
export const loopCosine = (t, cycles = 1) => Math.cos(clamp01(t) * Math.PI * 2 * cycles)

// easeInOutSine 0->1->0 pulse across [0,1].
export const pulseSine = (t) => 0.5 - 0.5 * Math.cos(clamp01(t) * Math.PI * 2)

// === (a) BREATHING — vertical scale oscillation, transform-origin bottom. ===
export function breathing(t, { cycles = 1, pct = 0.02 } = {}) {
  const amp = (pulseSine(t * cycles) - 0.5) * 2 // -1..1
  return { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 + amp * pct }
}

// === Continuous bob — always-moving vertical oscillation. ===
export function bob(t, { cycles = 3, px = 4.5, phaseRad = 0.6 } = {}) {
  const s = Math.sin(clamp01(t) * Math.PI * 2 * cycles + phaseRad)
  return { x: 0, y: s * px, rotate: 0, scaleX: 1, scaleY: 1 }
}

// === Lateral bob — side-to-side translate (adds horizontal life). ===
export function lateralBob(t, { cycles = 2, px = 3.0, phaseRad = 0 } = {}) {
  const s = Math.sin(clamp01(t) * Math.PI * 2 * cycles + phaseRad)
  return { x: s * px, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }
}

// === (b) SWAY — rotation + x-translate, phase-offset from breathing. ===
export function sway(t, { cycles = 1, deg = 1.2, px = 2.5, phaseRad = 0 } = {}) {
  const s = Math.sin(clamp01(t) * Math.PI * 2 * cycles + phaseRad)
  return { x: s * px, y: 0, rotate: s * deg, scaleX: 1, scaleY: 1 }
}

// === Tilt — pure rotation sway (head-tilt). ===
export function tilt(t, { cycles = 1, deg = 1.5, phaseRad = 0 } = {}) {
  const s = Math.sin(clamp01(t) * Math.PI * 2 * cycles + phaseRad)
  return { x: 0, y: 0, rotate: s * deg, scaleX: 1, scaleY: 1 }
}

// === (c) BLINK STAND-IN — squash-stretch pulse (single static pose). ===
export function blinkPulse(t, { phase = 0.5, width = 0.08, squash = 0.03, squashY = 0.025 } = {}) {
  const d = clamp01((t - (phase - width / 2)) / width)
  const p = pulseSine(d)
  return { x: 0, y: 0, rotate: 0, scaleX: 1 - p * squash, scaleY: 1 + p * squashY }
}

// === Head-nod — brief downward rotation + y-drop (full pulse). ===
export function nod(t, { phase = 0.5, width = 0.12, deg = 2.0, dropPx = 1.4 } = {}) {
  const d = clamp01((t - (phase - width / 2)) / width)
  const p = pulseSine(d) // 0..1..0
  return { x: 0, y: p * dropPx, rotate: p * deg, scaleX: 1, scaleY: 1 }
}

// N nod pulses evenly spaced across the loop (each a full pulse -> loop-safe).
export function nNods(t, n = 2, { deg = 2.0, dropPx = 1.4, width = 0.08 } = {}) {
  const pos = t * n
  const local = clamp01(pos - Math.floor(pos)) // 0..1 within each nod window
  const d = clamp01((local - (0.5 - width / 2)) / width)
  const p = pulseSine(d)
  return { x: 0, y: p * dropPx, rotate: p * deg, scaleX: 1, scaleY: 1 }
}

// === Bow — deeper forward rotation + dip (bigger nod). ===
export function bow(t, { phase = 0.5, width = 0.3, deg = 6.0, dropPx = 3.0 } = {}) {
  const d = clamp01((t - (phase - width / 2)) / width)
  const p = pulseSine(d)
  return { x: 0, y: p * dropPx, rotate: p * deg, scaleX: 1, scaleY: 1 }
}

// === Shrink pulse (shy / cover) — scale down then back up. ===
export function shrinkPulse(t, { phase = 0.5, width = 0.2, amount = 0.03 } = {}) {
  const d = clamp01((t - (phase - width / 2)) / width)
  const p = pulseSine(d)
  return { x: 0, y: 0, rotate: 0, scaleX: 1 - p * amount, scaleY: 1 - p * amount }
}

// === Shake — fast small x-jitter with an envelope (loop-safe integer cycles). ===
export function shake(t, { cycles = 8, px = 2.0, envCycles = 1 } = {}) {
  const fast = Math.sin(clamp01(t) * Math.PI * 2 * cycles)
  const env = 0.5 - 0.5 * Math.cos(clamp01(t) * Math.PI * 2 * envCycles) // 0..1..0
  return { x: fast * px * env, y: 0, rotate: fast * 0.5 * env, scaleX: 1, scaleY: 1 }
}

// === Crouch (cover ears / shrink down) — scale down + slight drop, continuous. ===
export function crouch(t, { cycles = 1, amount = 0.06, dropPx = 3.0 } = {}) {
  const s = 0.5 - 0.5 * Math.cos(clamp01(t) * Math.PI * 2 * cycles) // 0..1..0
  return { x: 0, y: s * dropPx, rotate: 0, scaleX: 1 - s * amount, scaleY: 1 - s * amount * 0.8 }
}

// === (d) ANTICIPATION-OVERSHOOT envelope (single rise-settle) ===
export function anticipationOvershoot(t, { anticipation = -0.08, overshoot = 1.1, settle = 0.75 } = {}) {
  const riseEnd = 0.5
  const antEnd = riseEnd * 0.35
  if (t < antEnd) return anticipation * Easing.out(Easing.quad)(t / antEnd)
  if (t < riseEnd) return overshoot * Easing.out(Easing.back(1.4))((t - antEnd) / (riseEnd - antEnd))
  const p = (t - riseEnd) / (settle - riseEnd)
  return overshoot * (1 - Easing.inOut(Easing.quad)(clamp01(p)))
}

// === Composable sum (scale multiplies, others add). ===
export function sumStates(...states) {
  const out = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }
  for (const s of states) {
    out.x += s.x || 0
    out.y += s.y || 0
    out.rotate += s.rotate || 0
    out.scaleX *= s.scaleX || 1
    out.scaleY *= s.scaleY || 1
  }
  return out
}

// === HIGH-LEVEL RECIPES ===

// Double-hop squash-stretch used by happy/excited/surprise/shout/guard.
export function doubleHop(t, { hopPx = 10, squashAmp = 0.035, bobCycles = 4, bobPx = 6.0, breathePct = 0.018 }) {
  const breathe = breathing(t, { cycles: 1, pct: breathePct })
  const swayState = sway(t, { cycles: 1, deg: 0.9, px: 2.0, phaseRad: 1.2 })
  const hop1 = Math.pow(Math.sin(clamp01(Math.min(1, t * 2)) * Math.PI), 2)
  const hop2 = Math.pow(Math.sin(clamp01(Math.max(0, (t - 0.5) * 2)) * Math.PI), 2)
  const hop = hop1 + hop2
  const bobState = bob(t, { cycles: bobCycles, px: bobPx, phaseRad: 0.6 })
  return sumStates(breathe, swayState, bobState, {
    x: 0,
    y: -hopPx * hop,
    rotate: 0,
    scaleX: 1 + (1 - hop) * squashAmp,
    scaleY: 1 - (1 - hop) * squashAmp,
  })
}

// General rise + squash->stretch ("stretch" family).
export function riseStretch(t, { risePx = 13, stretchY = 0.06, stretchX = 0.04, bobCycles = 3, bobPx = 5.0, breathePct = 0.014, tiltDeg = 0 }) {
  const breathe = breathing(t, { cycles: 1, pct: breathePct })
  const swayState = tilt(t, { cycles: 1, deg: tiltDeg, phaseRad: 1.2 })
  const riseY = -risePx * (1 - Math.cos(clamp01(t) * Math.PI * 2)) / 2
  const stretchOsc = loopSine(t, 1)
  const bobState = bob(t, { cycles: bobCycles, px: bobPx, phaseRad: 0.6 })
  return sumStates(breathe, swayState, bobState, {
    x: 0,
    y: riseY,
    rotate: 0,
    scaleX: 1 - stretchOsc * stretchX,
    scaleY: 1 + stretchOsc * stretchY,
  })
}

// Slow gentle "resting" family (sleep/idle/stare/chill).
export function gentleRest(t, { breathePct = 0.02, swayDeg = 1.6, swayPx = 3.5, bobCycles = 3, bobPx = 4.5, nodN = 1 }) {
  const breathe = breathing(t, { cycles: 1, pct: breathePct })
  const swayState = sway(t, { cycles: 1, deg: swayDeg, px: swayPx, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: bobCycles, px: bobPx, phaseRad: 0.6 })
  const nods = nodN >= 1 ? nNods(t, nodN, { deg: 2.0, dropPx: 1.4 }) : { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }
  return sumStates(breathe, swayState, bobState, nods)
}

// id="idle" — canonical idle breathing.
export function idleRecipe(t) {
  return gentleRest(t, { breathePct: 0.02, swayDeg: 1.6, swayPx: 3.5, bobCycles: 3, bobPx: 4.5, nodN: 1 })
}

// singing — stronger sway + nod (2 pulses).
export function singingRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const swayState = sway(t, { cycles: 1, deg: 2.4, px: 5.0, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 4, px: 5.0, phaseRad: 0.6 })
  const nods = nNods(t, 2, { deg: 2.4, dropPx: 1.8, width: 0.08 })
  return sumStates(breathe, swayState, bobState, nods)
}

// sleeping — slow breathing (fewer cycles, smaller amp) + tiny sway.
export function sleepingRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.012 })
  const swayState = sway(t, { cycles: 1, deg: 0.5, px: 1.0, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 4, px: 4.5, phaseRad: 0.6 })
  return sumStates(breathe, swayState, bobState)
}

// waking — rise + squash->stretch, slower.
export function wakingRecipe(t) {
  return riseStretch(t, { risePx: 10, stretchY: 0.05, stretchX: 0.03, bobCycles: 4, bobPx: 6.0, breathePct: 0.016 })
}

// waving-real — sway + lateral bob emphasized + nod (wave stand-in).
export function wavingRealRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const rockState = sway(t, { cycles: 2, deg: 2.2, px: 6.0, phaseRad: 1.2 })
  const latState = lateralBob(t, { cycles: 2, px: 5.0, phaseRad: 0.6 })
  const bobState = bob(t, { cycles: 3, px: 4.0, phaseRad: 0.6 })
  const nods = nNods(t, 1, { deg: 2.0, dropPx: 1.4 })
  return sumStates(breathe, rockState, latState, bobState, nods)
}

// emo_happy — double hop + squash-stretch.
export function emoHappyRecipe(t) {
  return doubleHop(t, { hopPx: 10, squashAmp: 0.035, bobCycles: 4, bobPx: 6.0 })
}

// emo_sleepy — slow breath + single slow nod.
export function emoSleepyRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.014 })
  const bobState = bob(t, { cycles: 4, px: 5.5, phaseRad: 0.6 })
  const nodState = nod(t, { phase: 0.5, width: 0.25, deg: 1.8, dropPx: 1.2 })
  return sumStates(breathe, bobState, nodState)
}

// act_chin — gentle breath + slight head-tilt sway.
export function actChinRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.018 })
  const tiltState = tilt(t, { cycles: 1, deg: 1.8, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 4, px: 5.5, phaseRad: 0.6 })
  return sumStates(breathe, tiltState, bobState)
}

// act_yawn — stretch variant: rise + tilt + longer hold.
export function actYawnRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.018 })
  const tiltState = tilt(t, { cycles: 1, deg: 1.6, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 3, px: 4.5, phaseRad: 0.6 })
  const riseY = -8 * (1 - Math.cos(clamp01(t) * Math.PI * 2)) / 2
  const stretchOsc = loopSine(t, 1)
  return sumStates(breathe, tiltState, bobState, {
    x: 0,
    y: riseY,
    rotate: 0,
    scaleX: 1 - stretchOsc * 0.03,
    scaleY: 1 + stretchOsc * 0.05,
  })
}

// emo_surprise — quick double bounce + squash (shorter amplitude than happy).
export function emoSurpriseRecipe(t) {
  return doubleHop(t, { hopPx: 7, squashAmp: 0.03, bobCycles: 4, bobPx: 5.0, breathePct: 0.02 })
}

// gift_thanks — hop + bow nod.
export function giftThanksRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const hop1 = Math.pow(Math.sin(clamp01(t) * Math.PI), 2)
  const bobState = bob(t, { cycles: 4, px: 6.0, phaseRad: 0.6 })
  const bowState = bow(t, { phase: 0.5, width: 0.3, deg: 5.0, dropPx: 2.5 })
  return sumStates(breathe, bobState, {
    x: 0,
    y: -7 * hop1 + bowState.y,
    rotate: bowState.rotate,
    scaleX: 1,
    scaleY: 1,
  })
}

// emo_sad — slow droop sway (asymmetric, lower frequency).
export function emoSadRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.012 })
  const droopState = sway(t, { cycles: 1, deg: 1.4, px: 2.5, phaseRad: 1.6 })
  const bobState = bob(t, { cycles: 4, px: 5.0, phaseRad: 0.6 })
  return sumStates(breathe, droopState, bobState)
}

// idle_stare — breath + subtle left-right look sway.
export function idleStareRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.015 })
  const lookState = sway(t, { cycles: 1, deg: 0.9, px: 3.0, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 4, px: 5.5, phaseRad: 0.6 })
  return sumStates(breathe, lookState, bobState)
}

// emo_shy — sway + slight shrink pulse.
export function emoShyRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.015 })
  const swayState = sway(t, { cycles: 1, deg: 1.4, px: 3.0, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 4, px: 5.5, phaseRad: 0.6 })
  const shrinkState = shrinkPulse(t, { phase: 0.5, width: 0.5, amount: 0.02 })
  return sumStates(breathe, swayState, bobState, shrinkState)
}

// idle_blink — breath + nod (blink stand-in).
export function idleBlinkRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.018 })
  const bobState = bob(t, { cycles: 4, px: 5.5, phaseRad: 0.6 })
  const nodState = nod(t, { phase: 0.5, width: 0.1, deg: 1.8, dropPx: 1.2 })
  const blink = blinkPulse(t, { phase: 0.5, width: 0.06, squash: 0.03, squashY: 0.025 })
  return sumStates(breathe, bobState, nodState, blink)
}

// act_work — energetic bob 2-3 cycles.
export function actWorkRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const bobState = bob(t, { cycles: 3, px: 8.0, phaseRad: 0.6 })
  const swayState = sway(t, { cycles: 2, deg: 1.8, px: 3.0, phaseRad: 1.2 })
  return sumStates(breathe, bobState, swayState)
}

// act_intro — bow nod + breath.
export function actIntroRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.018 })
  const bobState = bob(t, { cycles: 3, px: 4.0, phaseRad: 0.6 })
  const bowState = bow(t, { phase: 0.5, width: 0.4, deg: 7.0, dropPx: 3.5 })
  return sumStates(breathe, bobState, bowState)
}

// special_hourly — breath + nod.
export function specialHourlyRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.018 })
  const bobState = bob(t, { cycles: 4, px: 5.5, phaseRad: 0.6 })
  const nodState = nod(t, { phase: 0.5, width: 0.15, deg: 2.0, dropPx: 1.5 })
  return sumStates(breathe, bobState, nodState)
}

// act_rub_eye — tilt + sway.
export function actRubEyeRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.018 })
  const tiltState = tilt(t, { cycles: 1, deg: 1.8, phaseRad: 1.2 })
  const swayState = sway(t, { cycles: 1, deg: 1.4, px: 3.0, phaseRad: 0.6 })
  const bobState = bob(t, { cycles: 3, px: 4.0, phaseRad: 0.6 })
  return sumStates(breathe, tiltState, swayState, bobState)
}

// gift_sc — hop + bow.
export function giftScRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const hop1 = Math.pow(Math.sin(clamp01(t) * Math.PI), 2)
  const bobState = bob(t, { cycles: 3, px: 5.0, phaseRad: 0.6 })
  const bowState = bow(t, { phase: 0.5, width: 0.3, deg: 5.0, dropPx: 2.5 })
  return sumStates(breathe, bobState, {
    x: 0,
    y: -6 * hop1 + bowState.y,
    rotate: bowState.rotate,
    scaleX: 1,
    scaleY: 1,
  })
}

// gift_guard — hop + nod.
export function giftGuardRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const hop1 = Math.pow(Math.sin(clamp01(Math.min(1, t * 2)) * Math.PI), 2)
  const bobState = bob(t, { cycles: 3, px: 5.0, phaseRad: 0.6 })
  const nodState = nod(t, { phase: 0.5, width: 0.15, deg: 2.0, dropPx: 1.5 })
  return sumStates(breathe, bobState, {
    x: 0,
    y: -5 * hop1 + nodState.y,
    rotate: nodState.rotate,
    scaleX: 1,
    scaleY: 1,
  })
}

// act_table — rhythmic double-tap bob (sin^2 double pulse).
export function actTableRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  // two taps: quick down-up taps, tap1 at t~0.25, tap2 at t~0.75
  const tap1 = Math.pow(Math.sin(clamp01(Math.min(1, t * 2)) * Math.PI), 2)
  const tap2 = Math.pow(Math.sin(clamp01(Math.max(0, (t - 0.5) * 2)) * Math.PI), 2)
  const tap = tap1 + tap2
  const bobState = bob(t, { cycles: 4, px: 4.0, phaseRad: 0.6 })
  const tiltState = tilt(t, { cycles: 2, deg: 1.5, phaseRad: 0.6 })
  return sumStates(breathe, bobState, tiltState, {
    x: 0,
    y: -4 * tap,
    rotate: 0,
    scaleX: 1 + (1 - tap) * 0.03,
    scaleY: 1 - (1 - tap) * 0.03,
  })
}

// act_sneeze — anticipation-overshoot + quick shake.
export function actSneezeRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.016 })
  const bobState = bob(t, { cycles: 3, px: 4.0, phaseRad: 0.6 })
  const env = anticipationOvershoot(t, { anticipation: -0.1, overshoot: 1.2, settle: 0.8 })
  const shakeState = shake(t, { cycles: 8, px: 2.5, envCycles: 1 })
  return sumStates(breathe, bobState, shakeState, {
    x: 0,
    y: -5 * env,
    rotate: 0,
    scaleX: 1 + env * 0.03,
    scaleY: 1 - env * 0.03,
  })
}

// emo_excited — double hop (higher amplitude than happy).
export function emoExcitedRecipe(t) {
  return doubleHop(t, { hopPx: 14, squashAmp: 0.04, bobCycles: 4, bobPx: 7.0, breathePct: 0.02 })
}

// act_stretch — rise + squash->stretch.
export function actStretchRecipe(t) {
  return riseStretch(t, { risePx: 13, stretchY: 0.06, stretchX: 0.04, bobCycles: 4, bobPx: 6.0 })
}

// emo_shout — energetic jump + shake (new v0.2; no pose yet -> canonical image).
export function emoShoutRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.02 })
  const hop = Math.pow(Math.sin(clamp01(t) * Math.PI * 2), 2) // one big jump
  const bobState = bob(t, { cycles: 4, px: 6.0, phaseRad: 0.6 })
  const shakeState = shake(t, { cycles: 8, px: 2.0, envCycles: 1 })
  return sumStates(breathe, bobState, shakeState, {
    x: 0,
    y: -14 * hop,
    rotate: 0,
    scaleX: 1 + (1 - hop) * 0.04,
    scaleY: 1 - (1 - hop) * 0.04,
  })
}

// act_cover_ears — crouch (scale down) + sway (new v0.2; no pose yet).
export function actCoverEarsRecipe(t) {
  const breathe = breathing(t, { cycles: 1, pct: 0.015 })
  const crouchState = crouch(t, { cycles: 1, amount: 0.06, dropPx: 3.0 })
  const swayState = sway(t, { cycles: 1, deg: 1.4, px: 3.0, phaseRad: 1.2 })
  const bobState = bob(t, { cycles: 4, px: 4.5, phaseRad: 0.6 })
  return sumStates(breathe, crouchState, swayState, bobState)
}

// === REGISTRY: actionId -> { recipe, image } ===
export const LIFE_RECIPES = Object.freeze({
  idle_breath: idleRecipe,        // alias kept for pilot compat
  idle: idleRecipe,
  singing: singingRecipe,
  sleeping: sleepingRecipe,
  waking: wakingRecipe,
  'waving-real': wavingRealRecipe,
  emo_happy: emoHappyRecipe,
  emo_sleepy: emoSleepyRecipe,
  act_chin: actChinRecipe,
  act_yawn: actYawnRecipe,
  emo_surprise: emoSurpriseRecipe,
  gift_thanks: giftThanksRecipe,
  emo_sad: emoSadRecipe,
  idle_stare: idleStareRecipe,
  emo_shy: emoShyRecipe,
  idle_blink: idleBlinkRecipe,
  act_work: actWorkRecipe,
  act_intro: actIntroRecipe,
  special_hourly: specialHourlyRecipe,
  act_rub_eye: actRubEyeRecipe,
  gift_sc: giftScRecipe,
  gift_guard: giftGuardRecipe,
  act_table: actTableRecipe,
  act_sneeze: actSneezeRecipe,
  emo_excited: emoExcitedRecipe,
  act_stretch: actStretchRecipe,
  emo_shout: emoShoutRecipe,
  act_cover_ears: actCoverEarsRecipe,
})

export function getLifeRecipe(recipeId) {
  return Object.prototype.hasOwnProperty.call(LIFE_RECIPES, recipeId)
    ? LIFE_RECIPES[recipeId]
    : null
}

// image pose to use per actionId (defaults to canonical fafa-pet-final.png).
export function getLifeImage(actionId) {
  const custom = {
    idle: 'fafa-pet-final.png',
    singing: 'action-poses/singing.png',
    sleeping: 'action-poses/sleeping.png',
    waking: 'action-poses/waking.png',
    'waving-real': 'action-poses/waving-real.png',
    emo_happy: 'action-poses/emo_happy.png',
    emo_sleepy: 'action-poses/emo_sleepy.png',
    act_chin: 'action-poses/act_chin.png',
    act_yawn: 'action-poses/act_yawn.png',
    emo_surprise: 'action-poses/emo_surprise.png',
    gift_thanks: 'action-poses/gift_thanks-01.png',
    emo_sad: 'action-poses/emo_sad.png',
    idle_stare: 'action-poses/idle_stare.png',
    emo_shy: 'action-poses/emo_shy.png',
    idle_blink: 'action-poses/idle_blink.png',
    act_work: 'action-poses/act_work-01.png',
    act_intro: 'action-poses/act_intro-01.png',
    special_hourly: 'action-poses/special_hourly-01.png',
    act_rub_eye: 'action-poses/act_rub_eye-01.png',
    gift_sc: 'action-poses/gift_sc-01.png',
    gift_guard: 'action-poses/gift_guard-01.png',
    act_table: 'action-poses/act_table-01.png',
    act_sneeze: 'action-poses/act_sneeze-01.png',
    emo_excited: 'action-poses/emo_excited.png',
    act_stretch: 'action-poses/act_stretch.png',
    emo_shout: 'fafa-pet-final.png',        // new v0.2: no pose yet -> canonical
    act_cover_ears: 'fafa-pet-final.png',   // new v0.2: no pose yet -> canonical
  }
  return Object.prototype.hasOwnProperty.call(custom, actionId)
    ? custom[actionId]
    : 'fafa-pet-final.png'
}
