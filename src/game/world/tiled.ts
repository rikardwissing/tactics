import type { TerrainType } from '../core/types';
import type { MapPropAssetId, MapPropPlacement } from '../levels/types';
import type {
  WorldChunkMapDefinition,
  WorldEncounterDefinition,
  WorldInteriorDefinition,
  WorldMapDefinition,
  WorldNpcDefinition,
  WorldNpcDisposition,
  WorldSpawnDefinition,
  WorldTiledMapSource,
  WorldTransitionDefinition,
  WorldTransitionTargetKind
} from './types';
import type { NpcActionDefinition, NpcActionKind } from '../exploration/types';

type TiledPropertyValue = string | number | boolean;

interface TiledProperty {
  name: string;
  type?: string;
  value: TiledPropertyValue;
}

interface TiledTileset {
  firstgid: number;
  name: string;
  tilecount: number;
  tiles?: Array<{
    id: number;
    properties?: TiledProperty[];
  }>;
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

const NPC_ACTION_KINDS = new Set<NpcActionKind>(['talk', 'buy', 'sell', 'train']);
const DEFAULT_NPC_ACTION_LABELS: Record<NpcActionKind, string> = {
  talk: 'Talk',
  buy: 'Buy',
  sell: 'Sell',
  train: 'Train'
};
const FLIPPED_FLAG_MASK = 0x1fffffff;

export function parseTiledWorldMap(source: WorldTiledMapSource): WorldMapDefinition {
  const map = source as unknown as TiledMap;

  if (map.type !== 'map' || map.orientation !== 'orthogonal') {
    throw new Error('World maps must be orthogonal Tiled maps.');
  }

  const terrainLayer = getTileLayer(map, 'terrain');
  const heightsLayer = getTileLayer(map, 'heights');
  const propsLayer = getOptionalObjectLayer(map, 'props');
  const npcsLayer = getOptionalObjectLayer(map, 'npcs');
  const encountersLayer = getOptionalObjectLayer(map, 'encounters');
  const transitionsLayer = getOptionalObjectLayer(map, 'transitions');
  const spawnPointsLayer = getOptionalObjectLayer(map, 'spawnPoints');

  validateTileLayerSize(map, terrainLayer);
  validateTileLayerSize(map, heightsLayer);

  const terrainLookup = buildTilePropertyLookup(map.tilesets, 'terrain', 'terrain');
  const heightLookup = buildTilePropertyLookup(map.tilesets, 'heights', 'height');
  const terrain: TerrainType[][] = [];
  const heights: number[][] = [];

  for (let y = 0; y < map.height; y += 1) {
    const terrainRow: TerrainType[] = [];
    const heightRow: number[] = [];

    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      const terrainGid = normalizeGid(terrainLayer.data[index] ?? 0);
      const heightGid = normalizeGid(heightsLayer.data[index] ?? 0);
      const terrainValue = terrainLookup.get(terrainGid);
      const heightValue = heightLookup.get(heightGid);

      if (typeof terrainValue !== 'string') {
        throw new Error(`Missing terrain mapping for gid ${terrainGid} at tile (${x}, ${y}).`);
      }

      if (typeof heightValue !== 'number') {
        throw new Error(`Missing height mapping for gid ${heightGid} at tile (${x}, ${y}).`);
      }

      terrainRow.push(terrainValue as TerrainType);
      heightRow.push(heightValue);
    }

    terrain.push(terrainRow);
    heights.push(heightRow);
  }

  const mapId = getRequiredStringProperty(map.properties, 'mapId', 'World map');
  const displayName = getRequiredStringProperty(map.properties, 'displayName', mapId);
  const backdropAssetId = getOptionalStringProperty(map.properties, 'backdropAssetId');

  return {
    id: mapId,
    name: displayName,
    backdropAssetId,
    width: map.width,
    height: map.height,
    heights,
    terrain,
    props: (propsLayer?.objects ?? []).map((object) => parseProp(map, object, mapId)),
    npcs: (npcsLayer?.objects ?? []).map((object) => parseNpc(map, object, mapId)),
    encounters: (encountersLayer?.objects ?? []).map((object) => parseEncounter(map, object, mapId)),
    transitions: (transitionsLayer?.objects ?? []).map((object) => parseTransition(map, object, mapId)),
    spawnPoints: (spawnPointsLayer?.objects ?? []).map((object) => parseSpawnPoint(map, object, mapId))
  };
}

export function asOutdoorChunkMap(definition: WorldMapDefinition): WorldChunkMapDefinition {
  return {
    ...definition,
    kind: 'outdoor'
  };
}

export function asInteriorMap(definition: WorldMapDefinition): WorldInteriorDefinition {
  return {
    ...definition,
    kind: 'interior'
  };
}

function parseProp(map: TiledMap, object: TiledObject, mapId: string): MapPropPlacement {
  const assetId = getRequiredStringProperty(object.properties, 'assetId', `Prop ${object.id} in ${mapId}`);

  return {
    id: `prop:${mapId}:${object.id}`,
    x: toTileCoordinate(object.x, map.tilewidth),
    y: toTileCoordinate(object.y, map.tileheight),
    assetId: assetId as MapPropAssetId
  };
}

