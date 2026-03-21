import type { ItemId } from '../core/items';
import type { BattleUnit, Point, SpriteFacing } from '../core/types';

export interface BattleMoveUndoChestState {
  chestId: string;
  itemId: ItemId;
  quantity: number;
}

export interface BattleMoveUndoState {
  unitId: string;
  origin: Point;
  path: Point[];
  facing: SpriteFacing;
  openedChest?: BattleMoveUndoChestState;
}

export interface BattleRuntimeTurnState {
  activeUnitId: string | null;
  selectedAbilityId: string | null;
  selectedItemId: ItemId | null;
  turnMoveUsed: boolean;
  turnActionUsed: boolean;
  pendingMoveUndo: BattleMoveUndoState | null;
  autoBattleEnabled: boolean;
}

export interface BattleRuntimeState extends BattleRuntimeTurnState {
  units: BattleUnit[];
}

export type BattleRuntimeOutcome = 'Victory' | 'Defeat' | null;

export interface BattleTurnStartResult {
  actor: BattleUnit | null;
  outcome: BattleRuntimeOutcome;
  state: BattleRuntimeTurnState;
}

export function createEmptyBattleRuntimeTurnState(): BattleRuntimeTurnState {
  return {
    activeUnitId: null,
    selectedAbilityId: null,
    selectedItemId: null,
    turnMoveUsed: false,
    turnActionUsed: false,
    pendingMoveUndo: null,
    autoBattleEnabled: false
  };
}
