// The car's sounds, plugged into the shared engine (src/audio/engine.ts).
import { audio, beep, noiseBuffer, noiseHit, OVERLOAD_BOOM_AT, OVERLOAD_CRITICAL_AT, out, track, type LevelSound } from '../../audio/engine'

const rand = (min: number, max: number) => min + Math.random() * (max - min)

/** A soft chime ping with a bell-like decay (the "door ajar" chime, and falling glass). */
function ping(at: number, freq: number, volume: number, decay: number) {
  const c = audio()
  const osc = c.createOscillator()
  osc.frequency.value = freq
  const over = c.createOscillator() // a faint octave makes it chime rather than beep
  over.frequency.value = freq * 2.01
  const overGain = c.createGain()
  overGain.gain.value = 0.25
  const g = c.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(volume, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0005, at + decay)
  osc.connect(g)
  over.connect(overGain).connect(g)
  g.connect(out())
  for (const o of [osc, over]) {
    o.start(at)
    o.stop(at + decay + 0.02)
  }
}

/** Filtered noise whose cutoff sweeps: whooshes, the fireball, the engine catching its breath. */
function sweep(at: number, length: number, volume: number, from: number, peak: number, to: number) {
  const c = audio()
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, length)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.setValueAtTime(from, at)
  f.frequency.exponentialRampToValueAtTime(peak, at + length * 0.15)
  f.frequency.exponentialRampToValueAtTime(to, at + length)
  const g = c.createGain()
  g.gain.setValueAtTime(volume, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + length)
  src.connect(f).connect(g).connect(out())
  src.start(at)
}

