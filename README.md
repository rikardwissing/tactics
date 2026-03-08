# Crimson Tactics

A small fantasy tactics prototype built with Phaser 3, TypeScript, and Vite.

The game is an isometric skirmish focused on elevation, turn order, movement, abilities, loot, lighting, and battlefield presentation. The current playable battle takes place on a ruined chapel ridge with controllable camera pan, zoom, rotation, time-of-day changes, and a menu-driven player turn flow.

## Stack

- TypeScript
- Vite
- Phaser 3

## Running Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Controls

- Left click: interact, move, select menu options
- Right drag: pan the map
- Mouse wheel: zoom in and out
- `WASD` / arrow keys: pan the map
- `Q` / `E`: rotate the battlefield
- `T`: cycle day / dusk / night / dawn
- `Space`: confirm / wait / back out of some menu states
- `R`: restart the battle
- `Esc`: return to title
- `M`: mute audio

## Project Layout

- [`src/game/scenes`](/Users/rikardwissing/Projects/tactics/src/game/scenes): Phaser scenes, including the main battle implementation
- [`src/game/core`](/Users/rikardwissing/Projects/tactics/src/game/core): combat, items, pathfinding, and shared gameplay types
- [`src/game/levels`](/Users/rikardwissing/Projects/tactics/src/game/levels): level registry, Tiled parsing, and unit blueprints
- [`src/game/levels/data`](/Users/rikardwissing/Projects/tactics/src/game/levels/data): Tiled JSON maps
- [`src/game/audio`](/Users/rikardwissing/Projects/tactics/src/game/audio): procedural music and sound effects
- [`src/game/assets.ts`](/Users/rikardwissing/Projects/tactics/src/game/assets.ts): runtime asset manifest
- [`src/assets/game`](/Users/rikardwissing/Projects/tactics/src/assets/game): committed runtime art used by the game
- [`prompts/imagegen`](/Users/rikardwissing/Projects/tactics/prompts/imagegen): archived approved image generation specs

## Levels

Levels are authored as Tiled JSON and parsed at runtime.

Current expectations:

- Required map properties: `levelId`, `displayName`, `objective`
- Required layers: `terrain`, `heights`, `placements`
- Optional layers: `chests`, `props`

If you add a new level, register it in [`src/game/levels/index.ts`](/Users/rikardwissing/Projects/tactics/src/game/levels/index.ts).

## Assets

Runtime art belongs in [`src/assets/game`](/Users/rikardwissing/Projects/tactics/src/assets/game), not in `output/`.

Recommended workflow:

- generate or edit candidates under `tmp/` and `output/`
- review and approve candidates before promotion
- move approved runtime art into [`src/assets/game`](/Users/rikardwissing/Projects/tactics/src/assets/game)
- archive the final approved JSONL prompt spec in [`prompts/imagegen`](/Users/rikardwissing/Projects/tactics/prompts/imagegen)

For small in-game props, keep a high-resolution master if useful, but prefer a purpose-sized runtime asset for stable rendering.

## GitHub Pages

The project is configured for GitHub Pages deployment from GitHub Actions.

Relevant files:

- [`vite.config.ts`](/Users/rikardwissing/Projects/tactics/vite.config.ts)
- [`.github/workflows/deploy-pages.yml`](/Users/rikardwissing/Projects/tactics/.github/workflows/deploy-pages.yml)

To enable Pages:

1. Push the repository to GitHub.
2. Open repository settings.
3. Open `Pages`.
4. Set the source to `GitHub Actions`.

The deployed site target is:

- [https://rikardwissing.github.io/tactics/](https://rikardwissing.github.io/tactics/)

## Notes

- The battle scene is large and renderer-heavy for a prototype. Production builds work, but bundle size is still on the heavy side.
- The current art and generation workflow rules are documented in [AGENTS.md](/Users/rikardwissing/Projects/tactics/AGENTS.md) and [SKILLS.md](/Users/rikardwissing/Projects/tactics/SKILLS.md).