function parseNpc(map: TiledMap, object: TiledObject, mapId: string): WorldNpcDefinition {
  const context = `NPC ${object.id} in ${mapId}`;
  const id = getRequiredStringProperty(object.properties, 'id', context);
  const blueprintId = getRequiredStringProperty(object.properties, 'blueprintId', context);
  const summary = getRequiredStringProperty(object.properties, 'summary', context);
  const name = normalizeOptionalString(object.name) ?? getOptionalStringProperty(object.properties, 'name');
  const className = getOptionalStringProperty(object.properties, 'className');
  const disposition = getOptionalNpcDispositionProperty(object.properties, 'disposition') ?? 'friendly';
  const aggressive = getOptionalBooleanProperty(object.properties, 'aggressive') ?? false;
  const aggressionRadius = getOptionalNumberProperty(object.properties, 'aggressionRadius') ?? 0;
  const chaseLeashRadius = getOptionalNumberProperty(object.properties, 'chaseLeashRadius');
  const encounterId = getOptionalStringProperty(object.properties, 'encounterId');
  const encounterLevelId = getOptionalStringProperty(object.properties, 'encounterLevelId');
  const encounterLabel = getOptionalStringProperty(object.properties, 'encounterLabel');
  const clearOnVictory = getOptionalBooleanProperty(object.properties, 'clearOnVictory') ?? true;
  const patrolPath = parseNpcPatrolPath(object.properties, context);

  if (disposition === 'hostile') {
    if (!encounterId) {
      throw new Error(`${context} is missing the string property encounterId.`);
    }

    if (!encounterLevelId) {
      throw new Error(`${context} is missing the string property encounterLevelId.`);
    }
  }

  return {
    id,
    blueprintId,
    x: toTileCoordinate(object.x, map.tilewidth),
    y: toTileCoordinate(object.y, map.tileheight),
    name,
    className,
    summary,
    disposition,
    aggressive,
    aggressionRadius: Math.max(0, aggressionRadius),
    chaseLeashRadius: Math.max(0, chaseLeashRadius ?? (aggressive ? Math.max(8, aggressionRadius + 2) : 0)),
    encounterId,
    encounterLevelId,
    encounterLabel,
    clearOnVictory,
    patrolPath,
    actions: parseNpcActions(object.properties, context, disposition === 'friendly')
  };
}

function parseEncounter(map: TiledMap, object: TiledObject, mapId: string): WorldEncounterDefinition {
  const context = `Encounter ${object.id} in ${mapId}`;

  return {
    id: getRequiredStringProperty(object.properties, 'id', context),
    levelId: getRequiredStringProperty(object.properties, 'levelId', context),
    label: getOptionalStringProperty(object.properties, 'label'),
    x: toTileCoordinate(object.x, map.tilewidth),
    y: toTileCoordinate(object.y, map.tileheight),
    clearOnVictory: getOptionalBooleanProperty(object.properties, 'clearOnVictory') ?? true
  };
}

function parseTransition(map: TiledMap, object: TiledObject, mapId: string): WorldTransitionDefinition {
  const context = `Transition ${object.id} in ${mapId}`;
  const targetKind = getRequiredStringProperty(object.properties, 'targetKind', context);

  if (!isWorldTransitionTargetKind(targetKind)) {
    throw new Error(`${context} has unsupported target kind ${targetKind}.`);
  }

  return {
    id: getRequiredStringProperty(object.properties, 'id', context),
    kind: getRequiredStringProperty(object.properties, 'kind', context),
    label: getOptionalStringProperty(object.properties, 'label'),
    x: toTileCoordinate(object.x, map.tilewidth),
    y: toTileCoordinate(object.y, map.tileheight),
    targetKind,
    targetId: getOptionalStringProperty(object.properties, 'targetId'),
    targetSpawnId: getOptionalStringProperty(object.properties, 'targetSpawnId')
  };
}

function parseSpawnPoint(map: TiledMap, object: TiledObject, mapId: string): WorldSpawnDefinition {
  return {
    id: getRequiredStringProperty(object.properties, 'id', `Spawn point ${object.id} in ${mapId}`),
    x: toTileCoordinate(object.x, map.tilewidth),
    y: toTileCoordinate(object.y, map.tileheight)
  };
}

function parseNpcActions(
  properties: TiledProperty[] | undefined,
  context: string,
  required: boolean
): NpcActionDefinition[] {
  const actionKindsValue = required
    ? getRequiredStringProperty(properties, 'actionKinds', context)
    : getOptionalStringProperty(properties, 'actionKinds');

  if (!actionKindsValue) {
    return [];
  }

  const actionKinds = actionKindsValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (actionKinds.length === 0) {
    if (required) {
      throw new Error(`${context} must define at least one action.`);
    }

    return [];
  }

  const uniqueActionKinds = new Set<string>();

  return actionKinds.map((value) => {
    if (!isNpcActionKind(value)) {
      throw new Error(`${context} has unsupported action kind ${value}.`);
    }

    if (uniqueActionKinds.has(value)) {
      throw new Error(`${context} defines ${value} more than once.`);
    }

    uniqueActionKinds.add(value);

    return {
      id: getOptionalStringProperty(properties, `${value}Id`) ?? value,
      kind: value,
      label: getOptionalStringProperty(properties, `${value}Label`) ?? DEFAULT_NPC_ACTION_LABELS[value],
      title: getOptionalStringProperty(properties, `${value}Title`),
      body: getRequiredStringProperty(properties, `${value}Body`, `${context} ${value} action`)
    };
  });
}

