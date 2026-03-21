import type { ItemId } from '../core/items';
import { pickNextActor } from '../core/combat';
import type { BattleUnit, Point, TileData, UnitAbility } from '../core/types';
import type { MapPropPlacement } from '../levels/types';
import {
  buildBattleTurnQueue,
  chooseEnemyBattleTurnPlan,
  getBasicAttackAbility,
  getBlockedPropPoints,
  getTargetableUnitsForAbility,
  getTargetableUnitsForItem
} from './shared';
import type {
  BattleMoveUndoState,
  BattleRuntimeOutcome,
  BattleRuntimeState,
  BattleRuntimeTurnState,
  BattleTurnStartResult
} from './runtime';

export class BattleRuntimeController {
  getOutcome(units: readonly BattleUnit[]): BattleRuntimeOutcome {
    const livingPlayers = units.filter((unit) => unit.alive && unit.team === 'player').length;
    const livingEnemies = units.filter((unit) => unit.alive && unit.team === 'enemy').length;

    if (livingPlayers === 0) {
      return 'Defeat';
    }

    if (livingEnemies === 0) {
      return 'Victory';
    }

    return null;
  }

  clearTurnState(
    state: Pick<
      BattleRuntimeState,
      | 'selectedAbilityId'
      | 'selectedItemId'
      | 'turnMoveUsed'
      | 'turnActionUsed'
      | 'pendingMoveUndo'
      | 'autoBattleEnabled'
    >
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: null,
      selectedAbilityId: null,
      selectedItemId: null,
      turnMoveUsed: false,
      turnActionUsed: false,
      pendingMoveUndo: null,
      autoBattleEnabled: state.autoBattleEnabled
    };
  }

  startMoveSelection(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: state.activeUnitId,
      selectedAbilityId: null,
      selectedItemId: null,
      turnMoveUsed: state.turnMoveUsed,
      turnActionUsed: state.turnActionUsed,
      pendingMoveUndo: state.pendingMoveUndo,
      autoBattleEnabled: state.autoBattleEnabled
    };
  }

  startAbilitySelection(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>
  ): BattleRuntimeTurnState {
    return this.startMoveSelection(state);
  }

  startItemSelection(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>
  ): BattleRuntimeTurnState {
    return this.startMoveSelection(state);
  }

  selectAbility(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>,
    abilityId: string
  ): BattleRuntimeTurnState {
    return {
      ...this.startMoveSelection(state),
      selectedAbilityId: abilityId
    };
  }

  selectItem(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>,
    itemId: ItemId
  ): BattleRuntimeTurnState {
    return {
      ...this.startMoveSelection(state),
      selectedItemId: itemId
    };
  }

  clearSelection(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>
  ): BattleRuntimeTurnState {
    return this.startMoveSelection(state);
  }

  commitMove(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnActionUsed' | 'autoBattleEnabled'>,
    moveUndo: BattleMoveUndoState
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: state.activeUnitId,
      selectedAbilityId: null,
      selectedItemId: null,
      turnMoveUsed: true,
      turnActionUsed: state.turnActionUsed,
      pendingMoveUndo: moveUndo,
      autoBattleEnabled: state.autoBattleEnabled
    };
  }

  undoMove(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnActionUsed' | 'autoBattleEnabled'>
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: state.activeUnitId,
      selectedAbilityId: null,
      selectedItemId: null,
      turnMoveUsed: false,
      turnActionUsed: state.turnActionUsed,
      pendingMoveUndo: null,
      autoBattleEnabled: state.autoBattleEnabled
    };
  }

  commitAction(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>,
    options?: { abilityId?: string; itemId?: ItemId | null }
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: state.activeUnitId,
      selectedAbilityId: options?.abilityId ?? null,
      selectedItemId: options?.itemId ?? null,
      turnMoveUsed: state.turnMoveUsed,
      turnActionUsed: true,
      pendingMoveUndo: state.pendingMoveUndo,
      autoBattleEnabled: state.autoBattleEnabled
    };
  }

  finishPlayerCommand(
    state: Pick<BattleRuntimeState, 'activeUnitId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'>
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: state.activeUnitId,
      selectedAbilityId: null,
      selectedItemId: null,
      turnMoveUsed: state.turnMoveUsed,
      turnActionUsed: state.turnActionUsed,
      pendingMoveUndo: state.pendingMoveUndo,
      autoBattleEnabled: state.autoBattleEnabled
    };
  }

  toggleAutoBattle(
    state: Pick<
      BattleRuntimeState,
      'activeUnitId' | 'selectedAbilityId' | 'selectedItemId' | 'turnMoveUsed' | 'turnActionUsed' | 'pendingMoveUndo' | 'autoBattleEnabled'
    >
  ): BattleRuntimeTurnState {
    return {
      activeUnitId: state.activeUnitId,
      selectedAbilityId: state.selectedAbilityId,
      selectedItemId: state.selectedItemId,
      turnMoveUsed: state.turnMoveUsed,
      turnActionUsed: state.turnActionUsed,
      pendingMoveUndo: state.pendingMoveUndo,
      autoBattleEnabled: !state.autoBattleEnabled
    };
  }

  beginNextTurn(state: BattleRuntimeState): BattleTurnStartResult {
    const outcome = this.getOutcome(state.units);

    if (outcome) {
      return {
        actor: null,
        outcome,
        state: {
          activeUnitId: null,
          selectedAbilityId: null,
          selectedItemId: null,
          turnMoveUsed: false,
          turnActionUsed: false,
          pendingMoveUndo: null,
          autoBattleEnabled: state.autoBattleEnabled
        }
      };
    }

    const actor = pickNextActor(state.units);

    return {
      actor,
      outcome: null,
      state: {
        activeUnitId: actor.id,
        selectedAbilityId: null,
        selectedItemId: null,
        turnMoveUsed: false,
        turnActionUsed: false,
        pendingMoveUndo: null,
        autoBattleEnabled: state.autoBattleEnabled
      }
    };
  }

  buildTurnQueue(state: Pick<BattleRuntimeState, 'units' | 'activeUnitId'>, visibleTurnOrderCount: number): BattleUnit[] {
    const activeUnit = this.getActiveUnit(state);
    return buildBattleTurnQueue(state.units, activeUnit, visibleTurnOrderCount);
  }

  getActiveUnit(state: Pick<BattleRuntimeState, 'units' | 'activeUnitId'>): BattleUnit | null {
    return state.units.find((unit) => unit.id === state.activeUnitId) ?? null;
  }

  getSelectedAbility(state: Pick<BattleRuntimeState, 'units' | 'activeUnitId' | 'selectedAbilityId'>): UnitAbility | null {
    const activeUnit = this.getActiveUnit(state);

    if (!activeUnit || !state.selectedAbilityId) {
      return null;
    }

    return activeUnit.abilities.find((ability) => ability.id === state.selectedAbilityId) ?? null;
  }

  getTargetableUnitsForAbility(state: Pick<BattleRuntimeState, 'units'>, unit: BattleUnit, ability: UnitAbility): BattleUnit[] {
    return getTargetableUnitsForAbility(unit, state.units, ability);
  }

  getTargetableUnitsForItem(state: Pick<BattleRuntimeState, 'units'>, unit: BattleUnit, itemId: ItemId): BattleUnit[] {
    return getTargetableUnitsForItem(unit, state.units, itemId);
  }

  getBasicAttackAbility(unit: BattleUnit): UnitAbility {
    return getBasicAttackAbility(unit);
  }

  getBlockedPropPoints(props: readonly MapPropPlacement[]): Point[] {
    return getBlockedPropPoints(props);
  }

  chooseEnemyPlan(
    state: Pick<BattleRuntimeState, 'units'>,
    actor: BattleUnit,
    map: readonly TileData[],
    props: readonly MapPropPlacement[]
  ) {
    return chooseEnemyBattleTurnPlan(actor, state.units, map, this.getBlockedPropPoints(props));
  }
}
