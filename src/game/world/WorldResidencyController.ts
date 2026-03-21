import type { Point } from '../core/types';

export interface ResidentChunkCoordinate extends Point {}

export interface ResidentChunkDiff {
  desired: ResidentChunkCoordinate[];
  desiredKeys: Set<string>;
  entering: ResidentChunkCoordinate[];
  leaving: string[];
}

export function getResidentChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

export function getResidentChunkCoordinates(centerChunk: Point, radius: number): ResidentChunkCoordinate[] {
  const chunks: ResidentChunkCoordinate[] = [];

  for (let chunkY = centerChunk.y - radius; chunkY <= centerChunk.y + radius; chunkY += 1) {
    for (let chunkX = centerChunk.x - radius; chunkX <= centerChunk.x + radius; chunkX += 1) {
      chunks.push({ x: chunkX, y: chunkY });
    }
  }

  return chunks;
}

export function diffResidentChunks(
  currentKeys: Iterable<string>,
  centerChunk: Point,
  radius: number
): ResidentChunkDiff {
  const desired = getResidentChunkCoordinates(centerChunk, radius);
  const desiredKeys = new Set(desired.map((chunk) => getResidentChunkKey(chunk.x, chunk.y)));
  const current = new Set(currentKeys);

  return {
    desired,
    desiredKeys,
    entering: desired.filter((chunk) => !current.has(getResidentChunkKey(chunk.x, chunk.y))),
    leaving: [...current].filter((key) => !desiredKeys.has(key))
  };
}
