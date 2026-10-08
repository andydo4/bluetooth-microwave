import express from 'express'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { copyFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PROD = process.argv.includes('--prod')
const PORT = Number(process.env.PORT ?? 3000)
const YTDLP = process.env.YTDLP_PATH ?? 'yt-dlp'
const MAX_DURATION_SEC = 10 * 60
const MAX_BYTES = 25 * 1024 * 1024
const MAX_JOBS = 3
const MAX_ATTEMPTS = 3

// yt-dlp writes cookies back when it exits, and hosts mount secret files read-only,
// so work from a writable copy.
let cookies: string | undefined
if (process.env.YTDLP_COOKIES) {
  cookies = path.join(os.tmpdir(), 'yt-cookies.txt')
  copyFileSync(process.env.YTDLP_COOKIES, cookies)
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
])

function isYouTubeUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (url.protocol === 'https:' || url.protocol === 'http:') && YOUTUBE_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

type Job = {
  chunks: Buffer[]
  /** Exact final size in bytes when yt-dlp knows it. Safari needs this to play at all. */
  size: number
  done: boolean
  listeners: Set<() => void>
}

// The panel's preset buttons. After a preset's first full download its audio stays in memory,
// so later clicks start instantly (until the server restarts or sleeps).
const PRESETS: Record<string, string> = {
  popcorn: 'https://www.youtube.com/watch?v=hz1X9VLMjWc',
  defrost: 'https://www.youtube.com/watch?v=YJVmu6yttiw',
  reheat: 'https://www.youtube.com/watch?v=J2X5mJ3HDYE',
  beverage: 'https://www.youtube.com/watch?v=6ONRf7h3Mdk',
}
const presetCache = new Map<string, { id: string; duration: number }>()

// Audio being (or recently) downloaded, by id. Lets playback start while yt-dlp is still downloading.
const jobs = new Map<string, Job>()
let activeJobs = 0
const app = express()

// Step 1: start yt-dlp. Responds once audio starts flowing (with the song length),
// or with an error if YouTube refuses, so failures still show a clear message.
app.post('/api/audio', express.json(), (req, res) => {
  const preset = String(req.body?.preset ?? '')
  if (preset && !Object.hasOwn(PRESETS, preset)) {
    res.status(400).json({ error: 'Unknown preset.' })
    return
  }
  const cached = presetCache.get(preset)
  if (cached) {
    res.json(cached)
    return
  }
  const url = preset ? PRESETS[preset] : String(req.body?.url ?? '')
  if (!isYouTubeUrl(url)) {
    res.status(400).json({ error: 'That is not a YouTube link.' })
    return
  }
  if (activeJobs >= MAX_JOBS) {
    res.status(429).json({ error: 'Microwave is busy. Try again in a moment.' })
    return
  }

  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist',
    '--match-filter', `duration <= ${MAX_DURATION_SEC}`,
    '--js-runtimes', 'node',
    // With -o -, yt-dlp prints to stderr, so these don't mix into the audio.
    '--print', 'before_dl:DURATION=%(duration)s',
    '--print', 'before_dl:SIZE=%(filesize)s',
    '-q',
    '-o', '-',
  ]
  if (cookies) args.push('--cookies', cookies)
  if (process.env.YTDLP_PROXY) args.push('--proxy', process.env.YTDLP_PROXY)
  args.push('--', url)

  activeJobs++
  const id = randomUUID()
  const job: Job = { chunks: [], size: 0, done: false, listeners: new Set() }
  let duration = 0
  let responded = false
  let cancelled = false
  let current: ChildProcess | null = null

  const notify = () => job.listeners.forEach((fn) => fn())
  const fail = (status: number, error: string) => {
    if (responded) return
    responded = true
    res.status(status).json({ error })
  }

  // YouTube randomly 403s some attempts and accepts the next, so retry until audio starts flowing.
  // Once it has, a failure just ends the stream early.
  const attempt = (n: number) => {
    const proc = spawn(YTDLP, args)
    current = proc
    let bytes = 0
    let stderr = ''
    let spawnFailed = false

    proc.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > MAX_BYTES) {
        proc.kill() // the stream just ends early
        return
      }
      job.chunks.push(chunk)
      notify()
      if (!responded) {
        responded = true
        job.size = Number(stderr.match(/SIZE=(\d+)/)?.[1] ?? 0)
        jobs.set(id, job)
        duration = Number(stderr.match(/DURATION=([\d.]+)/)?.[1] ?? 0)
        res.json({ id, duration })
      }
    })
    proc.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    proc.on('error', (err) => {
      spawnFailed = true
      console.error('yt-dlp failed to start:', err.message)
      fail(500, 'Audio converter is not installed on the server.')
    })
    proc.on('close', (code) => {
      if (code !== 0) console.error(`yt-dlp attempt ${n} exited ${code}: ${stderr.trim()}`)
      if (code !== 0 && bytes === 0 && !spawnFailed && !cancelled && n < MAX_ATTEMPTS) {
        attempt(n + 1)
        return
      }
      activeJobs--
      job.done = true
      notify()
      const complete = code === 0 && bytes > 0 && (!job.size || bytes === job.size)
      if (preset && complete) presetCache.set(preset, { id, duration })
      else setTimeout(() => jobs.delete(id), 5 * 60 * 1000)
      // Exit 0 with no audio means --match-filter rejected it.
      if (code === 0) fail(422, `Videos longer than ${MAX_DURATION_SEC / 60} minutes won't fit.`)
      else fail(502, 'Could not get audio for that video.')
    })
  }
  attempt(1)

  // Client gave up before audio started (hit STOP, closed tab): stop downloading.
  res.on('close', () => {
    if (responded) return
    cancelled = true
    current?.kill()
  })
})

