import { BattleUnit, Point, ReachNode, TileData } from './types';

function keyFor(x: number, y: number): string {
  return `${x},${y}`;
}

export function pointKey(point: Point): string {
  return keyFor(point.x, point.y);
}

export function getTile(map: TileData[], x: number, y: number): TileData | null {
  return map.find((tile) => tile.x === x && tile.y === y) ?? null;
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function getReachableNodes(
  map: TileData[],
  unit: BattleUnit,
  units: BattleUnit[],
  blockedPoints: Point[] = []
): Map<string, ReachNode> {
  const blocked = new Set(
    units
      .filter((entry) => entry.alive && entry.id !== unit.id)
      .map((entry) => keyFor(entry.x, entry.y))
  );

  for (const point of blockedPoints) {
    blocked.add(keyFor(point.x, point.y));
  }

  const startKey = keyFor(unit.x, unit.y);
  const reachable = new Map<string, ReachNode>();
  const queue: ReachNode[] = [{ x: unit.x, y: unit.y, cost: 0, previousKey: null }];

  reachable.set(startKey, queue[0]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const currentTile = getTile(map, current.x, current.y);

    if (!currentTile) {
      continue;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 }
    ];

    for (const neighbor of neighbors) {
      const tile = getTile(map, neighbor.x, neighbor.y);

      if (!tile) {
        continue;
      }

      const nextCost = current.cost + 1;

      if (nextCost > unit.move) {
        continue;
      }

      if (Math.abs(tile.height - currentTile.height) > unit.jump) {
        continue;
      }

      const neighborKey = keyFor(tile.x, tile.y);

      if (neighborKey !== startKey && blocked.has(neighborKey)) {
        continue;
      }

      const existing = reachable.get(neighborKey);

      if (existing && existing.cost <= nextCost) {
        continue;
      }

      const nextNode: ReachNode = {
        x: tile.x,
        y: tile.y,
        cost: nextCost,
        previousKey: keyFor(current.x, current.y)
      };

      reachable.set(neighborKey, nextNode);
      queue.push(nextNode);
    }
  }

  return reachable;
}

export function buildPath(reachable: Map<string, ReachNode>, target: Point): Point[] {
  const trail: Point[] = [];
  let currentKey: string | null = keyFor(target.x, target.y);

  while (currentKey) {
    const node = reachable.get(currentKey);

    if (!node) {
      break;
    }

    trail.push({ x: node.x, y: node.y });
    currentKey = node.previousKey;
  }

  return trail.reverse();
}
