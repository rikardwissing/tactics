import type { BattleUnit, Point } from '../core/types';
import type { WorldSceneStartData } from '../sceneSession';
import { UNIT_BLUEPRINT_BATTLE_SCALE } from '../levels';
import { getUnitBlueprint } from '../levels/unitBlueprints';
import worldDefinitionData from './data/overworld.world.json';
import {
  clearWorldPersistentState,
  clearWorldSessionState,
  getWorldPersistentState,
  getWorldSessionState,
  getWorldStateRevision,
  setWorldPersistentState,
  setWorldSessionState
} from './session';
import { asInteriorMap, asOutdoorChunkMap, parseTiledWorldMap } from './tiled';
import type {
  WorldDefinition,
  WorldPersistentState,
  ResolvedWorldSpawn,
  WorldChunkDefinition,
  WorldChunkRuntime,
  WorldInteriorDefinition,
  WorldNpcDefinition,
  WorldNpcRuntime,
  WorldSessionState,
  WorldTiledMapSource
} from './types';

const WORLD_LEADER_BLUEPRINT_ID = 'time-travelers-aion-trooper';
const ACTIVE_WORLD_ID = 'overworld';
const WORLD_CHUNK_FILE_PATTERN = /^([a-z0-9-]+)\.(\d+)\.(\d+)(?:\.([a-z0-9-]+))?\.tiled\.json$/;

interface ParsedWorldChunkFileName {
  worldId: string;
  chunkX: number;
  chunkY: number;
  variantId: string | null;
}

interface WorldChunkRuntimeSet {
  id: string;
  chunkX: number;
  chunkY: number;
  base: WorldChunkRuntime;
  variants: Readonly<Record<string, WorldChunkRuntime>>;
}

const WORLD_DEFINITION = parseWorldDefinition(worldDefinitionData as WorldDefinition);
const WORLD_MAP_MODULES = import.meta.glob('./data/*.tiled.json', { eager: true });
const WORLD_MAP_ENTRIES = Object.entries(WORLD_MAP_MODULES).flatMap(([modulePath, moduleValue]) => {
  const fileName = modulePath.split('/').pop();

  if (!fileName) {
    return [];
  }

  return [
    {
      fileName,
      source: (moduleValue as { default: WorldTiledMapSource }).default
    }
  ];
});

export const DEFAULT_WORLD_SPAWN_ID = `${ACTIVE_WORLD_ID}-start`;

const WORLD_CHUNKS_BY_COORD = buildWorldChunkDefinitions(WORLD_MAP_ENTRIES);
const WORLD_CHUNKS: readonly WorldChunkDefinition[] = [...WORLD_CHUNKS_BY_COORD.values()];

const WORLD_INTERIORS: readonly WorldInteriorDefinition[] = WORLD_MAP_ENTRIES.flatMap(({ fileName, source }) => {
  if (parseWorldChunkFileName(fileName)) {
    return [];
  }

  return [resolveWorldInterior(fileName, source)];
});

const WORLD_CHUNK_RUNTIME_SETS_BY_COORD = new Map(
  WORLD_CHUNKS.map((definition) => [chunkKey(definition.chunkX, definition.chunkY), resolveWorldChunkRuntimeSet(definition)])
);
const WORLD_CHUNK_RUNTIME_SETS_BY_ID = new Map(
  [...WORLD_CHUNK_RUNTIME_SETS_BY_COORD.values()].map((runtimeSet) => [runtimeSet.id, runtimeSet])
);
export const WORLD_CHUNK_SIZE = resolveWorldChunkSize([...WORLD_CHUNK_RUNTIME_SETS_BY_COORD.values()]);

const INTERIORS_BY_ID = new Map(WORLD_INTERIORS.map((interior) => [interior.id, interior]));
const INTERIOR_SPAWNS_BY_ID = buildInteriorSpawnLookup(WORLD_INTERIORS);

if (!hasWorldSpawn(DEFAULT_WORLD_SPAWN_ID)) {
  throw new Error(`World default spawn ${DEFAULT_WORLD_SPAWN_ID} is not defined in any ${ACTIVE_WORLD_ID} chunk file.`);
}

