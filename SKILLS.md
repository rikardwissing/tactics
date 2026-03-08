# SKILLS.md

## Purpose
This file lists the common project workflows for contributors and agents working in this repo.

## Style Guardrails
- Match the existing game: moody fantasy tactics, painterly pixel-art-inspired presentation, ecclesiastical ruin setting, warm firelight against cool stone and moss.
- Favor restrained, dramatic, old-world fantasy over flashy JRPG spell spam or generic mobile-fantasy polish.
- Units must stay readable on the battlefield at small scale, with clean silhouettes and strong color separation.
- Terrain must look like part of the board surface.
- Props and obstacles must feel anchored to the ground and occupy the tile convincingly.
- UI and presentation should feel noble and worn: parchment, brass, crimson, ash, candlelight.

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
- Once an asset is approved and used in the game, keep the final JSONL prompt spec in [`prompts/imagegen`](prompts/imagegen).
- The stored JSONL should be the final approved generation recipe, not every failed iteration.
- Keep it runnable with the imagegen CLI when possible.
- Add an approval gate before promotion:
- generate candidate art under `output/`
- show the candidate to the user
- ask for a direct `Approve` / `Not approve`
- only after approval move the asset into [`src/assets/game`](src/assets/game) and archive the JSONL in [`prompts/imagegen`](prompts/imagegen)
- For multi-state asset families:
- generate the anchor state first
- get that state approved
- use the approved state as the reference for the next states
- review the derived states before promotion
- Prompt for the project style explicitly:
- moody fantasy tactics
- painterly pixel-art-inspired rendering
- grounded isometric readability
- ruined chapel / moss / stone / ember-lit atmosphere
- no photorealism, no glossy 3D, no UI text, no extra subjects
- Include the intended runtime render size in the prompt whenever possible, for example `rendered around 58px wide on a 96x48 tile`.
- If the asset will be rendered small, explicitly ask for big readable shapes, simplified detailing, and crisp silhouette preservation after downscaling.
- Reject or revise outputs that look too generic, too bright, too floaty, or too cinematic for tactical play.
- When generating a variant of an existing asset:
- use the current approved runtime asset as the reference point
- preserve silhouette, signature colors, emblem/trim language, and key shape language
- change only the intended dimension: pose, upgrade trim, charge state, damage state, open/closed state, elemental inflection, or attack-frame emphasis
- avoid redesign drift between variants; they should read as one asset family at a glance
- keep framing, scale, and canvas treatment compatible with the existing asset set so swapping variants in code does not require special handling
- prefer reference-preserving edits or tightly constrained follow-up generations instead of unrelated fresh generations
- for closed/open or similar state pairs, the later states should derive from the approved earlier state
- keep the same target render size and readability constraints across the whole state family

## 4a. Character And Item Variant Checklist
- Character variants should preserve:
- silhouette
- armor/clothing structure
- weapon shape
- primary faction colors
- face/hair identity where visible
- Item variants should preserve:
- base outline
- icon motif
- material language
- family color coding
- Good variant examples:
- same knight in idle / attack / damaged poses
- same potion bottle in normal / rare / blessed forms
- same chest in closed / open states
- Bad variant examples:
- same named unit with a different armor design and different silhouette
- same item family with totally different shape language between tiers

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
- Keep the score slow, grand, and martial. Avoid fast whimsical loops unless there is a deliberate scene-specific reason.

## 8. Validation
- Run `npm run build` after any non-trivial change.
- If you move files, also check [`src/game/assets.ts`](src/game/assets.ts) and git status before committing.

## External Tools Used In This Repo
- `imagegen`: useful for creating still art concepts and production PNGs before moving approved assets into [`src/assets/game`](src/assets/game).
- `sora`: useful for experiments and references, but current runtime assets should not depend on video outputs.
