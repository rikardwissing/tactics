import type { BattleSetup } from '../battleSetup';
import type { BattleRuntimeState } from '../battle/runtime';
import type { RuntimeBattleStartData } from '../sceneSession';
import type {
  GameplayBattleContext,
  GameplayMode,
  WorldBattleSessionState,
  WorldSessionState
} from '../world/types';

export interface GameplayBattleState extends BattleRuntimeState {
  context: GameplayBattleContext;
  runtimeBattle: RuntimeBattleStartData;
  sourcePreviewActive: boolean;
}

export interface GameplayRuntimeState {
  mode: GameplayMode;
  session: WorldSessionState;
  pendingSetupBattle: BattleSetup | null;
  battle: GameplayBattleState | null;
}

export function cloneBattleSetup(setup: BattleSetup | null): BattleSetup | null {
  return setup
    ? {
        levelId: setup.levelId,
        playerAssignments: { ...setup.playerAssignments }
      }
    : null;
}

export function cloneBattleContext(context: GameplayBattleContext): GameplayBattleContext {
  return {
    origin: context.origin,
    encounterId: context.encounterId,
    setup: cloneBattleSetup(context.setup)
  };
}

export function cloneRuntimeBattleStartData(runtimeBattle: RuntimeBattleStartData): RuntimeBattleStartData {
  return {
    ...runtimeBattle,
    units: runtimeBattle.units.map((unit) => ({ ...unit })),
    camera: {
      ...runtimeBattle.camera,
      origin: { ...runtimeBattle.camera.origin }
    },
    seamlessEntry: runtimeBattle.seamlessEntry
      ? {
          ...runtimeBattle.seamlessEntry,
          arenaBounds: { ...runtimeBattle.seamlessEntry.arenaBounds },
          introEntries: runtimeBattle.seamlessEntry.introEntries.map((entry) => ({
            ...entry,
            start: { ...entry.start },
            target: { ...entry.target }
          })),
          preservedLightSources: runtimeBattle.seamlessEntry.preservedLightSources.map((source) => ({ ...source }))
        }
      : undefined
  };
}

export function createGameplayBattleState(
  context: GameplayBattleContext,
  runtimeBattle: RuntimeBattleStartData
): GameplayBattleState {
  return {
    context: cloneBattleContext(context),
    runtimeBattle: cloneRuntimeBattleStartData(runtimeBattle),
    sourcePreviewActive: true,
    units: runtimeBattle.units.map((unit) => ({ ...unit })),
    activeUnitId: null,
    selectedAbilityId: null,
    selectedItemId: null,
    turnMoveUsed: false,
    turnActionUsed: false,
    pendingMoveUndo: null,
    autoBattleEnabled: false
  };
}

export function createGameplayBattleSessionState(
  context: GameplayBattleContext,
  runtimeBattle: RuntimeBattleStartData
): WorldBattleSessionState {
  return {
    context: cloneBattleContext(context),
    runtimeBattle: cloneRuntimeBattleStartData(runtimeBattle)
  };
}

export function createGameplayRuntimeState(
  session: WorldSessionState,
  options?: {
    pendingSetupBattle?: BattleSetup | null;
    mode?: GameplayMode;
  }
): GameplayRuntimeState {
  const activeBattle = session.activeBattle
    ? createGameplayBattleState(session.activeBattle.context, session.activeBattle.runtimeBattle)
    : null;

  return {
    mode: options?.mode ?? (activeBattle ? 'battle' : 'exploration'),
    session,
    pendingSetupBattle: cloneBattleSetup(options?.pendingSetupBattle ?? null),
    battle: activeBattle
  };
}