function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

function parseWorldDefinition(source: WorldDefinition): WorldDefinition {
  if (!Number.isInteger(source.width) || source.width <= 0) {
    throw new Error(`World ${ACTIVE_WORLD_ID} width must be a positive integer, received ${source.width}.`);
  }

  if (!Number.isInteger(source.height) || source.height <= 0) {
    throw new Error(`World ${ACTIVE_WORLD_ID} height must be a positive integer, received ${source.height}.`);
  }

  return source;
}

function parseWorldChunkFileName(fileName: string): ParsedWorldChunkFileName | null {
  const match = fileName.match(WORLD_CHUNK_FILE_PATTERN);

  if (!match) {
    return null;
  }

  return {
    worldId: match[1],
    chunkX: Number(match[2]),
    chunkY: Number(match[3]),
    variantId: match[4] ?? null
  };
}

function createWorldChunkMapId(chunkX: number, chunkY: number): string {
  return `${ACTIVE_WORLD_ID}.${chunkX}.${chunkY}`;
}

function buildWorldChunkDefinitions(
  entries: ReadonlyArray<{ fileName: string; source: WorldTiledMapSource }>
): Map<string, WorldChunkDefinition> {
  const definitions = new Map<
    string,
    {
      id: string;
      chunkX: number;
      chunkY: number;
      baseSource?: WorldTiledMapSource;
      variantSources: Record<string, WorldTiledMapSource>;
    }
  >();

  for (const { fileName, source } of entries) {
    const placement = parseWorldChunkFileName(fileName);

    if (!placement || placement.worldId !== ACTIVE_WORLD_ID) {
      continue;
    }

    if (
      placement.chunkX < 0 ||
      placement.chunkX >= WORLD_DEFINITION.width ||
      placement.chunkY < 0 ||
      placement.chunkY >= WORLD_DEFINITION.height
    ) {
      throw new Error(
        `World chunk file ${fileName} is outside ${ACTIVE_WORLD_ID}'s ${WORLD_DEFINITION.width}x${WORLD_DEFINITION.height} bounds.`
      );
    }

    const id = createWorldChunkMapId(placement.chunkX, placement.chunkY);
    const key = chunkKey(placement.chunkX, placement.chunkY);
    const existing =
      definitions.get(key) ??
      {
        id,
        chunkX: placement.chunkX,
        chunkY: placement.chunkY,
        variantSources: {}
      };

    if (placement.variantId === null) {
      if (existing.baseSource) {
        throw new Error(`World chunk coordinate ${key} defines more than one base chunk file for ${ACTIVE_WORLD_ID}.`);
      }

      existing.baseSource = source;
    } else {
      if (existing.variantSources[placement.variantId]) {
        throw new Error(`World chunk ${id} defines variant ${placement.variantId} more than once.`);
      }

      existing.variantSources[placement.variantId] = source;
    }

    definitions.set(key, existing);
  }

  for (let chunkY = 0; chunkY < WORLD_DEFINITION.height; chunkY += 1) {
    for (let chunkX = 0; chunkX < WORLD_DEFINITION.width; chunkX += 1) {
      const key = chunkKey(chunkX, chunkY);
      const definition = definitions.get(key);

      if (!definition) {
        throw new Error(`Missing world chunk file ${ACTIVE_WORLD_ID}.${chunkX}.${chunkY}.tiled.json.`);
      }

      if (!definition.baseSource) {
        throw new Error(`World chunk ${definition.id} is missing its base file ${ACTIVE_WORLD_ID}.${chunkX}.${chunkY}.tiled.json.`);
      }
    }
  }

  return new Map(
    [...definitions.entries()].map(([key, definition]) => [
      key,
      {
        id: definition.id,
        chunkX: definition.chunkX,
        chunkY: definition.chunkY,
        baseSource: definition.baseSource as WorldTiledMapSource,
        variantSources: definition.variantSources
      } satisfies WorldChunkDefinition
    ])
  );
}

