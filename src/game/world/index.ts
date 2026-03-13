import type { BattleUnit, Point } from '../core/types';
import type { WorldSceneStartData } from '../sceneSession';
import { UNIT_BLUEPRINT_BATTLE_SCALE } from '../levels';
import type { MapPropAssetId } from '../levels/types';
import { getUnitBlueprint } from '../levels/unitBlueprints';
import emberCaveInteriorMap from './data/ember-cave-interior.tiled.json';
import pilgrimCampExteriorMap from './data/pilgrim-camp-exterior.tiled.json';
import pilgrimStorehouseInteriorMap from './data/pilgrim-storehouse-interior.tiled.json';
import sableCityApproachMap from './data/sable-city-approach.tiled.json';
import wildernessPassageMap from './data/wilderness-passage.tiled.json';
import { clearWorldSessionState, getWorldSessionState, setWorldSessionState } from './session';
import { asInteriorMap, asOutdoorChunkMap, parseTiledWorldMap } from './tiled';
import type {
  ResolvedWorldSpawn,
  WorldChunkDefinition,
  WorldChunkRuntime,
  WorldInteriorDefinition,
  WorldNpcDefinition,
  WorldNpcRuntime,
  WorldSessionState
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

type ChunkTransform = 'none' | 'mirrorX' | 'mirrorY' | 'rotate180';

interface VariantPropDefinition {
  x: number;
  y: number;
  assetId: MapPropAssetId;
}

interface OutdoorChunkVariantConfig {
  mapId: string;
  displayName: string;
  backdropAssetId: string;
  transform?: ChunkTransform;
  props?: readonly VariantPropDefinition[];
}

export const WORLD_CHUNK_SIZE = 16;
export const DEFAULT_WORLD_SPAWN_ID = 'overworld-start';

const cinderHeathMap = createOutdoorChunkVariant(wildernessPassageMap, {
  mapId: 'cinder-heath',
  displayName: 'Cinder Heath',
  backdropAssetId: 'renations-global-backdrop',
  transform: 'rotate180',
  props: [
    { x: 4, y: 11, assetId: 'obstacle-rubble-barricade' },
    { x: 11, y: 6, assetId: 'light-torch' }
  ]
});

const ridgeRoadMap = createOutdoorChunkVariant(wildernessPassageMap, {
  mapId: 'ridge-road',
  displayName: 'Ridge Road',
  backdropAssetId: 'renations-global-backdrop',
  transform: 'mirrorY',
  props: [
    { x: 8, y: 5, assetId: 'light-torch' },
    { x: 11, y: 10, assetId: 'obstacle-rubble-barricade' }
  ]
});

const pilgrimHeightsMap = createOutdoorChunkVariant(pilgrimCampExteriorMap, {
  mapId: 'pilgrim-heights',
  displayName: 'Pilgrim Heights',
  backdropAssetId: 'setup-war-council-backdrop',
  transform: 'mirrorY',
  props: [
    { x: 6, y: 5, assetId: 'sanctum-brazier' },
    { x: 10, y: 10, assetId: 'light-torch' }
  ]
});

const northGateRidgeMap = createOutdoorChunkVariant(sableCityApproachMap, {
  mapId: 'north-gate-ridge',
  displayName: 'North Gate Ridge',
  backdropAssetId: 'iron-basilica-backdrop',
  transform: 'mirrorY',
  props: [
    { x: 4, y: 5, assetId: 'light-torch' },
    { x: 12, y: 9, assetId: 'obstacle-rubble-barricade' }
  ]
});

const gatewatchRidgeMap = createOutdoorChunkVariant(sableCityApproachMap, {
  mapId: 'gatewatch-ridge',
  displayName: 'Gatewatch Ridge',
  backdropAssetId: 'iron-basilica-backdrop',
  transform: 'rotate180',
  props: [
    { x: 3, y: 7, assetId: 'light-torch' },
    { x: 12, y: 7, assetId: 'light-torch' }
  ]
});

const hollowMarchMap = createOutdoorChunkVariant(wildernessPassageMap, {
  mapId: 'hollow-march',
  displayName: 'Hollow March',
  backdropAssetId: 'renations-global-backdrop',
  transform: 'mirrorX',
  props: [
    { x: 6, y: 8, assetId: 'obstacle-rubble-barricade' },
    { x: 12, y: 5, assetId: 'light-torch' }
  ]
});

const easternCausewayMap = createOutdoorChunkVariant(sableCityApproachMap, {
  mapId: 'eastern-causeway',
  displayName: 'Eastern Causeway',
  backdropAssetId: 'iron-basilica-backdrop',
  transform: 'mirrorX',
  props: [
    { x: 3, y: 6, assetId: 'light-torch' },
    { x: 9, y: 10, assetId: 'obstacle-rubble-barricade' }
  ]
});

const reedMireMap = createOutdoorChunkVariant(wildernessPassageMap, {
  mapId: 'reed-mire',
  displayName: 'Reed Mire',
  backdropAssetId: 'renations-global-backdrop',
  transform: 'none',
  props: [
    { x: 5, y: 4, assetId: 'obstacle-rubble-barricade' },
    { x: 12, y: 11, assetId: 'light-torch' }
  ]
});

const emberFenMap = createOutdoorChunkVariant(wildernessPassageMap, {
  mapId: 'ember-fen',
  displayName: 'Ember Fen',
  backdropAssetId: 'renations-global-backdrop',
  transform: 'mirrorY',
  props: [
    { x: 7, y: 7, assetId: 'sanctum-brazier' },
    { x: 11, y: 4, assetId: 'obstacle-rubble-barricade' }
  ]
});

const pilgrimLowfieldsMap = createOutdoorChunkVariant(pilgrimCampExteriorMap, {
  mapId: 'pilgrim-lowfields',
  displayName: 'Pilgrim Lowfields',
  backdropAssetId: 'setup-war-council-backdrop',
  transform: 'mirrorX',
  props: [
    { x: 5, y: 10, assetId: 'light-torch' },
    { x: 10, y: 6, assetId: 'sanctum-brazier' }
  ]
});

const southGateMoorMap = createOutdoorChunkVariant(sableCityApproachMap, {
  mapId: 'south-gate-moor',
  displayName: 'South Gate Moor',
  backdropAssetId: 'iron-basilica-backdrop',
  transform: 'none',
  props: [
    { x: 4, y: 9, assetId: 'light-torch' },
    { x: 11, y: 6, assetId: 'obstacle-rubble-barricade' }
  ]
});

const sunkenCausewayMap = createOutdoorChunkVariant(sableCityApproachMap, {
  mapId: 'sunken-causeway',
  displayName: 'Sunken Causeway',
  backdropAssetId: 'iron-basilica-backdrop',
  transform: 'rotate180',
  props: [
    { x: 6, y: 5, assetId: 'light-torch' },
    { x: 11, y: 10, assetId: 'light-torch' }
  ]
});

const WORLD_CHUNKS: readonly WorldChunkDefinition[] = [
  {
    id: 'cinder-heath',
    chunkX: -1,
    chunkY: -1,
    variants: {
      default: cinderHeathMap
    }
  },
  {
    id: 'ridge-road',
    chunkX: 0,
    chunkY: -1,
    variants: {
      default: ridgeRoadMap
    }
  },
  {
    id: 'pilgrim-heights',
    chunkX: 1,
    chunkY: -1,
    variants: {
      default: pilgrimHeightsMap
    }
  },
  {
    id: 'north-gate-ridge',
    chunkX: 2,
    chunkY: -1,
    variants: {
      default: northGateRidgeMap
    }
  },
  {
    id: 'gatewatch-ridge',
    chunkX: 3,
    chunkY: -1,
    variants: {
      default: gatewatchRidgeMap
    }
  },
  {
    id: 'hollow-march',
    chunkX: -1,
    chunkY: 0,
    variants: {
      default: hollowMarchMap
    }
  },
  {
    id: 'wilderness-passage',
    chunkX: 0,
    chunkY: 0,
    variants: {
      default: wildernessPassageMap
    }
  },
  {
    id: 'pilgrim-camp-exterior',
    chunkX: 1,
    chunkY: 0,
    variants: {
      default: pilgrimCampExteriorMap
    }
  },
  {
    id: 'sable-city-approach',
    chunkX: 2,
    chunkY: 0,
    variants: {
      default: sableCityApproachMap
    }
  },
  {
    id: 'eastern-causeway',
    chunkX: 3,
    chunkY: 0,
    variants: {
      default: easternCausewayMap
    }
  },
  {
    id: 'reed-mire',
    chunkX: -1,
    chunkY: 1,
    variants: {
      default: reedMireMap
    }
  },
  {
    id: 'ember-fen',
    chunkX: 0,
    chunkY: 1,
    variants: {
      default: emberFenMap
    }
  },
  {
    id: 'pilgrim-lowfields',
    chunkX: 1,
    chunkY: 1,
    variants: {
      default: pilgrimLowfieldsMap
    }
  },
  {
    id: 'south-gate-moor',
    chunkX: 2,
    chunkY: 1,
    variants: {
      default: southGateMoorMap
    }
  },
  {
    id: 'sunken-causeway',
    chunkX: 3,
    chunkY: 1,
    variants: {
      default: sunkenCausewayMap
    }
  }
] as const;

const WORLD_INTERIORS = [
  asInteriorMap(parseTiledWorldMap(pilgrimStorehouseInteriorMap)),
  asInteriorMap(parseTiledWorldMap(emberCaveInteriorMap))
] as const satisfies readonly WorldInteriorDefinition[];

const WORLD_CHUNK_RUNTIMES = WORLD_CHUNKS.map((definition) => {
  const parsed = asOutdoorChunkMap(parseTiledWorldMap(definition.variants.default));

  if (parsed.width !== WORLD_CHUNK_SIZE || parsed.height !== WORLD_CHUNK_SIZE) {
    throw new Error(`Outdoor world chunk ${definition.id} must be ${WORLD_CHUNK_SIZE}x${WORLD_CHUNK_SIZE}.`);
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

function chunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

function createOutdoorChunkVariant(
  source: Record<string, unknown>,
  config: OutdoorChunkVariantConfig
): Record<string, unknown> {
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
      value: config.mapId
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

  return map as unknown as Record<string, unknown>;
}

function cloneTiledMap(source: Record<string, unknown>): TiledMap {
  return JSON.parse(JSON.stringify(source)) as TiledMap;
}

function transformTileLayerData(
  data: readonly number[],
  width: number,
  height: number,
  transform: ChunkTransform
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
  prop: VariantPropDefinition,
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
