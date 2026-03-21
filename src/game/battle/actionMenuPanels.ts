import type { ActionMenuEntryDescriptor, ActionMenuPanelDescriptor } from '../scenes/components/BattleActionMenuStack';
import type { UnitAbility } from '../core/types';
import type { NpcActionDefinition } from '../exploration/types';

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

export interface BattleCommandMenuPanelsFromStateOptions
  extends Omit<BattleCommandMenuPanelOptions, 'rootEntries' | 'currentRootActionId'>,
    BattleCommandMenuEntriesOptions {}

export interface BattleCommandMenuEntriesOptions {
  canUndoMove: boolean;
  turnMoveUsed: boolean;
  turnActionUsed: boolean;
  hasAbilities: boolean;
  hasItems: boolean;
}

export interface NpcActionMenuPanelOptions {
  phase: string;
  menuPhase: string;
  detailPhase: string;
  npc: {
    name: string;
    actions: readonly NpcActionDefinition[];
  };
  selectedActionId: string | null;
  rootPanelId: string;
  detailPanelId: string;
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

export function createBattleCommandMenuEntries({
  canUndoMove,
  turnMoveUsed,
  turnActionUsed,
  hasAbilities,
  hasItems
}: BattleCommandMenuEntriesOptions): ActionMenuEntryDescriptor[] {
  return [
    canUndoMove
      ? { id: 'undo-move', label: 'Undo Move', enabled: true }
      : {
          id: 'move',
          label: turnMoveUsed ? 'Move [Done]' : 'Move',
          enabled: !turnMoveUsed
        },
    {
      id: 'abilities',
      label: turnActionUsed ? 'Abilities [Done]' : 'Abilities',
      enabled: !turnActionUsed && hasAbilities
    },
    {
      id: 'items',
      label: turnActionUsed ? 'Items [Done]' : 'Items',
      enabled: !turnActionUsed && hasItems
    },
    {
      id: 'wait',
      label: 'Wait',
      enabled: true
    }
  ];
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

export function createBattleCommandMenuPanelsFromState({
  canUndoMove,
  turnMoveUsed,
  turnActionUsed,
  hasAbilities,
  hasItems,
  ...options
}: BattleCommandMenuPanelsFromStateOptions): ActionMenuPanelDescriptor[] {
  return createBattleCommandMenuPanels({
    ...options,
    currentRootActionId: resolveBattleCommandMenuAction(options.phase, canUndoMove),
    rootEntries: createBattleCommandMenuEntries({
      canUndoMove,
      turnMoveUsed,
      turnActionUsed,
      hasAbilities,
      hasItems
    })
  });
}

export function createNpcActionMenuPanels({
  phase,
  menuPhase,
  detailPhase,
  npc,
  selectedActionId,
  rootPanelId,
  detailPanelId
}: NpcActionMenuPanelOptions): ActionMenuPanelDescriptor[] {
  if (phase !== menuPhase && phase !== detailPhase) {
    return [];
  }

  const rootPanel = createListPanel(
    rootPanelId,
    npc.name,
    npc.actions.map((action) => ({
      id: action.id,
      label: action.label,
      enabled: true
    })),
    selectedActionId
  );

  if (phase !== detailPhase) {
    return [rootPanel];
  }

  const detailAction = npc.actions.find((action) => action.id === selectedActionId);

  if (!detailAction) {
    return [rootPanel];
  }

  return [
    rootPanel,
    createDetailPanel(detailPanelId, detailAction.title ?? detailAction.label, detailAction.body)
  ];
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
