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
