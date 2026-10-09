# Levels plan (agreed with Andy, October 8 2026)

**Status:** the shared systems below are built, plus levels 1 (Microwave) and 2 (Washing machine). Next: Andy approves the washer's look and feel, then elevator, car and data center (can be built in parallel, each in its own `src/levels/<id>/` folder; see "Adding a level" in ARCHITECTURE.md).

After the microwave explodes, you can **upgrade to a bigger thing** that can also blow up, escalating from the kitchen to the whole universe. Each level has its own object, an upgraded speaker, themed controls, its own sound and its own explosion.

## The 8 levels

| # | Level | Speaker (levels up each time) | Themed controls | Preset labels (same 4 songs) | Signature twist | Explosion | Damage bill |
|---|---|---|---|---|---|---|---|
| 1 | **Microwave** ✅ built | Small portable cylinder speaker | Microwave keypad + LED | POPCORN / DEFROST / REHEAT / BEVERAGE | Turntable spins; power level = muffle amount | Sparks → fire → debris | $89 |
| 2 | **Washing machine** ✅ built | Boombox | Big cycle dial + LED; WATER LEVEL LOW/MED/HIGH = power | DELICATE / HEAVY / RINSE / SPIN | **The speaker tumbles in the drum**; music sounds wet and sloshy (wobbling cutoff) | `UE` rattle → `SUDS` foams over → foam blanket | $649 |
| 3 | **Elevator** | *Proposed:* hi-fi floor-standing speaker tower (confirm with Andy) | Brass floor-button panel + floor counter + door open/close + red alarm bell | *Proposed:* floor buttons (e.g. LOBBY / 2 / 3 / PENTHOUSE) | Your song becomes **elevator music**: muffled, echoing in a metal shaft; the floor counter climbs as it plays | The cable snaps, sparks run down the shaft, the car plummets and crashes, the doors blow off | $48,000 |
| 4 | **Car** | Trunk subwoofer stack | Car-stereo head unit | AM / FM / AUX / BASS BOOST | The bass is so heavy the car bounces and the windows rattle | Action-movie fireball; tires and doors fly | $35,000 |
| 5 | **Data center** | Wall of PA speakers | Server terminal, green-text command line | *Proposed:* RACK A–D (confirm) | Roaring server fans, echoing aisles | Racks short out in a chain reaction and topple like dominoes | $250,000,000 |
| 6 | **Space station** | Concert speaker line array | Spacecraft console: switches, warning lights | *Proposed:* COMMS 1–4 (confirm) | **No sound in space**: the music fades to near-silence | Zero gravity: debris drifts away forever instead of falling | $150,000,000,000 |
| 7 | **Alien planet** | Glowing alien sound orb | Unreadable glyph controls that light up | *Proposed:* 4 alien glyphs (confirm) | Warped, alien reverb | The planet cracks open and glows | 1 planet |
| 8 | **The Universe** (finale) | A black hole | Cosmic dials | *Proposed:* to decide | Everything collapses toward the black hole | **Big Bang**. Its leftover glow is called the *cosmic microwave background*, so the universe resets to… a microwave (back to level 1) | $∞ |

Andy's decisions: each level keeps the **same 4 songs** with themed button labels. Each level gets its **own themed controls** (not one shared panel with new labels).

## Shared systems (build these first, with the microwave as level 1)

1. **Level system:** one definition per level (e.g. a `LevelDef` with id, name, price, intact model, speaker, controls component, preset labels → the 4 server preset keys, audio profile (hum + muffle settings), overload/explosion). The current microwave code becomes level 1.
2. **Progression:**
   - Each explosion **automatically unlocks the next level**.
   - After an explosion, offer **"Upgrade to ___"** (next level) **and** "Buy new ___ ($price)" for the current one, plus a **level picker to replay any unlocked level**.
   - Save unlocked levels in the browser (`localStorage`; wrap in try/catch) so they survive a refresh.
   - After the Universe, loop back to the microwave; everything stays unlocked.
3. **Leveling-up speaker** (Andy likes this): the speaker is the one thing that survives every explosion. After the blast it sits unharmed in the wreckage, and the song **keeps playing, now crisp and un-muffled**. This needs a change: today the song is stopped at the explosion; instead bypass the muffle/distortion and keep playing. On "Upgrade", the surviving speaker glows and transforms into the next level's speaker.
4. **Cheap zoom-out transition** (Andy likes this): on Upgrade, the camera pulls back fast (about 10 → 60 units in ~1.2 s), so the wreckage shrinks to a dot while the next level fades in around it. Build it once in the level system. (A true seamless "each level contains the previous one" zoom was judged impractical.)
5. **Damage bill** (Andy loves this): after each explosion a receipt pops up ("Microwave: $89"), plus a running **"total damages"** across the whole game (saved with progression). "Buy new" buttons show the price. The prices are in the table above.

## Build order

1. Level system + progression + picker + damage bill + leveling-up speaker + zoom-out, with only the microwave as a level (no visible new level yet).
2. Washing machine (first new level). Andy plays it before the next one starts.
3. Elevator → Car → Data center → Space station → Alien planet → The Universe, one at a time, each played and approved before the next.

## Still open (ask Andy)

- Speaker for the elevator level (proposed: hi-fi floor-standing tower).
- Preset labels for elevator, data center, space station, alien planet, universe (proposals above).
- Possible easter egg: a bonus song that only plays on the space level (suggested, not decided).

## Ideas Andy rejected (don't re-propose)

- **Levels:** fridge (too similar to the microwave), ice cream truck (too similar to the car; maybe a bonus level someday), cruise ship, rocket launch pad, stadium, volcano, blender, jukebox, arcade cabinet, tour bus, jet engine, nuclear reactor, submarine, hot tub, bank vault, giant robot, particle collider, radio telescope.
- A single shared control panel that only changes labels per level (he wants fully themed controls).
