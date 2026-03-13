import type { WorldSessionState } from './types';

let worldSessionState: WorldSessionState | null = null;

function cloneState(state: WorldSessionState): WorldSessionState {
  return {
    ...state,
    outdoorPosition: { ...state.outdoorPosition },
    interiorPosition: state.interiorPosition ? { ...state.interiorPosition } : null,
    returnOutdoorPosition: state.returnOutdoorPosition ? { ...state.returnOutdoorPosition } : null
  };
}

export function getWorldSessionState(): WorldSessionState | null {
  return worldSessionState ? cloneState(worldSessionState) : null;
}

export function setWorldSessionState(state: WorldSessionState): WorldSessionState {
  worldSessionState = cloneState(state);
  return cloneState(worldSessionState);
}

export function clearWorldSessionState(): void {
  worldSessionState = null;
}
