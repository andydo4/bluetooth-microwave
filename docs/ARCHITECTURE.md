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
src/App.tsx                  App state (playback status, power level, wreck stage, level/progression,
                             level-change transition), desktop vs phone layout, start/stop/overload/
                             buy-new/goToLevel logic. Progress saved in localStorage (bm.level,
                             bm.unlocked, bm.damages)
src/audio/engine.ts          The shared sound engine: muffle filter chain, player, beeps, power-off,
                             overload timeline, explosion, iOS audio unlock. Each level plugs in a
                             LevelSound profile (setLevelSound). Web Audio only, no sound files
src/components/Scene.tsx     R3F <Canvas>: lights, environment, the current level's Model, shadows,
                             CameraRig (fits level.frame; runs the level-change zoom), orbit controls
src/ui/Progress.tsx          LevelBadge (top-left), LevelPicker, Receipt (damage bill + Upgrade/Buy new)
src/levels/types.ts          LevelDef, ModelProps, ControlsProps, Wreck, Status, Source, PresetKey
src/levels/index.ts          LEVELS (in order) + nextLevel()
src/levels/shared/effects.tsx  Particles, Flash, Debris (gravity/bounce physics; the survivor speaker
                             lands upright and glows when levelling up), rand, softTexture
src/levels/shared/led.tsx    LED display text logic, useTick, MiniDisplay (phone pill), DoNotPress
src/levels/<level>/          One folder per level, same shape:
  index.ts                   the LevelDef (name, bill, frame for the camera, etc.)
  Model.tsx                  the intact machine + speaker; overload visuals; Explosion when exploded
  effects.tsx                that level's overload visuals and explosion debris
  Controls.tsx               themed HTML controls (on the model's face on desktop, in the sheet on phones)
  sound.ts                   LevelSound: muffle cutoff, hum, end signal, overload, explosion extras
  labels.ts                  LED words for the two overload stages
  dims.ts                    dimensions/materials shared by Model and effects
  (speaker file)             microwave/Speaker.tsx, washer/Boombox.tsx, elevator/Tower.tsx,
                             car/SubBox.tsx, datacenter/SpeakerWall.tsx
Dockerfile, .dockerignore    Production image
```

### Adding a level

Copy the washer folder's shape, then add the new `LevelDef` to `LEVELS` in `src/levels/index.ts`. Rules:
- Keep the same 4 preset keys (`popcorn/defrost/reheat/beverage`), just themed labels.
- `frame.halfWidth/halfHeight` = how much of the scene the camera must fit; `groundY` = floor height.
- Its speaker is the `survivor: true` piece in the explosion's `Debris` (it lands upright).
- Controls get `@container` queries; the phone sheet is ~440 px wide, the desktop face is whatever
  width the Model's `<Html>` div gives it (200 px = 1 world unit at `distanceFactor={2}`).
- Use only the engine's overload timeline (`OVERLOAD_CRITICAL_AT` 3 s, `OVERLOAD_BOOM_AT` 6.5 s);
  register overload sounds with `track()` / `noiseHit()` so `explode()` can stop them.

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
- **Presets:** the `PRESETS` map (popcorn / defrost / reheat / beverage → Andy's four YouTube songs). After a preset's first *complete* download, its job stays in memory (`presetCache`), so later presses reply instantly. This is lost when the server restarts or Render's free tier sleeps. **Every level's `Controls.tsx` uses these same keys.**
- **Limits:** 10-minute videos, 25 MB of audio, 3 concurrent yt-dlp jobs, YouTube hosts only. Non-preset jobs are deleted 5 minutes after finishing.
- **Env:** `PORT` (3000), `YTDLP_PATH` (`yt-dlp`), `YTDLP_COOKIES` (path to cookies.txt; copied to a writable temp file because yt-dlp writes cookies back and Render's secret files are read-only), `YTDLP_PROXY`.

## Sound (`src/audio/engine.ts`)

Everything is Web Audio. There are no audio files.

- **Muffle chain (the core joke):** `<audio>` → `MediaElementSource` → lowpass → lowpass → peaking "box" resonance (320 Hz) → waveshaper (pass-through unless overloading) → gate → dry + short convolution "metal box" reverb → master.
- **Power level 1–10** (keypad digits, 0 = 10) sets how muffled it is: cutoff = `700 × 12^((10 − level) / 9)` Hz, so level 10 = 700 Hz (sealed in) and level 1 ≈ 8.4 kHz (barely muffled). lp2 = cutoff × 1.3, box gain = 5 × level/10. It changes live while playing.
- **Per-level muffle options** (`LevelSound.muffle`): `cutoff`, optional `wobbleHz/wobbleDepth` (washer slosh), `room` (reverb size: elevator shaft, data-center hall; default is the microwave's tiny metal box) and `bass` (low-shelf dB boost, car).
- **Hum (microwave):** 120 Hz sawtooth (lowpassed) + 60 Hz sine + bandpassed noise (fan). It is not muffled; it's the microwave itself.
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
- **Control panel on desktop:** the level's HTML `Controls` are placed on the machine's face (washer: a 560 px div on the console) with drei `<Html transform occlude="blending" distanceFactor={2}>` (200 px = 1 world unit), inside a 220 px `@container` div.
- **Washer (level 2):** 4.2 × 4.6 × 4.0 body, front plate is an extruded shape with a round hole; the open-ended `BackSide` drum spins behind the glass door; the boombox is carried up by the drum and drops back with a flip (a small state machine in `washer/Model.tsx`), and is pinned to the wall during the overload spin. Water is a circle-segment extrusion scaled in while running.
- **Camera:** `CameraRig` (in `Scene.tsx`) fits the level's `frame` (microwave: half-width 4.4). Desktop uses `max(9.6, fit)`; phones (no panel on the face) frame it tightly. OrbitControls (`makeDefault`) zoom limits are set imperatively to 0.55×–1.4× the fitted distance, because a portrait phone needs the camera ~25 units away. Azimuth is limited to about ±51° so you can't see behind it.
- **Shadows:** drei `ContactShadows` renders once (`frames={1}`) normally, and every frame (remounted via `key`) while things move (explosion, drop-in).

## Layout

- **Desktop:** full-screen canvas; the control panel sits on the microwave's face.
- **Phone (`max-width: 700px`):** full-screen canvas with the microwave centred. A bottom pill shows `MiniDisplay` (the LED readout) + "CONTROLS ▲" and opens the panel as a bottom sheet (max 85svh, scrollable, dimmed backdrop; tap outside or the handle to close). Presets, START and DO NOT PRESS close the sheet so you watch the action; power keys and typing don't.
- **The microwave's Controls** sizes adapt with container queries (`@min-[300px]:`): compact at 220 px on the 3D face, with bigger keys, a 4-across preset row and a 16 px input on phones (16 px stops iOS zooming in when the input is tapped).
- LED font: **DSEG14 Classic Italic** (npm `dseg`, SIL Open Font License), loaded in `index.css`.

## Overload ("DO NOT PRESS") and progression

`Wreck` state in `App.tsx`: `none` → `overloading` (display shows `wreckLabels.overloading`, e.g. `HOT`/`UE`) → `critical` at 3 s (`FIRE`/`SUDS`) → `exploded` at 6.5 s → after 2.5 s the damage-bill receipt. The timings are `OVERLOAD_CRITICAL_AT` / `OVERLOAD_BOOM_AT` in `engine.ts`; App's timers use the same constants. All controls sit in `<fieldset disabled={wreck !== 'none'}>`.

- **The speaker survives:** at the explosion a playing song keeps going, un-muffled (`explode()` sets the chain "clear": cutoff 16 kHz, no box resonance, no distortion). The speaker piece lands upright in the debris.
- **Explosion** unlocks the next level and adds the level's `bill` to the running total.
- **Buy new:** quiet stop, `resetAfterExplosion()` (restores the muffle chain, ding), wreck → `none`; the Model drops a new one in.
- **Upgrade / picker (`goToLevel`)**: transition `out` (camera pulls back 6× in 1.2 s while the surviving speaker glows; the screen fades dark), then the level swaps, then `in` (camera eases back in 1.0 s), then `idle`. Camera controls are disabled during the transition.

Microwave visuals (`levels/microwave/effects.tsx`): `Sparks` (imperatively repositioned cylinder bolts), `Fire` (sprite flames + seam smoke), `Explosion`. Washer visuals (`levels/washer/effects.tsx`): `Foam` from the door seal, then the drawer + a floor puddle; `Explosion` = foam burst + panels flying + a foam blanket.

## Gotchas (each of these cost real debugging time)

1. **drei `<Html>` needs a stable `portal` ref** (`overlay` in `Scene.tsx`). Without it, `<Html>` re-mounts when R3F connects its event system, React 19 defers the old root's unmount, and the panel's content is wiped: an empty panel with no error.
2. **Never let 3D surfaces overlap exactly (z-fighting).** The shell used to be 5 overlapping wall boxes, which gave striped, flickering edges and inside walls. Use one box with a hidden face, or keep surfaces at least about 0.01 apart. The camera's `near: 0.5, far: 50` also helps depth precision.
3. **`occlude="blending"` requires a transparent canvas.** Don't add `<color attach="background">`; the dark background comes from the page CSS (`index.css`). Blending is what lets the door handle cover the HTML panel.
4. **Transparent objects flicker when the camera moves** if three.js re-sorts them. The door screen uses `renderOrder={1}` + `depthWrite={false}`, and the glass turntable uses `depthWrite={false}`.
5. **iPhone audio:** the shared, pre-unlocked `<audio>` element (see Sound) **and** byte-range support on the server (see Server). Remove either and iPhones fail ("not allowed by the user agent" / "operation is not supported").
6. **Preset keys** live in `server/index.ts` `PRESETS` and in every level's `Controls.tsx` (typed by `PresetKey`).
11. **Overlays under the canvas:** `occlude="blending"` gives the canvas a huge z-index. The Scene wrapper has Tailwind's `isolate` so the badge, receipt and picker stay on top. Don't remove it.
12. **Timing tests in Playwright:** with software rendering (~1–2 fps) `click()` can return seconds late. Time stages from an in-page timestamp, not from when `click()` returns.
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
