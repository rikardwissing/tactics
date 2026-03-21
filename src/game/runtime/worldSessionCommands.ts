import type { Point } from '../core/types';
import { getChunkCoordinatesForWorldPosition, getWorldChunkAt, getWorldSpawn } from '../world';
import type { WorldSessionState, WorldTransitionDefinition } from '../world/types';

export function syncOutdoorSessionPlayerPosition(session: WorldSessionState, absolutePosition: Point): WorldSessionState {
  const playerChunk = getChunkCoordinatesForWorldPosition(absolutePosition);
  const playerChunkDefinition = getWorldChunkAt(playerChunk.x, playerChunk.y);

  return {
    ...session,
    areaKind: 'outdoor',
    areaId: playerChunkDefinition?.id ?? session.areaId,
    outdoorPosition: absolutePosition,
    interiorPosition: null
  };
}

export function syncInteriorSessionPlayerPosition(session: WorldSessionState, interiorPosition: Point): WorldSessionState {
  return {
    ...session,
    areaKind: 'interior',
    interiorPosition: { ...interiorPosition }
  };
}

export function createInteriorTransitionSession(
  session: WorldSessionState,
  transition: Pick<WorldTransitionDefinition, 'targetId' | 'targetSpawnId'>,
  absolutePosition: Point
): WorldSessionState {
  const spawn = getWorldSpawn(transition.targetSpawnId);

  return {
    ...session,
    areaKind: 'interior',
    areaId: transition.targetId ?? session.areaId,
    outdoorPosition: { ...absolutePosition },
    interiorPosition: { x: spawn.x, y: spawn.y },
    returnOutdoorPosition: { ...absolutePosition }
  };
}

export function createReturnTransitionSession(session: WorldSessionState, outdoorPosition: Point): WorldSessionState {
  const playerChunk = getChunkCoordinatesForWorldPosition(outdoorPosition);
  const chunk = getWorldChunkAt(playerChunk.x, playerChunk.y);

  return {
    ...session,
    areaKind: 'outdoor',
    areaId: chunk?.id ?? session.areaId,
    outdoorPosition: { ...outdoorPosition },
    interiorPosition: null,
    returnOutdoorPosition: null
  };
}

export function createSpawnTransitionSession(
  session: WorldSessionState,
  targetSpawnId: string
): WorldSessionState {
  const spawn = getWorldSpawn(targetSpawnId);

  return spawn.areaKind === 'outdoor'
    ? {
        ...session,
        areaKind: 'outdoor',
        areaId: spawn.areaId,
        outdoorPosition: { x: spawn.x, y: spawn.y },
        interiorPosition: null,
        returnOutdoorPosition: null
      }
    : {
        ...session,
        areaKind: 'interior',
        areaId: spawn.areaId,
        interiorPosition: { x: spawn.x, y: spawn.y }
      };
}

export function createEncounterSuppressedSession(session: WorldSessionState, encounterId: string): WorldSessionState {
  return {
    ...session,
    suppressedEncounterId: encounterId
  };
}
