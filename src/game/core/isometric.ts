import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from './mapData';
import type { Point } from './types';

export interface IsometricBoardLayout {
  origin: Point;
  gridWidth: number;
  gridHeight: number;
  rotationStep?: number;
}

export const DEFAULT_UNIT_GROUND_OFFSET_Y = 6;

function normalizeRotationStep(rotationStep = 0): number {
  return ((rotationStep % 4) + 4) % 4;
}

export function getRotatedGridPoint(tile: Point, layout: IsometricBoardLayout): Point {
  switch (normalizeRotationStep(layout.rotationStep)) {
    case 1:
      return { x: layout.gridHeight - 1 - tile.y, y: tile.x };
    case 2:
      return { x: layout.gridWidth - 1 - tile.x, y: layout.gridHeight - 1 - tile.y };
    case 3:
      return { x: tile.y, y: layout.gridWidth - 1 - tile.x };
    default:
      return { x: tile.x, y: tile.y };
  }
}

export function getBasePlanePoint(tile: Point, layout: IsometricBoardLayout): Point {
  const visualPoint = getRotatedGridPoint(tile, layout);
  const boardX = (visualPoint.x - visualPoint.y) * (TILE_WIDTH / 2);
  const boardY = (visualPoint.x + visualPoint.y) * (TILE_HEIGHT / 2);

  return {
    x: layout.origin.x + boardX,
    y: layout.origin.y + boardY
  };
}

export function isoToScreenPoint(
  tile: Point & { height?: number },
  layout: IsometricBoardLayout,
  fallbackHeight = 0
): Point {
  const tileHeight = tile.height ?? fallbackHeight;
  const point = getBasePlanePoint(tile, layout);

  return {
    x: point.x,
    y: point.y - tileHeight * ELEVATION_STEP
  };
}

export function getTileTopPoints(
  tile: Point & { height?: number },
  layout: IsometricBoardLayout,
  fallbackHeight = 0
): Point[] {
  const center = isoToScreenPoint(tile, layout, fallbackHeight);

  return [
    { x: center.x, y: center.y - TILE_HEIGHT / 2 },
    { x: center.x + TILE_WIDTH / 2, y: center.y },
    { x: center.x, y: center.y + TILE_HEIGHT / 2 },
    { x: center.x - TILE_WIDTH / 2, y: center.y }
  ];
}

export function getTileDepth(
  tile: Point & { height?: number },
  layout: IsometricBoardLayout,
  fallbackHeight = 0
): number {
  const tileHeight = tile.height ?? fallbackHeight;
  return isoToScreenPoint({ ...tile, height: tileHeight }, layout, tileHeight).y + tileHeight * ELEVATION_STEP;
}

export function getUnitGroundPoint(
  tile: Point & { height?: number },
  layout: IsometricBoardLayout,
  fallbackHeight = 0,
  groundOffsetY = DEFAULT_UNIT_GROUND_OFFSET_Y
): Point {
  const point = isoToScreenPoint(tile, layout, fallbackHeight);

  return {
    x: point.x,
    y: point.y + groundOffsetY
  };
}
