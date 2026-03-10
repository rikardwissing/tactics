import { BattleUnit, TileData } from '../core/types';
import brokenChapelTiledMap from './data/broken-chapel.tiled.json';
import { parseTiledLevel } from './tiled';
import { getUnitBlueprint } from './unitBlueprints';
import { LevelDefinition } from './types';

const UNIT_SPRITE_SCALE = 0.8;

const brokenChapelLevel = parseTiledLevel(brokenChapelTiledMap);

const LEVELS = {
  [brokenChapelLevel.id]: brokenChapelLevel
} as const;

export type LevelId = keyof typeof LEVELS;

export const CURRENT_LEVEL_ID: LevelId = brokenChapelLevel.id;
export const CURRENT_LEVEL = LEVELS[CURRENT_LEVEL_ID];

export function getLevel(levelId: string): LevelDefinition {
  const level = LEVELS[levelId as LevelId];

  if (!level) {
    throw new Error(`Unknown level: ${levelId}`);
  }

  return level;
}

export function createLevelMap(level: LevelDefinition): TileData[] {
  const width = getLevelWidth(level);
  const height = getLevelHeight(level);
  const map: TileData[] = [];

  validateLevel(level);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      map.push({
        x,
        y,
        height: level.heights[y][x],
        terrain: level.terrain[y][x]
      });
    }
  }

  return map;
}

export function createLevelUnits(level: LevelDefinition): BattleUnit[] {
  const width = getLevelWidth(level);
  const height = getLevelHeight(level);

  validateLevel(level);

  return level.placements.map(({ blueprintId, x, y }) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      throw new Error(`Unit placement ${blueprintId} is outside the level bounds.`);
    }

    const blueprint = getUnitBlueprint(blueprintId);

    return {
      ...blueprint,
      spriteDisplayHeight: Math.round(blueprint.spriteDisplayHeight * UNIT_SPRITE_SCALE),
      spriteOffsetX:
        typeof blueprint.spriteOffsetX === 'number'
          ? Math.round(blueprint.spriteOffsetX * UNIT_SPRITE_SCALE)
          : undefined,
      spriteOffsetY:
        typeof blueprint.spriteOffsetY === 'number'
          ? Math.round(blueprint.spriteOffsetY * UNIT_SPRITE_SCALE)
          : undefined,
      x,
      y,
      hp: blueprint.maxHp,
      ct: 0,
      alive: true
    };
  });
}

export function getLevelWidth(level: LevelDefinition): number {
  return level.heights[0]?.length ?? 0;
}

export function getLevelHeight(level: LevelDefinition): number {
  return level.heights.length;
}

function validateLevel(level: LevelDefinition): void {
  const height = getLevelHeight(level);
  const width = getLevelWidth(level);

  if (height === 0 || width === 0) {
    throw new Error(`Level ${level.id} must define a non-empty grid.`);
  }

  if (level.terrain.length !== height) {
    throw new Error(`Level ${level.id} terrain rows do not match the height map.`);
  }

  for (const chest of level.chests) {
    if (chest.x < 0 || chest.x >= width || chest.y < 0 || chest.y >= height) {
      throw new Error(`Chest ${chest.id} is outside the level bounds.`);
    }
  }

  for (const prop of level.props) {
    if (prop.x < 0 || prop.x >= width || prop.y < 0 || prop.y >= height) {
      throw new Error(`Prop ${prop.id} is outside the level bounds.`);
    }
  }

  for (const [index, row] of level.heights.entries()) {
    if (row.length !== width) {
      throw new Error(`Level ${level.id} heights row ${index} is not rectangular.`);
    }
  }

  for (const [index, row] of level.terrain.entries()) {
    if (row.length !== width) {
      throw new Error(`Level ${level.id} terrain row ${index} is not rectangular.`);
    }
  }
}
