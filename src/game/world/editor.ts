import type { TerrainType } from '../core/types';
import { parseTiledWorldMap } from './tiled';
import worldDefinitionData from './data/overworld.world.json';
import type { WorldTiledMapSource } from './types';

export type WorldEditorPropertyValue = string | number | boolean;
export type WorldEditorObjectLayerName = 'props' | 'npcs' | 'encounters' | 'transitions' | 'spawnPoints';
export type WorldEditorTileLayerName = 'terrain' | 'heights';

interface WorldEditorChunkPlacement {
  worldId: string;
  chunkX: number;
  chunkY: number;
  variantId: string | null;
}

export interface WorldEditorTiledProperty {
  name: string;
  type?: string;
  value: WorldEditorPropertyValue;
}

export interface WorldEditorTiledObject {
  id: number;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  type?: string;
  visible?: boolean;
  properties?: WorldEditorTiledProperty[];
}

export interface WorldEditorTiledTileLayer {
  type: 'tilelayer';
  name: string;
  width: number;
  height: number;
  data: number[];
}

export interface WorldEditorTiledObjectLayer {
  type: 'objectgroup';
  name: string;
  objects: WorldEditorTiledObject[];
}

export interface WorldEditorTiledTileset {
  firstgid: number;
  name: string;
  tilecount?: number;
  tiles?: Array<{
    id: number;
    properties?: WorldEditorTiledProperty[];
  }>;
}

export interface WorldEditorTiledMap {
  type: 'map';
  orientation: 'orthogonal';
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<WorldEditorTiledTileLayer | WorldEditorTiledObjectLayer | Record<string, unknown>>;
  tilesets: WorldEditorTiledTileset[];
  properties?: WorldEditorTiledProperty[];
  nextlayerid?: number;
  nextobjectid?: number;
  [key: string]: unknown;
}

export interface WorldEditorMapDescriptor {
  fileName: string;
  fileKey: string;
  mapId: string;
  displayName: string;
  backdropAssetId?: string;
  kind: 'chunk' | 'interior';
  chunkX?: number;
  chunkY?: number;
  variantId?: string | null;
  source: WorldEditorTiledMap;
  terrainOptions: readonly TerrainType[];
  heightOptions: readonly number[];
}

export interface WorldEditorMapDraft {
  descriptor: WorldEditorMapDescriptor;
  source: WorldEditorTiledMap;
  terrainGids: Partial<Record<TerrainType, number>>;
  heightGids: Record<number, number>;
}

export interface WorldEditorArchiveFileEntry {
  path: string;
  contents: WorldEditorTiledMap | { width: number; height: number };
}

const WORLD_CHUNK_FILE_PATTERN = /^([a-z0-9-]+)\.(\d+)\.(\d+)(?:\.([a-z0-9-]+))?\.tiled\.json$/;
const WORLD_MAP_MODULES = import.meta.glob('./data/*.tiled.json', { eager: true });
const REQUIRED_OBJECT_LAYERS: readonly WorldEditorObjectLayerName[] = [
  'props',
  'npcs',
  'encounters',
  'transitions',
  'spawnPoints'
] as const;

export const WORLD_EDITOR_WORLD_SIZE = {
  width: Number((worldDefinitionData as { width: number }).width),
  height: Number((worldDefinitionData as { height: number }).height)
} as const;

const WORLD_EDITOR_MAPS = buildWorldEditorMapDescriptors();
const WORLD_EDITOR_MAPS_BY_FILE = new Map(WORLD_EDITOR_MAPS.map((descriptor) => [descriptor.fileName, descriptor]));
const WORLD_EDITOR_OUTDOOR_BASE_MAPS = WORLD_EDITOR_MAPS.filter(
  (descriptor) => descriptor.kind === 'chunk' && !descriptor.variantId
);
const WORLD_EDITOR_OUTDOOR_BASE_MAPS_BY_COORD = new Map(
  WORLD_EDITOR_OUTDOOR_BASE_MAPS.map((descriptor) => [`${descriptor.chunkX},${descriptor.chunkY}`, descriptor])
);

