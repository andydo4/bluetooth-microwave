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

/** Press START: beep, then the microwave hums until powerOff(). */
export function powerOn() {
  const c = audio()
  beep(c.currentTime)
  if (!hum) startHum()
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
  const c = audio()
  const el = new Audio(url)
  const src = c.createMediaElementSource(el)

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

  let started = false
  const playing = new Promise<void>((resolve, reject) => {
    el.addEventListener('playing', () => {
      started = true
      resolve()
    }, { once: true })
    el.addEventListener('error', () => {
      if (started) onEnded()
      else reject(new Error('Could not play that audio.'))
    })
    el.play().catch(reject)
  })
  el.addEventListener('ended', onEnded)

  return {
    playing,
    stop: () => {
      el.pause()
      el.removeAttribute('src')
      el.load() // drops the stream connection
    },
  }
}
