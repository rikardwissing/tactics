import type { WorldPersistentState, WorldSessionState } from './types';

let worldSessionState: WorldSessionState | null = null;
let worldPersistentState: WorldPersistentState = {
  chunkVariants: {},
  clearedEncounterIds: {}
};
let worldStateRevision = 0;

function cloneState(state: WorldSessionState): WorldSessionState {
  return {
    ...state,
    outdoorPosition: { ...state.outdoorPosition },
    interiorPosition: state.interiorPosition ? { ...state.interiorPosition } : null,
    returnOutdoorPosition: state.returnOutdoorPosition ? { ...state.returnOutdoorPosition } : null,
    suppressedEncounterId: state.suppressedEncounterId,
    outdoorNpcStates: Object.fromEntries(
      Object.entries(state.outdoorNpcStates).map(([npcId, npcState]) => [
        npcId,
        npcState
          ? {
              absolutePosition: { ...npcState.absolutePosition },
              patrolIndex: npcState.patrolIndex
            }
          : undefined
      ])
    ),
    activeBattle: state.activeBattle
      ? {
          context: {
            origin: state.activeBattle.context.origin,
            encounterId: state.activeBattle.context.encounterId,
            setup: state.activeBattle.context.setup
              ? {
                  levelId: state.activeBattle.context.setup.levelId,
                  playerAssignments: { ...state.activeBattle.context.setup.playerAssignments }
                }
              : null
          },
          runtimeBattle: {
            ...state.activeBattle.runtimeBattle,
            units: state.activeBattle.runtimeBattle.units.map((unit) => ({ ...unit })),
            camera: {
              ...state.activeBattle.runtimeBattle.camera,
              origin: { ...state.activeBattle.runtimeBattle.camera.origin }
            },
            seamlessEntry: state.activeBattle.runtimeBattle.seamlessEntry
              ? {
                  ...state.activeBattle.runtimeBattle.seamlessEntry,
                  arenaBounds: { ...state.activeBattle.runtimeBattle.seamlessEntry.arenaBounds },
                  introEntries: state.activeBattle.runtimeBattle.seamlessEntry.introEntries.map((entry) => ({
                    ...entry,
                    start: { ...entry.start },
                    target: { ...entry.target }
                  })),
                  preservedLightSources: state.activeBattle.runtimeBattle.seamlessEntry.preservedLightSources.map((source) => ({
                    ...source
                  }))
                }
              : undefined
          }
        }
      : null
  };
}

function clonePersistentState(state: WorldPersistentState): WorldPersistentState {
  return {
    chunkVariants: { ...state.chunkVariants },
    clearedEncounterIds: { ...state.clearedEncounterIds }
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
    chunkVariants: {},
    clearedEncounterIds: {}
  };
  worldStateRevision += 1;
}

export function getWorldStateRevision(): number {
  return worldStateRevision;
}
