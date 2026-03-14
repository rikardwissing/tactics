import type { WorldPersistentState, WorldSessionState } from './types';

let worldSessionState: WorldSessionState | null = null;
let worldPersistentState: WorldPersistentState = {
  chunkVariants: {}
};
let worldStateRevision = 0;

function cloneState(state: WorldSessionState): WorldSessionState {
  return {
    ...state,
    outdoorPosition: { ...state.outdoorPosition },
    interiorPosition: state.interiorPosition ? { ...state.interiorPosition } : null,
    returnOutdoorPosition: state.returnOutdoorPosition ? { ...state.returnOutdoorPosition } : null
  };
}

function clonePersistentState(state: WorldPersistentState): WorldPersistentState {
  return {
    chunkVariants: { ...state.chunkVariants }
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

export function getWorldPersistentState(): WorldPersistentState {
  return clonePersistentState(worldPersistentState);
}

export function setWorldPersistentState(state: WorldPersistentState): WorldPersistentState {
  worldPersistentState = clonePersistentState(state);
  worldStateRevision += 1;
  return clonePersistentState(worldPersistentState);
}

export function clearWorldPersistentState(): void {
  worldPersistentState = {
    chunkVariants: {}
  };
  worldStateRevision += 1;
}

export function getWorldStateRevision(): number {
  return worldStateRevision;
}
