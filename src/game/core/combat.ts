import { BattleUnit, TileData } from './types';
import { getTile, manhattanDistance } from './pathfinding';

interface DamageCalculationOptions {
  canCrit?: boolean;
  damageMultiplier?: number;
  minimumDamage?: number;
}

export function pickNextActor(units: BattleUnit[]): BattleUnit {
  const living = units.filter((unit) => unit.alive);

  if (living.length === 0) {
    throw new Error('Cannot select an actor without living units.');
  }

  while (true) {
    for (const unit of living) {
      unit.ct += unit.speed;
    }

    const ready = living
      .filter((unit) => unit.ct >= 100)
      .sort((left, right) => {
        if (right.ct !== left.ct) {
          return right.ct - left.ct;
        }

        return right.speed - left.speed;
      });

    if (ready.length > 0) {
      ready[0].ct -= 100;
      return ready[0];
    }
  }
}

export function projectTurnOrder(units: BattleUnit[], count: number): BattleUnit[] {
  const simulated = units
    .filter((unit) => unit.alive)
    .map((unit) => ({ ...unit }));
  const order: BattleUnit[] = [];

  while (order.length < count && simulated.length > 0) {
    order.push(pickNextActor(simulated));
  }

  return order;
}

export function getAttackableUnits(
  attacker: BattleUnit,
  units: BattleUnit[]
): BattleUnit[] {
  return units.filter((unit) => {
    if (!unit.alive || unit.team === attacker.team) {
      return false;
    }

    return isTargetInRange(attacker, unit);
  });
}

export function isTargetInRange(attacker: BattleUnit, target: { x: number; y: number }): boolean {
  const distance = manhattanDistance(attacker, target);
  return distance >= attacker.rangeMin && distance <= attacker.rangeMax;
}

export function calculateDamage(
  attacker: BattleUnit,
  defender: BattleUnit,
  map: TileData[],
  randomValue: number,
  options: DamageCalculationOptions = {}
): { amount: number; critical: boolean } {
  const attackerTile = getTile(map, attacker.x, attacker.y);
  const defenderTile = getTile(map, defender.x, defender.y);
  const attackerHeight = attackerTile?.height ?? 0;
  const defenderHeight = defenderTile?.height ?? 0;
  const heightBonus = Math.max(0, attackerHeight - defenderHeight) * 3;
  const heightPenalty = Math.max(0, defenderHeight - attackerHeight) * 2;
  const terrainMitigation = defenderTile?.terrain === 'sanctum' ? 3 : defenderTile?.terrain === 'stone' ? 2 : 0;
  const baseDamage =
    attacker.attack +
    heightBonus -
    heightPenalty -
    defender.defense -
    terrainMitigation +
    Math.round(randomValue * 6);
  const critical = (options.canCrit ?? true) && randomValue > 0.89;
  const amount = Math.max(
    options.minimumDamage ?? 10,
    Math.round(baseDamage * (critical ? 1.35 : 1) * (options.damageMultiplier ?? 1))
  );

  return { amount, critical };
}
