import {
  createBattleAbilityDetailBody,
  createBattleCommandMenuEntries,
  createBattleCommandMenuPanelsFromState,
  createBattleItemDetailBody,
  createBattleMoveDetailBody
} from '../battle/actionMenuPanels';
import {
  createWorldSceneHudViewModel,
  resolveDetailPortraitDescriptor,
  resolveCombatUnitBodyMode,
  type ActorPortraitDescriptor,
  type BattleHudViewModel,
  type WorldSceneHudViewModelOptions
} from '../battle/hudShared';
import { getInventoryEntries, getItemDefinition, type ItemId } from '../core/items';
import type { BattleUnit, SpriteFacing, UnitAbility } from '../core/types';
import type { GameplayBattleState } from './gameplayRuntime';
import type { ActionMenuEntryDescriptor, ActionMenuPanelDescriptor } from '../scenes/components/BattleActionMenuStack';
import { isSetupBattleState, isWorldEncounterBattleState } from './battleSelectors';

export type WorldUiInspection = WorldSceneHudViewModelOptions['inspection'];

export interface SelectWorldHudViewModelOptions
  extends Omit<WorldSceneHudViewModelOptions, 'combatBodyMode'> {
  phase: string;
}

export interface BattleCommandSubmenuEntry {
  label: string;
  enabled: boolean;
  abilityId?: string;
  itemId?: ItemId;
}

export interface BattleCommandMenuState {
  rootEntries: ActionMenuEntryDescriptor[];
  submenuEntries: BattleCommandSubmenuEntry[];
  panels: ActionMenuPanelDescriptor[];
}

export interface SelectWorldDetailPanelStateOptions {
  inspection: WorldUiInspection;
  currentSelectionKey: string | null;
  currentAlpha: number;
  defaultFacing: SpriteFacing;
  getActorFacing: (id: string) => SpriteFacing | null;
}

export interface WorldDetailPanelState {
  selectionKey: string | null;
  selectionChanged: boolean;
  shouldAnimate: boolean;
  showDetailPanel: boolean;
  hasHealthBar: boolean;
  portraitDescriptor: ActorPortraitDescriptor | null;
}

export interface WorldBattleResultPresentation {
  isWorldEncounterBattle: boolean;
  isSetupBattle: boolean;
}

export interface SelectBattleCommandMenuStateOptions {
  phase: string;
  activeUnit: BattleUnit | null;
  turnMoveUsed: boolean;
  turnActionUsed: boolean;
  canUndoMove: boolean;
  selectedAbility: UnitAbility | null;
  selectedItemId: ItemId | null;
  getBattleUnitInventory: (unit: BattleUnit) => Partial<Record<ItemId, number>>;
  getTargetableUnitsForAbility: (unit: BattleUnit, ability: UnitAbility) => readonly BattleUnit[];
  getTargetableUnitsForItem: (unit: BattleUnit, itemId: ItemId) => readonly BattleUnit[];
}

export function selectWorldHudViewModel({
  phase,
  ...options
}: SelectWorldHudViewModelOptions): BattleHudViewModel {
  return createWorldSceneHudViewModel({
    ...options,
    combatBodyMode: resolveCombatUnitBodyMode({
      isMove: phase === 'battle-player-move',
      isItems: phase === 'battle-player-items' || phase === 'battle-player-item-action',
      isAbilities: phase === 'battle-player-abilities' || phase === 'battle-player-action'
    })
  });
}

export function selectWorldDetailSelectionKey(inspection: WorldUiInspection): string | null {
  switch (inspection.kind) {
    case 'battle-unit':
      return `battle-unit:${inspection.unit.id}`;
    case 'npc':
      return `npc:${inspection.npc.id}`;
    case 'tile':
      return `tile:${inspection.tile.x},${inspection.tile.y}`;
    case 'mission':
    default:
      return null;
  }
}

export function selectWorldHudPortraitDescriptor({
  inspection,
  defaultFacing,
  getActorFacing
}: Pick<SelectWorldDetailPanelStateOptions, 'inspection' | 'defaultFacing' | 'getActorFacing'>): ActorPortraitDescriptor | null {
  switch (inspection.kind) {
    case 'battle-unit':
      return resolveDetailPortraitDescriptor({
        unit: {
          spriteKey: inspection.unit.spriteKey,
          facing: getActorFacing(inspection.unit.id) ?? defaultFacing
        }
      });
    case 'npc':
      return resolveDetailPortraitDescriptor({
        npc: {
          spriteKey: inspection.npc.spriteKey,
          facing: getActorFacing(inspection.npc.id) ?? defaultFacing
        }
      });
    case 'tile':
      return resolveDetailPortraitDescriptor({
        tile: inspection.tile,
        hasChest: false,
        chestOpened: false,
        propAssetId: inspection.prop?.assetId ?? null
      });
    case 'mission':
    default:
      return null;
  }
}