export const carSound: LevelSound = {
  // Music through the trunk and the cabin: only the bass gets out, and there's plenty of it.
  muffle: { cutoff: 400, bass: 8, room: { seconds: 0.35, decay: 0.06, wet: 0.2 } },

  // Engine idle: a low sawtooth rumble with an uneven throb, a lumpy firing pulse, and exhaust hiss.
  hum(c, dest) {
    const engine = c.createOscillator()
    engine.type = 'sawtooth'
    engine.frequency.value = 36
    const engineFilter = c.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 170
    engineFilter.Q.value = 2
    const engineGain = c.createGain()
    engineGain.gain.value = 0.08
    engine.connect(engineFilter).connect(engineGain).connect(dest)

    // Two unrelated slow LFOs on the volume: the idle never quite settles.
    const throb = c.createOscillator()
    throb.frequency.value = 1.3
    const throbDepth = c.createGain()
    throbDepth.gain.value = 0.025
    throb.connect(throbDepth).connect(engineGain.gain)
    const wander = c.createOscillator()
    wander.frequency.value = 0.47
    const wanderDepth = c.createGain()
    wanderDepth.gain.value = 0.02
    wander.connect(wanderDepth).connect(engineGain.gain)

    const firing = c.createOscillator()
    firing.type = 'square'
    firing.frequency.value = 18
    const firingFilter = c.createBiquadFilter()
    firingFilter.type = 'lowpass'
    firingFilter.frequency.value = 110
    const firingGain = c.createGain()
    firingGain.gain.value = 0.035
    firing.connect(firingFilter).connect(firingGain).connect(dest)

    const exhaust = c.createBufferSource()
    exhaust.buffer = noiseBuffer(c, 2)
    exhaust.loop = true
    const exhaustFilter = c.createBiquadFilter()
    exhaustFilter.type = 'bandpass'
    exhaustFilter.frequency.value = 230
    exhaustFilter.Q.value = 0.9
    const exhaustGain = c.createGain()
    exhaustGain.gain.value = 0.03
    exhaust.connect(exhaustFilter).connect(exhaustGain).connect(dest)

    return [engine, firing, exhaust, throb, wander]
  },

  // Engine off (a shudder), then the door-ajar chime: three soft pings.
  endSignal(at) {
    sweep(at, 0.35, 0.25, 90, 160, 50)
    for (let i = 0; i < 3; i++) ping(at + 0.45 + i * 0.42, 880, 0.07, 0.38)
  },

  overload(t0) {
    const c = audio()

    // REV: the engine revs up, drops, revs higher... then bounces off the limiter.
    const revs: [number, number][] = [[0, 45], [0.45, 115], [0.75, 75], [1.3, 160], [1.6, 105], [2.3, 215], [2.55, 175], [3.0, 245]]
    const rev = track(c.createOscillator())
    rev.type = 'sawtooth'
    const rev2 = track(c.createOscillator())
    rev2.type = 'sawtooth'
    rev2.detune.value = -1210 // an octave and a bit down: a throaty growl under it
    const revFilter = c.createBiquadFilter()
    revFilter.type = 'lowpass'
    revFilter.Q.value = 3
    const revGain = c.createGain()
    revGain.gain.setValueAtTime(0, t0)
    revGain.gain.linearRampToValueAtTime(0.11, t0 + 0.3)
    for (const osc of [rev, rev2]) osc.frequency.setValueAtTime(revs[0][1], t0)
    revFilter.frequency.setValueAtTime(revs[0][1] * 5, t0)
    for (const [t, f] of revs) {
      for (const osc of [rev, rev2]) osc.frequency.linearRampToValueAtTime(f, t0 + t)
      revFilter.frequency.linearRampToValueAtTime(f * 5, t0 + t)
    }
    for (let t = OVERLOAD_CRITICAL_AT + 0.08, hi = false; t < OVERLOAD_BOOM_AT; t += 0.08, hi = !hi) {
      for (const osc of [rev, rev2]) osc.frequency.linearRampToValueAtTime(hi ? 248 : 222, t0 + t)
    }
    rev.connect(revFilter)
    rev2.connect(revFilter)
    revFilter.connect(revGain).connect(out())
    rev.start(t0)
    rev2.start(t0)

    // Panels and glass rattling, harder and faster as it goes.
    for (let t = 0.1; t < OVERLOAD_BOOM_AT; t += rand(0.04, 0.16 - (t / OVERLOAD_BOOM_AT) * 0.1)) {
      noiseHit(t0 + t, rand(0.02, 0.05), rand(0.06, 0.16), 'bandpass', rand(2500, 5500))
    }

    // FIRE: backfires...
    for (let t = OVERLOAD_CRITICAL_AT + 0.1; t < OVERLOAD_BOOM_AT - 0.15; t += rand(0.22, 0.6)) {
      noiseHit(t0 + t, 0.16, rand(0.5, 0.8), 'lowpass', 650)
      noiseHit(t0 + t, 0.05, 0.3, 'bandpass', 1600)
    }

    // ...tire screech (a wailing band of noise-ish sawtooth)...
    const screech = track(c.createOscillator())
    screech.type = 'sawtooth'
    screech.frequency.value = 1250
    const wobble = track(c.createOscillator())
    wobble.frequency.value = 7
    const wobbleDepth = c.createGain()
    wobbleDepth.gain.value = 45
    wobble.connect(wobbleDepth).connect(screech.frequency)
    const screechFilter = c.createBiquadFilter()
    screechFilter.type = 'bandpass'
    screechFilter.frequency.value = 1400
    screechFilter.Q.value = 5
    const screechGain = c.createGain()
    screechGain.gain.setValueAtTime(0, t0 + OVERLOAD_CRITICAL_AT + 0.2)
    screechGain.gain.linearRampToValueAtTime(0.05, t0 + OVERLOAD_CRITICAL_AT + 0.45)
    screechGain.gain.setValueAtTime(0.05, t0 + 5.1)
    screechGain.gain.linearRampToValueAtTime(0, t0 + 5.7)
    screech.connect(screechFilter).connect(screechGain).connect(out())
    screech.start(t0 + OVERLOAD_CRITICAL_AT)
    wobble.start(t0 + OVERLOAD_CRITICAL_AT)

    // ...and the fire catching: a roar with crackles.
    const roar = track(c.createBufferSource())
    roar.buffer = noiseBuffer(c, 2)
    roar.loop = true
    const roarFilter = c.createBiquadFilter()
    roarFilter.type = 'bandpass'
    roarFilter.frequency.value = 700
    roarFilter.Q.value = 0.5
    const roarGain = c.createGain()
    roarGain.gain.setValueAtTime(0, t0 + OVERLOAD_CRITICAL_AT)
    roarGain.gain.linearRampToValueAtTime(0.16, t0 + OVERLOAD_BOOM_AT)
    roar.connect(roarFilter).connect(roarGain).connect(out())
    roar.start(t0 + OVERLOAD_CRITICAL_AT)
    for (let t = OVERLOAD_CRITICAL_AT; t < OVERLOAD_BOOM_AT; t += rand(0.02, 0.1)) {
      noiseHit(t0 + t, 0.02, rand(0.1, 0.3), 'highpass', 2000)
    }

    // The car alarm goes off, too (softly: it's a long way under everything else).
    const alarm = track(c.createOscillator())
    alarm.type = 'square'
    for (let t = OVERLOAD_CRITICAL_AT + 0.6, i = 0; t < OVERLOAD_BOOM_AT; t += 0.16, i++) {
      alarm.frequency.setValueAtTime(i % 2 ? 1050 : 760, t0 + t)
    }
    const alarmFilter = c.createBiquadFilter()
    alarmFilter.type = 'lowpass'
    alarmFilter.frequency.value = 2500
    const alarmGain = c.createGain()
    alarmGain.gain.value = 0.022
    alarm.connect(alarmFilter).connect(alarmGain).connect(out())
    alarm.start(t0 + OVERLOAD_CRITICAL_AT + 0.6)

    // A warning chime from the dash, just before it goes.
    beep(t0 + OVERLOAD_BOOM_AT - 0.9, 0.12, 1320, 'sine', 0.05)
    beep(t0 + OVERLOAD_BOOM_AT - 0.6, 0.12, 1320, 'sine', 0.05)
  },

  // A big fireball whoomp, then glass shattering and tinkling down.
  explodeExtra(t0) {
    sweep(t0, 2.2, 0.75, 120, 1400, 180)
    const c = audio()
    const sub = c.createOscillator()
    sub.frequency.setValueAtTime(55, t0)
    sub.frequency.exponentialRampToValueAtTime(30, t0 + 0.8)
    const subGain = c.createGain()
    subGain.gain.setValueAtTime(0.5, t0)
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1)
    sub.connect(subGain).connect(out())
    sub.start(t0)
    sub.stop(t0 + 1)

    for (let i = 0; i < 26; i++) noiseHit(t0 + rand(0.03, 0.5), rand(0.03, 0.08), rand(0.06, 0.18), 'bandpass', rand(4500, 9000))
    for (let t = 0.3; t < 2.2; t += rand(0.04, 0.18)) ping(t0 + t, rand(3000, 6200), 0.03 * (1 - t / 2.4), 0.15)
  },
}
