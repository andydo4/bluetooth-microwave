// The elevator's sounds, plugged into the shared engine (src/audio/engine.ts).
import { audio, noiseBuffer, noiseHit, OVERLOAD_BOOM_AT, OVERLOAD_CRITICAL_AT, out, track, type LevelSound } from '../../audio/engine'
import { JOLTS } from './dims'

/** A bell-like sine with a long ring-out (plus a quiet octave for shimmer): the elevator "ding". */
function chime(at: number, freq: number, volume: number, decay: number) {
  const c = audio()
  for (const [mult, v] of [[1, volume], [2, volume * 0.18]]) {
    const osc = c.createOscillator()
    osc.frequency.value = freq * mult
    const g = c.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(v, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(g).connect(out())
    osc.start(at)
    osc.stop(at + decay + 0.05)
  }
}

/**
 * The alarm bell: an electric bell's hammer striking ~19 times a second. A falling sawtooth
 * drives the gain, so each strike hits hard and rings down before the next. Inharmonic partials
 * make it sound like a metal gong rather than a beep.
 */
function bell(at: number, seconds: number, volume: number, tracked = false) {
  const c = audio()
  const reg = <T extends AudioScheduledSourceNode>(n: T) => (tracked ? track(n) : n)
  const env = c.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(volume, at + 0.02)
  env.gain.setValueAtTime(volume, at + seconds - 0.12)
  env.gain.linearRampToValueAtTime(0, at + seconds)
  const strike = c.createGain()
  strike.gain.value = 0.5
  const hammer = reg(c.createOscillator())
  hammer.type = 'sawtooth'
  hammer.frequency.value = 19
  const depth = c.createGain()
  depth.gain.value = -0.5 // inverted saw: jumps to full, then decays
  hammer.connect(depth).connect(strike.gain)
  strike.connect(env).connect(out())
  hammer.start(at)
  hammer.stop(at + seconds)
  for (const [freq, v] of [[1850, 1], [2690, 0.5], [4100, 0.25]]) {
    const osc = reg(c.createOscillator())
    osc.frequency.value = freq
    const g = c.createGain()
    g.gain.value = v
    osc.connect(g).connect(strike)
    osc.start(at)
    osc.stop(at + seconds)
  }
}

/** The ALARM button: a short ring. Harmless fun. */
export function ringAlarm() {
  bell(audio().currentTime, 1.3, 0.09)
}

/** Steel cable under strain: a stick-slip creak (a slow pulse train through a narrow resonance). */
function creak(at: number, length: number, volume: number) {
  const c = audio()
  const osc = track(c.createOscillator())
  osc.type = 'sawtooth'
  const rate = 14 + Math.random() * 24
  osc.frequency.setValueAtTime(rate, at)
  osc.frequency.linearRampToValueAtTime(rate * (0.5 + Math.random() * 1.4), at + length)
  const res = c.createBiquadFilter()
  res.type = 'bandpass'
  res.frequency.value = 500 + Math.random() * 1100
  res.Q.value = 7
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(volume, at + length * 0.3)
  g.gain.linearRampToValueAtTime(0, at + length)
  osc.connect(res).connect(g).connect(out())
  osc.start(at)
  osc.stop(at + length)
}

/** The whole car groaning on its cables: a low sliding drone that swells and fades. */
function groan(at: number, length: number, volume: number) {
  const c = audio()
  const osc = track(c.createOscillator())
  osc.type = 'sawtooth'
  const f = 60 + Math.random() * 30
  osc.frequency.setValueAtTime(f, at)
  osc.frequency.exponentialRampToValueAtTime(f * 0.7, at + length)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  lp.Q.value = 4
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(volume, at + length * 0.5)
  g.gain.linearRampToValueAtTime(0, at + length)
  osc.connect(lp).connect(g).connect(out())
  osc.start(at)
  osc.stop(at + length)
}

/** A cable snapping: a sharp crack, then the loose end whipping, a plucked steel "boing" that sags in pitch. */
function twang(at: number, volume: number) {
  noiseHit(at, 0.05, volume * 1.6, 'highpass', 2500)
  const c = audio()
  const base = 160 + Math.random() * 120
  const tone = c.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.setValueAtTime(5000, at)
  tone.frequency.exponentialRampToValueAtTime(400, at + 1)
  const g = c.createGain()
  g.gain.setValueAtTime(volume, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 1.1)
  tone.connect(g).connect(out())
  for (const mult of [1, 1.008, 2.02]) {
    const osc = track(c.createOscillator())
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(base * mult, at)
    osc.frequency.exponentialRampToValueAtTime(base * mult * 0.45, at + 1)
    osc.connect(tone)
    osc.start(at)
    osc.stop(at + 1.1)
  }
}

/** A brake shoe screeching on the rail as the car slips. */
function screech(at: number, length: number, volume: number) {
  const c = audio()
  const osc = track(c.createOscillator())
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(2300 + Math.random() * 500, at)
  osc.frequency.linearRampToValueAtTime(1900 + Math.random() * 400, at + length)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2600
  bp.Q.value = 8
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(volume, at + 0.03)
  g.gain.linearRampToValueAtTime(0, at + length)
  osc.connect(bp).connect(g).connect(out())
  osc.start(at)
  osc.stop(at + length)
}

/** Loose noise through a filter, looped (the hum's ventilation and cable whir). */
function noiseLoop(c: AudioContext, dest: AudioNode, type: BiquadFilterType, freq: number, q: number, volume: number) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 2)
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.value = volume
  src.connect(f).connect(g).connect(dest)
  return { src, gain: g }
}

