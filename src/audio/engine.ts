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
let muffle: { lp1: BiquadFilterNode; lp2: BiquadFilterNode; box: BiquadFilterNode } | null = null
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

  src.connect(lp1).connect(lp2).connect(box)
  box.connect(dry).connect(master)
  box.connect(reverb).connect(wet).connect(master)
  muffle = { lp1, lp2, box }
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
