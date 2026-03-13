import type { BattleUnit, Point } from '../core/types';
import type { WorldSceneStartData } from '../sceneSession';
import { UNIT_BLUEPRINT_BATTLE_SCALE } from '../levels';
import { getUnitBlueprint } from '../levels/unitBlueprints';
import emberCaveInteriorMap from './data/ember-cave-interior.tiled.json';
import pilgrimCampExteriorMap from './data/pilgrim-camp-exterior.tiled.json';
import pilgrimStorehouseInteriorMap from './data/pilgrim-storehouse-interior.tiled.json';
import sableCityApproachMap from './data/sable-city-approach.tiled.json';
import wildernessPassageMap from './data/wilderness-passage.tiled.json';
import worldLayoutData from './data/world.json';
import { clearWorldSessionState, getWorldSessionState, setWorldSessionState } from './session';
import { asInteriorMap, asOutdoorChunkMap, parseTiledWorldMap } from './tiled';
import type {
  ResolvedWorldSpawn,
  WorldChunkDefinition,
  WorldChunkLayoutDefinition,
  WorldChunkRuntime,
  WorldChunkVariantDefinition,
  WorldInteriorDefinition,
  WorldInteriorLayoutDefinition,
  WorldLayoutDefinition,
  WorldMapTransform,
  WorldNpcDefinition,
  WorldNpcRuntime,
  WorldSessionState,
  WorldTiledMapSource,
  WorldVariantPropDefinition
} from './types';

const WORLD_LEADER_BLUEPRINT_ID = 'time-travelers-aion-trooper';

type TiledPropertyValue = string | number | boolean;

interface TiledProperty {
  name: string;
  value: TiledPropertyValue;
}

interface TiledTileDefinition {
  id: number;
  properties?: TiledProperty[];
}

interface TiledTileset {
  firstgid: number;
  name: string;
  tilecount: number;
  tiles?: TiledTileDefinition[];
}

interface TiledTileLayer {
  type: 'tilelayer';
  name: string;
  width: number;
  height: number;
  data: number[];
}

