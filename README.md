# Kestrel Run

An original low-poly flight game for make.fun's *best flight game* bounty: a first-person
cockpit or chase view over the Meridian Archipelago — flat-shaded islands, mountain peaks, a
coastal airfield with a painted runway 36, and six numbered target rings.

Everything is drawn by hand with a small software 3D projector on a 2D canvas: perspective
projection, near-plane clipping, painter-sorted flat polygons, a sky with a sun, water with a
moving sheen and WebAudio-synthesised sound. No libraries, no network requests, no build step.

## Fly it

Serve the static files and open the page in desktop Chrome:

```
node serve.ts
# http://localhost:8080
```

or use any static server rooted at `game/` (for example `python3 -m http.server -d game 8137`).

## Controls

| key | action |
| --- | --- |
| W / S (or Shift / Ctrl) | throttle up / down |
| Arrow keys | pitch and roll |
| A / D | rudder |
| G | gear down / up |
| Space | release the supply crate |
| C | cockpit / chase view |
| P or Esc | pause |
| R | restart the sortie |
| M | mute sound |

The flight model stalls below about 54 kt, turns with bank, loses height when slow and burns
fuel faster at high throttle. Landings need gear down, runway 36, under 93 kt, a gentle sink
rate and a nose-up attitude; anything else reads as a crash.

## Sortie

1. **RING RUN** — fly the six numbered rings in order against the clock.
2. **SUPPLY DROP** — reach the marked island zone and drop the crate below 800 ft and 120 kt.
3. **AIRFIELD RETURN** — come back and land on runway 36.

Missions rotate automatically; the HUD names the current mission and its next target with a
distance, bearing and screen marker.

## Files

```
game/index.html            canvas shell
game/src/main.js           boot, fixed-step loop, frame assembly
game/src/render3d.js       projection, near clipping, painter fill, sky and sea
game/src/world.js          islands, runway, mountains, rings, drop zone, glints
game/src/flight.js         flight model, stall, fuel, gear, touchdown test
game/src/aircraft.js       the Kestrel airframe and traffic silhouettes
game/src/camera.js         cockpit and chase rigs
game/src/hud.js            instrument panel assembly, target marker, warnings
game/src/instruments.js    compass, tapes, artificial horizon, bars
game/src/missions.js       the three missions and their scoring
game/src/screens.js        title, pause and sortie summary
game/src/input.js          keyboard and optional mouse steering
game/src/audio.js          WebAudio engine, wind, chimes and thuds
game/src/shots.js          deterministic ?shot= poses for screenshots
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes the dossier
with the vendored make.fun library.

## Screenshots

`?shot=rings|cockpit|landing|islands` poses a repeatable frame for screenshots (1280x720).

MIT licensed. Original art, names and sounds.
