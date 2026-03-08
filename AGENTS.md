# AGENTS.md

## Project
- `crimson-tactics` is a TypeScript + Vite + Phaser 3 tactics prototype.
- The main gameplay scene is [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).
- Runtime art belongs in [`src/assets/game`](src/assets/game), not in `output/`.

## Commands
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Production check: `npm run build`
- Preview build: `npm run preview`

## Repo Map
- [`src/game/scenes`](src/game/scenes): Phaser scenes (`BootScene`, `TitleScene`, `BattleScene`)
- [`src/game/core`](src/game/core): combat, items, pathfinding, board data types
- [`src/game/levels`](src/game/levels): level registry, Tiled parser, unit blueprints
- [`src/game/levels/data`](src/game/levels/data): Tiled JSON level files
- [`src/game/audio`](src/game/audio): procedural music and SFX
- [`src/game/assets.ts`](src/game/assets.ts): runtime asset manifest
- [`src/assets/game`](src/assets/game): committed game art used at runtime
- `tmp/` and `output/`: disposable/generated scratch data, ignored by git

## Level Authoring
- Levels are stored as Tiled JSON and parsed by [`src/game/levels/tiled.ts`](src/game/levels/tiled.ts).
- Required map properties: `levelId`, `displayName`, `objective`.
- Required layers: `terrain`, `heights`, `placements`.
- Optional layers: `chests`, `props`.
- After adding a level file, register it in [`src/game/levels/index.ts`](src/game/levels/index.ts).

## Asset Rules
- Final game assets must be moved into [`src/assets/game`](src/assets/game).
- Generated source material, experiments, and discarded variants should stay out of `src/assets/game`.
- When adding a runtime asset, update [`src/game/assets.ts`](src/game/assets.ts).
- `output/` is for temporary generation artifacts only.

## Working Rules
- Run `npm run build` after gameplay, rendering, level-format, or asset-manifest changes.
- Keep world-depth, lighting, and tile rendering behavior centralized in [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).
- Keep data changes explicit. If you add a new prop, terrain type, item, or ability, update the relevant type definitions as part of the same change.
- Prefer extending existing systems over adding parallel one-off logic.

## Related Reference
- See [`SKILLS.md`](SKILLS.md) for common repo workflows.
