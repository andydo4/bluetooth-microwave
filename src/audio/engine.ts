// All microwave sounds are synthesized; the song goes through a "closed metal box" filter chain.

let ctx: AudioContext | null = null
let master: GainNode
let hum: { nodes: (OscillatorNode | AudioBufferSourceNode)[]; gain: GainNode } | null = null

function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
  }
  // Must be called from a click handler the first time, or browsers keep it suspended.
  void ctx.resume()
  return ctx
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

function beep(at: number, length = 0.14, freq = 1850) {
  const c = audio()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(0.06, at + 0.005)
  g.gain.setValueAtTime(0.06, at + length - 0.01)
  g.gain.linearRampToValueAtTime(0, at + length)
  osc.connect(g).connect(master)
  osc.start(at)
  osc.stop(at + length)
}

// Magnetron/transformer buzz + fan noise. Not muffled: it's the microwave itself.
function startHum() {
  const c = audio()
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, c.currentTime)
  gain.gain.linearRampToValueAtTime(1, c.currentTime + 0.25)
  gain.connect(master)

  const buzz = c.createOscillator()
  buzz.type = 'sawtooth'
  buzz.frequency.value = 120
  const buzzFilter = c.createBiquadFilter()
  buzzFilter.type = 'lowpass'
  buzzFilter.frequency.value = 450
  const buzzGain = c.createGain()
  buzzGain.gain.value = 0.06
  buzz.connect(buzzFilter).connect(buzzGain).connect(gain)

  const mains = c.createOscillator()
  mains.frequency.value = 60
  const mainsGain = c.createGain()
  mainsGain.gain.value = 0.12
  mains.connect(mainsGain).connect(gain)

  const fan = c.createBufferSource()
  fan.buffer = noiseBuffer(c, 2)
  fan.loop = true
  const fanFilter = c.createBiquadFilter()
  fanFilter.type = 'bandpass'
  fanFilter.frequency.value = 600
  fanFilter.Q.value = 0.6
  const fanGain = c.createGain()
  fanGain.gain.value = 0.05
  fan.connect(fanFilter).connect(fanGain).connect(gain)

  const nodes = [buzz, mains, fan]
  nodes.forEach((n) => n.start())
  hum = { nodes, gain }
}

// Short, bright decay: what a small metal cavity adds to a sound.
function boxImpulse(c: AudioContext): AudioBuffer {
  const seconds = 0.18
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.035)
    }
  }
  return buf
}

/** The short chirp each panel key makes. */
export function keyBeep() {
  beep(audio().currentTime, 0.07, 2100)
}

// Power level 1–10 sets how sealed-in the speaker sounds: 10 is fully muffled
// (700 Hz cutoff), 1 barely (~8.4 kHz). Each level step multiplies the cutoff by ~1.3.
let powerLevel = 10
let muffle: {
  lp1: BiquadFilterNode
  lp2: BiquadFilterNode
  box: BiquadFilterNode
  shaper: WaveShaperNode // pass-through until the overload distorts it
  gate: GainNode // the overload stutters the music with it
} | null = null
function applyPowerLevel(at: number) {
  if (!muffle) return
  const cutoff = 700 * 12 ** ((10 - powerLevel) / 9)
  muffle.lp1.frequency.setTargetAtTime(cutoff, at, 0.05)
  muffle.lp2.frequency.setTargetAtTime(cutoff * 1.3, at, 0.05)
  muffle.box.gain.setTargetAtTime(5 * (powerLevel / 10), at, 0.05)
}
export function setPowerLevel(level: number) {
  powerLevel = level
  if (ctx) applyPowerLevel(ctx.currentTime)
}

/** Press START: beep, then the microwave hums until powerOff(). Must be called from the tap/click. */
export function powerOn() {
  const c = audio()
  beep(c.currentTime)
  if (!hum) startHum()

  // iPhone Safari only lets audio start during the tap itself, but the song arrives seconds later.
  // Playing a moment of silence now unlocks the player, so the song can start on it afterwards.
  const el = getPlayer()
  el.src = silence ??= silentWav()
  el.play().catch(() => {})
}

/** Hum spins down, relay clunks, then the classic three end beeps. */
export function powerOff() {
  const c = audio()
  const now = c.currentTime
  if (hum) {
    const { nodes, gain } = hum
    hum = null
    for (const n of nodes) {
      const param = n instanceof OscillatorNode ? n.frequency : n.playbackRate
      param.setValueAtTime(param.value, now)
      param.exponentialRampToValueAtTime(param.value * 0.6, now + 0.7)
      n.stop(now + 0.75)
    }
    gain.gain.setValueAtTime(1, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.7)
  }

  // Relay clunk
  const clunk = c.createBufferSource()
  clunk.buffer = noiseBuffer(c, 0.05)
  const clunkFilter = c.createBiquadFilter()
  clunkFilter.type = 'lowpass'
  clunkFilter.frequency.value = 250
  const clunkGain = c.createGain()
  clunkGain.gain.setValueAtTime(0.8, now + 0.05)
  clunkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  clunk.connect(clunkFilter).connect(clunkGain).connect(master)
  clunk.start(now + 0.05)

  for (let i = 0; i < 3; i++) beep(now + 0.9 + i * 0.45, 0.25)
}