export const elevatorSound: LevelSound = {
  // Music heard through elevator doors in a metal shaft: dark, and with a long hard echo.
  muffle: { cutoff: 600, room: { seconds: 1.6, decay: 0.32, wet: 0.32 } },

  // Hoist motor drone + cable whir + soft ventilation fan. Not muffled: it's the machine.
  hum(c, dest) {
    const motor = c.createOscillator()
    motor.type = 'sawtooth'
    motor.frequency.value = 46
    const motorFilter = c.createBiquadFilter()
    motorFilter.type = 'lowpass'
    motorFilter.frequency.value = 190
    const motorGain = c.createGain()
    motorGain.gain.value = 0.08
    motor.connect(motorFilter).connect(motorGain).connect(dest)

    const sub = c.createOscillator()
    sub.frequency.value = 92
    const subGain = c.createGain()
    subGain.gain.value = 0.025
    sub.connect(subGain).connect(dest)

    // The drive's faint whine.
    const whine = c.createOscillator()
    whine.frequency.value = 760
    const whineGain = c.createGain()
    whineGain.gain.value = 0.004
    whine.connect(whineGain).connect(dest)

    // Cables running over the sheave: a band of noise that swells slowly.
    const whir = noiseLoop(c, dest, 'bandpass', 1500, 2.5, 0.014)
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.35
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = 0.01
    lfo.connect(lfoDepth).connect(whir.gain.gain)

    const vent = noiseLoop(c, dest, 'lowpass', 650, 0.7, 0.04)

    return [motor, sub, whine, whir.src, lfo, vent.src]
  },

  // The classic two-tone "ding" (you've arrived).
  endSignal(at) {
    chime(at, 1318, 0.13, 2.2)
    chime(at + 0.42, 1046, 0.13, 2.8)
  },

  overload(t0) {
    // Stage 1 (JAM): the cables creak and the car groans, more and more often.
    for (let t = 0.05; t < OVERLOAD_BOOM_AT - 0.3; t += 0.15 + Math.random() * (0.6 - (t / OVERLOAD_BOOM_AT) * 0.4)) {
      creak(t0 + t, 0.25 + Math.random() * 0.4, 0.18 + Math.random() * 0.12)
    }
    groan(t0 + 0.2, 1.8, 0.16)
    groan(t0 + 1.6, 1.6, 0.2)
    groan(t0 + 2.6, 2, 0.24)

    // Stage 2 (FALL): the car slips in jolts (thud + brake screech, in time with the model's drops).
    for (const j of JOLTS) {
      const at = t0 + OVERLOAD_CRITICAL_AT + j
      noiseHit(at, 0.35, 0.8, 'lowpass', 140)
      noiseHit(at, 0.12, 0.25, 'bandpass', 900)
      screech(at + 0.02, 0.45 + Math.random() * 0.2, 0.05)
    }
    // Cables snapping one after another.
    for (const t of [0.1, 0.95, 1.6, 2.4, 2.9]) twang(t0 + OVERLOAD_CRITICAL_AT + t, 0.16)
    // Sparks crackling.
    for (let t = OVERLOAD_CRITICAL_AT * 0.6; t < OVERLOAD_BOOM_AT; t += 0.03 + Math.random() * 0.14) {
      noiseHit(t0 + t, 0.015 + Math.random() * 0.03, 0.08 + Math.random() * 0.14, 'highpass', 3000 + Math.random() * 3000)
    }
    // And the alarm bell, ringing on and on.
    bell(t0 + OVERLOAD_CRITICAL_AT + 0.2, OVERLOAD_BOOM_AT - OVERLOAD_CRITICAL_AT - 0.2, 0.08, true)
  },

  // A huge metallic crash: the car hitting the pit. Then, from the wreck, one sad little ding.
  explodeExtra(t0) {
    noiseHit(t0, 0.7, 0.9, 'lowpass', 90)
    noiseHit(t0, 1.6, 0.55, 'bandpass', 2400)
    noiseHit(t0 + 0.02, 0.9, 0.3, 'highpass', 5000)
    const c = audio()
    // The car body ringing like a struck steel box: inharmonic partials with long decays.
    for (const freq of [143, 337, 588, 911, 1377, 2210]) {
      const osc = c.createOscillator()
      osc.frequency.value = freq * (0.97 + Math.random() * 0.06)
      const g = c.createGain()
      const decay = 1.2 + Math.random() * 1.6
      g.gain.setValueAtTime(0.06, t0)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      osc.connect(g).connect(out())
      osc.start(t0)
      osc.stop(t0 + decay)
    }
    // Panels and rails clanging down.
    for (let i = 0; i < 14; i++) {
      noiseHit(t0 + 0.3 + Math.random() * 2, 0.06 + Math.random() * 0.12, 0.2 + Math.random() * 0.3, 'bandpass', 1200 + Math.random() * 3800)
    }
    chime(t0 + 3, 1290, 0.05, 1.4)
    chime(t0 + 3.45, 980, 0.05, 2)
  },
}
