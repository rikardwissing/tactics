import Phaser from 'phaser';
import { ELEVATION_STEP, TILE_WIDTH } from '../core/mapData';
import { getTile } from '../core/pathfinding';
import type { Point, TerrainType, TileData } from '../core/types';
import type { WorldChunkRuntime } from './types';
import {
  getTerrainPalette,
  getTerrainTileAssetKey,
  getVisibleNeighborDirections,
  getWallDepth,
  WORLD_EDGE_BASE_LEVEL
} from './rendering';

interface ResidentTerrainTile {
  localX: number;
  localY: number;
  height: number;
  terrain: TerrainType;
  image: Phaser.GameObjects.Image;
}

export interface ResidentWorldChunkRenderSet {
  key: string;
  chunkX: number;
  chunkY: number;
  runtime: WorldChunkRuntime;
  localOffset: Point;
  terrainTiles: ResidentTerrainTile[];
  wallGraphics: Phaser.GameObjects.Graphics[];
}

interface ChunkRenderTransformHelpers {
  isoToScreen(tile: Point & { height?: number }): Phaser.Math.Vector2;
  getTileDepth(tile: TileData): number;
  getTileTopPoints(tile: TileData): Phaser.Math.Vector2[];
}

export interface CreateResidentWorldChunkRenderSetOptions extends ChunkRenderTransformHelpers {
  scene: Phaser.Scene;
  registerWorldObject<T extends Phaser.GameObjects.GameObject>(object: T): T;
  chunk: WorldChunkRuntime;
  localOffset: Point;
}

export interface RedrawResidentWorldChunkWallsOptions extends ChunkRenderTransformHelpers {
  scene: Phaser.Scene;
  registerWorldObject<T extends Phaser.GameObjects.GameObject>(object: T): T;
  renderSet: ResidentWorldChunkRenderSet;
  residentMap: readonly TileData[];
  boardRotationStep: number;
  hasWorldChunkAt(chunkX: number, chunkY: number): boolean;
}

function createDisplayTile(
  localOffset: Point,
  localX: number,
  localY: number,
  height: number,
  terrain: TerrainType
): TileData {
  return {
    x: localOffset.x + localX,
    y: localOffset.y + localY,
    height,
    terrain
  };
}

export function createResidentWorldChunkRenderSet({
  scene,
  registerWorldObject,
  chunk,
  localOffset,
  isoToScreen,
  getTileDepth
}: CreateResidentWorldChunkRenderSetOptions): ResidentWorldChunkRenderSet {
  const terrainTiles: ResidentTerrainTile[] = [];

  for (let localY = 0; localY < chunk.height; localY += 1) {
    for (let localX = 0; localX < chunk.width; localX += 1) {
      const displayTile = createDisplayTile(
        localOffset,
        localX,
        localY,
        chunk.heights[localY]?.[localX] ?? 0,
        chunk.terrain[localY]?.[localX] ?? 'grass'
      );
      const point = isoToScreen(displayTile);
      const image = registerWorldObject(
        scene.add
          .image(point.x, point.y, getTerrainTileAssetKey(displayTile))
          .setOrigin(0.5, 0.5)
          .setDisplaySize(TILE_WIDTH, TILE_WIDTH)
          .setDepth(getTileDepth(displayTile))
      );
      image.setData('tileX', displayTile.x);
      image.setData('tileY', displayTile.y);
      terrainTiles.push({
        localX,
        localY,
        height: displayTile.height,
        terrain: displayTile.terrain,
        image
      });
    }
  }

  return {
    key: `${chunk.chunkX},${chunk.chunkY}`,
    chunkX: chunk.chunkX,
    chunkY: chunk.chunkY,
    runtime: chunk,
    localOffset: { ...localOffset },
    terrainTiles,
    wallGraphics: []
  };
}

export function updateResidentWorldChunkRenderSet(
  renderSet: ResidentWorldChunkRenderSet,
  localOffset: Point,
  { isoToScreen, getTileDepth }: Pick<ChunkRenderTransformHelpers, 'isoToScreen' | 'getTileDepth'>
): void {
  renderSet.localOffset = { ...localOffset };

  for (const terrainTile of renderSet.terrainTiles) {
    const displayTile = createDisplayTile(
      renderSet.localOffset,
      terrainTile.localX,
      terrainTile.localY,
      terrainTile.height,
      terrainTile.terrain
    );
    const point = isoToScreen(displayTile);
    terrainTile.image.setPosition(point.x, point.y).setDepth(getTileDepth(displayTile));
    terrainTile.image.setData('tileX', displayTile.x);
    terrainTile.image.setData('tileY', displayTile.y);
  }
}

