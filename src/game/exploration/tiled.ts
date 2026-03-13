import { parseTiledLevel } from '../levels/tiled';
import type {
  ExplorationActorPlacement,
  ExplorationLocationDefinition,
  ExplorationNpcDefinition,
  NpcActionDefinition,
  NpcActionKind
} from './types';

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
  name?: string;
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

const NPC_ACTION_KINDS = new Set<NpcActionKind>(['talk', 'buy', 'sell', 'train']);
const DEFAULT_NPC_ACTION_LABELS: Record<NpcActionKind, string> = {
  talk: 'Talk',
  buy: 'Buy',
  sell: 'Sell',
  train: 'Train'
};

export function parseTiledExplorationLocation(map: TiledMap): ExplorationLocationDefinition {
  const level = parseTiledLevel(map);
  const leaderLayer = getObjectLayer(map, 'leader');
  const npcsLayer = getObjectLayer(map, 'npcs');

  if (leaderLayer.objects.length !== 1) {
    throw new Error(`Exploration map ${level.id} must define exactly one leader object.`);
  }

  const [leaderObject] = leaderLayer.objects;

  if (!leaderObject) {
    throw new Error(`Exploration map ${level.id} is missing its leader object.`);
  }

  return {
    ...level,
    leader: parseActorPlacement(map, leaderObject, `leader for ${level.id}`),
    npcs: npcsLayer.objects.map((object) => parseNpc(map, object, level.id))
  };
}

function parseNpc(map: TiledMap, object: TiledObject, levelId: string): ExplorationNpcDefinition {
  const context = `NPC object ${object.id} in ${levelId}`;
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

function parseActorPlacement(
  map: TiledMap,
  object: TiledObject,
  context: string
): ExplorationActorPlacement {
  return {
    blueprintId: getRequiredStringProperty(object.properties, 'blueprintId', context),
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
    throw new Error(`${context} must define at least one NPC action.`);
  }

  const uniqueActionKinds = new Set<string>();

  return actionKinds.map((value) => {
    if (!isNpcActionKind(value)) {
      throw new Error(`${context} has an unsupported action kind: ${value}`);
    }

    if (uniqueActionKinds.has(value)) {
      throw new Error(`${context} defines the action ${value} more than once.`);
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

function getObjectLayer(map: TiledMap, name: string): TiledObjectLayer {
  const layer = map.layers.find((entry): entry is TiledObjectLayer => entry.type === 'objectgroup' && entry.name === name);

  if (!layer) {
    throw new Error(`Missing Tiled object layer: ${name}`);
  }

  return layer;
}

function getRequiredStringProperty(
  properties: TiledProperty[] | undefined,
  propertyName: string,
  context: string
): string {
  const value = getProperty(properties, propertyName);

  if (typeof value !== 'string') {
    throw new Error(`${context} is missing a string ${propertyName} property.`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${context} has an empty ${propertyName} property.`);
  }

  return normalizedValue;
}

function getOptionalStringProperty(properties: TiledProperty[] | undefined, propertyName: string): string | undefined {
  const value = getProperty(properties, propertyName);

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function getProperty(
  properties: TiledProperty[] | undefined,
  propertyName: string
): TiledPropertyValue | undefined {
  return properties?.find((property) => property.name === propertyName)?.value;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function isNpcActionKind(value: string): value is NpcActionKind {
  return NPC_ACTION_KINDS.has(value as NpcActionKind);
}

function toTileCoordinate(value: number, tileSize: number): number {
  return Math.round(value / tileSize);
}
