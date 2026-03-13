import type { TerrainType } from '../core/types';
import type { MapPropAssetId, MapPropPlacement } from '../levels/types';
import type {
  WorldChunkMapDefinition,
  WorldInteriorDefinition,
  WorldMapDefinition,
  WorldNpcDefinition,
  WorldSpawnDefinition,
  WorldTiledMapSource,
  WorldTransitionDefinition,
  WorldTransitionTargetKind
} from './types';
import type { NpcActionDefinition, NpcActionKind } from '../exploration/types';

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

const NPC_ACTION_KINDS = new Set<NpcActionKind>(['talk', 'buy', 'sell', 'train']);
const DEFAULT_NPC_ACTION_LABELS: Record<NpcActionKind, string> = {
  talk: 'Talk',
  buy: 'Buy',
  sell: 'Sell',
  train: 'Train'
};

export function parseTiledWorldMap(source: WorldTiledMapSource): WorldMapDefinition {
  const map = source as unknown as TiledMap;

  if (map.type !== 'map' || map.orientation !== 'orthogonal') {
    throw new Error('World maps must be orthogonal Tiled maps.');
  }

  const terrainLayer = getTileLayer(map, 'terrain');
  const heightsLayer = getTileLayer(map, 'heights');
  const propsLayer = getOptionalObjectLayer(map, 'props');
  const npcsLayer = getOptionalObjectLayer(map, 'npcs');
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
      const terrainValue = terrainLookup.get(terrainLayer.data[index]);
      const heightValue = heightLookup.get(heightsLayer.data[index]);

      if (typeof terrainValue !== 'string') {
        throw new Error(`Missing terrain mapping at tile (${x}, ${y}).`);
      }

      if (typeof heightValue !== 'number') {
        throw new Error(`Missing height mapping at tile (${x}, ${y}).`);
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

  return {
    id,
    blueprintId,
    x: toTileCoordinate(object.x, map.tilewidth),
    y: toTileCoordinate(object.y, map.tileheight),
    name,
    className,
    summary,
    actions: parseNpcActions(object.properties, context)
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

function parseNpcActions(properties: TiledProperty[] | undefined, context: string): NpcActionDefinition[] {
  const actionKindsValue = getRequiredStringProperty(properties, 'actionKinds', context);
  const actionKinds = actionKindsValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (actionKinds.length === 0) {
    throw new Error(`${context} must define at least one action.`);
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

function getTileLayer(map: TiledMap, name: string): TiledTileLayer {
  const layer = map.layers.find((entry): entry is TiledTileLayer => entry.type === 'tilelayer' && entry.name === name);

  if (!layer) {
    throw new Error(`Missing tile layer ${name}.`);
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

function isNpcActionKind(value: string): value is NpcActionKind {
  return NPC_ACTION_KINDS.has(value as NpcActionKind);
}

function isWorldTransitionTargetKind(value: string): value is WorldTransitionTargetKind {
  return value === 'interior' || value === 'spawn' || value === 'return';
}

function toTileCoordinate(position: number, tileSize: number): number {
  return Math.round(position / tileSize);
}