function parseNpcPatrolPath(properties: TiledProperty[] | undefined, context: string): readonly { x: number; y: number }[] {
  const patrolPathValue = getOptionalStringProperty(properties, 'patrolPath');

  if (!patrolPathValue) {
    return [];
  }

  return patrolPathValue
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [rawX, rawY] = entry.split(':').map((value) => value.trim());

      if (!rawX || !rawY) {
        throw new Error(`${context} has malformed patrolPath entry "${entry}". Use x:y|x:y.`);
      }

      const x = Number(rawX);
      const y = Number(rawY);

      if (!Number.isInteger(x) || !Number.isInteger(y)) {
        throw new Error(`${context} has malformed patrolPath coordinate "${entry}".`);
      }

      return { x, y };
    });
}

function getTileLayer(map: TiledMap, name: string): TiledTileLayer {
  const layer = map.layers.find((entry): entry is TiledTileLayer => entry.type === 'tilelayer' && entry.name === name);

  if (!layer) {
    throw new Error(`Missing tile layer ${name}.`);
  }

  if (!Array.isArray(layer.data)) {
    throw new Error(`Layer ${name} must use array-based tile data.`);
  }

  return layer;
}

function getOptionalObjectLayer(map: TiledMap, name: string): TiledObjectLayer | null {
  return map.layers.find((entry): entry is TiledObjectLayer => entry.type === 'objectgroup' && entry.name === name) ?? null;
}

function validateTileLayerSize(map: TiledMap, layer: TiledTileLayer): void {
  if (layer.width !== map.width || layer.height !== map.height) {
    throw new Error(`Layer ${layer.name} does not match the world map dimensions.`);
  }

  if (layer.data.length !== map.width * map.height) {
    throw new Error(`Layer ${layer.name} data length does not match the world map dimensions.`);
  }
}

function buildTilePropertyLookup(
  tilesets: TiledTileset[],
  tilesetName: string,
  propertyName: string
): Map<number, TiledPropertyValue> {
  const tileset = tilesets.find((entry) => entry.name === tilesetName);

  if (!tileset) {
    throw new Error(`Missing tileset ${tilesetName}.`);
  }

  const lookup = new Map<number, TiledPropertyValue>();

  for (const tile of tileset.tiles ?? []) {
    const value = getProperty(tile.properties, propertyName);

    if (value !== undefined) {
      lookup.set(tileset.firstgid + tile.id, value);
    }
  }

  return lookup;
}

function getRequiredStringProperty(
  properties: TiledProperty[] | undefined,
  propertyName: string,
  context: string
): string {
  const value = getProperty(properties, propertyName);

  if (typeof value !== 'string') {
    throw new Error(`${context} is missing the string property ${propertyName}.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${context} has an empty ${propertyName} property.`);
  }

  return normalized;
}

function getOptionalStringProperty(properties: TiledProperty[] | undefined, propertyName: string): string | undefined {
  const value = getProperty(properties, propertyName);

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function getProperty(properties: TiledProperty[] | undefined, propertyName: string): TiledPropertyValue | undefined {
  return properties?.find((property) => property.name === propertyName)?.value;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function getOptionalBooleanProperty(properties: TiledProperty[] | undefined, propertyName: string): boolean | undefined {
  const value = getProperty(properties, propertyName);
  return typeof value === 'boolean' ? value : undefined;
}

function getOptionalNumberProperty(properties: TiledProperty[] | undefined, propertyName: string): number | undefined {
  const value = getProperty(properties, propertyName);
  return typeof value === 'number' ? value : undefined;
}

function isNpcActionKind(value: string): value is NpcActionKind {
  return NPC_ACTION_KINDS.has(value as NpcActionKind);
}

function getOptionalNpcDispositionProperty(
  properties: TiledProperty[] | undefined,
  propertyName: string
): WorldNpcDisposition | undefined {
  const value = getOptionalStringProperty(properties, propertyName);

  if (!value) {
    return undefined;
  }

  if (value === 'friendly' || value === 'hostile') {
    return value;
  }

  throw new Error(`Unsupported NPC disposition ${value}.`);
}

function isWorldTransitionTargetKind(value: string): value is WorldTransitionTargetKind {
  return value === 'interior' || value === 'spawn' || value === 'return';
}

function toTileCoordinate(position: number, tileSize: number): number {
  return Math.round(position / tileSize);
}

function normalizeGid(gid: number): number {
  return gid & FLIPPED_FLAG_MASK;
}