// 0.1 s of silence as a WAV file, used to unlock the player (see powerOn).
let silence: string | undefined
function silentWav(): string {
  const rate = 8000
  const samples = 800
  const v = new DataView(new ArrayBuffer(44 + samples * 2))
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  v.setUint32(16, 16, true) // fmt chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true) // bytes per second
  v.setUint16(32, 2, true) // bytes per frame
  v.setUint16(34, 16, true) // bits per sample
  text(36, 'data')
  v.setUint32(40, samples * 2, true)
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }))
}

// One <audio> element for every song, wired through the muffle chain once.
// Reusing it is what keeps the unlock from powerOn() working, and an element can
// only be connected to Web Audio once anyway.
let player: HTMLAudioElement | null = null
function getPlayer(): HTMLAudioElement {
  if (player) return player
  const c = audio()
  player = new Audio()
  const src = c.createMediaElementSource(player)

  // Two cascaded lowpasses (24 dB/oct) kill the highs like the door and walls would.
  const lp1 = c.createBiquadFilter()
  lp1.type = 'lowpass'
  lp1.frequency.value = 700
  const lp2 = c.createBiquadFilter()
  lp2.type = 'lowpass'
  lp2.frequency.value = 900
  // Boxy resonance from the cavity.
  const box = c.createBiquadFilter()
  box.type = 'peaking'
  box.frequency.value = 320
  box.Q.value = 2
  box.gain.value = 5

  const dry = c.createGain()
  dry.gain.value = 0.8
  const reverb = c.createConvolver()
  reverb.buffer = boxImpulse(c)
  const wet = c.createGain()
  wet.gain.value = 0.25

  const shaper = c.createWaveShaper()
  shaper.oversample = '4x'
  const gate = c.createGain()

  src.connect(lp1).connect(lp2).connect(box).connect(shaper).connect(gate)
  gate.connect(dry).connect(master)
  gate.connect(reverb).connect(wet).connect(master)
  muffle = { lp1, lp2, box, shaper, gate }
  applyPowerLevel(c.currentTime)
  return player
}

export type Song = {
  /** Resolves when sound actually starts; rejects if the audio can't load. */
  playing: Promise<void>
  stop: () => void
}

/**
 * Streams the song from `url` as if it's coming from a speaker shut inside the microwave.
 * Playback starts as soon as enough has buffered. onEnded fires when the song finishes
 * (or the stream breaks mid-song), not when stop() is called.
 */
