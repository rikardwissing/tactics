import Phaser from 'phaser';
import { DEFAULT_UNIT_GROUND_OFFSET_Y } from '../core/isometric';
import { ELEVATION_STEP, TILE_HEIGHT } from '../core/mapData';
import { getTile } from '../core/pathfinding';
import type { Point, TerrainType, TileData } from '../core/types';
import type { MapPropAssetId } from '../levels/types';

export const TERRAIN_TILE_ASSETS: Record<TerrainType, readonly string[]> = {
  grass: ['terrain-grass-a', 'terrain-grass-b'],
  moss: ['terrain-moss-a', 'terrain-moss-b'],
  stone: ['terrain-stone-a', 'terrain-stone-b'],
  sanctum: ['terrain-sanctum-a'],
  chrono: ['terrain-chrono-a', 'terrain-chrono-b'],
  brine: ['terrain-brine-a', 'terrain-brine-b'],
  bastion: ['terrain-bastion-a', 'terrain-bastion-b'],
  aevum: ['terrain-aevum-a', 'terrain-aevum-b']
};

export interface PropRenderConfig {
  height: number;
  minWidth: number;
  offsetX?: number;
  groundOffsetY?: number;
  baseFill: number;
  baseAlpha: number;
  rim: number;
  rimAlpha: number;
  blocksMovement: boolean;
  description?: string;
  light?: {
    color: number;
    radius: number;
    intensity: number;
    sourceOffsetY: number;
    emberTint: number[];
  };
}

export const PROP_RENDER_CONFIG: Record<MapPropAssetId, PropRenderConfig> = {
  'obstacle-rubble-barricade': {
    height: 132,
    minWidth: 104,
    baseFill: 0x181410,
    baseAlpha: 0.18,
    rim: 0x8c8576,
    rimAlpha: 0.12,
    blocksMovement: true,
    description: 'A towering stone outcrop claims the whole tile and blocks passage.'
  },
  'light-torch': {
    height: 88,
    minWidth: 44,
    offsetX: -3,
    groundOffsetY: 11,
    baseFill: 0x2c2118,
    baseAlpha: 0.1,
    rim: 0x7f5f32,
    rimAlpha: 0.16,
    blocksMovement: true,
    description: 'An iron torch stand throws warm light over the nearby stones.',
    light: {
      color: 0xffb45f,
      radius: 228,
      intensity: 1.8,
      sourceOffsetY: 58,
      emberTint: [0xffefb0, 0xffa24d, 0xd45a1d]
    }
  },
  'sanctum-brazier': {
    height: 80,
    minWidth: 60,
    groundOffsetY: 21,
    baseFill: 0x2f2118,
    baseAlpha: 0.12,
    rim: 0x8c6535,
    rimAlpha: 0.18,
    blocksMovement: true,
    description: 'A sanctum brazier burns bright, pushing back the dark around the altar.',
    light: {
      color: 0xffc977,
      radius: 272,
      intensity: 2.15,
      sourceOffsetY: 48,
      emberTint: [0xfff2bb, 0xffb45f, 0xc95924]
    }
  }
};

export const DEFAULT_BOARD_ZOOM = 1;
export const BASE_MIN_BOARD_ZOOM = 0.72;
export const MAX_BOARD_ZOOM = 1.8;
export const BOARD_ZOOM_SENSITIVITY = 0.00055;
export const UNIT_GROUND_OFFSET_Y = DEFAULT_UNIT_GROUND_OFFSET_Y;
export const UNIT_FOOTPRINT_OFFSET_Y = -4;
export const WORLD_EDGE_BASE_LEVEL = 1;

export const ACTIVE_TILE_HIGHLIGHT_COLORS = {
  glowOuter: 0xffd36b,
  glowInner: 0xffc24f,
  fillDark: 0x6f4a18,
  fillMid: 0xe4a93d,
  fillLight: 0xffefb2,
  strokeOuter: 0xfff3c6,
  strokeMid: 0xffca62,
  strokeInner: 0x8c5d1b,
  center: 0xfff5cb
} as const;

export interface TerrainPalette {
  top: number;
  sideLeft: number;
  sideRight: number;
  outline: number;
  detail: number;
}

const TERRAIN_PALETTES: Record<TerrainType, TerrainPalette> = {
  grass: {
    top: 0x486d40,
    sideLeft: 0x334e2c,
    sideRight: 0x24371f,
    outline: 0x182012,
    detail: 0xb9c97b
  },
  moss: {
    top: 0x5a6247,
    sideLeft: 0x444933,
    sideRight: 0x2d3024,
    outline: 0x1b1f15,
    detail: 0x9ba36a
  },
  stone: {
    top: 0x77736f,
    sideLeft: 0x57514f,
    sideRight: 0x403d3b,
    outline: 0x1e1a1a,
    detail: 0xc8b991
  },
  sanctum: {
    top: 0x8f7a66,
    sideLeft: 0x6d5947,
    sideRight: 0x4d3e34,
    outline: 0x241713,
    detail: 0xf8dea0
  },
  chrono: {
    top: 0x5a6f7b,
    sideLeft: 0x42535d,
    sideRight: 0x2b363f,
    outline: 0x12171c,
    detail: 0x93c7c8
  },
  brine: {
    top: 0x45685c,
    sideLeft: 0x335046,
    sideRight: 0x21352e,
    outline: 0x101816,
    detail: 0x8cc6bf
  },
  bastion: {
    top: 0x80786f,
    sideLeft: 0x645f59,
    sideRight: 0x48443f,
    outline: 0x1d1715,
    detail: 0xd8c28b
  },
  aevum: {
    top: 0xa08d75,
    sideLeft: 0x7a6b58,
    sideRight: 0x5a4d3f,
    outline: 0x241a14,
    detail: 0xf1ddb5
  }
};

