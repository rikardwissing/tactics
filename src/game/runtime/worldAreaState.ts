import type { Point, TileData } from '../core/types';
import type { MapPropPlacement } from '../levels/types';
import {
  createWorldNpcs,
  getWorldChunkAt,
  getWorldInterior,
  getWorldNpcRuntimeId,
  WORLD_CHUNK_SIZE
} from '../world';
import type {
  WorldChunkRuntime,
  WorldEncounterDefinition,
  WorldNpcRuntime,
  WorldSessionState,
  WorldTransitionDefinition
} from '../world/types';

export interface LocalWorldProp extends MapPropPlacement {
  absolutePosition?: Point;
}

export interface LocalWorldTransition extends WorldTransitionDefinition {
  absolutePosition?: Point;
}

export interface LocalWorldEncounter extends WorldEncounterDefinition {
  absolutePosition?: Point;
}

export interface ResolvedOutdoorAreaState {
  centerChunk: Point;
  loadedChunks: WorldChunkRuntime[];
  playerChunk: WorldChunkRuntime | null;
  windowOrigin: Point;
  localPlayerPoint: Point;
  map: TileData[];
  props: LocalWorldProp[];
  encounters: LocalWorldEncounter[];
  transitions: LocalWorldTransition[];
  npcs: WorldNpcRuntime[];
}

export interface ResolvedInteriorAreaState {
  localPlayerPoint: Point;
  gridWidth: number;
  gridHeight: number;
  map: TileData[];
  props: LocalWorldProp[];
  transitions: LocalWorldTransition[];
  npcs: WorldNpcRuntime[];
  areaName: string;
  areaBackdropAssetId: string;
}

export function resolveOutdoorAreaState(options: {
  sessionState: WorldSessionState;
  centerChunk: Point;
  outdoorWindowChunkRadius: number;
  getWindowChunks: (centerChunk: Point) => WorldChunkRuntime[];
}): ResolvedOutdoorAreaState {
  const {
    sessionState,
    centerChunk,
    outdoorWindowChunkRadius,
    getWindowChunks
  } = options;
  const outdoorPosition = { ...sessionState.outdoorPosition };
  const loadedChunks = getWindowChunks(centerChunk);
  const playerChunk = getWorldChunkAt(centerChunk.x, centerChunk.y);
  const windowOrigin = {
    x: (centerChunk.x - outdoorWindowChunkRadius) * WORLD_CHUNK_SIZE,
    y: (centerChunk.y - outdoorWindowChunkRadius) * WORLD_CHUNK_SIZE
  };
  const localPlayerPoint = {
    x: outdoorPosition.x - windowOrigin.x,
    y: outdoorPosition.y - windowOrigin.y
  };
  const outdoorWindowChunkDiameter = outdoorWindowChunkRadius * 2 + 1;
  const map: TileData[] = [];
  const props: LocalWorldProp[] = [];
  const encounters: LocalWorldEncounter[] = [];
  const transitions: LocalWorldTransition[] = [];
  const npcDefinitions = [];

  for (const chunk of loadedChunks) {
    const offsetX = (chunk.chunkX - (centerChunk.x - outdoorWindowChunkRadius)) * WORLD_CHUNK_SIZE;
    const offsetY = (chunk.chunkY - (centerChunk.y - outdoorWindowChunkRadius)) * WORLD_CHUNK_SIZE;

    for (let y = 0; y < chunk.height; y += 1) {
      for (let x = 0; x < chunk.width; x += 1) {
        map.push({
          x: offsetX + x,
          y: offsetY + y,
          height: chunk.heights[y]?.[x] ?? 0,
          terrain: chunk.terrain[y]?.[x] ?? 'grass'
        });
      }
    }

    props.push(
      ...chunk.props.map((prop) => ({
        ...prop,
        x: offsetX + prop.x,
        y: offsetY + prop.y,
        absolutePosition: {
          x: chunk.chunkX * WORLD_CHUNK_SIZE + prop.x,
          y: chunk.chunkY * WORLD_CHUNK_SIZE + prop.y
        }
      }))
    );
    transitions.push(
      ...chunk.transitions.map((transition) => ({
        ...transition,
        x: offsetX + transition.x,
        y: offsetY + transition.y,
        absolutePosition: {
          x: chunk.chunkX * WORLD_CHUNK_SIZE + transition.x,
          y: chunk.chunkY * WORLD_CHUNK_SIZE + transition.y
        }
      }))
    );
    encounters.push(
      ...chunk.encounters.map((encounter) => ({
        ...encounter,
        x: offsetX + encounter.x,
        y: offsetY + encounter.y,
        absolutePosition: {
          x: chunk.chunkX * WORLD_CHUNK_SIZE + encounter.x,
          y: chunk.chunkY * WORLD_CHUNK_SIZE + encounter.y
        }
      }))
    );
    npcDefinitions.push(
      ...chunk.npcs.flatMap((npc) => {
        const runtimeId = getWorldNpcRuntimeId('outdoor', npc.id);
        const persistedState = sessionState.outdoorNpcStates[runtimeId];
        const absolutePosition = persistedState?.absolutePosition ?? {
          x: chunk.chunkX * WORLD_CHUNK_SIZE + npc.x,
          y: chunk.chunkY * WORLD_CHUNK_SIZE + npc.y
        };
        const localPosition = {
          x: absolutePosition.x - windowOrigin.x,
          y: absolutePosition.y - windowOrigin.y
        };

        if (
          localPosition.x < 0 ||
          localPosition.x >= WORLD_CHUNK_SIZE * outdoorWindowChunkDiameter ||
          localPosition.y < 0 ||
          localPosition.y >= WORLD_CHUNK_SIZE * outdoorWindowChunkDiameter
        ) {
          return [];
        }

        return [{
          ...npc,
          x: localPosition.x,
          y: localPosition.y,
          patrolPath: npc.patrolPath.map((point) => ({
            x: offsetX + point.x,
            y: offsetY + point.y
          }))
        }];
      })
    );
  }

  return {
    centerChunk,
    loadedChunks,
    playerChunk,
    windowOrigin,
    localPlayerPoint,
    map,
    props,
    encounters,
    transitions,
    npcs: createWorldNpcs('outdoor', npcDefinitions)
  };
}

export function resolveInteriorAreaState(sessionState: WorldSessionState): ResolvedInteriorAreaState {
  const interior = getWorldInterior(sessionState.areaId);
  const localPlayerPoint = sessionState.interiorPosition ?? interior.spawnPoints[0] ?? { x: 1, y: 1 };
  const map: TileData[] = [];

  for (let y = 0; y < interior.height; y += 1) {
    for (let x = 0; x < interior.width; x += 1) {
      map.push({
        x,
        y,
        height: interior.heights[y]?.[x] ?? 0,
        terrain: interior.terrain[y]?.[x] ?? 'stone'
      });
    }
  }

  return {
    localPlayerPoint,
    gridWidth: interior.width,
    gridHeight: interior.height,
    map,
    props: interior.props.map((prop) => ({ ...prop })),
    transitions: interior.transitions.map((transition) => ({ ...transition })),
    npcs: createWorldNpcs(interior.id, interior.npcs),
    areaName: interior.name,
    areaBackdropAssetId: interior.backdropAssetId ?? 'title-backdrop'
  };
}
