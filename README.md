# Bluetooth Microwave

A 3D microwave with a Bluetooth speaker inside. Paste a YouTube link into the control panel, press **START**, and the song plays muffled from inside the microwave while it hums and the turntable spins. When the song ends, the microwave powers down and beeps.

- **Frontend:** Vite + React + TypeScript, React Three Fiber/drei for 3D, Tailwind for the control panel
- **Server:** Express. `POST /api/audio` starts [yt-dlp](https://github.com/yt-dlp/yt-dlp) and replies once audio starts flowing; `GET /api/audio/:id` streams it, so playback starts before the download finishes
- **Sound:** all Web Audio. The song goes through a lowpass + "metal box" reverb chain. Hum, beeps, and power-down are synthesized (`src/audio/engine.ts`)

**Working on the code (human or AI)?** Start with [GEMINI.md](GEMINI.md), then [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (how it works + gotchas) and [docs/LEVELS.md](docs/LEVELS.md) (the planned levels feature).

## Run locally (Windows)

1. Install yt-dlp: `winget install yt-dlp.yt-dlp` (or download `yt-dlp.exe` and put it on your PATH)
2. Install and start:
   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:3000

The server uses Node as yt-dlp's JavaScript runtime (`--js-runtimes node`), so you don't need Deno.

## Deploy (Render, as an example)

Visitors don't install anything. The server does the conversion.

1. Push this folder to a GitHub repo.
2. On Render: **New → Web Service**, pick the repo. Render detects the `Dockerfile`.
3. Deploy. The image downloads the latest yt-dlp and self-updates it on every boot, because YouTube breaks old versions often.

Any Docker host works (Fly.io, Railway, a VPS). The app listens on `$PORT` (default 3000).

### If YouTube blocks the server

YouTube often blocks downloads from cloud IPs ("Sign in to confirm you're not a bot"). The server logs yt-dlp's error. Fixes, in order of effort:

- **Cookies:** sign in to YouTube with a throwaway account in a browser, export `cookies.txt` (e.g. the "Get cookies.txt LOCALLY" extension), add it as a secret file on your host, and set `YTDLP_COOKIES` to its path (on Render: `/etc/secrets/cookies.txt`). Cookies expire, so re-export when it starts failing again.
- **Proxy:** set `YTDLP_PROXY` to a residential proxy URL.

## Config

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `YTDLP_PATH` | `yt-dlp` | Path to the yt-dlp binary |
| `YTDLP_COOKIES` | none | Path to a Netscape cookies.txt |
| `YTDLP_PROXY` | none | Proxy URL for yt-dlp |

Limits (in `server/index.ts`): videos up to 10 minutes, 25 MB of audio, 3 conversions at once.