export function redrawResidentWorldChunkWalls({
  scene,
  registerWorldObject,
  renderSet,
  residentMap,
  boardRotationStep,
  hasWorldChunkAt,
  getTileDepth,
  getTileTopPoints
}: RedrawResidentWorldChunkWallsOptions): Phaser.GameObjects.Graphics[] {
  for (const wall of renderSet.wallGraphics) {
    wall.destroy();
  }

  renderSet.wallGraphics = [];

  const visibleNeighborDirections = getVisibleNeighborDirections(boardRotationStep);
  const terrainTiles = [...renderSet.terrainTiles].sort((left, right) => {
    const leftTile = createDisplayTile(renderSet.localOffset, left.localX, left.localY, left.height, left.terrain);
    const rightTile = createDisplayTile(renderSet.localOffset, right.localX, right.localY, right.height, right.terrain);
    return getTileDepth(leftTile) - getTileDepth(rightTile);
  });

  for (const terrainTile of terrainTiles) {
    const tile = createDisplayTile(
      renderSet.localOffset,
      terrainTile.localX,
      terrainTile.localY,
      terrainTile.height,
      terrainTile.terrain
    );
    const corners = getTileTopPoints(tile);
    const right = corners[1];
    const bottom = corners[2];
    const left = corners[3];
    const color = getTerrainPalette(tile.terrain);
    const absoluteX = renderSet.chunkX * renderSet.runtime.width + terrainTile.localX;
    const absoluteY = renderSet.chunkY * renderSet.runtime.height + terrainTile.localY;
    const rightNeighbor = getTile(
      residentMap as TileData[],
      tile.x + visibleNeighborDirections.right.x,
      tile.y + visibleNeighborDirections.right.y
    );
    const leftNeighbor = getTile(
      residentMap as TileData[],
      tile.x + visibleNeighborDirections.left.x,
      tile.y + visibleNeighborDirections.left.y
    );
    const rightNeighborChunkX = Math.floor((absoluteX + visibleNeighborDirections.right.x) / renderSet.runtime.width);
    const rightNeighborChunkY = Math.floor((absoluteY + visibleNeighborDirections.right.y) / renderSet.runtime.height);
    const leftNeighborChunkX = Math.floor((absoluteX + visibleNeighborDirections.left.x) / renderSet.runtime.width);
    const leftNeighborChunkY = Math.floor((absoluteY + visibleNeighborDirections.left.y) / renderSet.runtime.height);
    const rightNeighborHeight =
      rightNeighbor?.height ??
      (hasWorldChunkAt(rightNeighborChunkX, rightNeighborChunkY) ? tile.height : -WORLD_EDGE_BASE_LEVEL);
    const leftNeighborHeight =
      leftNeighbor?.height ??
      (hasWorldChunkAt(leftNeighborChunkX, leftNeighborChunkY) ? tile.height : -WORLD_EDGE_BASE_LEVEL);
    const rightDrop = Math.max(0, tile.height - rightNeighborHeight) * ELEVATION_STEP;
    const leftDrop = Math.max(0, tile.height - leftNeighborHeight) * ELEVATION_STEP;

    if (rightDrop <= 0 && leftDrop <= 0) {
      continue;
    }

    const wall = registerWorldObject(scene.add.graphics());
    wall.setData('tileX', tile.x);
    wall.setData('tileY', tile.y);

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
    renderSet.wallGraphics.push(wall);
  }

  return renderSet.wallGraphics;
}

export function destroyResidentWorldChunkRenderSet(renderSet: ResidentWorldChunkRenderSet): void {
  for (const terrainTile of renderSet.terrainTiles) {
    terrainTile.image.destroy();
  }

  for (const wall of renderSet.wallGraphics) {
    wall.destroy();
  }

  renderSet.terrainTiles = [];
  renderSet.wallGraphics = [];
}
