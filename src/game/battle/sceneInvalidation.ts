export interface SceneInvalidationState {
  hudDirty: boolean;
  highlightsDirty: boolean;
  turnOrderDirty: boolean;
}

export interface SceneInvalidationCounters {
  hudInvalidations: number;
  highlightInvalidations: number;
  turnOrderInvalidations: number;
}

interface SceneInvalidationFlushCallbacks {
  drawHighlights: () => void;
  refreshUi: () => void;
}

export function invalidateHud(state: SceneInvalidationState, counters: SceneInvalidationCounters): void {
  state.hudDirty = true;
  counters.hudInvalidations += 1;
}

export function invalidateHighlights(state: SceneInvalidationState, counters: SceneInvalidationCounters): void {
  state.highlightsDirty = true;
  counters.highlightInvalidations += 1;
}

export function invalidateTurnOrder(state: SceneInvalidationState, counters: SceneInvalidationCounters): void {
  state.turnOrderDirty = true;
  counters.turnOrderInvalidations += 1;
}

export function invalidatePresentation(state: SceneInvalidationState, counters: SceneInvalidationCounters): void {
  invalidateHud(state, counters);
  invalidateHighlights(state, counters);
}

export function invalidateBattlePresentation(state: SceneInvalidationState, counters: SceneInvalidationCounters): void {
  invalidateHud(state, counters);
  invalidateHighlights(state, counters);
  invalidateTurnOrder(state, counters);
}

export function flushSceneInvalidations(
  state: SceneInvalidationState,
  callbacks: SceneInvalidationFlushCallbacks
): void {
  if (state.highlightsDirty) {
    state.highlightsDirty = false;
    callbacks.drawHighlights();
  }

  if (state.hudDirty || state.turnOrderDirty) {
    state.hudDirty = false;
    state.turnOrderDirty = false;
    callbacks.refreshUi();
  }
}