function resolveWorldChunkRuntimeSet(definition: WorldChunkDefinition): WorldChunkRuntimeSet {
  const variants = Object.fromEntries(
    Object.entries(definition.variantSources).map(([variantId, source]) => [
      variantId,
      resolveWorldChunkRuntime(definition, source, variantId)
    ])
  ) as Record<string, WorldChunkRuntime>;

  return {
    id: definition.id,
    chunkX: definition.chunkX,
    chunkY: definition.chunkY,
    base: resolveWorldChunkRuntime(definition, definition.baseSource, null),
    variants
  };
}

function resolveWorldChunkRuntime(
  definition: WorldChunkDefinition,
  source: WorldTiledMapSource,
  variantId: string | null
): WorldChunkRuntime {
  const parsed = asOutdoorChunkMap(parseTiledWorldMap(source));

  if (parsed.width !== parsed.height) {
    throw new Error(`Outdoor world chunk ${definition.id} must be square, received ${parsed.width}x${parsed.height}.`);
  }

  if (parsed.id !== definition.id) {
    const fileSuffix = variantId ? `.${variantId}` : '';
    throw new Error(
      `Outdoor world chunk ${definition.id}${fileSuffix} resolved to map ${parsed.id}; keep the filename and mapId aligned.`
    );
  }

  return {
    ...parsed,
    chunkX: definition.chunkX,
    chunkY: definition.chunkY,
    variantId
  };
}

function resolveWorldChunkSize(runtimeSets: readonly WorldChunkRuntimeSet[]): number {
  const firstRuntimeSet = runtimeSets[0];

  if (!firstRuntimeSet) {
    throw new Error(`World ${ACTIVE_WORLD_ID} has no outdoor chunk files.`);
  }

  const chunkSize = firstRuntimeSet.base.width;

  for (const runtimeSet of runtimeSets) {
    const runtimes = [runtimeSet.base, ...Object.values(runtimeSet.variants)];

    for (const runtime of runtimes) {
      if (runtime.width !== chunkSize || runtime.height !== chunkSize) {
        throw new Error(
          `Outdoor world chunk ${runtime.id} must match the shared ${chunkSize}x${chunkSize} size, received ${runtime.width}x${runtime.height}.`
        );
      }
    }
  }

  return chunkSize;
}

function buildInteriorSpawnLookup(interiors: readonly WorldInteriorDefinition[]): Map<string, ResolvedWorldSpawn> {
  const lookup = new Map<string, ResolvedWorldSpawn>();

  for (const interior of interiors) {
    for (const spawnPoint of interior.spawnPoints) {
      setResolvedWorldSpawn(
        lookup,
        {
          id: spawnPoint.id,
          areaKind: 'interior',
          areaId: interior.id,
          x: spawnPoint.x,
          y: spawnPoint.y
        },
        `World interior ${interior.id}`
      );
    }
  }

  return lookup;
}

function getActiveWorldPersistentState(): WorldPersistentState {
  return getWorldPersistentState();
}

function getActiveChunkRuntime(
  runtimeSet: WorldChunkRuntimeSet,
  state: WorldPersistentState = getActiveWorldPersistentState()
): WorldChunkRuntime {
  const variantId = state.chunkVariants[runtimeSet.id];

  if (!variantId) {
    return runtimeSet.base;
  }

  const variant = runtimeSet.variants[variantId];

  if (!variant) {
    throw new Error(`World chunk ${runtimeSet.id} has no variant named ${variantId}.`);
  }

  return variant;
}

function buildActiveOutdoorSpawnLookup(): Map<string, ResolvedWorldSpawn> {
  const lookup = new Map<string, ResolvedWorldSpawn>();
  const state = getActiveWorldPersistentState();

  for (const runtimeSet of WORLD_CHUNK_RUNTIME_SETS_BY_COORD.values()) {
    const chunk = getActiveChunkRuntime(runtimeSet, state);

    for (const spawnPoint of chunk.spawnPoints) {
      setResolvedWorldSpawn(
        lookup,
        {
          id: spawnPoint.id,
          areaKind: 'outdoor',
          areaId: chunk.id,
          x: chunk.chunkX * WORLD_CHUNK_SIZE + spawnPoint.x,
          y: chunk.chunkY * WORLD_CHUNK_SIZE + spawnPoint.y
        },
        `World chunk ${chunk.id}${chunk.variantId ? ` variant ${chunk.variantId}` : ''}`
      );
    }
  }

  return lookup;
}

