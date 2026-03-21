import type { ActionMenuEntryDescriptor, ActionMenuPanelDescriptor } from '../scenes/components/BattleActionMenuStack';
import type { UnitAbility } from '../core/types';

export interface BattleCommandMenuPanelOptions {
  phase: string;
  rootPanelId: string;
  rootTitle: string;
  rootEntries: readonly ActionMenuEntryDescriptor[];
  currentRootActionId: string | null;
  selectedAbilityId: string | null;
  selectedItemId: string | null;
  movePanelId: string;
  moveDetailBody: string;
  abilityListPanelId: string;
  abilityEntries: readonly ActionMenuEntryDescriptor[];
  abilityDetailPanelId: string;
  abilityDetail: { title: string; body: string } | null;
  itemListPanelId: string;
  itemEntries: readonly ActionMenuEntryDescriptor[];
  itemDetailPanelId: string;
  itemDetail: { title: string; body: string } | null;
}

type BattleCommandMenuPhase = 'menu' | 'move' | 'abilities' | 'action' | 'items' | 'item-action';

function resolveBattleCommandMenuPhase(phase: string): BattleCommandMenuPhase | null {
  switch (phase) {
    case 'player-menu':
    case 'battle-player-menu':
      return 'menu';
    case 'player-move':
    case 'battle-player-move':
      return 'move';
    case 'player-abilities':
    case 'battle-player-abilities':
      return 'abilities';
    case 'player-action':
    case 'battle-player-action':
      return 'action';
    case 'player-items':
    case 'battle-player-items':
      return 'items';
    case 'player-item-action':
    case 'battle-player-item-action':
      return 'item-action';
    default:
      return null;
  }
}

export function resolveBattleCommandMenuAction(phase: string, canUndoMove = false): string | null {
  switch (phase) {
    case 'player-abilities':
    case 'battle-player-abilities':
    case 'player-action':
    case 'battle-player-action':
      return 'abilities';
    case 'player-items':
    case 'battle-player-items':
    case 'player-item-action':
    case 'battle-player-item-action':
      return 'items';
    case 'player-move':
    case 'battle-player-move':
      return canUndoMove ? 'undo-move' : 'move';
    case 'player-menu':
    case 'battle-player-menu':
    default:
      return null;
  }
}

function createListPanel(
  id: string,
  title: string,
  entries: readonly ActionMenuEntryDescriptor[],
  activeId: string | null = null
): ActionMenuPanelDescriptor {
  return {
    id,
    kind: 'list',
    title,
    blocksWorldInput: true,
    entries: entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      enabled: entry.enabled,
      active: entry.id === activeId
    }))
  };
}

function createDetailPanel(
  id: string,
  title: string,
  body: string
): ActionMenuPanelDescriptor {
  return {
    id,
    kind: 'detail',
    title,
    blocksWorldInput: true,
    body
  };
}

export function createBattleCommandMenuPanels({
  phase,
  rootPanelId,
  rootTitle,
  rootEntries,
  currentRootActionId,
  selectedAbilityId,
  selectedItemId,
  movePanelId,
  moveDetailBody,
  abilityListPanelId,
  abilityEntries,
  abilityDetailPanelId,
  abilityDetail,
  itemListPanelId,
  itemEntries,
  itemDetailPanelId,
  itemDetail
}: BattleCommandMenuPanelOptions): ActionMenuPanelDescriptor[] {
  const menuPhase = resolveBattleCommandMenuPhase(phase);
  if (!menuPhase) {
    return [];
  }

  const rootPanel = createListPanel(
    rootPanelId,
    rootTitle,
    rootEntries,
    currentRootActionId
  );

  switch (menuPhase) {
    case 'menu':
      return [rootPanel];
    case 'move':
      return [
        rootPanel,
        createDetailPanel(movePanelId, 'Move', moveDetailBody)
      ];
    case 'abilities':
      return [
        rootPanel,
        createListPanel(abilityListPanelId, 'Abilities', abilityEntries, selectedAbilityId)
      ];
    case 'action':
      return abilityDetail
        ? [
            rootPanel,
            createListPanel(abilityListPanelId, 'Abilities', abilityEntries, selectedAbilityId),
            createDetailPanel(abilityDetailPanelId, abilityDetail.title, abilityDetail.body)
          ]
        : [
            rootPanel,
            createListPanel(abilityListPanelId, 'Abilities', abilityEntries, selectedAbilityId)
          ];
    case 'items':
      return [
        rootPanel,
        createListPanel(itemListPanelId, 'Items', itemEntries, selectedItemId)
      ];
    case 'item-action':
      return itemDetail
        ? [
            rootPanel,
            createListPanel(itemListPanelId, 'Items', itemEntries, selectedItemId),
            createDetailPanel(itemDetailPanelId, itemDetail.title, itemDetail.body)
          ]
        : [
            rootPanel,
            createListPanel(itemListPanelId, 'Items', itemEntries, selectedItemId)
          ];
    default:
      return [];
  }
}

export function createBattleMoveDetailBody(
  move: number,
  terrainLabel: string,
  movementSpent: boolean,
  movementSpentText: string,
  promptText: string
): string {
  return [
    `Stride up to ${move} tiles across ${terrainLabel}.`,
    movementSpent ? movementSpentText : promptText
  ].join('\n');
}

export function createBattleAbilityDetailBody(ability: UnitAbility): string {
  const detailTags = [
    `Range ${ability.rangeMin}-${ability.rangeMax}`,
    ability.target === 'ally' ? 'Allies' : 'Enemies',
    ...(ability.splashRadius && ability.splashDamageMultiplier ? [`Blast ${ability.splashRadius}`] : []),
    ...(ability.counterable === false ? ['No Counter'] : [])
  ];

  return [ability.description, detailTags.join('  •  ')].join('\n');
}

export function createBattleItemDetailBody(
  description: string,
  count: number,
  promptText: string
): string {
  return [
    description,
    `Range 1  •  Stock ${count}`,
    `Targets any adjacent unit.`,
    promptText
  ].join('\n');
}
