import type { GameplayBattleState } from './gameplayRuntime';

export function isSetupBattleState(battle: GameplayBattleState | null): boolean {
  return battle?.context.origin === 'setup';
}

export function isWorldEncounterBattleState(battle: GameplayBattleState | null): boolean {
  return battle?.context.origin === 'world-encounter';
}

export function getBattleEncounterId(battle: GameplayBattleState | null): string {
  return battle?.context.encounterId ?? '';
}