function setResolvedWorldSpawn(
  lookup: Map<string, ResolvedWorldSpawn>,
  spawn: ResolvedWorldSpawn,
  context: string
): void {
  if (lookup.has(spawn.id)) {
    throw new Error(`${context} defines duplicate world spawn ${spawn.id}.`);
  }

  lookup.set(spawn.id, spawn);
}

function hasWorldSpawn(spawnId: string): boolean {
  return buildActiveOutdoorSpawnLookup().has(spawnId) || INTERIOR_SPAWNS_BY_ID.has(spawnId);
}

function resolveWorldInterior(fileName: string, source: WorldTiledMapSource): WorldInteriorDefinition {
  const resolved = asInteriorMap(parseTiledWorldMap(source));
  const expectedId = fileName.replace(/\.tiled\.json$/, '');

  if (resolved.id !== expectedId) {
    throw new Error(`World interior ${expectedId} resolved to map ${resolved.id}; keep the filename and mapId aligned.`);
  }

  return resolved;
}

function createWorldUnit(
  actorId: string,
  blueprintId: string,
  position: Point,
  team: BattleUnit['team'],
  nameOverride?: string,
  classNameOverride?: string
): BattleUnit {
  const blueprint = getUnitBlueprint(blueprintId);
  const { id: resolvedBlueprintId, ...blueprintData } = blueprint;

  return {
    ...blueprintData,
    id: actorId,
    blueprintId: resolvedBlueprintId,
    team,
    name: nameOverride ?? blueprint.name,
    className: classNameOverride ?? blueprint.className,
    spriteDisplayHeight: Math.round(blueprint.spriteDisplayHeight * UNIT_BLUEPRINT_BATTLE_SCALE),
    spriteOffsetX:
      typeof blueprint.spriteOffsetX === 'number'
        ? Math.round(blueprint.spriteOffsetX * UNIT_BLUEPRINT_BATTLE_SCALE)
        : undefined,
    spriteOffsetY:
      typeof blueprint.spriteOffsetY === 'number'
        ? Math.round(blueprint.spriteOffsetY * UNIT_BLUEPRINT_BATTLE_SCALE)
        : undefined,
    x: position.x,
    y: position.y,
    hp: blueprint.maxHp,
    ct: 0,
    alive: true
  };
}

export function createWorldLeader(position: Point): BattleUnit {
  return createWorldUnit('world:leader', WORLD_LEADER_BLUEPRINT_ID, position, 'player');
}

export function createWorldNpcs(areaId: string, npcs: readonly WorldNpcDefinition[]): WorldNpcRuntime[] {
  return npcs.map((npc) => {
    const unit = createWorldUnit(
      `world:npc:${areaId}:${npc.id}`,
      npc.blueprintId,
      { x: npc.x, y: npc.y },
      'enemy',
      npc.name,
      npc.className
    );

    return {
      id: unit.id,
      blueprintId: unit.blueprintId,
      factionId: unit.factionId,
      name: unit.name,
      className: unit.className,
      x: unit.x,
      y: unit.y,
      jump: unit.jump,
      spriteKey: unit.spriteKey,
      accentColor: unit.accentColor,
      spriteDisplayHeight: unit.spriteDisplayHeight,
      spriteOffsetX: unit.spriteOffsetX,
      spriteOffsetY: unit.spriteOffsetY,
      movementStyle: unit.movementStyle,
      idleStyle: unit.idleStyle,
      summary: npc.summary,
      actions: npc.actions
    };
  });
}

export function getWorldChunkAt(chunkX: number, chunkY: number): WorldChunkRuntime | null {
  const runtimeSet = WORLD_CHUNK_RUNTIME_SETS_BY_COORD.get(chunkKey(chunkX, chunkY));
  return runtimeSet ? getActiveChunkRuntime(runtimeSet, getActiveWorldPersistentState()) : null;
}