export function selectWorldDetailPanelState({
  inspection,
  currentSelectionKey,
  currentAlpha,
  defaultFacing,
  getActorFacing
}: SelectWorldDetailPanelStateOptions): WorldDetailPanelState {
  const selectionKey = selectWorldDetailSelectionKey(inspection);
  const selectionChanged = currentSelectionKey !== selectionKey;
  const showDetailPanel = inspection.kind !== 'mission';

  return {
    selectionKey,
    selectionChanged,
    shouldAnimate: showDetailPanel && (selectionChanged || currentAlpha <= 0.01),
    showDetailPanel,
    hasHealthBar: inspection.kind === 'battle-unit',
    portraitDescriptor: selectWorldHudPortraitDescriptor({
      inspection,
      defaultFacing,
      getActorFacing
    })
  };
}

function selectBattleCommandSubmenuEntries({
  phase,
  activeUnit,
  getBattleUnitInventory,
  getTargetableUnitsForAbility,
  getTargetableUnitsForItem
}: Pick<
  SelectBattleCommandMenuStateOptions,
  | 'phase'
  | 'activeUnit'
  | 'getBattleUnitInventory'
  | 'getTargetableUnitsForAbility'
  | 'getTargetableUnitsForItem'
>): BattleCommandSubmenuEntry[] {
  if (!activeUnit || activeUnit.team !== 'player') {
    return [];
  }

  if (phase === 'battle-player-abilities' || phase === 'battle-player-action') {
    return activeUnit.abilities.map((ability) => ({
      label: ability.name,
      enabled: getTargetableUnitsForAbility(activeUnit, ability).length > 0,
      abilityId: ability.id
    }));
  }

  if (phase === 'battle-player-items' || phase === 'battle-player-item-action') {
    return getInventoryEntries(getBattleUnitInventory(activeUnit)).map((entry) => ({
      label: `${getItemDefinition(entry.itemId).name} x${entry.count}`,
      enabled: getTargetableUnitsForItem(activeUnit, entry.itemId).length > 0,
      itemId: entry.itemId
    }));
  }

  return [];
}

export function selectBattleCommandMenuState({
  phase,
  activeUnit,
  turnMoveUsed,
  turnActionUsed,
  canUndoMove,
  selectedAbility,
  selectedItemId,
  getBattleUnitInventory,
  getTargetableUnitsForAbility,
  getTargetableUnitsForItem
}: SelectBattleCommandMenuStateOptions): BattleCommandMenuState {
  if (!activeUnit || activeUnit.team !== 'player' || !activeUnit.alive) {
    return {
      rootEntries: [],
      submenuEntries: [],
      panels: []
    };
  }

  const inventoryEntries = getInventoryEntries(getBattleUnitInventory(activeUnit));
  const rootEntries = createBattleCommandMenuEntries({
    canUndoMove,
    turnMoveUsed,
    turnActionUsed,
    hasAbilities: activeUnit.abilities.length > 0,
    hasItems: inventoryEntries.length > 0
  });
  const submenuEntries = selectBattleCommandSubmenuEntries({
    phase,
    activeUnit,
    getBattleUnitInventory,
    getTargetableUnitsForAbility,
    getTargetableUnitsForItem
  });

  return {
    rootEntries,
    submenuEntries,
    panels: createBattleCommandMenuPanelsFromState({
      phase,
      rootPanelId: 'battle-command-list',
      rootTitle: activeUnit.name,
      canUndoMove,
      turnMoveUsed,
      turnActionUsed,
      hasAbilities: activeUnit.abilities.length > 0,
      hasItems: inventoryEntries.length > 0,
      selectedAbilityId: selectedAbility?.id ?? null,
      selectedItemId,
      movePanelId: 'battle-move-detail',
      moveDetailBody: createBattleMoveDetailBody(
        activeUnit.move,
        'open ground',
        turnMoveUsed,
        'Movement is already spent this turn.',
        'Select a reachable tile on the field.'
      ),
      abilityListPanelId: 'battle-ability-list',
      abilityEntries: submenuEntries.map((entry) => ({
        id: entry.abilityId ?? '',
        label: entry.label,
        enabled: entry.enabled
      })),
      abilityDetailPanelId: 'battle-ability-detail',
      abilityDetail: selectedAbility
        ? {
            title: selectedAbility.name,
            body: createBattleAbilityDetailBody(selectedAbility)
          }
        : null,
      itemListPanelId: 'battle-item-list',
      itemEntries: submenuEntries.map((entry) => ({
        id: entry.itemId ?? '',
        label: entry.label,
        enabled: entry.enabled
      })),
      itemDetailPanelId: 'battle-item-detail',
      itemDetail: selectedItemId
        ? {
            title: getItemDefinition(selectedItemId).name,
            body: createBattleItemDetailBody(
              getItemDefinition(selectedItemId).description,
              getBattleUnitInventory(activeUnit)[selectedItemId] ?? 0,
              'Select an adjacent target on the map.'
            )
          }
        : null
    })
  };
}

export function selectWorldBattleResultPresentation(
  battle: GameplayBattleState | null,
  _result: 'Victory' | 'Defeat'
): WorldBattleResultPresentation {
  const isWorldEncounterBattle = isWorldEncounterBattleState(battle);
  const isSetupBattle = isSetupBattleState(battle);

  return {
    isWorldEncounterBattle,
    isSetupBattle
  };
}