function buildWorldEditorMapDescriptors(): readonly WorldEditorMapDescriptor[] {
  return Object.entries(WORLD_MAP_MODULES)
    .flatMap(([modulePath, moduleValue]) => {
      const fileName = modulePath.split('/').pop();

      if (!fileName) {
        return [];
      }

      const source = deepClone((moduleValue as { default: WorldEditorTiledMap }).default);
      const fileKey = fileName.replace(/\.tiled\.json$/, '');
      const placement = parseChunkPlacement(fileName);
      const mapId = String(getTiledPropertyValue(source.properties, 'mapId') ?? fileKey);
      const displayName = String(getTiledPropertyValue(source.properties, 'displayName') ?? mapId);
      const backdropAssetId = getOptionalStringProperty(source.properties, 'backdropAssetId');

      return [{
        fileName,
        fileKey,
        mapId,
        displayName,
        backdropAssetId,
        kind: placement ? 'chunk' : 'interior',
        chunkX: placement?.chunkX,
        chunkY: placement?.chunkY,
        variantId: placement?.variantId,
        source,
        terrainOptions: Object.keys(buildTerrainGidLookup(source)) as TerrainType[],
        heightOptions: Object.keys(buildHeightGidLookup(source))
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .sort((left, right) => left - right)
      } satisfies WorldEditorMapDescriptor];
    })
    .sort(compareWorldEditorMapDescriptors);
}

function compareWorldEditorMapDescriptors(left: WorldEditorMapDescriptor, right: WorldEditorMapDescriptor): number {
  if (left.kind !== right.kind) {
    return left.kind === 'chunk' ? -1 : 1;
  }

  if (left.kind === 'chunk' && right.kind === 'chunk') {
    if ((left.chunkY ?? 0) !== (right.chunkY ?? 0)) {
      return (left.chunkY ?? 0) - (right.chunkY ?? 0);
    }

    if ((left.chunkX ?? 0) !== (right.chunkX ?? 0)) {
      return (left.chunkX ?? 0) - (right.chunkX ?? 0);
    }

    if (!!left.variantId !== !!right.variantId) {
      return left.variantId ? 1 : -1;
    }

    return (left.variantId ?? '').localeCompare(right.variantId ?? '');
  }

  return left.fileName.localeCompare(right.fileName);
}

