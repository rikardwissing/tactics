# Turn Order UI Improvement Plan (Compact-First)

## Goals
- Fit the turn order panel cleanly on constrained screens (mobile portrait, compact laptop, split attention with command UI).
- Preserve fast tactical readability of **NOW**, **NEXT**, and near-future turns without clutter.
- Keep the moody parchment/brass fantasy tone while reducing UI weight.
- Avoid adding data that is already available elsewhere (unit names and health are intentionally excluded from the queue list).

## Design Constraints
- The queue must prioritize silhouette-level recognition and turn timing over full stat presentation.
- Turn order entries should remain tappable/clickable for camera focus.
- Do not rely on color alone for faction identification.
- Names and HP bars/text are **not required** in turn order and should stay out unless explicitly re-requested.
- Portraits should fill a square visual slot to maximize readability at small sizes.
- Animations must improve comprehension, not add visual noise.

## Current Baseline
- Compact rows already show portrait crop, team mark, turn-state badge (`NOW`/`NEXT`/`LATER`), and relative offset (`0`, `+1`, `+2`...).
- Rows are interactable and can be used to focus units.
- Queue size already scales by layout (`minimalMobile`, `portrait`, `compact`, default).

## Problems Remaining
1. **Vertical pressure on small screens**: even compact rows can compete with command/info panels.
2. **Portrait footprint inconsistency**: cropped heads can feel too narrow and not fully occupy each square slot.
3. **Background/border hierarchy needs stronger planning**: each turn state should read differently even in grayscale.
4. **No robust capacity strategy**: players need to see the current unit plus more than three future turns when space allows.
5. **Order updates feel abrupt**: queue reshuffles can be hard to track without transitional motion.

## Proposed Rework

### Phase 1 — Square Portrait Slots & Space Budget (required)
- Use fixed square portrait slots per mode (e.g., `32`, `36`, `40`), with image crop rules that fill the square visually.
- Ensure face/upper-body framing is centered and scaled to avoid empty padding in the square.
- Define strict gap/row tokens by layout mode:
  - `minimalMobile`: smallest square + minimal gap,
  - `portrait`: compact square with slightly clearer spacing,
  - `compact/default`: roomier square while retaining tight stack.
- Keep row hitboxes larger than the visible slot where needed for reliable taps.

### Phase 2 — Turn Background & Border Language (required)
- Standardize per-turn container treatment:
  - `NOW`: highest-contrast background + thick brass/ivory border + subtle glow/pulse.
  - `NEXT`: medium-contrast background + medium border weight.
  - `LATER`: subdued background + thin border.
- Keep team identification as shape + tint (`▲`/`◆`) so readability survives color limitations.
- Keep badge/offset in a compact top band and avoid expanding row width.

### Phase 3 — Queue Capacity Rules (required)
- Always include the current acting unit in the visible stack.
- Show more than three projected entries when layout permits:
  - `minimalMobile`: `NOW + 3` target,
  - `portrait`: `NOW + 4` target,
  - `compact/default`: `NOW + 5` or more target.
- If additional entries exist beyond visible slots, show a compact overflow marker (`+X`).
- Do not hide `NOW` in favor of future units; current actor remains anchor row.

### Phase 4 — Turn Order Change Animation (required)
- Animate row movement when queue order changes (short vertical slide to new slot) so players can track who moved where.
- Animate state transitions:
  - incoming `NOW`: quick border brighten + settle,
  - previous `NOW` to `LATER`: brief fade-down of emphasis,
  - new entries: soft fade/slide-in.
- Keep timing short and tactical (`120–220ms`) to avoid input lag perception.
- If many rows change simultaneously, stagger by small offsets (`10–20ms`) to preserve readability.
- Respect reduced-motion preferences with near-instant transitions.

### Phase 5 — Interaction & Readability Polish
- Strengthen hover/press feedback with alpha/border/badge shifts only (no layout shifts).
- Maintain click-to-focus behavior and ensure it works equally on `NOW`, `NEXT`, and `LATER` entries.
- Validate grayscale differentiation using border style + glyph shape, not color alone.

## Technical Notes
- Keep source-of-truth turn sequencing in existing projection flow (`projectTurnOrder` + `BattleScene`).
- Keep rendering/state logic centralized in `TurnOrderPanel`.
- Avoid reintroducing per-row name/HP objects to prevent object-count growth and layout regression.
- Use constants for portrait slot size, row padding, border thickness, per-mode visible counts, and animation durations.
- Prefer tweening existing row objects to new positions instead of destroying/recreating objects on each update.

## Validation Checklist
- Portraits visually fill square slots in all layout modes without excessive empty padding.
- `NOW`, `NEXT`, and `LATER` are distinguishable by both border/background style and text token.
- Queue shows current unit plus at least three upcoming turns on the most constrained layout.
- Portrait mode and larger layouts show additional upcoming turns beyond three when available.
- Queue reorders are understandable at a glance due to movement/state transition animation.
- Animations do not block interaction and do not make command response feel delayed.
- Queue never overlaps critical command buttons in minimal and portrait layouts.
- Click/tap target remains reliable at reduced visual size.

## Risks & Mitigations
- **Risk:** Square-fill crop hides important silhouette detail.
  - **Mitigation:** tune crop anchor per sprite family and verify at runtime scale.
- **Risk:** Showing more entries increases clutter.
  - **Mitigation:** keep lower-priority rows visually subdued and use overflow marker when needed.
- **Risk:** Animation causes jitter or visual noise.
  - **Mitigation:** short, consistent durations and no oversized easing/bounce.
- **Risk:** Inconsistent behavior across layout modes.
  - **Mitigation:** centralize mode tokens and test each mode explicitly.

## Success Criteria
- Turn order remains legible and actionable on constrained screens without names or health bars.
- Portraits read clearly because each entry uses a filled square slot.
- Current unit is always present, and players can read more than three future turns when space allows.
- Turn-order changes are easy to follow because row/state transitions are clearly animated.
- Panel footprint stays compact while matching the game’s dark fantasy UI tone.
