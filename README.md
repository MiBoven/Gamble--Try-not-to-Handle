# Gamble - Try not to Handle

A physically simulated 3D dice roller that runs entirely in your browser. No files are ever uploaded to a server.

**Live at:** [gamble.michels.world](https://gamble.michels.world)

## Features

- Real 3D dice, rendered with Three.js and simulated with the Cannon-es physics engine — dice actually tumble, bounce off the tray walls, collide with each other, and settle
- Roll **1 to 5 dice at once**, each starting from a random rotation and a slightly offset position, so they land differently every time (useful later for games like Kniffel/Yahtzee)
- **Pip mode** toggle:
  - **1–6**: standard die, each number appears once
  - **1–3 (doubled)**: each number 1–3 appears twice (physical roll shown in parentheses next to the counted value) — effectively a D3
- Automatic face-up detection: after the dice come to rest, the app compares each die's actual 3D orientation against the die model's known geometry to read off the correct number — no manual reading needed
- Sum of all rolled dice shown alongside the individual results
- Placeholder sections for **Players** and **Statistics** (UI only for now — functionality comes in a later version)
- Dark mode by default, with a light mode toggle
- Mobile-first layout
- 100% client-side: no backend, no analytics, nothing ever leaves the device

## How face detection works

The uploaded `D6.glb` model was analyzed directly (its pip geometry, not a texture) to determine which local axis of the 3D model corresponds to which number:

| Local axis | Pips |
|---|---|
| +X | 3 |
| −X | 4 |
| +Y | 2 |
| −Y | 5 |
| +Z | 6 |
| −Z | 1 |

All opposite faces correctly sum to 7, matching a real die. After each die's physics body comes to rest, the app rotates these six axis vectors by the body's current orientation (quaternion) and picks whichever one points closest to world "up" — that axis's mapped number is the result.

## Setup required before deploying (important)

To keep this app dependency-free at *runtime* (no CDN calls, fully offline-capable), Three.js and Cannon-es are imported as local ES modules rather than from a CDN. **These library files are not included** — download them once and place them in the exact folder structure below, since Three.js's own `GLTFLoader.js` imports the core library via a relative path that depends on this structure:

```
vendor/
  three/
    build/
      three.module.js        <- https://unpkg.com/three@0.160.0/build/three.module.js
    examples/
      jsm/
        loaders/
          GLTFLoader.js       <- https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js
  cannon-es.js                <- https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js
```

All 3D model files (dice, and any future shapes) live in their own subfolder from now on:

```
models/
  D6.glb
```

Once these are in place, the app works with zero build step — it's plain static files.

## Files

- `index.html` — markup and UI
- `style.css` — all styling
- `app.js` — Three.js scene, Cannon-es physics, dice pool, face detection
- `models/D6.glb` — 3D die model (you provide this; see above)
- `vendor/` — Three.js and Cannon-es (you provide these; see above)

## Deployment (Netlify)

1. Push this repository to GitHub, including the `vendor/` folder and `models/D6.glb`.
2. In Netlify: **Add new site → Import an existing project**, and pick the repo.
3. Build settings: none needed — this is a static site.
   - Build command: *(leave empty)*
   - Publish directory: `/`
4. Deploy.
5. To use the `gamble.michels.world` subdomain:
   - In Netlify: **Site settings → Domain management → Add a domain** → enter `gamble.michels.world`.
   - In your DNS provider for `michels.world`, add a `CNAME` record:
     - Host: `gamble`
     - Value: `<your-site-name>.netlify.app`
   - Netlify provisions an HTTPS certificate automatically once DNS is verified.

## Favicon

`index.html` already references these files at the repo root (add them yourself — they aren't included):

- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180×180, used for "Add to Home Screen" on iOS)

## Roadmap

- More die types: D4, D10 (1–10 / 0–9 / 1–5 doubled), D12, D20, D50, D100
- Coin flip (heads/tails, 0/1 binary)
- Named players, each able to submit their own roll
- Statistics view (roll history, distributions)

## Browser support

Requires WebGL. Works in all modern browsers (Chrome, Safari, Firefox, Edge). Physics performance on very old mobile devices may be reduced with 5 dice at once; reduce dice count if the frame rate feels low.

## Changelog

### 0.1.1
- Renamed the app to "Gamble - Try not to Handle"
- Button/accent colors now match the shared design system used across the app suite (blue accent instead of the earlier gold/green)
- 3D model files now live in a `models/` subfolder instead of the repo root (`models/D6.glb`)

### 0.1.0
- Initial release: D6 physics roller with Three.js + Cannon-es
- 1–5 dice, random start rotation/position, tray walls, die-die collisions
- Pip mode toggle (1–6 standard / 1–3 doubled)
- Automatic face-up detection from real die geometry (measured, not guessed)
- Placeholder UI for Players and Statistics