interface TiledObject {
  id: number;
  name?: string;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

interface TiledObjectLayer {
  type: 'objectgroup';
  name: string;
  objects: TiledObject[];
}

type TiledLayer = TiledTileLayer | TiledObjectLayer;

interface TiledMap {
  type: 'map';
  orientation: 'orthogonal';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

const WORLD_LAYOUT = worldLayoutData as WorldLayoutDefinition;
const WORLD_MAP_SOURCES: Record<string, WorldTiledMapSource> = {
  'ember-cave-interior': emberCaveInteriorMap,
  'pilgrim-camp-exterior': pilgrimCampExteriorMap,
  'pilgrim-storehouse-interior': pilgrimStorehouseInteriorMap,
  'sable-city-approach': sableCityApproachMap,
  'wilderness-passage': wildernessPassageMap
};

export const WORLD_CHUNK_SIZE = WORLD_LAYOUT.chunkSize;
export const DEFAULT_WORLD_SPAWN_ID = WORLD_LAYOUT.defaultSpawnId;

if (!Number.isInteger(WORLD_CHUNK_SIZE) || WORLD_CHUNK_SIZE <= 0) {
  throw new Error(`World chunk size must be a positive integer, received ${WORLD_CHUNK_SIZE}.`);
}

if (DEFAULT_WORLD_SPAWN_ID.trim().length === 0) {
  throw new Error('World default spawn id must be defined in world.json.');
}

const WORLD_CHUNKS: readonly WorldChunkDefinition[] = WORLD_LAYOUT.chunks.map((definition) => ({
  id: definition.id,
  chunkX: definition.chunkX,
  chunkY: definition.chunkY,
  variants: {
    default: resolveOutdoorChunkMapSource(definition)
  }
}));

const WORLD_INTERIORS: readonly WorldInteriorDefinition[] = WORLD_LAYOUT.interiors.map((definition) =>
  resolveWorldInterior(definition)
);

const WORLD_CHUNK_RUNTIMES = WORLD_CHUNKS.map((definition) => {
  const parsed = asOutdoorChunkMap(parseTiledWorldMap(definition.variants.default));

  if (parsed.width !== WORLD_CHUNK_SIZE || parsed.height !== WORLD_CHUNK_SIZE) {
    throw new Error(`Outdoor world chunk ${definition.id} must be ${WORLD_CHUNK_SIZE}x${WORLD_CHUNK_SIZE}.`);
  }

  if (parsed.id !== definition.id) {
    throw new Error(`Outdoor world chunk ${definition.id} resolved to map ${parsed.id}; keep world.json aligned.`);
  }

  return {
    ...parsed,
    chunkX: definition.chunkX,
    chunkY: definition.chunkY,
    variantId: 'default'
  } satisfies WorldChunkRuntime;
});

const CHUNKS_BY_COORD = new Map(WORLD_CHUNK_RUNTIMES.map((chunk) => [chunkKey(chunk.chunkX, chunk.chunkY), chunk]));
const INTERIORS_BY_ID = new Map(WORLD_INTERIORS.map((interior) => [interior.id, interior]));
const SPAWNS_BY_ID = new Map<string, ResolvedWorldSpawn>();

for (const chunk of WORLD_CHUNK_RUNTIMES) {
  for (const spawnPoint of chunk.spawnPoints) {
    SPAWNS_BY_ID.set(spawnPoint.id, {
      id: spawnPoint.id,
      areaKind: 'outdoor',
      areaId: chunk.id,
      x: chunk.chunkX * WORLD_CHUNK_SIZE + spawnPoint.x,
      y: chunk.chunkY * WORLD_CHUNK_SIZE + spawnPoint.y
    });
  }
}

for (const interior of WORLD_INTERIORS) {
  for (const spawnPoint of interior.spawnPoints) {
    SPAWNS_BY_ID.set(spawnPoint.id, {
      id: spawnPoint.id,
      areaKind: 'interior',
      areaId: interior.id,
      x: spawnPoint.x,
      y: spawnPoint.y
    });
  }
}

if (!SPAWNS_BY_ID.has(DEFAULT_WORLD_SPAWN_ID)) {
  throw new Error(`World default spawn ${DEFAULT_WORLD_SPAWN_ID} is not defined in world.json.`);
}

function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

function createOutdoorChunkVariant(
  source: WorldTiledMapSource,
  mapId: string,
  config: WorldChunkVariantDefinition
): WorldTiledMapSource {
  const map = cloneTiledMap(source);
  const transform = config.transform ?? 'none';

  map.layers = map.layers.map((layer) => {
    if (layer.type === 'tilelayer') {
      return {
        ...layer,
        data: transformTileLayerData(layer.data, layer.width, layer.height, transform)
      };
    }

    if (layer.name === 'props') {
      return {
        ...layer,
        objects: (config.props ?? []).map((prop, index) => createPropObject(index + 1, prop, map.tilewidth, map.tileheight))
      };
    }

    return {
      ...layer,
      objects: []
    };
  });

  map.properties = [
    {
      name: 'mapId',
      value: mapId
    },
    {
      name: 'displayName',
      value: config.displayName
    },
    {
      name: 'backdropAssetId',
      value: config.backdropAssetId
    }
  ];

  return map as unknown as WorldTiledMapSource;
}

function resolveOutdoorChunkMapSource(definition: WorldChunkLayoutDefinition): WorldTiledMapSource {
  const source = resolveWorldMapSource(definition.sourceMapId);

  return definition.variant ? createOutdoorChunkVariant(source, definition.id, definition.variant) : source;
}

function resolveWorldInterior(definition: WorldInteriorLayoutDefinition): WorldInteriorDefinition {
  const resolved = asInteriorMap(parseTiledWorldMap(resolveWorldMapSource(definition.sourceMapId)));

  if (resolved.id !== definition.id) {
    throw new Error(`World interior ${definition.id} resolved to map ${resolved.id}; keep world.json aligned.`);
  }

  return resolved;
}

function resolveWorldMapSource(sourceMapId: string): WorldTiledMapSource {
  const source = WORLD_MAP_SOURCES[sourceMapId];

  if (!source) {
    throw new Error(`Unknown world source map ${sourceMapId} in world.json.`);
  }

  return source;
}

function cloneTiledMap(source: WorldTiledMapSource): TiledMap {
  return JSON.parse(JSON.stringify(source)) as TiledMap;
}

function transformTileLayerData(
  data: readonly number[],
  width: number,
  height: number,
  transform: WorldMapTransform
): number[] {
  if (transform === 'none') {
    return [...data];
  }

  const next = new Array<number>(data.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let targetX = x;
      let targetY = y;

      if (transform === 'mirrorX' || transform === 'rotate180') {
        targetX = width - 1 - x;
      }

      if (transform === 'mirrorY' || transform === 'rotate180') {
        targetY = height - 1 - y;
      }

      next[targetY * width + targetX] = data[y * width + x];
    }
  }

  return next;
}

function createPropObject(
  id: number,
  prop: WorldVariantPropDefinition,
  tileWidth: number,
  tileHeight: number
): TiledObject {
  return {
    id,
    x: prop.x * tileWidth,
    y: prop.y * tileHeight,
    properties: [
      {
        name: 'assetId',
        value: prop.assetId
      }
    ]
  };
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
  return CHUNKS_BY_COORD.get(chunkKey(chunkX, chunkY)) ?? null;
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
  const spawn = SPAWNS_BY_ID.get(spawnId);

  if (!spawn) {
    throw new Error(`Unknown world spawn ${spawnId}.`);
  }

  return {
    ...spawn
  };
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
}
