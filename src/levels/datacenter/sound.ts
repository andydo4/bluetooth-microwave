// The data center's sounds, plugged into the shared engine (src/audio/engine.ts).
import { audio, beep, noiseBuffer, noiseHit, OVERLOAD_BOOM_AT, OVERLOAD_CRITICAL_AT, out, track, type LevelSound } from '../../audio/engine'

// Hard drives seeking: a loop of short, irregular ticks.
function seekBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let t = 0.1; t < seconds - 0.05; t += 0.08 + Math.random() * 0.5) {
    const burst = Math.random() < 0.4 ? 3 : 1 // sometimes a little rattle of seeks
    for (let b = 0; b < burst; b++) {
      const at = Math.floor(c.sampleRate * (t + b * 0.035))
      for (let i = 0; i < c.sampleRate * 0.006; i++) {
        data[at + i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.0015))
      }
    }
  }
  return buf
}

/** Power-down whine: a tone sliding down as a server loses power. */
function whineDown(at: number, from = 900) {
  const c = audio()
  const osc = track(c.createOscillator())
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(60, at + 0.7)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1800
  const g = c.createGain()
  g.gain.setValueAtTime(0.045, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.7)
  osc.connect(filter).connect(g).connect(out())
  osc.start(at)
  osc.stop(at + 0.72)
}

export const datacenterSound: LevelSound = {
  // Heard from across a roaring server hall: dark, with a long echo down the aisles.
  muffle: { cutoff: 800, room: { seconds: 2.2, decay: 0.5, wet: 0.35 } },

  // Hundreds of fans (bright filtered noise), 60 Hz mains hum, and hard drives clicking away.
  hum(c, dest) {
    const fans = c.createBufferSource()
    fans.buffer = noiseBuffer(c, 2)
    fans.loop = true
    const fanHigh = c.createBiquadFilter()
    fanHigh.type = 'highpass'
    fanHigh.frequency.value = 700
    const fanBand = c.createBiquadFilter()
    fanBand.type = 'peaking'
    fanBand.frequency.value = 2600
    fanBand.gain.value = 6
    const fanGain = c.createGain()
    fanGain.gain.value = 0.06
    fans.connect(fanHigh).connect(fanBand).connect(fanGain).connect(dest)

    // Fan blade tone: a faint high whir on top of the rush.
    const whir = c.createOscillator()
    whir.frequency.value = 1180
    const whirGain = c.createGain()
    whirGain.gain.value = 0.005
    whir.connect(whirGain).connect(dest)

    const mains = c.createOscillator()
    mains.frequency.value = 60
    const mainsGain = c.createGain()
    mainsGain.gain.value = 0.07
    mains.connect(mainsGain).connect(dest)

    const buzz = c.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = 120
    const buzzFilter = c.createBiquadFilter()
    buzzFilter.type = 'lowpass'
    buzzFilter.frequency.value = 400
    const buzzGain = c.createGain()
    buzzGain.gain.value = 0.025
    buzz.connect(buzzFilter).connect(buzzGain).connect(dest)

    const seeks = c.createBufferSource()
    seeks.buffer = seekBuffer(c, 3.1)
    seeks.loop = true
    const seekFilter = c.createBiquadFilter()
    seekFilter.type = 'bandpass'
    seekFilter.frequency.value = 3200
    const seekGain = c.createGain()
    seekGain.gain.value = 0.25
    seeks.connect(seekFilter).connect(seekGain).connect(dest)

    return [fans, whir, mains, buzz, seeks]
  },

  // The terminal's "job done": two short square beeps.
  endSignal(at) {
    beep(at, 0.07, 1320, 'square', 0.06)
    beep(at + 0.14, 0.07, 1320, 'square', 0.06)
  },

  overload(t0) {
    const c = audio()

    // TEMP: the fans scream up (a rising whistle over the rush, on top of the engine's pitch climb).
    const scream = track(c.createBufferSource())
    scream.buffer = noiseBuffer(c, 2)
    scream.loop = true
    const screamFilter = c.createBiquadFilter()
    screamFilter.type = 'bandpass'
    screamFilter.Q.value = 4
    screamFilter.frequency.setValueAtTime(1500, t0)
    screamFilter.frequency.exponentialRampToValueAtTime(5500, t0 + OVERLOAD_BOOM_AT)
    const screamGain = c.createGain()
    screamGain.gain.setValueAtTime(0.02, t0)
    screamGain.gain.linearRampToValueAtTime(0.16, t0 + OVERLOAD_CRITICAL_AT)
    screamGain.gain.linearRampToValueAtTime(0.1, t0 + OVERLOAD_BOOM_AT)
    scream.connect(screamFilter).connect(screamGain).connect(out())
    scream.start(t0)

    // Temperature alarm: quick chirp pairs.
    for (let t = 0.2; t < OVERLOAD_CRITICAL_AT; t += 0.6) {
      beep(t0 + t, 0.05, 2900, 'square', 0.04)
      beep(t0 + t + 0.09, 0.05, 2900, 'square', 0.04)
    }

    // FAIL: arcing crackles, breakers tripping one after another, each server whining down.
    for (let t = OVERLOAD_CRITICAL_AT; t < OVERLOAD_BOOM_AT; t += 0.02 + Math.random() * 0.1) {
      noiseHit(t0 + t, 0.03 + Math.random() * 0.05, 0.12 + Math.random() * 0.2, 'highpass', 2500 + Math.random() * 3000)
    }
    for (let t = OVERLOAD_CRITICAL_AT + 0.2, i = 0; t < OVERLOAD_BOOM_AT - 0.2; t += 0.5 + Math.random() * 0.2, i++) {
      noiseHit(t0 + t, 0.12, 0.8, 'lowpass', 180) // breaker clunk
      noiseHit(t0 + t, 0.04, 0.25, 'bandpass', 1500)
      whineDown(t0 + t + 0.05, 1100 - i * 80)
    }
    // A harsh alarm under it all.
    for (let t = OVERLOAD_CRITICAL_AT, i = 0; t < OVERLOAD_BOOM_AT - 0.1; t += 0.3, i++) beep(t0 + t, 0.22, i % 2 ? 740 : 990, 'sawtooth', 0.03)
  },

  // Racks toppling one after another (matching the dominoes in effects.tsx), with glass and steel.
  explodeExtra(t0) {
    for (let i = 0; i < 8; i++) {
      const at = t0 + 0.55 + i * 0.25
      noiseHit(at, 0.6, 0.7, 'lowpass', 260)
      noiseHit(at + 0.01, 0.25, 0.25, 'bandpass', 1800 + Math.random() * 1500)
      if (i % 2 === 0) noiseHit(at + 0.03, 0.4, 0.12, 'highpass', 5000) // a door's glass shattering
    }
  },
}
