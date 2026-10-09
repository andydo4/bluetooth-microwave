// The sound engine: one shared music player + "muffle" chain, power on/off, the overload framework
// and the explosion. Everything is synthesized with Web Audio (no sound files).
// Each level supplies a LevelSound profile (its hum, muffle character, end signal and overload
// noises); see src/levels/*/sound.ts. Call setLevelSound() when the level changes.

let ctx: AudioContext | null = null
let master: GainNode

/** The shared AudioContext. Must be first called from a tap/click, or browsers keep it suspended. */
export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
  }
  void ctx.resume()
  return ctx
}

/** Where level sounds connect to. */
export function out(): AudioNode {
  audio()
  return master
}

export function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

export function beep(at: number, length = 0.14, freq = 1850, type: OscillatorType = 'square', volume = 0.06) {
  const c = audio()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(volume, at + 0.005)
  g.gain.setValueAtTime(volume, at + length - 0.01)
  g.gain.linearRampToValueAtTime(0, at + length)
  osc.connect(g).connect(master)
  osc.start(at)
  osc.stop(at + length)
}

/** Sources started for the overload; all stopped at the explosion. */
let overloadNodes: AudioScheduledSourceNode[] = []
export function track<T extends AudioScheduledSourceNode>(node: T): T {
  overloadNodes.push(node)
  return node
}

/** A short burst of filtered noise: a crackle, a thud, a splash or a boom depending on settings. */
export function noiseHit(at: number, length: number, volume: number, type: BiquadFilterType, freq: number) {
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
  track(src)
}

// ---------------------------------------------------------------------------------------------
// Level sound profiles

export type HumNode = OscillatorNode | AudioBufferSourceNode

export type LevelSound = {
  /**
   * Lowpass cutoff (Hz) at power level 10, i.e. fully sealed in. Optional wobble makes it slosh.
   * room: the reverb around the speaker (default: a tiny metal box, 0.18 s). Bigger spaces (a lift
   * shaft, server aisles) want seconds 1–3 and a slower decay. bass: low-shelf boost in dB (car).
   */
  muffle: {
    cutoff: number
    wobbleHz?: number
    wobbleDepth?: number
    room?: { seconds: number; decay: number; wet: number }
    bass?: number
  }
  /** The machine's running sound, connected to `dest`. Return the sources; the engine starts them. */
  hum(c: AudioContext, dest: AudioNode): HumNode[]
  /** The "done" signal after power-down (microwave beeps, washer chime...), at time `at`. */
  endSignal(at: number): void
  /** Level-specific overload sounds scheduled from t0. Register sources with track() / noiseHit(). */
  overload(t0: number): void
  /** Extra sounds layered on the generic boom. */
  explodeExtra?(t0: number): void
}

const BOX_ROOM = { seconds: 0.18, decay: 0.035, wet: 0.25 }

let level: LevelSound | null = null
export function setLevelSound(sound: LevelSound) {
  level = sound
  if (muffle && ctx) muffle.reverb.buffer = roomImpulse(ctx, sound.muffle.room ?? BOX_ROOM)
  if (ctx) applyMuffle(ctx.currentTime)
}

// ---------------------------------------------------------------------------------------------
// The shared music player and muffle chain

// Decaying noise: the reverb of the space around the speaker (a small metal cavity by default).
function roomImpulse(c: AudioContext, { seconds, decay }: { seconds: number; decay: number }): AudioBuffer {
  const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const t = i / c.sampleRate
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t / decay)
    }
  }
  return buf
}

// Power level 1–10 sets how sealed-in the speaker sounds: 10 is fully muffled (the level's
// cutoff, 700 Hz for the microwave), 1 barely (12× higher). Each step multiplies the cutoff by ~1.3.
let powerLevel = 10
let clear = false // after an explosion the speaker is out in the open: no muffling
let muffle: {
  lp1: BiquadFilterNode
  lp2: BiquadFilterNode
  box: BiquadFilterNode
  shaper: WaveShaperNode // pass-through until the overload distorts it
  gate: GainNode // the overload stutters the music with it
  wet: GainNode
  reverb: ConvolverNode
  bass: BiquadFilterNode // low shelf, 0 dB unless the level boosts it
  wobble: OscillatorNode // sloshing cutoff (washer); depth 0 when unused
  wobbleDepth: GainNode
} | null = null

function applyMuffle(at: number) {
  if (!muffle) return
  const m = level?.muffle ?? { cutoff: 700 }
  const cutoff = clear ? 16000 : m.cutoff * 12 ** ((10 - powerLevel) / 9)
  muffle.lp1.frequency.setTargetAtTime(cutoff, at, 0.05)
  muffle.lp2.frequency.setTargetAtTime(cutoff * 1.3, at, 0.05)
  muffle.box.gain.setTargetAtTime(clear ? 0 : 5 * (powerLevel / 10), at, 0.05)
  muffle.wet.gain.setTargetAtTime(clear ? 0.05 : (m.room ?? BOX_ROOM).wet, at, 0.05)
  muffle.bass.gain.setTargetAtTime(clear ? 0 : (m.bass ?? 0), at, 0.05)
  muffle.wobble.frequency.setTargetAtTime(m.wobbleHz ?? 1, at, 0.05)
  muffle.wobbleDepth.gain.setTargetAtTime(clear ? 0 : (m.wobbleDepth ?? 0) * (powerLevel / 10), at, 0.05)
}

