import type { BattleSetup } from '../battleSetup';
import {
  cloneBattleContext,
  cloneRuntimeBattleStartData,
  type GameplayBattleState
} from './gameplayRuntime';
import { getBattleEncounterId, isSetupBattleState } from './battleSelectors';

export type WorldBattleFlowResult = 'victory' | 'defeat';
export type WorldBattleOverlayResult = 'Victory' | 'Defeat';
export type WorldBattleResultAction = 'retry' | 'return';

export interface CompletedWorldBattlePlan {
  overlayResult: WorldBattleOverlayResult;
  clearEncounterId: string | null;
  audioCue: 'victory' | 'defeat';
}

export type WorldBattleCommandPlan =
  | {
      type: 'restart-battle';
      context: GameplayBattleState['context'];
      runtimeBattle: GameplayBattleState['runtimeBattle'];
    }
  | {
      type: 'return-to-setup';
      setup: BattleSetup;
    }
  | {
      type: 'return-to-world';
      message: string;
    };

export function resolveCompletedWorldBattlePlan(
  battle: GameplayBattleState | null,
  result: WorldBattleFlowResult
): CompletedWorldBattlePlan | null {
  if (!battle) {
    return null;
  }

  return {
    overlayResult: result === 'victory' ? 'Victory' : 'Defeat',
    clearEncounterId: result === 'victory' ? getBattleEncounterId(battle) : null,
    audioCue: result === 'victory' && getBattleEncounterId(battle) ? 'victory' : 'defeat'
  };
}

export function createRestartWorldBattlePlan(
  battle: GameplayBattleState | null
): Extract<WorldBattleCommandPlan, { type: 'restart-battle' }> | null {
  if (!battle) {
    return null;
  }

  return {
    type: 'restart-battle',
    context: cloneBattleContext(battle.context),
    runtimeBattle: cloneRuntimeBattleStartData(battle.runtimeBattle)
  };
}

function resolveWorldBattleReturnMessage(result: WorldBattleOverlayResult): string {
  return result === 'Victory'
    ? 'The skirmish breaks and the road opens again.'
    : 'The clash dissolves and both sides pull back to the road.';
}

export function createWorldBattleExitPlan(
  battle: GameplayBattleState | null,
  options?: {
    result?: WorldBattleOverlayResult;
    cancelledMessage?: string;
  }
): Exclude<WorldBattleCommandPlan, { type: 'restart-battle' }> | null {
  if (!battle) {
    return null;
  }

  if (isSetupBattleState(battle)) {
    const setup = battle.context.setup;
    if (!setup) {
      return null;
    }

    return {
      type: 'return-to-setup',
      setup: {
        levelId: setup.levelId,
        playerAssignments: { ...setup.playerAssignments }
      }
    };
  }

  return {
    type: 'return-to-world',
    message: options?.result
      ? resolveWorldBattleReturnMessage(options.result)
      : options?.cancelledMessage ?? 'The skirmish disperses and the road opens again.'
  };
}

export function resolveWorldBattleResultActionPlan(
  battle: GameplayBattleState | null,
  result: WorldBattleOverlayResult,
  action: WorldBattleResultAction
): WorldBattleCommandPlan | null {
  if (action === 'retry') {
    return createRestartWorldBattlePlan(battle);
  }

  return createWorldBattleExitPlan(battle, { result });
}
