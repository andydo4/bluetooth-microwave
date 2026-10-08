# Bluetooth Microwave: start here

You're working on **Bluetooth Microwave**, a joke website by Andy. A 3D microwave has a Bluetooth speaker inside. You paste a YouTube link (or press a preset), and the song plays *muffled*, as if from inside the microwave, while it hums, glows and spins. A DO NOT PRESS button makes it spark, catch fire and explode.

- **Live site:** https://bluetooth-microwave.onrender.com (Render free tier; auto-deploys when `main` is pushed to GitHub `andyd4/bluetooth-microwave`)
- **Local code:** `C:\dev\bluetoothmicrowave` (Windows)

## Read these before changing anything

1. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: how everything works today, file by file, plus the gotchas that already cost hours. Most "obvious" fixes here were tried and broke something.
2. **[docs/LEVELS.md](docs/LEVELS.md)**: the agreed plan for the next big feature (8 levels from microwave to the Universe), what's decided, what's still open, and ideas Andy already rejected.

## Run it

```
winget install yt-dlp.yt-dlp   # once; the server shells out to yt-dlp
npm install
npm run dev                    # http://localhost:3000 (Express + Vite dev middleware)
npm run build                  # typecheck (tsc --noEmit) + production build; run before every commit
```

## Working with Andy

- Andy is a CS student (TypeScript/React/Tailwind). He likes hands-on iteration and concrete examples (numbers, not abstractions), and he'll push back when something is wrong. Acknowledge it and fix it.
- **YAGNI.** Build what's asked; ask before adding features or making a call that's expensive to undo.
- Ask a short clarifying question when a request is genuinely ambiguous; otherwise just do it and say what you assumed.
- He tests on **desktop Chrome and his iPhone**. Anything audio-related must keep working on iPhone Safari (see the iOS section in ARCHITECTURE.md).
- Style already settled: STOP is grey (he didn't want red); the link label reads "Paste YouTube link"; on phones the microwave stays the centre of attention, with controls in a slide-up sheet.
- Keep the docs current: when you change behaviour or settle a decision, update ARCHITECTURE.md / LEVELS.md in the same commit.

## Code conventions

TypeScript strict, React function components, no semicolons, single quotes, 2-space indent, Tailwind classes inline. Comments explain *why* (constraints, gotchas), not what. Run `npm run build` before committing; it must pass cleanly.
