# AGENTS.md

## Project
- `renations-tactics` is a TypeScript + Vite + Phaser 3 tactics prototype.
- The main gameplay scene is [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).
- Runtime art belongs in [`src/assets/game`](src/assets/game), not in `output/`.

## Style Direction
- The game should read as a science-fantasy tactics RPG about the factions rising from humanity's ruins, in the vein of classic late-90s / early-2000s strategy games rather than generic mobile fantasy.
- Visual tone: solemn, martial, ecclesiastical, ember-lit, slightly tragic.
- Rendering target: stylized 2D painterly pixel-art-inspired sprites and terrain, not photorealism, glossy 3D, anime key art, or cartoon slapstick.
- Camera feel: elevated isometric battlefield with readable silhouettes and grounded objects.
- UI tone: parchment, brass, warm ivory, dark wine, and muted stone rather than neon or sci-fi colors.

## Visual Palette
- Base terrain colors should live in moss green, worn stone gray, ash brown, desaturated earth, and muted chapel gold.
- Accent colors should be reserved for faction identity and magic: crimson, ember orange, pale gold, ghostly teal, and ash-violet.
- Night, dusk, and dawn scenes should stay dark and atmospheric so firelight and glow effects matter.

## Art Generation Constraints
- Units should be single-subject, full-body, readable at small tactical scale, with a strong silhouette.
- Props and obstacles must feel heavy and planted on the tile, never floating.
- Terrain art must read as the surface of the tile itself, not a separate hovering decal.
- Avoid oversized transparent padding around sprites; keep bounds tight so placement feels grounded.
- Avoid text, UI, extra characters, complex backgrounds, or cinematic compositions in runtime assets.
- New generated art should match the existing assets in [`src/assets/game`](src/assets/game) more than it matches a prompt in isolation.
- When generating runtime art, specify the intended in-game render size in the prompt whenever it is known, for example `rendered around 58px wide on a 96x48 tile`.
- If an asset will be shown small in-game, prompt for larger readable shapes and reduced micro-detail so it survives downscaling cleanly.

## Variant Generation Rules
- When generating a variant of an existing character, item, prop, or terrain tile, preserve the core identity from the approved base asset.
- Lock the silhouette-defining features first: body shape, armor layout, cloak shape, weapon profile, icon shape, emblem placement, and main color blocking.
- Keep signature colors stable across variants unless the variant is explicitly a transformed or upgraded form.
- Variants should change pose, expression, effect state, damage state, upgrade trim, or small material details more than they change the underlying design.
- For character variants, keep face, hair, armor proportions, and weapon read consistent enough that the unit is instantly recognizable on the board.
- For item variants, keep the base outline and key motif consistent so upgraded or charged versions still read as the same item family.
- Use the approved runtime asset as the visual reference whenever possible. Do not regenerate variants from memory if a base asset already exists.
- Name and organize variants clearly so the base asset remains obvious and the lineage is easy to track.
- Keep the target render size consistent across the variant family so one state does not become over-detailed or over-thin relative to another.

## Audio Tone
- Music should feel grand, slow, and martial rather than frantic or playful.
- Sound effects should support a grounded battlefield mood, with warm firelight, steel, ritual, and stone rather than arcade-style bleeps.

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
- [`prompts/imagegen`](prompts/imagegen): tracked JSONL generation specs for approved runtime art
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
- `tmp/imagegen/` is for working drafts only. If a generated asset is approved for the game, keep its final JSONL spec under [`prompts/imagegen`](prompts/imagegen).
- Keep those stored JSONL files CLI-compatible so the asset can be regenerated later with the same structured instructions.
- Use one JSONL file per approved asset family when practical, for example a closed/open chest pair in one file.
- Do not promote generated art into [`src/assets/game`](src/assets/game) until the user has explicitly approved it.
- After generation, show the candidate and ask for a direct `Approve` / `Not approve` decision before replacing runtime art.
- If the asset is not approved, keep iterating in `tmp/` and `output/` and do not archive its JSONL in [`prompts/imagegen`](prompts/imagegen).
- For multi-state asset families, generate and approve the anchor state first, then use that approved state as the reference for the remaining states.
- For state variants like closed/open, idle/attack, or normal/damaged, prefer reference-preserving edits or tightly referenced follow-up generations over unrelated fresh generations.
- If generated art misses the established style, revise the prompt or regenerate before promoting it into runtime assets.

## Working Rules
- Run `npm run build` after gameplay, rendering, level-format, or asset-manifest changes.
- Keep world-depth, lighting, and tile rendering behavior centralized in [`src/game/scenes/BattleScene.ts`](src/game/scenes/BattleScene.ts).
- Keep data changes explicit. If you add a new prop, terrain type, item, or ability, update the relevant type definitions as part of the same change.
- Prefer extending existing systems over adding parallel one-off logic.

## Related Reference
- See [`SKILLS.md`](SKILLS.md) for common repo workflows.
