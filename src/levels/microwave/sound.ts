// The microwave's sounds, plugged into the shared engine (src/audio/engine.ts).
import { audio, beep, noiseBuffer, noiseHit, OVERLOAD_BOOM_AT, OVERLOAD_CRITICAL_AT, out, track, type LevelSound } from '../../audio/engine'

export const microwaveSound: LevelSound = {
  // Through a metal box door: 700 Hz at power level 10.
  muffle: { cutoff: 700 },

  // Magnetron/transformer buzz + fan noise. Not muffled: it's the microwave itself.
  hum(c, dest) {
    const buzz = c.createOscillator()
    buzz.type = 'sawtooth'
    buzz.frequency.value = 120
    const buzzFilter = c.createBiquadFilter()
    buzzFilter.type = 'lowpass'
    buzzFilter.frequency.value = 450
    const buzzGain = c.createGain()
    buzzGain.gain.value = 0.06
    buzz.connect(buzzFilter).connect(buzzGain).connect(dest)

    const mains = c.createOscillator()
    mains.frequency.value = 60
    const mainsGain = c.createGain()
    mainsGain.gain.value = 0.12
    mains.connect(mainsGain).connect(dest)

    const fan = c.createBufferSource()
    fan.buffer = noiseBuffer(c, 2)
    fan.loop = true
    const fanFilter = c.createBiquadFilter()
    fanFilter.type = 'bandpass'
    fanFilter.frequency.value = 600
    fanFilter.Q.value = 0.6
    const fanGain = c.createGain()
    fanGain.gain.value = 0.05
    fan.connect(fanFilter).connect(fanGain).connect(dest)

    return [buzz, mains, fan]
  },

  // The classic three end beeps.
  endSignal(at) {
    for (let i = 0; i < 3; i++) beep(at + i * 0.45, 0.25)
  },

  overload(t0) {
    // Electric crackles, getting denser.
    for (let t = 0.05; t < OVERLOAD_BOOM_AT; t += 0.04 + Math.random() * (0.25 - (t / OVERLOAD_BOOM_AT) * 0.2)) {
      noiseHit(t0 + t, 0.015 + Math.random() * 0.03, 0.15 + Math.random() * 0.35, 'highpass', 2000 + Math.random() * 4000)
    }

    // Fire: a roaring, crackling rumble that swells until the boom.
    const c = audio()
    const roar = track(c.createBufferSource())
    roar.buffer = noiseBuffer(c, 2)
    roar.loop = true
    const roarFilter = c.createBiquadFilter()
    roarFilter.type = 'lowpass'
    roarFilter.frequency.value = 700
    const roarGain = c.createGain()
    roarGain.gain.setValueAtTime(0, t0 + OVERLOAD_CRITICAL_AT)
    roarGain.gain.linearRampToValueAtTime(0.35, t0 + OVERLOAD_BOOM_AT)
    roar.connect(roarFilter).connect(roarGain).connect(out())
    roar.start(t0 + OVERLOAD_CRITICAL_AT)

    // Smoke alarm-style beeping once it's on fire.
    for (let t = OVERLOAD_CRITICAL_AT; t < OVERLOAD_BOOM_AT - 0.1; t += 0.22) beep(t0 + t, 0.11, 2900)
  },
}