export interface RedrawBoardWallsOptions {
  boardGraphics: Phaser.GameObjects.Graphics;
  wallGraphics: readonly Phaser.GameObjects.Graphics[];
  createWallGraphics: () => Phaser.GameObjects.Graphics;
  map: readonly TileData[];
  boardRotationStep: number;
  getTileDepth: (tile: TileData) => number;
  getTileTopPoints: (tile: TileData) => Phaser.Math.Vector2[];
}

export function getTerrainPalette(terrain: TerrainType): TerrainPalette {
  return TERRAIN_PALETTES[terrain] ?? TERRAIN_PALETTES.stone;
}

export function getTerrainTileAssetKey(tile: Pick<TileData, 'x' | 'y' | 'height' | 'terrain'>): string {
  const assetKeys = TERRAIN_TILE_ASSETS[tile.terrain];
  return assetKeys[(tile.x * 17 + tile.y * 31 + tile.height * 7) % assetKeys.length];
}

export function getWallDepth(tileDepth: number): number {
  return tileDepth + TILE_HEIGHT / 2 + 1;
}

export function getVisibleNeighborDirections(boardRotationStep: number): { right: Point; left: Point } {
  return {
    right: getOriginalDirectionForVisualDirection({ x: 1, y: 0 }, boardRotationStep),
    left: getOriginalDirectionForVisualDirection({ x: 0, y: 1 }, boardRotationStep)
  };
}

export function getOriginalDirectionForVisualDirection(direction: Point, boardRotationStep: number): Point {
  let dx = direction.x;
  let dy = direction.y;

  for (let index = 0; index < boardRotationStep % 4; index += 1) {
    const nextX = dy;
    const nextY = -dx;
    dx = nextX;
    dy = nextY;
  }

  return { x: dx, y: dy };
}

export function redrawBoardWalls({
  boardGraphics,
  wallGraphics,
  createWallGraphics,
  map,
  boardRotationStep,
  getTileDepth,
  getTileTopPoints
}: RedrawBoardWallsOptions): Phaser.GameObjects.Graphics[] {
  boardGraphics.clear();

  for (const wall of wallGraphics) {
    wall.destroy();
  }

  const nextWallGraphics: Phaser.GameObjects.Graphics[] = [];
  const collisionMap = map as TileData[];
  const tiles = [...map].sort((left, right) => getTileDepth(left) - getTileDepth(right));
  const visibleNeighborDirections = getVisibleNeighborDirections(boardRotationStep);

  for (const tile of tiles) {
    const corners = getTileTopPoints(tile);
    const right = corners[1];
    const bottom = corners[2];
    const left = corners[3];
    const color = getTerrainPalette(tile.terrain);
    const rightNeighborHeight =
      getTile(collisionMap, tile.x + visibleNeighborDirections.right.x, tile.y + visibleNeighborDirections.right.y)?.height ??
      -WORLD_EDGE_BASE_LEVEL;
    const leftNeighborHeight =
      getTile(collisionMap, tile.x + visibleNeighborDirections.left.x, tile.y + visibleNeighborDirections.left.y)?.height ??
      -WORLD_EDGE_BASE_LEVEL;
    const rightDrop = Math.max(0, tile.height - rightNeighborHeight) * ELEVATION_STEP;
    const leftDrop = Math.max(0, tile.height - leftNeighborHeight) * ELEVATION_STEP;

    if (rightDrop <= 0 && leftDrop <= 0) {
      continue;
    }

    const wall = createWallGraphics();

    if (rightDrop > 0) {
      const rightFace = [
        right,
        bottom,
        new Phaser.Math.Vector2(bottom.x, bottom.y + rightDrop),
        new Phaser.Math.Vector2(right.x, right.y + rightDrop)
      ];
      wall.fillStyle(color.sideRight, 1);
      wall.fillPoints(rightFace, true);
      wall.lineStyle(2, color.outline, 0.88);
      wall.strokePoints(rightFace, true, true);
    }

    if (leftDrop > 0) {
      const leftFace = [
        left,
        bottom,
        new Phaser.Math.Vector2(bottom.x, bottom.y + leftDrop),
        new Phaser.Math.Vector2(left.x, left.y + leftDrop)
      ];
      wall.fillStyle(color.sideLeft, 1);
      wall.fillPoints(leftFace, true);
      wall.lineStyle(2, color.outline, 0.88);
      wall.strokePoints(leftFace, true, true);
    }

    wall.setDepth(getWallDepth(getTileDepth(tile)));
    nextWallGraphics.push(wall);
  }

  return nextWallGraphics;
}