export function setPowerLevel(levelNumber: number) {
  powerLevel = levelNumber
  if (ctx) applyMuffle(ctx.currentTime)
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
  const lp2 = c.createBiquadFilter()
  lp2.type = 'lowpass'
  // Boxy resonance from the cavity.
  const box = c.createBiquadFilter()
  box.type = 'peaking'
  box.frequency.value = 320
  box.Q.value = 2
  const bass = c.createBiquadFilter()
  bass.type = 'lowshelf'
  bass.frequency.value = 120

  const wobble = c.createOscillator()
  const wobbleDepth = c.createGain()
  wobbleDepth.gain.value = 0
  wobble.connect(wobbleDepth)
  wobbleDepth.connect(lp1.frequency)
  wobbleDepth.connect(lp2.frequency)
  wobble.start()

  const dry = c.createGain()
  dry.gain.value = 0.8
  const reverb = c.createConvolver()
  reverb.buffer = roomImpulse(c, level?.muffle.room ?? BOX_ROOM)
  const wet = c.createGain()

  const shaper = c.createWaveShaper()
  shaper.oversample = '4x'
  const gate = c.createGain()

  src.connect(lp1).connect(lp2).connect(box).connect(bass).connect(shaper).connect(gate)
  gate.connect(dry).connect(master)
  gate.connect(reverb).connect(wet).connect(master)
  muffle = { lp1, lp2, box, shaper, gate, wet, reverb, bass, wobble, wobbleDepth }
  applyMuffle(c.currentTime)
  return player
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

export type Song = {
  /** Resolves when sound actually starts; rejects if the audio can't load. */
  playing: Promise<void>
  stop: () => void
}

/**
 * Streams the song from `url` as if it's coming from a speaker shut inside the machine.
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
// Power

let hum: { nodes: HumNode[]; gain: GainNode } | null = null

function startHum() {
  if (!level) return
  const c = audio()
  const gain = c.createGain()
  gain.gain.setValueAtTime(0, c.currentTime)
  gain.gain.linearRampToValueAtTime(1, c.currentTime + 0.25)
  gain.connect(master)
  const nodes = level.hum(c, gain)
  nodes.forEach((n) => n.start())
  hum = { nodes, gain }
}

/** The short chirp each panel key makes. */
export function keyBeep() {
  beep(audio().currentTime, 0.07, 2100)
}

/** Press START: beep, then the machine runs until powerOff(). Must be called from the tap/click. */
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

/** The machine winds down (every hum source's pitch drops), a relay clunks, then the level's end signal. */
export function powerOff() {
  const c = audio()
  const now = c.currentTime
  if (hum) {
    const { nodes, gain } = hum
    hum = null
    for (const n of nodes) {
      const param = n instanceof OscillatorNode ? n.frequency : n.playbackRate
      param.setValueAtTime(param.value, now)
      param.exponentialRampToValueAtTime(Math.max(param.value * 0.6, 0.01), now + 0.7)
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

  level?.endSignal(now + 0.9)
}

// ---------------------------------------------------------------------------------------------
// Overload: stage 1 "overloading" (0–3 s) → stage 2 "critical" (3–6.5 s) → explode() at OVERLOAD_BOOM_AT.
// The same timeline for every level; App's timers use these constants so sound and visuals line up.

export const OVERLOAD_CRITICAL_AT = 3
export const OVERLOAD_BOOM_AT = 6.5

let tinnitus: { osc: OscillatorNode; gain: GainNode } | null = null

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  return curve
}

/** DO NOT PRESS: everything that leads up to the explosion, scheduled from now. */
export function startOverload() {
  const c = audio()
  const t0 = c.currentTime
  getPlayer() // make sure the music chain exists so it can be distorted
  if (!hum) startHum()

  // The machine strains: its hum pitch climbs.
  for (const n of hum?.nodes ?? []) {
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

  level?.overload(t0)
}

/**
 * The boom: cuts the machine's sounds, then debris clatter and a ringing in your ears.
 * The speaker survives: a playing song carries on, now un-muffled (it's out in the open).
 */
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

  // The speaker, out in the open: no muffle, no distortion, no stutter.
  clear = true
  if (muffle) {
    muffle.shaper.curve = null
    muffle.gate.gain.cancelScheduledValues(t0)
    // Knocked out by the blast for a beat, then back.
    muffle.gate.gain.setValueAtTime(0, t0)
    muffle.gate.gain.linearRampToValueAtTime(1, t0 + 1.5)
  }
  applyMuffle(t0)

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

  level?.explodeExtra?.(t0)

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

/** A brand-new machine (same level or the next one): undo the damage to the audio chain, and ding. */
export function resetAfterExplosion() {
  const c = audio()
  const now = c.currentTime
  if (tinnitus) {
    tinnitus.gain.gain.cancelScheduledValues(now)
    tinnitus.gain.gain.setTargetAtTime(0, now, 0.05)
    tinnitus = null
  }
  clear = false
  if (muffle) {
    muffle.shaper.curve = null
    muffle.gate.gain.cancelScheduledValues(now)
    muffle.gate.gain.setValueAtTime(1, now)
  }
  applyMuffle(now)
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
