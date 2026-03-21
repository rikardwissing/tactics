import type { Point } from '../core/types';
import { getWorldChunkAt, getWorldChunksForWindow } from '.';
import { diffResidentChunks } from './WorldResidencyController';

export class WorldStreamingController {
  constructor(private readonly radius: number) {}

  diffResidentChunks(currentKeys: Iterable<string>, centerChunk: Point) {
    return diffResidentChunks(currentKeys, centerChunk, this.radius);
  }

  getWindowChunks(centerChunk: Point) {
    return getWorldChunksForWindow(centerChunk.x, centerChunk.y, this.radius);
  }

  hasWorldChunkAt(chunkX: number, chunkY: number): boolean {
    return getWorldChunkAt(chunkX, chunkY) !== null;
  }
}
