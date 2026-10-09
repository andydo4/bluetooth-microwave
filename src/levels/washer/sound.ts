// The washing machine's sounds, plugged into the shared engine (src/audio/engine.ts).
import { audio, beep, noiseBuffer, noiseHit, OVERLOAD_BOOM_AT, OVERLOAD_CRITICAL_AT, out, track, type LevelSound } from '../../audio/engine'

// One wash cycle "tumble": a dull thud as the load drops, looped.
function thumpBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const data = buf.getChannelData(0)
  const at = Math.floor(c.sampleRate * 0.05)
  for (let i = 0; i < c.sampleRate * 0.25; i++) {
    const t = i / c.sampleRate
    data[at + i] = (Math.sin(2 * Math.PI * 65 * t) * 0.8 + (Math.random() * 2 - 1) * 0.15) * Math.exp(-t / 0.05)
  }
  return buf
}

/** A water bubble: a short sine that sweeps up in pitch. */
function bloop(at: number, volume = 0.12) {
  const c = audio()
  const osc = track(c.createOscillator())
  const g = c.createGain()
  const f = 250 + Math.random() * 300
  osc.frequency.setValueAtTime(f, at)
  osc.frequency.exponentialRampToValueAtTime(f * 3, at + 0.06)
  g.gain.setValueAtTime(volume, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
  osc.connect(g).connect(out())
  osc.start(at)
  osc.stop(at + 0.08)
}

export const washerSound: LevelSound = {
  // Through a sloshing drum of water: darker than the microwave, with the cutoff wobbling.
  muffle: { cutoff: 550, wobbleHz: 0.7, wobbleDepth: 220 },

  // Motor drone + whine, water sloshing, and the load thumping round. Not muffled: it's the machine.
  hum(c, dest) {
    const motor = c.createOscillator()
    motor.type = 'sawtooth'
    motor.frequency.value = 50
    const motorFilter = c.createBiquadFilter()
    motorFilter.type = 'lowpass'
    motorFilter.frequency.value = 250
    const motorGain = c.createGain()
    motorGain.gain.value = 0.08
    motor.connect(motorFilter).connect(motorGain).connect(dest)

    const whine = c.createOscillator()
    whine.frequency.value = 420
    const whineGain = c.createGain()
    whineGain.gain.value = 0.008
    whine.connect(whineGain).connect(dest)

    // Slosh: filtered noise whose volume swells and fades with a slow LFO.
    const slosh = c.createBufferSource()
    slosh.buffer = noiseBuffer(c, 2)
    slosh.loop = true
    const sloshFilter = c.createBiquadFilter()
    sloshFilter.type = 'bandpass'
    sloshFilter.frequency.value = 500
    sloshFilter.Q.value = 0.7
    const sloshGain = c.createGain()
    sloshGain.gain.value = 0.04
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.6
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = 0.035
    lfo.connect(lfoDepth).connect(sloshGain.gain)
    slosh.connect(sloshFilter).connect(sloshGain).connect(dest)

    const thump = c.createBufferSource()
    thump.buffer = thumpBuffer(c, 1.4)
    thump.loop = true
    const thumpGain = c.createGain()
    thumpGain.gain.value = 0.5
    thump.connect(thumpGain).connect(dest)

    return [motor, whine, slosh, lfo, thump]
  },

  // The rising "cycle finished" chime.
  endSignal(at) {
    beep(at, 0.22, 1046, 'sine', 0.09)
    beep(at + 0.2, 0.22, 1318, 'sine', 0.09)
    beep(at + 0.4, 0.55, 1568, 'sine', 0.09)
  },

  overload(t0) {
    // Unbalanced load: irregular banging that gets faster, with the odd metal clank.
    for (let t = 0.1; t < OVERLOAD_BOOM_AT; t += 0.12 + Math.random() * (0.45 - (t / OVERLOAD_BOOM_AT) * 0.3)) {
      noiseHit(t0 + t, 0.12, 0.7 + Math.random() * 0.3, 'lowpass', 140)
      if (Math.random() < 0.3) noiseHit(t0 + t + 0.01, 0.05, 0.15, 'bandpass', 2200 + Math.random() * 1500)
    }

    // Foaming over: water gushing and bubbling.
    const c = audio()
    const gush = track(c.createBufferSource())
    gush.buffer = noiseBuffer(c, 2)
    gush.loop = true
    const gushFilter = c.createBiquadFilter()
    gushFilter.type = 'lowpass'
    gushFilter.frequency.value = 1100
    const gushGain = c.createGain()
    gushGain.gain.setValueAtTime(0, t0 + OVERLOAD_CRITICAL_AT)
    gushGain.gain.linearRampToValueAtTime(0.3, t0 + OVERLOAD_BOOM_AT)
    gush.connect(gushFilter).connect(gushGain).connect(out())
    gush.start(t0 + OVERLOAD_CRITICAL_AT)
    for (let t = OVERLOAD_CRITICAL_AT; t < OVERLOAD_BOOM_AT; t += 0.03 + Math.random() * 0.12) bloop(t0 + t)

    // The error beep: two tones, over and over.
    for (let t = OVERLOAD_CRITICAL_AT, i = 0; t < OVERLOAD_BOOM_AT - 0.1; t += 0.25, i++) beep(t0 + t, 0.2, i % 2 ? 660 : 880, 'square', 0.05)
  },

  // A big splash, then bubbles settling.
  explodeExtra(t0) {
    noiseHit(t0, 1.4, 0.5, 'bandpass', 1400)
    for (let t = 0.2; t < 2.5; t += 0.05 + Math.random() * 0.25) bloop(t0 + t, 0.08 * (1 - t / 2.5))
  },
}