export function play(url: string, onEnded: () => void): Song {
  const el = getPlayer()
  let cleanup = () => {}

  const playing = new Promise<void>((resolve, reject) => {
    let started = false
    const onPlaying = () => {
      started = true
      resolve()
    }
    const onEnd = () => {
      cleanup()
      onEnded()
    }
    const onError = () => {
      if (started) return onEnd()
      cleanup()
      reject(new Error('Could not play that audio.'))
    }
    el.addEventListener('playing', onPlaying)
    el.addEventListener('ended', onEnd)
    el.addEventListener('error', onError)
    cleanup = () => {
      el.removeEventListener('playing', onPlaying)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('error', onError)
    }

    el.src = url
    el.play().catch((e) => {
      cleanup()
      reject(e)
    })
  })

  return {
    playing,
    stop: () => {
      cleanup()
      el.pause()
      el.removeAttribute('src')
      el.load() // drops the stream connection
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Overload: arcing (0–3 s) → fire (3–6.5 s) → explode() at OVERLOAD_BOOM_AT.

export const OVERLOAD_FIRE_AT = 3
export const OVERLOAD_BOOM_AT = 6.5

let overloadNodes: AudioScheduledSourceNode[] = []
let tinnitus: { osc: OscillatorNode; gain: GainNode } | null = null

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  return curve
}

/** A short burst of filtered noise: an electric crackle, a thud, or a boom depending on settings. */
function noiseHit(at: number, length: number, volume: number, type: BiquadFilterType, freq: number) {
  const c = audio()
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, length)
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(volume, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + length)
  src.connect(filter).connect(g).connect(master)
  src.start(at)
  overloadNodes.push(src)
}

/** DO NOT PRESS: everything that leads up to the explosion, scheduled from now. */
export function startOverload() {
  const c = audio()
  const t0 = c.currentTime
  getPlayer() // make sure the music chain exists so it can be distorted
  if (!hum) startHum()

  // The magnetron strains: hum pitch climbs.
  for (const n of hum!.nodes) {
    const param = n instanceof OscillatorNode ? n.frequency : n.playbackRate
    param.setValueAtTime(param.value, t0)
    param.linearRampToValueAtTime(param.value * 1.8, t0 + OVERLOAD_BOOM_AT)
  }

  // The song distorts and stutters.
  if (muffle) {
    muffle.shaper.curve = distortionCurve(60)
    const gate = muffle.gate.gain
    gate.cancelScheduledValues(t0)
    for (let t = t0; t < t0 + OVERLOAD_BOOM_AT; t += 0.06 + Math.random() * 0.12) {
      gate.setValueAtTime(Math.random() < 0.35 ? 0.05 : 1, t)
    }
  }

  // Electric crackles, getting denser.
  for (let t = 0.05; t < OVERLOAD_BOOM_AT; t += 0.04 + Math.random() * (0.25 - (t / OVERLOAD_BOOM_AT) * 0.2)) {
    noiseHit(t0 + t, 0.015 + Math.random() * 0.03, 0.15 + Math.random() * 0.35, 'highpass', 2000 + Math.random() * 4000)
  }

  // Fire: a roaring, crackling rumble that swells until the boom.
  const roar = c.createBufferSource()
  roar.buffer = noiseBuffer(c, 2)
  roar.loop = true
  const roarFilter = c.createBiquadFilter()
  roarFilter.type = 'lowpass'
  roarFilter.frequency.value = 700
  const roarGain = c.createGain()
  roarGain.gain.setValueAtTime(0, t0 + OVERLOAD_FIRE_AT)
  roarGain.gain.linearRampToValueAtTime(0.35, t0 + OVERLOAD_BOOM_AT)
  roar.connect(roarFilter).connect(roarGain).connect(master)
  roar.start(t0 + OVERLOAD_FIRE_AT)
  overloadNodes.push(roar)

  // Smoke alarm-style beeping once it's on fire.
  for (let t = OVERLOAD_FIRE_AT; t < OVERLOAD_BOOM_AT - 0.1; t += 0.22) beep(t0 + t, 0.11, 2900)
}

/** The boom: cuts everything, then debris clatter and a ringing in your ears. */
export function explode() {
  const c = audio()
  const t0 = c.currentTime

  for (const n of overloadNodes) {
    try {
      n.stop(t0)
    } catch {
      // never started (scheduled past now) or already stopped
    }
  }
  overloadNodes = []
  if (hum) {
    hum.nodes.forEach((n) => n.stop(t0))
    hum = null
  }

  // Boom: a long, dark noise blast plus a falling sub-bass thump.
  noiseHit(t0, 2.5, 0.9, 'lowpass', 500)
  const sub = c.createOscillator()
  sub.frequency.setValueAtTime(80, t0)
  sub.frequency.exponentialRampToValueAtTime(28, t0 + 0.9)
  const subGain = c.createGain()
  subGain.gain.setValueAtTime(0.9, t0)
  subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2)
  sub.connect(subGain).connect(master)
  sub.start(t0)
  sub.stop(t0 + 1.2)

  // Pieces landing.
  for (let i = 0; i < 7; i++) noiseHit(t0 + 0.7 + Math.random() * 1.4, 0.08, 0.3 + Math.random() * 0.3, 'lowpass', 400 + Math.random() * 900)

  // Tinnitus.
  const osc = c.createOscillator()
  osc.frequency.value = 4200
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.025, t0 + 0.3)
  gain.gain.setValueAtTime(0.025, t0 + 2)
  gain.gain.linearRampToValueAtTime(0, t0 + 7)
  osc.connect(gain).connect(master)
  osc.start(t0)
  osc.stop(t0 + 7)
  tinnitus = { osc, gain }
}

/** A brand-new microwave: undo the damage to the audio chain, and ding. */
export function resetAfterExplosion() {
  const c = audio()
  const now = c.currentTime
  if (tinnitus) {
    tinnitus.gain.gain.cancelScheduledValues(now)
    tinnitus.gain.gain.setTargetAtTime(0, now, 0.05)
    tinnitus = null
  }
  if (muffle) {
    muffle.shaper.curve = null
    muffle.gate.gain.cancelScheduledValues(now)
    muffle.gate.gain.setValueAtTime(1, now)
  }
  // Ding (lands after the drop-in animation).
  for (const [freq, vol] of [[1318, 0.12], [1975, 0.05]]) {
    const o = c.createOscillator()
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.setValueAtTime(0, now + 0.7)
    g.gain.linearRampToValueAtTime(vol, now + 0.71)
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.2)
    o.connect(g).connect(master)
    o.start(now + 0.7)
    o.stop(now + 2.3)
  }
}
