import { ItemId } from '../core/items';
import { TerrainType } from '../core/types';
import { ChestPlacement, LevelDefinition, MapPropAssetId, MapPropPlacement, UnitPlacement } from './types';

type TiledPropertyValue = string | number | boolean;

interface TiledProperty {
  name: string;
  type?: string;
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
  type: string;
  name: string;
  width: number;
  height: number;
  data: number[];
}

interface TiledObject {
  id: number;
  x: number;
  y: number;
  properties?: TiledProperty[];
}

interface TiledObjectLayer {
  type: string;
  name: string;
  objects: TiledObject[];
}

type TiledLayer = TiledTileLayer | TiledObjectLayer;

interface TiledMap {
  type: string;
  orientation: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

const FLIPPED_FLAG_MASK = 0x1fffffff;

export function parseTiledLevel(map: TiledMap): LevelDefinition {
  if (map.type !== 'map') {
    throw new Error('Expected a Tiled map JSON file.');
  }

  if (map.orientation !== 'orthogonal') {
    throw new Error(`Unsupported Tiled orientation: ${map.orientation}`);
  }

  const terrainLayer = getTileLayer(map, 'terrain');
  const heightsLayer = getTileLayer(map, 'heights');
  const placementsLayer = getObjectLayer(map, 'placements');
  const chestsLayer = getOptionalObjectLayer(map, 'chests');
  const propsLayer = getOptionalObjectLayer(map, 'props');

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
      const terrainGid = normalizeGid(terrainLayer.data[index]);
      const heightGid = normalizeGid(heightsLayer.data[index]);

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

  const placements: UnitPlacement[] = placementsLayer.objects.map((object) => {
    const blueprintId = getProperty(object.properties, 'blueprintId');

    if (typeof blueprintId !== 'string' || !blueprintId) {
      throw new Error(`Placement object ${object.id} is missing a blueprintId property.`);
    }

    const x = Math.round(object.x / map.tilewidth);
    const y = Math.round(object.y / map.tileheight);

    return {
      blueprintId,
      x,
      y
    };
  });

  const chests: ChestPlacement[] = (chestsLayer?.objects ?? []).map((object) => {
    const itemId = getProperty(object.properties, 'itemId');
    const quantity = getProperty(object.properties, 'quantity');
    const x = Math.round(object.x / map.tilewidth);
    const y = Math.round(object.y / map.tileheight);

    if (typeof itemId !== 'string' || !itemId) {
      throw new Error(`Chest object ${object.id} is missing an itemId property.`);
    }

    return {
      id: `chest-${object.id}`,
      x,
      y,
      itemId: itemId as ItemId,
      quantity: typeof quantity === 'number' ? quantity : 1
    };
  });

  const props: MapPropPlacement[] = (propsLayer?.objects ?? []).map((object) => {
    const assetId = getProperty(object.properties, 'assetId');
    const x = Math.round(object.x / map.tilewidth);
    const y = Math.round(object.y / map.tileheight);

    if (typeof assetId !== 'string' || !assetId) {
      throw new Error(`Prop object ${object.id} is missing an assetId property.`);
    }

    return {
      id: `prop-${object.id}`,
      x,
      y,
      assetId: assetId as MapPropAssetId
    };
  });

  const levelId = getProperty(map.properties, 'levelId');
  const displayName = getProperty(map.properties, 'displayName');
  const objective = getProperty(map.properties, 'objective');

  if (typeof levelId !== 'string' || typeof displayName !== 'string' || typeof objective !== 'string') {
    throw new Error('Tiled map properties must include string values for levelId, displayName, and objective.');
  }

  return {
    id: levelId,
    name: displayName,
    objective,
    heights,
    terrain,
    placements,
    chests,
    props
  };
}

function getTileLayer(map: TiledMap, name: string): TiledTileLayer {
  const layer = map.layers.find((entry): entry is TiledTileLayer => entry.type === 'tilelayer' && entry.name === name);

  if (!layer) {
    throw new Error(`Missing Tiled tile layer: ${name}`);
  }

  if (!Array.isArray(layer.data)) {
    throw new Error(`Tiled layer ${name} must use array-based tile data.`);
  }

  return layer;
}

function getObjectLayer(map: TiledMap, name: string): TiledObjectLayer {
  const layer = map.layers.find((entry): entry is TiledObjectLayer => entry.type === 'objectgroup' && entry.name === name);

  if (!layer) {
    throw new Error(`Missing Tiled object layer: ${name}`);
  }

  return layer;
}

function getOptionalObjectLayer(map: TiledMap, name: string): TiledObjectLayer | null {
  return map.layers.find((entry): entry is TiledObjectLayer => entry.type === 'objectgroup' && entry.name === name) ?? null;
}

function validateTileLayerSize(map: TiledMap, layer: TiledTileLayer): void {
  if (layer.width !== map.width || layer.height !== map.height) {
    throw new Error(`Layer ${layer.name} does not match the map dimensions.`);
  }

  if (layer.data.length !== map.width * map.height) {
    throw new Error(`Layer ${layer.name} data length does not match the map dimensions.`);
  }
}

function buildTilePropertyLookup(
  tilesets: TiledTileset[],
  tilesetName: string,
  propertyName: string
): Map<number, TiledPropertyValue> {
  const tileset = tilesets.find((entry) => entry.name === tilesetName);

  if (!tileset) {
    throw new Error(`Missing Tiled tileset: ${tilesetName}`);
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

function getProperty(
  properties: TiledProperty[] | undefined,
  propertyName: string
): TiledPropertyValue | undefined {
  return properties?.find((property) => property.name === propertyName)?.value;
}

function normalizeGid(value: number): number {
  return value & FLIPPED_FLAG_MASK;
}
