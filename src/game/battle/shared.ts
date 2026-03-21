import { getInventoryEntries, getItemDefinition, ItemId } from '../core/items';
import { projectTurnOrder } from '../core/combat';
import { BattleUnit, Point, ReachNode, SpriteFacing, TileData, UnitAbility } from '../core/types';
import { getTile, getTraversalNodes, manhattanDistance } from '../core/pathfinding';
import type { MapPropPlacement } from '../levels/types';
import { getOriginalDirectionForVisualDirection, PROP_RENDER_CONFIG } from '../world/rendering';

export interface AutoBattleActionPlan {
  moveTile: TileData;
  ability: UnitAbility;
  target: BattleUnit;
  score: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

export type EnemyBattleTurnPlan =
  | {
      kind: 'attack';
      moveTile: TileData;
      target: BattleUnit;
      score: number;
    }
  | {
      kind: 'approach';
      moveTile: TileData;
      score: number;
    };

export interface BattleTileHighlightStyle {
  fill: number;
  fillAlpha: number;
  lineWidth: number;
  stroke: number;
  strokeAlpha: number;
}

export const BATTLE_INSPECTION_HIGHLIGHT_STYLE: BattleTileHighlightStyle = {
  fill: 0xd9c06d,
  fillAlpha: 0.2,
  lineWidth: 2,
  stroke: 0xf6e6b4,
  strokeAlpha: 0.7
};

export function getBlockedPropPoints(props: readonly MapPropPlacement[]): Point[] {
  return props
    .filter((prop) => PROP_RENDER_CONFIG[prop.assetId].blocksMovement)
    .map((prop) => ({ x: prop.x, y: prop.y }));
}

export function buildBattleTurnQueue(
  units: readonly BattleUnit[],
  activeUnit: BattleUnit | null,
  visibleTurnOrderCount: number
): BattleUnit[] {
  return activeUnit
    ? [activeUnit, ...projectTurnOrder([...units], Math.max(0, visibleTurnOrderCount - 1))]
    : projectTurnOrder([...units], visibleTurnOrderCount);
}

export function getBattleMovementFacing(
  fromPoint: ScreenPoint,
  toPoint: ScreenPoint,
  fallbackFacing: SpriteFacing
): SpriteFacing {
  const deltaX = toPoint.x - fromPoint.x;

  if (Math.abs(deltaX) < 1) {
    return fallbackFacing;
  }

  return deltaX > 0 ? 'right' : 'left';
}

export function getWorldDirectionForFacing(facing: SpriteFacing, rotationStep: number): Point {
  const rightDirection = getOriginalDirectionForVisualDirection({ x: 1, y: 0 }, rotationStep);

  return facing === 'right'
    ? rightDirection
    : { x: -rightDirection.x, y: -rightDirection.y };
}

export function getFacingForWorldDirection(
  direction: Point,
  rotationStep: number,
  fallbackFacing: SpriteFacing
): SpriteFacing {
  const rightDirection = getOriginalDirectionForVisualDirection({ x: 1, y: 0 }, rotationStep);
  const projection = direction.x * rightDirection.x + direction.y * rightDirection.y;

  if (projection === 0) {
    return fallbackFacing;
  }

  return projection > 0 ? 'right' : 'left';
}

export function rotateFacingForBoardRotation(
  facing: SpriteFacing,
  fromRotationStep: number,
  toRotationStep: number
): SpriteFacing {
  const worldDirection = getWorldDirectionForFacing(facing, fromRotationStep);
  return getFacingForWorldDirection(worldDirection, toRotationStep, facing);
}

export function shouldShowBattleActiveUnitFocus(
  phase: string,
  animatingPhase: string,
  completePhase: string
): boolean {
  return phase !== animatingPhase && phase !== completePhase;
}

export function shouldShowBattleActiveUnitAura(
  phase: string,
  completePhase: string
): boolean {
  return phase !== completePhase;
}

export function getInitialBattleFacing(
  unit: BattleUnit,
  units: readonly BattleUnit[],
  map: readonly TileData[],
  getUnitGroundPoint: (tile: TileData) => ScreenPoint,
  defaultFacing: SpriteFacing
): SpriteFacing {
  const unitTile = getTile(map as TileData[], unit.x, unit.y);

  if (!unitTile) {
    return defaultFacing;
  }

  const unitPoint = getUnitGroundPoint(unitTile);
  let bestEnemy:
    | {
        tacticalDistance: number;
        screenDistance: number;
        facing: SpriteFacing;
      }
    | null = null;

  for (const candidate of units) {
    if (!candidate.alive || candidate.team === unit.team || candidate.id === unit.id) {
      continue;
    }

    const candidateTile = getTile(map as TileData[], candidate.x, candidate.y);

    if (!candidateTile) {
      continue;
    }

    const candidatePoint = getUnitGroundPoint(candidateTile);
    const tacticalDistance = manhattanDistance(unit, candidate);
    const dx = candidatePoint.x - unitPoint.x;
    const dy = candidatePoint.y - unitPoint.y;
    const screenDistance = dx * dx + dy * dy;
    const facing = getBattleMovementFacing(unitPoint, candidatePoint, defaultFacing);

    if (
      !bestEnemy ||
      tacticalDistance < bestEnemy.tacticalDistance ||
      (tacticalDistance === bestEnemy.tacticalDistance && screenDistance < bestEnemy.screenDistance)
    ) {
      bestEnemy = { tacticalDistance, screenDistance, facing };
    }
  }

  return bestEnemy?.facing ?? defaultFacing;
}

export function getBasicAttackAbility(unit: BattleUnit): UnitAbility {
  return (
    unit.abilities.find((ability) => ability.id === 'attack') ??
    unit.abilities.find((ability) => ability.kind === 'attack') ??
    unit.abilities[0]
  );
}

export function isAbilityInRange(
  attacker: BattleUnit,
  target: BattleUnit,
  ability: UnitAbility
): boolean {
  const distance = manhattanDistance(attacker, target);
  return distance >= ability.rangeMin && distance <= ability.rangeMax;
}

export function getTargetableUnitsForAbility(
  unit: BattleUnit,
  units: readonly BattleUnit[],
  ability: UnitAbility
): BattleUnit[] {
  return units.filter((target) => {
    if (!target.alive) {
      return false;
    }

    if (ability.target === 'enemy' && target.team === unit.team) {
      return false;
    }

    if (ability.target === 'ally' && target.team !== unit.team) {
      return false;
    }

    if (ability.kind === 'steal' && !target.dropItemId) {
      return false;
    }

    return isAbilityInRange(unit, target, ability);
  });
}

export function getTargetableUnitsForItem(
  unit: BattleUnit,
  units: readonly BattleUnit[],
  itemId: ItemId
): BattleUnit[] {
  const item = getItemDefinition(itemId);

  return units.filter((target) => {
    if (!target.alive) {
      return false;
    }

    if (manhattanDistance(unit, target) > 1) {
      return false;
    }

    if (item.effect.kind === 'heal' || item.effect.kind === 'ct') {
      return target.team === unit.team;
    }

    return true;
  });
}

export function chooseAutoBattleItem(
  actor: BattleUnit,
  inventory: Partial<Record<ItemId, number>>
): ItemId | null {
  const entries = getInventoryEntries(inventory);

  for (const entry of entries) {
    const item = getItemDefinition(entry.itemId);

    if (
      item.effect.kind === 'heal' &&
      actor.hp <= Math.floor(actor.maxHp * 0.55) &&
      actor.hp < actor.maxHp
    ) {
      return entry.itemId;
    }
  }

  return null;
}

export function chooseAutoBattleActionPlan(
  actor: BattleUnit,
  units: readonly BattleUnit[],
  map: readonly TileData[],
  blockedPoints: readonly Point[],
  turnMoveUsed: boolean
): AutoBattleActionPlan | null {
  const reachable = turnMoveUsed
    ? new Map<string, ReachNode>([[`${actor.x},${actor.y}`, { x: actor.x, y: actor.y, cost: 0, previousKey: null }]])
    : getTraversalNodes(map as TileData[], actor, actor.move, [
        ...blockedPoints.filter((point) => point.x !== actor.x || point.y !== actor.y),
        ...units
          .filter((unit) => unit.alive && unit.id !== actor.id)
          .map((unit) => ({ x: unit.x, y: unit.y }))
      ]);
  const allies = units.filter((unit) => unit.alive && unit.team === actor.team && unit.id !== actor.id);
  const enemies = units.filter((unit) => unit.alive && unit.team !== actor.team);
  let bestPlan: AutoBattleActionPlan | null = null;

  for (const node of reachable.values()) {
    const tile = getTile(map as TileData[], node.x, node.y);

    if (!tile) {
      continue;
    }

    const simulatedActor = { ...actor, x: tile.x, y: tile.y };

    for (const ability of actor.abilities) {
      const targets = ability.target === 'ally' ? allies : enemies;

      for (const target of targets) {
        if (ability.kind === 'steal' && !target.dropItemId) {
          continue;
        }

        const distance = manhattanDistance(simulatedActor, target);

        if (distance < ability.rangeMin || distance > ability.rangeMax) {
          continue;
        }

        let score = 0;

        switch (ability.kind) {
          case 'attack': {
            score =
              (target.maxHp - target.hp) * 2 +
              Math.max(0, tile.height - (getTile(map as TileData[], target.x, target.y)?.height ?? 0)) * 8 +
              (target.hp <= actor.attack + (ability.powerModifier ?? 0) ? 40 : 0) -
              distance * 3;

            if (ability.splashRadius && ability.splashDamageMultiplier) {
              const clusteredTargets = enemies.filter(
                (candidate) =>
                  candidate.id !== target.id &&
                  manhattanDistance(candidate, target) <= ability.splashRadius!
              );

              score += clusteredTargets.length * Math.round(18 * ability.splashDamageMultiplier);
            }

            if (ability.counterable === false) {
              score += 6;
            }

            break;
          }
          case 'heal': {
            const missingHp = target.maxHp - target.hp;

            if (missingHp <= 0) {
              continue;
            }

            score =
              missingHp * 2 +
              (target.hp <= Math.floor(target.maxHp * 0.4) ? 30 : 0) -
              distance * 2;
            break;
          }
          case 'steal':
            score = 55 - distance * 2 + ((target.dropQuantity ?? 1) - 1) * 6;
            break;
          default:
            break;
        }

        if (!bestPlan || score > bestPlan.score) {
          bestPlan = { moveTile: tile, ability, target, score };
        }
      }
    }
  }

  return bestPlan;
}

export function chooseAutoBattleMoveTile(
  actor: BattleUnit,
  units: readonly BattleUnit[],
  map: readonly TileData[],
  blockedPoints: readonly Point[]
): TileData | null {
  const reachable = getTraversalNodes(map as TileData[], actor, actor.move, [
    ...blockedPoints.filter((point) => point.x !== actor.x || point.y !== actor.y),
    ...units
      .filter((unit) => unit.alive && unit.id !== actor.id)
      .map((unit) => ({ x: unit.x, y: unit.y }))
  ]);
  const enemies = units.filter((unit) => unit.alive && unit.team !== actor.team);
  let bestApproach: { tile: TileData; score: number } | null = null;

  for (const node of reachable.values()) {
    const tile = getTile(map as TileData[], node.x, node.y);

    if (!tile) {
      continue;
    }

    const nearestDistance = Math.min(...enemies.map((enemy) => manhattanDistance(node, enemy)));
    const score = nearestDistance * 20 - tile.height * 4;

    if (!bestApproach || score < bestApproach.score) {
      bestApproach = { tile, score };
    }
  }

  return bestApproach?.tile ?? null;
}

export function chooseEnemyBattleTurnPlan(
  actor: BattleUnit,
  units: readonly BattleUnit[],
  map: readonly TileData[],
  blockedPoints: readonly Point[]
): EnemyBattleTurnPlan | null {
  const reachable = getTraversalNodes(map as TileData[], actor, actor.move, [
    ...blockedPoints.filter((point) => point.x !== actor.x || point.y !== actor.y),
    ...units
      .filter((unit) => unit.alive && unit.id !== actor.id)
      .map((unit) => ({ x: unit.x, y: unit.y }))
  ]);
  const enemies = units.filter((unit) => unit.alive && unit.team !== actor.team);
  let bestAttackPlan: Extract<EnemyBattleTurnPlan, { kind: 'attack' }> | null = null;

  for (const node of reachable.values()) {
    const tile = getTile(map as TileData[], node.x, node.y);

    if (!tile) {
      continue;
    }

    for (const target of enemies) {
      const distance = manhattanDistance(node, target);

      if (distance < actor.rangeMin || distance > actor.rangeMax) {
        continue;
      }

      const score =
        (target.maxHp - target.hp) * 2 +
        Math.max(0, tile.height - (getTile(map as TileData[], target.x, target.y)?.height ?? 0)) * 8 +
        (target.hp <= actor.attack ? 40 : 0) -
        distance * 3;

      if (!bestAttackPlan || score > bestAttackPlan.score) {
        bestAttackPlan = {
          kind: 'attack',
          moveTile: tile,
          target,
          score
        };
      }
    }
  }

  if (bestAttackPlan) {
    return bestAttackPlan;
  }

  let bestApproachPlan: Extract<EnemyBattleTurnPlan, { kind: 'approach' }> | null = null;

  for (const node of reachable.values()) {
    const tile = getTile(map as TileData[], node.x, node.y);

    if (!tile) {
      continue;
    }

    const nearestDistance = Math.min(...enemies.map((enemy) => manhattanDistance(node, enemy)));
    const score = nearestDistance * 20 - tile.height * 4;

    if (!bestApproachPlan || score < bestApproachPlan.score) {
      bestApproachPlan = {
        kind: 'approach',
        moveTile: tile,
        score
      };
    }
  }

  return bestApproachPlan;
}