export function getWorldChunksForWindow(centerChunkX: number, centerChunkY: number): WorldChunkRuntime[] {
  const chunks: WorldChunkRuntime[] = [];

  for (let chunkY = centerChunkY - 1; chunkY <= centerChunkY + 1; chunkY += 1) {
    for (let chunkX = centerChunkX - 1; chunkX <= centerChunkX + 1; chunkX += 1) {
      const chunk = getWorldChunkAt(chunkX, chunkY);

      if (chunk) {
        chunks.push(chunk);
      }
    }
  }

  return chunks;
}

export function getWorldInterior(interiorId: string): WorldInteriorDefinition {
  const interior = INTERIORS_BY_ID.get(interiorId);

  if (!interior) {
    throw new Error(`Unknown world interior ${interiorId}.`);
  }

  return interior;
}

export function getWorldSpawn(spawnId: string = DEFAULT_WORLD_SPAWN_ID): ResolvedWorldSpawn {
  const spawn = buildActiveOutdoorSpawnLookup().get(spawnId) ?? INTERIOR_SPAWNS_BY_ID.get(spawnId);

  if (!spawn) {
    throw new Error(`Unknown world spawn ${spawnId}.`);
  }

  return {
    ...spawn
  };
}

export function getWorldChunkId(chunkX: number, chunkY: number): string {
  return createWorldChunkMapId(chunkX, chunkY);
}

export function getWorldChunkVariant(chunkId: string): string | null {
  return getActiveWorldPersistentState().chunkVariants[chunkId] ?? null;
}

export function listWorldChunkVariants(chunkId: string): string[] {
  const runtimeSet = WORLD_CHUNK_RUNTIME_SETS_BY_ID.get(chunkId);

  if (!runtimeSet) {
    throw new Error(`Unknown world chunk ${chunkId}.`);
  }

  return Object.keys(runtimeSet.variants).sort();
}

export function setWorldChunkVariant(chunkId: string, variantId: string | null): WorldPersistentState {
  const runtimeSet = WORLD_CHUNK_RUNTIME_SETS_BY_ID.get(chunkId);

  if (!runtimeSet) {
    throw new Error(`Unknown world chunk ${chunkId}.`);
  }

  if (variantId && !runtimeSet.variants[variantId]) {
    throw new Error(`World chunk ${chunkId} has no variant named ${variantId}.`);
  }

  const state = getActiveWorldPersistentState();
  const nextChunkVariants = { ...state.chunkVariants };

  if (variantId) {
    nextChunkVariants[chunkId] = variantId;
  } else {
    delete nextChunkVariants[chunkId];
  }

  return setWorldPersistentState({
    ...state,
    chunkVariants: nextChunkVariants
  });
}

export function clearWorldChunkVariant(chunkId: string): WorldPersistentState {
  return setWorldChunkVariant(chunkId, null);
}

export function getWorldStateVersion(): number {
  return getWorldStateRevision();
}

export function getChunkCoordinatesForWorldPosition(point: Point): Point {
  return {
    x: Math.floor(point.x / WORLD_CHUNK_SIZE),
    y: Math.floor(point.y / WORLD_CHUNK_SIZE)
  };
}

export function resolveWorldSceneStart(data?: WorldSceneStartData): WorldSessionState {
  if (data?.resumeSession) {
    const existingState = getWorldSessionState();

    if (existingState) {
      return existingState;
    }
  }

  const spawn = getWorldSpawn(data?.spawnId ?? DEFAULT_WORLD_SPAWN_ID);
  const state: WorldSessionState =
    spawn.areaKind === 'outdoor'
      ? {
          areaKind: 'outdoor',
          areaId: spawn.areaId,
          outdoorPosition: { x: spawn.x, y: spawn.y },
          interiorPosition: null,
          returnOutdoorPosition: null
        }
      : {
          areaKind: 'interior',
          areaId: spawn.areaId,
          outdoorPosition: { x: 0, y: 0 },
          interiorPosition: { x: spawn.x, y: spawn.y },
          returnOutdoorPosition: null
        };

  return setWorldSessionState(state);
}

export function persistWorldSession(state: WorldSessionState): WorldSessionState {
  return setWorldSessionState(state);
}

export function resetWorldSession(): void {
  clearWorldSessionState();
  clearWorldPersistentState();
}