function parseChunkPlacement(fileName: string): WorldEditorChunkPlacement | null {
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

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getOptionalStringProperty(
  properties: readonly WorldEditorTiledProperty[] | undefined,
  name: string
): string | undefined {
  const value = getTiledPropertyValue(properties, name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isWorldEditorTiledObjectLayer(
  layer: WorldEditorTiledMap['layers'][number]
): layer is WorldEditorTiledObjectLayer {
  return layer.type === 'objectgroup' && Array.isArray((layer as { objects?: unknown }).objects);
}

function isWorldEditorMapDraft(draft: WorldEditorMapDraft | WorldEditorTiledMap): draft is WorldEditorMapDraft {
  return 'descriptor' in draft && 'source' in draft;
}

function buildTerrainGidLookup(source: WorldEditorTiledMap): Partial<Record<TerrainType, number>> {
  const tileset = source.tilesets.find((entry) => entry.name === 'terrain');
  const lookup: Partial<Record<TerrainType, number>> = {};

  if (!tileset) {
    return lookup;
  }

  for (const tile of tileset.tiles ?? []) {
    const terrain = getTiledPropertyValue(tile.properties, 'terrain');

    if (typeof terrain === 'string') {
      lookup[terrain as TerrainType] = tileset.firstgid + tile.id;
    }
  }

  return lookup;
}

function buildHeightGidLookup(source: WorldEditorTiledMap): Record<number, number> {
  const tileset = source.tilesets.find((entry) => entry.name === 'heights');
  const lookup: Record<number, number> = {};

  if (!tileset) {
    return lookup;
  }

  for (const tile of tileset.tiles ?? []) {
    const height = getTiledPropertyValue(tile.properties, 'height');

    if (typeof height === 'number') {
      lookup[height] = tileset.firstgid + tile.id;
    }
  }

  return lookup;
}

function getHeightTileset(source: WorldEditorTiledMap): WorldEditorTiledTileset {
  const tileset = source.tilesets.find((entry) => entry.name === 'heights');

  if (!tileset) {
    throw new Error('Missing heights tileset.');
  }

  return tileset;
}

function ensureHeightGid(draft: WorldEditorMapDraft, height: number): number {
  if (!Number.isInteger(height) || height < 0) {
    throw new Error(`Height ${height} must be a non-negative integer.`);
  }

  const existingGid = draft.heightGids[height];

  if (typeof existingGid === 'number') {
    return existingGid;
  }

  const tileset = getHeightTileset(draft.source);
  const nextTileId = Math.max(-1, ...(tileset.tiles ?? []).map((tile) => tile.id)) + 1;
  const nextTile = {
    id: nextTileId,
    properties: [
      {
        name: 'height',
        type: 'int',
        value: height
      }
    ]
  } satisfies NonNullable<WorldEditorTiledTileset['tiles']>[number];

  tileset.tiles = [...(tileset.tiles ?? []), nextTile].sort((left, right) => left.id - right.id);
  tileset.tilecount = Math.max(tileset.tilecount ?? 0, nextTileId + 1);

  const nextGid = tileset.firstgid + nextTileId;
  draft.heightGids[height] = nextGid;
  return nextGid;
}

function resolveNextObjectId(source: WorldEditorTiledMap): number {
  const maxLayerObjectId = source.layers.reduce((maxId, layer) => {
    if (!isWorldEditorTiledObjectLayer(layer)) {
      return maxId;
    }

    return Math.max(maxId, ...layer.objects.map((object) => object.id));
  }, 0);

  return Math.max(maxLayerObjectId + 1, source.nextobjectid ?? 1);
}

function resolveNextLayerId(source: WorldEditorTiledMap): number {
  return Math.max(
    source.nextlayerid ?? 1,
    ...source.layers
      .map((layer) => {
        const layerId = 'id' in layer && typeof layer.id === 'number' ? layer.id : 0;
        return layerId + 1;
      })
      .filter((value) => Number.isFinite(value))
  );
}

function ensureObjectLayers(source: WorldEditorTiledMap): void {
  for (const layerName of REQUIRED_OBJECT_LAYERS) {
    const existing = source.layers.find((layer) => layer.type === 'objectgroup' && layer.name === layerName);

    if (existing) {
      continue;
    }

    const nextLayerId = resolveNextLayerId(source);
    source.layers.push({
      id: nextLayerId,
      draworder: 'topdown',
      name: layerName,
      objects: [],
      opacity: 1,
      type: 'objectgroup',
      visible: true,
      x: 0,
      y: 0
    });
    source.nextlayerid = nextLayerId + 1;
  }
}

function getExpectedMapIdForDescriptor(descriptor: WorldEditorMapDescriptor): string {
  if (descriptor.kind === 'interior') {
    return descriptor.fileKey;
  }

  return `${parseChunkPlacement(descriptor.fileName)?.worldId}.${descriptor.chunkX}.${descriptor.chunkY}`;
}

export function getWorldEditorMaps(): readonly WorldEditorMapDescriptor[] {
  return WORLD_EDITOR_MAPS;
}

export function getWorldEditorOutdoorBaseMaps(): readonly WorldEditorMapDescriptor[] {
  return WORLD_EDITOR_OUTDOOR_BASE_MAPS;
}

export function getWorldEditorMap(fileName: string): WorldEditorMapDescriptor {
  const descriptor = WORLD_EDITOR_MAPS_BY_FILE.get(fileName);

  if (!descriptor) {
    throw new Error(`Unknown world editor map ${fileName}.`);
  }

  return descriptor;
}

export function getWorldEditorOutdoorBaseMapAt(chunkX: number, chunkY: number): WorldEditorMapDescriptor {
  const descriptor = WORLD_EDITOR_OUTDOOR_BASE_MAPS_BY_COORD.get(`${chunkX},${chunkY}`);

  if (!descriptor) {
    throw new Error(`Missing outdoor base map at ${chunkX},${chunkY}.`);
  }

  return descriptor;
}

export function createWorldEditorDraft(fileName: string): WorldEditorMapDraft {
  const descriptor = getWorldEditorMap(fileName);
  const source = deepClone(descriptor.source);
  ensureObjectLayers(source);

  return {
    descriptor,
    source,
    terrainGids: buildTerrainGidLookup(source),
    heightGids: buildHeightGidLookup(source)
  };
}

export function getWorldEditorMapProperty(
  draft: WorldEditorMapDraft | WorldEditorTiledMap,
  name: string
): WorldEditorPropertyValue | undefined {
  const source = isWorldEditorMapDraft(draft) ? draft.source : draft;
  return getTiledPropertyValue(source.properties, name);
}

export function setWorldEditorMapProperty(
  draft: WorldEditorMapDraft,
  name: string,
  value: WorldEditorPropertyValue | null | undefined
): void {
  draft.source.properties = upsertTiledProperty(draft.source.properties ?? [], name, value);
}

export function getWorldEditorTileLayer(
  draft: WorldEditorMapDraft,
  layerName: WorldEditorTileLayerName
): WorldEditorTiledTileLayer {
  const layer = draft.source.layers.find(
    (entry): entry is WorldEditorTiledTileLayer => entry.type === 'tilelayer' && entry.name === layerName
  );

  if (!layer) {
    throw new Error(`Missing tile layer ${layerName} in ${draft.descriptor.fileName}.`);
  }

  return layer;
}

export function getWorldEditorObjectLayer(
  draft: WorldEditorMapDraft,
  layerName: WorldEditorObjectLayerName
): WorldEditorTiledObjectLayer {
  const layer = draft.source.layers.find(
    (entry): entry is WorldEditorTiledObjectLayer => entry.type === 'objectgroup' && entry.name === layerName
  );

  if (!layer) {
    throw new Error(`Missing object layer ${layerName} in ${draft.descriptor.fileName}.`);
  }

  return layer;
}

export function getWorldEditorTerrainAt(draft: WorldEditorMapDraft, x: number, y: number): TerrainType | null {
  const layer = getWorldEditorTileLayer(draft, 'terrain');
  const gid = layer.data[getWorldEditorTileIndex(draft, x, y)];

  for (const [terrain, terrainGid] of Object.entries(draft.terrainGids)) {
    if (terrainGid === gid) {
      return terrain as TerrainType;
    }
  }

  return null;
}

export function getWorldEditorHeightAt(draft: WorldEditorMapDraft, x: number, y: number): number | null {
  const layer = getWorldEditorTileLayer(draft, 'heights');
  const gid = layer.data[getWorldEditorTileIndex(draft, x, y)];

  for (const [height, heightGid] of Object.entries(draft.heightGids)) {
    if (heightGid === gid) {
      return Number(height);
    }
  }

  return null;
}

export function setWorldEditorTerrainAt(draft: WorldEditorMapDraft, x: number, y: number, terrain: TerrainType): void {
  const gid = draft.terrainGids[terrain];

  if (typeof gid !== 'number') {
    throw new Error(`Terrain ${terrain} is not available in ${draft.descriptor.fileName}.`);
  }

  const layer = getWorldEditorTileLayer(draft, 'terrain');
  layer.data[getWorldEditorTileIndex(draft, x, y)] = gid;
}

export function setWorldEditorHeightAt(draft: WorldEditorMapDraft, x: number, y: number, height: number): void {
  const gid = ensureHeightGid(draft, height);
  const layer = getWorldEditorTileLayer(draft, 'heights');
  layer.data[getWorldEditorTileIndex(draft, x, y)] = gid;
}

export function getWorldEditorTileIndex(draft: WorldEditorMapDraft, x: number, y: number): number {
  return y * draft.source.width + x;
}

export function allocateWorldEditorObjectId(draft: WorldEditorMapDraft): number {
  const nextId = resolveNextObjectId(draft.source);
  draft.source.nextobjectid = nextId + 1;
  return nextId;
}

export function removeWorldEditorObject(
  draft: WorldEditorMapDraft,
  layerName: WorldEditorObjectLayerName,
  objectId: number
): void {
  const layer = getWorldEditorObjectLayer(draft, layerName);
  const index = layer.objects.findIndex((object) => object.id === objectId);

  if (index >= 0) {
    layer.objects.splice(index, 1);
  }
}

export function getWorldEditorObject(
  draft: WorldEditorMapDraft,
  layerName: WorldEditorObjectLayerName,
  objectId: number
): WorldEditorTiledObject | null {
  return getWorldEditorObjectLayer(draft, layerName).objects.find((object) => object.id === objectId) ?? null;
}

export function getTiledPropertyValue(
  properties: readonly WorldEditorTiledProperty[] | undefined,
  name: string
): WorldEditorPropertyValue | undefined {
  return properties?.find((property) => property.name === name)?.value;
}

export function upsertTiledProperty(
  properties: readonly WorldEditorTiledProperty[],
  name: string,
  value: WorldEditorPropertyValue | null | undefined,
  preferredType?: string
): WorldEditorTiledProperty[] {
  const nextProperties = [...properties];
  const index = nextProperties.findIndex((property) => property.name === name);

  if (value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0)) {
    if (index >= 0) {
      nextProperties.splice(index, 1);
    }

    return nextProperties;
  }

  const existing = index >= 0 ? nextProperties[index] : undefined;
  const nextProperty = createTiledProperty(name, value, preferredType ?? existing?.type);

  if (index >= 0) {
    nextProperties[index] = nextProperty;
  } else {
    nextProperties.push(nextProperty);
  }

  return nextProperties;
}

export function tiledPropertiesToRecord(
  properties: readonly WorldEditorTiledProperty[] | undefined
): Record<string, WorldEditorPropertyValue> {
  return Object.fromEntries((properties ?? []).map((property) => [property.name, property.value]));
}

export function recordToTiledProperties(
  record: Record<string, WorldEditorPropertyValue>,
  existingProperties: readonly WorldEditorTiledProperty[] = []
): WorldEditorTiledProperty[] {
  const propertyNames = [
    ...existingProperties.map((property) => property.name),
    ...Object.keys(record).filter((name) => !existingProperties.some((property) => property.name === name))
  ];

  return propertyNames
    .filter((name) => record[name] !== undefined)
    .map((name) => {
      const existing = existingProperties.find((property) => property.name === name);
      return createTiledProperty(name, record[name], existing?.type);
    });
}

function createTiledProperty(
  name: string,
  value: WorldEditorPropertyValue,
  preferredType?: string
): WorldEditorTiledProperty {
  const resolvedType = preferredType ?? inferTiledPropertyType(value);

  return {
    name,
    type: resolvedType,
    value
  };
}

function inferTiledPropertyType(value: WorldEditorPropertyValue): string {
  if (typeof value === 'boolean') {
    return 'bool';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float';
  }

  return 'string';
}

export function validateWorldEditorDraft(draft: WorldEditorMapDraft): void {
  const expectedMapId = getExpectedMapIdForDescriptor(draft.descriptor);
  const actualMapId = String(getWorldEditorMapProperty(draft, 'mapId') ?? '');

  if (actualMapId !== expectedMapId) {
    throw new Error(`mapId must stay aligned with ${expectedMapId}.`);
  }

  draft.source.nextobjectid = resolveNextObjectId(draft.source);
  parseTiledWorldMap(draft.source as WorldTiledMapSource);
}

export function serializeWorldEditorDraft(draft: WorldEditorMapDraft): string {
  validateWorldEditorDraft(draft);
  return `${JSON.stringify(draft.source, null, 2)}\n`;
}

export function buildWorldEditorArchive(
  drafts: readonly WorldEditorMapDraft[],
  additionalFiles: readonly WorldEditorArchiveFileEntry[] = []
): string {
  const files = Object.fromEntries([
    [
      'src/game/world/data/overworld.world.json',
      {
        width: WORLD_EDITOR_WORLD_SIZE.width,
        height: WORLD_EDITOR_WORLD_SIZE.height
      }
    ],
    ...additionalFiles.map((entry) => [entry.path, entry.contents]),
    ...drafts
      .map((draft) => {
        validateWorldEditorDraft(draft);
        return [`src/game/world/data/${draft.descriptor.fileName}`, draft.source] as const;
      })
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  ]);

  return `${JSON.stringify(
    {
      format: 'renations-world-archive-v1',
      generatedAt: new Date().toISOString(),
      files
    },
    null,
    2
  )}\n`;
}
