# Turn Order UI Improvement Plan (Compact Layout)

## Goals
- Keep turn order readable in very limited screen space.
- Preserve strong tactical hierarchy: **Now**, **Next**, then **Later**.
- Avoid rail clutter that competes with map visibility and action menus.
- Preserve moody parchment/brass visual language.

## Constraints
- The right rail is narrow and frequently competes with other HUD blocks.
- The timeline must remain readable on compact and portrait-like layouts.
- Names, full stat lines, and health bars are too expensive in this space.

## Design Principles
1. **High-signal only in rail**: portrait, team symbol, turn offset, Now/Next/Later state.
2. **Progressive disclosure**: detailed unit info belongs in existing detail panel or hover card, not the rail row.
3. **Shape + tone over text volume**: use borders, contrast, and icon shapes first.
4. **No duplicate information**: do not repeat large HP/name data already available elsewhere.

## Compact Rail Specification
- Keep each row to:
  - cropped avatar,
  - row capsule + border,
  - team glyph (`▲` ally / `◆` enemy),
  - small state badge (`NOW` / `NEXT` / `LATER`),
  - turn offset (`0`, `+1`, `+2`, ...).
- Remove from rail rows:
  - unit names,
  - HP text,
  - HP bars.

## Interaction
- Keep click-to-focus camera behavior.
- Keep hover alpha feedback.
- Optional future enhancement: subtle map highlight of hovered unit (without expanding row width).

## Implementation Phases
1. **Phase A (done/active)**: compact hierarchy rail (Now/Next/Later + team glyph + offset).
2. **Phase B**: optional status micro-icons (max 1-2 glyphs) only if readability remains high.
3. **Phase C**: optional queue preview overlay for action targeting (ghost badges/arrows), not permanent row expansion.

## Validation Checklist
- Rail width remains compact and does not crowd battlefield view.
- Players can identify the next 3 actors quickly.
- Ally/enemy distinction is clear without relying on tint alone.
- Visual tone remains parchment/brass/dark wine and avoids neon.
- No turn-order mismatch against actual execution.

## Risks & Mitigations
- **Risk**: too little info for advanced planning.
  - **Mitigation**: show rich info in detail panel/selection panel, not rail.
- **Risk**: badge text noise at tiny sizes.
  - **Mitigation**: keep typography short and rely on border emphasis.

## Success Criteria
- Timeline is glanceable in under two seconds on compact layouts.
- No overlap pressure with adjacent HUD blocks.
- Better clarity than portrait-only baseline without adding panel bloat.