// Step 2: the <audio> element streams from here, getting bytes as soon as they've downloaded.
// Safari (all iPhone browsers) only plays audio from servers that answer byte-range requests
// with the total size, so when yt-dlp told us the size we serve ranges; otherwise one open stream.
app.get('/api/audio/:id', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) {
    res.sendStatus(404)
    return
  }
  const isMp4 = job.chunks[0]?.subarray(4, 8).toString() === 'ftyp'
  res.set('Content-Type', isMp4 ? 'audio/mp4' : 'audio/webm')

  let start = 0
  let end = Infinity // inclusive
  const total = job.size
  if (total) {
    res.set('Accept-Ranges', 'bytes')
    end = total - 1
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
    if (range) {
      const [, from, to] = range
      if (from) {
        start = Number(from)
        if (to) end = Math.min(Number(to), total - 1)
      } else if (to) {
        start = Math.max(0, total - Number(to)) // "bytes=-N": the last N bytes
      }
      if (start > end) {
        res.status(416).set('Content-Range', `bytes */${total}`).end()
        return
      }
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${total}`)
    }
    res.set('Content-Length', String(end - start + 1))
  }

  let pos = start // next byte to send
  const pump = () => {
    let offset = 0
    for (const chunk of job.chunks) {
      const chunkEnd = offset + chunk.length
      if (chunkEnd > pos && offset <= end) {
        const to = Math.min(chunk.length, end - offset + 1)
        res.write(chunk.subarray(pos - offset, to))
        pos = offset + to
      }
      offset = chunkEnd
      if (pos > end) break
    }
    // Done, or the download ended early (the browser sees a short file and stops).
    if (pos > end || job.done) {
      job.listeners.delete(pump)
      res.end()
    }
  }
  job.listeners.add(pump)
  res.on('close', () => job.listeners.delete(pump))
  pump()
})

if (PROD) {
  const dist = path.resolve('dist')
  app.use(express.static(dist))
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.listen(PORT, () => console.log(`Bluetooth Microwave on http://localhost:${PORT}`))
