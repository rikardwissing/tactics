import { getTile } from '../core/pathfinding';
import type { Point, TileData } from '../core/types';

export class WorldSpatialIndex {
  private map: readonly TileData[] = [];
  private windowOrigin: Point | null = null;

  update(map: readonly TileData[], windowOrigin: Point | null): void {
    this.map = map;
    this.windowOrigin = windowOrigin;
  }

  localToAbsolute(point: Point): Point {
    if (!this.windowOrigin) {
      return point;
    }

    return {
      x: this.windowOrigin.x + point.x,
      y: this.windowOrigin.y + point.y
    };
  }

  absoluteToLocal(point: Point): Point {
    if (!this.windowOrigin) {
      return point;
    }

    return {
      x: point.x - this.windowOrigin.x,
      y: point.y - this.windowOrigin.y
    };
  }

  getLocalTile(point: Point): TileData | null {
    return getTile(this.map as TileData[], point.x, point.y) ?? null;
  }

  getAbsoluteTile(point: Point): TileData | null {
    return this.getLocalTile(this.absoluteToLocal(point));
  }
}
