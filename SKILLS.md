# SKILLS.md

## Purpose
This file lists the common project workflows for contributors and agents working in this repo.

## 1. Add A Level
- Create a new Tiled JSON file in [`src/game/levels/data`](src/game/levels/data).
- Include the required Tiled map properties: `levelId`, `displayName`, `objective`.
- Include the required layers: `terrain`, `heights`, `placements`.
- Add `chests` and `props` object layers if needed.
- Register the level in [`src/game/levels/index.ts`](src/game/levels/index.ts).

## 2. Add Or Change A Unit
- Update unit data in [`src/game/levels/unitBlueprints.ts`](src/game/levels/unitBlueprints.ts).
- If the unit needs a new ability shape or combat rule, update the relevant core types in [`src/game/core/types.ts`](src/game/core/types.ts) and combat flow in [`src/game/core/combat.ts`](src/game/core/combat.ts) or [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).
- If the unit needs new art, add the final PNG to [`src/assets/game/units`](src/assets/game/units) and register it in [`src/game/assets.ts`](src/game/assets.ts).

## 3. Add A Runtime Asset
- Put final committed art in one of:
- [`src/assets/game/backdrops`](src/assets/game/backdrops)
- [`src/assets/game/units`](src/assets/game/units)
- [`src/assets/game/effects`](src/assets/game/effects)
- [`src/assets/game/props`](src/assets/game/props)
- [`src/assets/game/terrain`](src/assets/game/terrain)
- Register the asset in [`src/game/assets.ts`](src/game/assets.ts).
- Do not load runtime art from `output/`.

## 4. Generate New Art
- Use generated art as source material, not as the final runtime location.
- Keep prompts, masks, and scratch files under `tmp/`.
- Keep generated outputs under `output/` until the selected final asset is approved.
- Move only the approved final files into [`src/assets/game`](src/assets/game).

## 5. Adjust Map Rendering
- Tile projection, depth sorting, highlights, props, cliffs, and lighting all live in [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).
- Be careful with depth ordering. Terrain-plane effects should usually sort below props and units.
- If you add a new terrain or prop behavior, also update the level types in [`src/game/levels/types.ts`](src/game/levels/types.ts).

## 6. Add Items, Chests, Or Drops
- Items live in [`src/game/core/items.ts`](src/game/core/items.ts).
- Chest and prop placement data comes from level files parsed through [`src/game/levels/tiled.ts`](src/game/levels/tiled.ts).
- Unit-owned inventory behavior is handled in [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).

## 7. Audio Work
- Music and SFX are generated in code in [`src/game/audio/audioDirector.ts`](src/game/audio/audioDirector.ts).
- If you add new event sounds, hook them up in the scene code where the event actually resolves.

## 8. Validation
- Run `npm run build` after any non-trivial change.
- If you move files, also check [`src/game/assets.ts`](src/game/assets.ts) and git status before committing.

## External Tools Used In This Repo
- `imagegen`: useful for creating still art concepts and production PNGs before moving approved assets into [`src/assets/game`](src/assets/game).
- `sora`: useful for experiments and references, but current runtime assets should not depend on video outputs.
