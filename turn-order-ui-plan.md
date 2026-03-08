# Turn Order UI Improvement Plan

## Goals
- Improve readability of who acts **now**, **next**, and **soon** at a glance.
- Preserve the game's moody, martial visual tone (parchment, brass, muted accents).
- Make the timeline more actionable for both mouse and controller-style play.
- Keep implementation incremental so gameplay logic remains stable.

## Current State (Baseline)
- The panel renders a vertical stack of cropped unit portraits (`maxEntries`) with team tint and active alpha emphasis.
- Each portrait is clickable and can focus/select the corresponding unit.
- The panel currently does not show:
  - explicit turn index / separators,
  - status overlays (stunned, delayed, empowered),
  - projected initiative deltas,
  - hover details/tooltips,
  - clear ally/enemy grouping cues beyond tint.

## UX Problems to Solve
1. **Weak "now vs next" hierarchy**: active unit and first upcoming unit are too similar.
2. **Low information density**: portraits alone require map scanning to understand threat/action context.
3. **Limited affordance feedback**: clickable behavior exists, but interaction intent is not communicated visually.
4. **No anticipation support**: players cannot quickly read multi-turn consequences.
5. **Accessibility gaps**: color-only team distinction is risky for color-vision differences.

## Proposed UI Changes

### 1) Visual Hierarchy and Framing (Phase 1)
- Add a dedicated "Now" frame for active unit:
  - thicker brass/ivory border,
  - subtle pulse or ember glow,
  - optional small "NOW" badge.
- Add "Next" and "Later" styling tiers:
  - entry #1 after active gets medium emphasis,
  - later entries use reduced contrast/opacity.
- Add row background capsules (parchment-stone) for stronger silhouette separation.

### 2) Information Layers (Phase 2)
- Add compact per-entry metadata chips:
  - team icon (ally/enemy shape, not just tint),
  - status markers (e.g., stun, guard, burn),
  - turn offset label (`+1`, `+2`, ...).
- Add optional hover tooltip/side detail:
  - unit name,
  - HP (or health state text),
  - key status effects impacting next turn.

### 3) Interaction Clarity (Phase 3)
- On hover/focus:
  - brighten row and show selection ring on corresponding map unit.
- On click:
  - camera nudge/focus to selected queued unit (if visible/alive),
  - maintain current unit-selection behavior.
- Add keyboard/controller traversal for entries if input system supports it.

### 4) Predictive Feedback (Phase 4)
- Add temporary "preview" mode during targeting/ability selection:
  - ghost markers showing potential queue shifts,
  - color-safe arrows indicating speed-up/slow-down effects.
- Ensure preview uses existing projected turn order source to avoid divergent logic.

## Technical Implementation Notes
- Keep queue source of truth in existing turn projection logic (`projectTurnOrder` flow in `BattleScene`).
- Extend `TurnOrderPanel` row model to include:
  - frame/background image,
  - badge text object,
  - status icon container,
  - optional offset text.
- Avoid duplicating render logic in `BattleScene`; panel should own visual state derivation from passed queue metadata.
- Add lightweight UI tokens (colors/sizes) as constants for consistency and theme iteration.

## Data & API Additions
- Introduce a `TurnOrderEntryViewModel` (or similar) that wraps `BattleUnit` plus UI metadata:
  - `isActive`, `offset`, `team`, `statuses`, `isPreviewDelta`.
- Keep backward-compatible adapter so existing `setQueue` callsites can be migrated in steps.

## Rollout Plan
1. **Milestone A**: Hierarchy-only pass (Now/Next/Later, frames, badges).
2. **Milestone B**: Metadata chips + non-color team icon.
3. **Milestone C**: Hover/click feedback polish and input navigation.
4. **Milestone D**: Predictive queue preview during ability targeting.

## Validation Checklist
- Readability: can players identify the next 3 actors in <2 seconds.
- Accuracy: timeline order always matches actual turn execution.
- Performance: no measurable frame drops from additional UI objects.
- Theme fit: visuals stay within parchment/brass/muted palette direction.
- Accessibility: ally/enemy distinction remains clear in grayscale simulation.

## Risks & Mitigations
- **Risk**: UI clutter at small resolutions.
  - **Mitigation**: progressive disclosure (show full metadata on hover/focus).
- **Risk**: Preview order desync with actual combat resolution.
  - **Mitigation**: single shared projection pipeline; add assertion logging in debug.
- **Risk**: Art mismatch with existing runtime assets.
  - **Mitigation**: reuse current sprite crops and introduce minimal, theme-aligned framing assets.

## Success Criteria
- Players report improved confidence in planning multi-turn actions.
- Fewer mistaken assumptions about enemy upcoming turns.
- Turn order panel remains legible and stylistically consistent with the battlefield UI.
