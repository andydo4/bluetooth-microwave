# Architecture

How Bluetooth Microwave works today (October 2026), and the traps already found. Read the **Gotchas** section before "fixing" anything that looks odd: most odd-looking code is there on purpose.

## Stack

- **Frontend:** Vite 8 + React 19 + TypeScript (strict), React Three Fiber 9 + drei 10 + three.js for 3D, Tailwind CSS v4 (via `@tailwindcss/vite`).
- **Server:** Express 5, run with `tsx` (no compile step). In dev it mounts Vite as middleware; with `--prod` it serves `dist/`.
- **Audio source:** [yt-dlp](https://github.com/yt-dlp/yt-dlp), spawned by the server per request.
- **Deploy:** Docker (`node:22-slim` + the standalone `yt-dlp_linux` binary) on Render's free tier.

## File map

```
server/index.ts              Express server: /api/audio endpoints (yt-dlp), presets + cache, static hosting
src/main.tsx                 React entry
src/index.css                Tailwind import, DSEG LED font @font-face, page background
src/App.tsx                  App state (playback status, power level, overload "wreck" state),
                             desktop vs phone layout, start/stop/overload/buy-new logic
src/audio/engine.ts          ALL sound: muffle filter chain, hum, beeps, power-off, overload,
                             explosion, iOS audio unlock. Synthesized with Web Audio (no sound files)
src/components/Scene.tsx     R3F <Canvas>: lights, environment, camera fitting, shadows, orbit controls
src/components/Microwave.tsx The microwave model (built from primitives), turntable, door, control-panel
                             mount; swaps to debris when exploded; shake + drop-in animations
src/components/Speaker.tsx   The small cylindrical Bluetooth speaker (generic, no brand logo)
src/components/Mayhem.tsx    Overload visuals: Sparks, Fire (+ seam smoke), Explosion (flash, debris
                             physics, smoke), plus a small sprite particle system
src/components/dims.ts       Shared microwave dimensions/materials (used by Microwave + Mayhem)
src/components/ControlPanel.tsx  The microwave control panel UI (HTML), LED display logic, MiniDisplay
Dockerfile, .dockerignore    Production image
```

## Playback flow

1. The user presses START (link) or a preset. `App.start()` calls `sound.powerOn()` **synchronously inside the tap** (beep, hum, and iOS audio unlock; see below) and sets status `loading` (the display shows `COOK`).
2. `POST /api/audio` with `{url}` or `{preset}`. The server spawns yt-dlp and **replies as soon as the first audio bytes arrive** with `{id, duration}`, or with a JSON error (`400` bad link, `422` too long, `429` busy, `502` YouTube refused, `500` yt-dlp missing).
3. The client sets the shared `<audio>` element's `src` to `GET /api/audio/:id`, which serves the bytes downloaded so far and then streams the rest as they arrive. Playback starts before the download finishes.
4. When the `<audio>` element fires `playing`, status becomes `playing` and the display counts down from `duration`.
5. When the song ends or STOP is pressed, `finish()` stops the audio and calls `sound.powerOff()` (spin-down, relay clunk, 3 beeps). Every path ends through that single guarded `finish()`.

### Server details (`server/index.ts`)

- yt-dlp args: `-f bestaudio[ext=m4a]/bestaudio --no-playlist --match-filter "duration <= 600" --js-runtimes node --print before_dl:DURATION=%(duration)s --print before_dl:SIZE=%(filesize)s -q -o -`.
  - The song comes out as **m4a/AAC, not mp3**. No transcoding is needed and every browser decodes it.
  - With `-o -` (audio to stdout), yt-dlp writes `--print` output to **stderr**, so DURATION/SIZE never corrupt the audio. The server parses them from stderr.
  - `--js-runtimes node`: yt-dlp needs a JavaScript runtime to solve YouTube's player challenges. Node is already in the image, so Deno isn't needed.
- **Retries:** YouTube intermittently returns `HTTP Error 403: Forbidden` on the video data. If an attempt fails *before any audio bytes* arrive, the server re-runs yt-dlp, up to 3 attempts total. Once audio is flowing, a failure just ends the stream early.
- **Byte ranges:** if yt-dlp reported the exact `filesize`, `GET /api/audio/:id` answers `Range` requests (`206` + `Content-Range`, or `416` past the end) and waits for bytes still downloading. **iPhone Safari won't play audio without this.** Without a size it falls back to one open stream.
- **Presets:** the `PRESETS` map (popcorn / defrost / reheat / beverage → Andy's four YouTube songs). After a preset's first *complete* download, its job stays in memory (`presetCache`), so later presses reply instantly. This is lost when the server restarts or Render's free tier sleeps. **The client's preset keys in `ControlPanel.tsx` must match.**
- **Limits:** 10-minute videos, 25 MB of audio, 3 concurrent yt-dlp jobs, YouTube hosts only. Non-preset jobs are deleted 5 minutes after finishing.
- **Env:** `PORT` (3000), `YTDLP_PATH` (`yt-dlp`), `YTDLP_COOKIES` (path to cookies.txt; copied to a writable temp file because yt-dlp writes cookies back and Render's secret files are read-only), `YTDLP_PROXY`.

## Sound (`src/audio/engine.ts`)

Everything is Web Audio. There are no audio files.

- **Muffle chain (the core joke):** `<audio>` → `MediaElementSource` → lowpass → lowpass → peaking "box" resonance (320 Hz) → waveshaper (pass-through unless overloading) → gate → dry + short convolution "metal box" reverb → master.
- **Power level 1–10** (keypad digits, 0 = 10) sets how muffled it is: cutoff = `700 × 12^((10 − level) / 9)` Hz, so level 10 = 700 Hz (sealed in) and level 1 ≈ 8.4 kHz (barely muffled). lp2 = cutoff × 1.3, box gain = 5 × level/10. It changes live while playing.
- **Hum:** 120 Hz sawtooth (lowpassed) + 60 Hz sine + bandpassed noise (fan). It is not muffled; it's the microwave itself.
- **Power off:** hum pitch spins down, relay clunk (filtered noise), 3 beeps.
- **Overload:** `startOverload()` turns on waveshaper distortion and a random stutter gate on the music, ramps the hum pitch up 1.8×, and schedules crackles, a fire roar from 3 s and alarm beeps. `explode()` cuts everything and plays a boom (dark noise + falling sub-bass), debris thuds and a 4.2 kHz tinnitus tone. `resetAfterExplosion()` restores the chain and plays a ding.
- **iOS (important):** Safari only allows `audio.play()` *during the user's tap*, but the song arrives seconds later. So one shared `<audio>` element is created once, wired into the chain once (`createMediaElementSource` can only be called once per element), and unlocked in `powerOn()` by playing a 0.1 s silent WAV blob during the START tap. Songs later reuse that element. **Don't create a new `Audio()` per song.**
- Known unaddressed iOS issue: Web Audio is silent when the iPhone's ring/silent switch is on silent. `navigator.audioSession.type = 'playback'` (Safari 17+) would fix it; not added yet.

## 3D scene

- Everything is modelled from primitives (boxes, cylinders); there are no model files. Units: the microwave is 5 wide × 3 tall × 3.4 deep, centred on the origin, front face at z = 1.7 (see `dims.ts`).
- **Outer shell = ONE box with its front face hidden** (a material array with index 4, +z, invisible). The door and control panel cover the front.
- **Cavity lining** is a `BackSide` box, so you see its inner faces through the door. It lights up warm orange while on.
- **Door screen:** a plane with a canvas-generated dot `alphaMap` (the metal mesh look), `renderOrder={1}` + `depthWrite={false}`.
- **Turntable + speaker** rotate while on.
- **Control panel on desktop:** the HTML `ControlPanel` is placed on the microwave's face with drei `<Html transform occlude="blending" distanceFactor={2}>` (200 px = 1 world unit), inside a 220 px `@container` div.
- **Camera:** `FitCamera` (in `Scene.tsx`) fits a half-width of 4.4 world units horizontally. Desktop uses `max(9.6, fit)`; phones (no panel on the face) frame it tightly. OrbitControls (`makeDefault`) zoom limits are set imperatively to 0.55×–1.4× the fitted distance, because a portrait phone needs the camera ~25 units away. Azimuth is limited to about ±51° so you can't see behind it.
- **Shadows:** drei `ContactShadows` renders once (`frames={1}`) normally, and every frame (remounted via `key`) while things move (explosion, drop-in).

## Layout

- **Desktop:** full-screen canvas; the control panel sits on the microwave's face.
- **Phone (`max-width: 700px`):** full-screen canvas with the microwave centred. A bottom pill shows `MiniDisplay` (the LED readout) + "CONTROLS ▲" and opens the panel as a bottom sheet (max 85svh, scrollable, dimmed backdrop; tap outside or the handle to close). Presets, START and DO NOT PRESS close the sheet so you watch the action; power keys and typing don't.
- **ControlPanel** sizes adapt with container queries (`@min-[300px]:`): compact at 220 px on the 3D face, with bigger keys, a 4-across preset row and a 16 px input on phones (16 px stops iOS zooming in when the input is tapped).
- LED font: **DSEG14 Classic Italic** (npm `dseg`, SIL Open Font License), loaded in `index.css`.

## Overload ("DO NOT PRESS")

`Wreck` state in `App.tsx`: `none` → `arcing` (sparks; display `HOT`) → `fire` at 3 s (`FIRE`) → `exploded` at 6.5 s (blank display; desktop panel removed; the song is stopped quietly) → after 2.5 s a "Buy new microwave" button → `none` (a new microwave drops in and dings). The timings are `OVERLOAD_FIRE_AT` / `OVERLOAD_BOOM_AT` in `engine.ts`, and App's timers use the same constants so sound and visuals stay in sync. All controls sit in `<fieldset disabled={wreck !== 'none'}>`.

Visuals (`Mayhem.tsx`):
- `Sparks`: jagged bolts drawn as thin cylinder meshes, repositioned imperatively in `useFrame` (no React state), plus a flickering blue light.
- `Fire`: additive sprite flames + smoke leaking from the top seams + a flickering orange light.
- `Explosion`: flash, then debris pieces (shell slabs, door, panel, turntable, speaker) with simple gravity/bounce physics, thrown sideways and back so they land in view, plus smoke. `Microwave.tsx` shakes the root group for 0.8 s.

## Gotchas (each of these cost real debugging time)

1. **drei `<Html>` needs a stable `portal` ref** (`overlay` in `Scene.tsx`). Without it, `<Html>` re-mounts when R3F connects its event system, React 19 defers the old root's unmount, and the panel's content is wiped: an empty panel with no error.
2. **Never let 3D surfaces overlap exactly (z-fighting).** The shell used to be 5 overlapping wall boxes, which gave striped, flickering edges and inside walls. Use one box with a hidden face, or keep surfaces at least about 0.01 apart. The camera's `near: 0.5, far: 50` also helps depth precision.
3. **`occlude="blending"` requires a transparent canvas.** Don't add `<color attach="background">`; the dark background comes from the page CSS (`index.css`). Blending is what lets the door handle cover the HTML panel.
4. **Transparent objects flicker when the camera moves** if three.js re-sorts them. The door screen uses `renderOrder={1}` + `depthWrite={false}`, and the glass turntable uses `depthWrite={false}`.
5. **iPhone audio:** the shared, pre-unlocked `<audio>` element (see Sound) **and** byte-range support on the server (see Server). Remove either and iPhones fail ("not allowed by the user agent" / "operation is not supported").
6. **Preset keys** live in two places: `server/index.ts` `PRESETS` and `ControlPanel.tsx` `PRESETS`.
7. **Don't pass fixed `minDistance` / `maxDistance` props to OrbitControls.** `FitCamera` sets them; props would be re-applied on re-render and snap the camera.
8. **YouTube blocks cloud servers** ("Sign in to confirm you're not a bot"). Production uses cookies from a throwaway Google account (Render Secret File `/etc/secrets/cookies.txt` + env `YTDLP_COOKIES=/etc/secrets/cookies.txt`). Cookies expire: re-export them from a *fresh Incognito window* (sign in, open `youtube.com/robots.txt`, export with the "Get cookies.txt LOCALLY" extension, close the window), as the yt-dlp wiki recommends. **Never commit cookies** (`cookies.txt` is in `.gitignore`).
9. `yt-dlp -U` at container boot is often rate-limited by GitHub ("rate limit exceeded"). That's harmless; the build already downloaded the latest.
10. **Render free tier** sleeps after 15 minutes idle (about a 1-minute cold start) and has a weak CPU, so the COOK wait is ~7 s there versus 2–5 s locally. The preset cache resets on sleep.

## Testing

There's no automated test suite. Before committing:

- `npm run build` must pass (typecheck + bundle).
- Run `npm run dev`, then on desktop Chrome: a preset, a pasted link, STOP during COOK and while playing, the power keys (`PL 7`), START with an empty box (`LINK?`), a bad link (`Err`), and DO NOT PRESS through to "Buy new microwave".
- Check the phone layout (Chrome DevTools device mode, then a real iPhone): pill → sheet → preset → the sheet closes and the countdown shows in the pill.

## Deploy

`git push` to `main`, and Render rebuilds from the `Dockerfile` automatically (a few minutes). See the README for host setup and cookies.
