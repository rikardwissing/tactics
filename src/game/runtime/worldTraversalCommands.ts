import type { Point } from '../core/types';
import type {
  GameplayBattleContext,
  WorldEncounterDefinition,
  WorldSessionState,
  WorldTransitionDefinition
} from '../world/types';
import {
  createEncounterSuppressedSession,
  createInteriorTransitionSession,
  createReturnTransitionSession,
  createSpawnTransitionSession
} from './worldSessionCommands';

export type WorldArrivalCommand<TTransition, TEncounter, TNpc> =
  | {
      type: 'transition';
      transition: TTransition;
    }
  | {
      type: 'encounter';
      encounter: TEncounter;
      previousPlayerPosition: Point | null;
    }
  | {
      type: 'hostile-encounter';
      npc: TNpc;
      previousPlayerPosition: Point;
    }
  | {
      type: 'idle';
    };

export interface SelectWorldArrivalCommandOptions<TTransition, TEncounter, TNpc> {
  transition: TTransition | null;
  encounter: TEncounter | null;
  hostileNpc: TNpc | null;
  previousPlayerPosition: Point | null;
  currentPlayerPosition: Point;
}

export interface WorldTransitionPlan {
  nextSession: WorldSessionState | null;
  message: string | null;
}

export interface WorldEncounterStartPlan {
  nextSession: WorldSessionState;
  context: GameplayBattleContext;
}

export function selectWorldArrivalCommand<
  TTransition,
  TEncounter,
  TNpc
>({
  transition,
  encounter,
  hostileNpc,
  previousPlayerPosition,
  currentPlayerPosition
}: SelectWorldArrivalCommandOptions<TTransition, TEncounter, TNpc>): WorldArrivalCommand<TTransition, TEncounter, TNpc> {
  if (transition) {
    return {
      type: 'transition',
      transition
    };
  }

  if (encounter) {
    return {
      type: 'encounter',
      encounter,
      previousPlayerPosition
    };
  }

  if (hostileNpc) {
    return {
      type: 'hostile-encounter',
      npc: hostileNpc,
      previousPlayerPosition: previousPlayerPosition ?? { ...currentPlayerPosition }
    };
  }

  return { type: 'idle' };
}

export function createWorldTransitionPlan(
  session: WorldSessionState,
  transition: Pick<WorldTransitionDefinition, 'targetKind' | 'targetId' | 'targetSpawnId'>,
  options: {
    absolutePosition?: Point | null;
    returnOutdoorPosition?: Point | null;
    areaName: string;
  }
): WorldTransitionPlan {
  if (session.areaKind === 'outdoor' && transition.targetKind === 'interior' && transition.targetId && options.absolutePosition) {
    return {
      nextSession: createInteriorTransitionSession(session, transition, options.absolutePosition),
      message: `${options.areaName} opens before you.`
    };
  }

  if (transition.targetKind === 'return' && options.returnOutdoorPosition) {
    return {
      nextSession: createReturnTransitionSession(session, options.returnOutdoorPosition),
      message: `You return to ${options.areaName}.`
    };
  }

  if (transition.targetKind === 'spawn' && transition.targetSpawnId) {
    return {
      nextSession: createSpawnTransitionSession(session, transition.targetSpawnId),
      message: null
    };
  }

  return {
    nextSession: null,
    message: null
  };
}

export function createWorldEncounterStartPlan(
  session: WorldSessionState,
  encounter: Pick<WorldEncounterDefinition, 'id'>
): WorldEncounterStartPlan {
  return {
    nextSession: createEncounterSuppressedSession(session, encounter.id),
    context: {
      origin: 'world-encounter',
      encounterId: encounter.id,
      setup: null
    }
  };
}
