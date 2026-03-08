export type ItemId = 'mending-salve' | 'quick-tonic';

type ItemEffect =
  | {
      kind: 'heal';
      amount: number;
    }
  | {
      kind: 'ct';
      amount: number;
    };

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  effect: ItemEffect;
}

export const ITEM_DEFINITIONS: Record<ItemId, ItemDefinition> = {
  'mending-salve': {
    id: 'mending-salve',
    name: 'Mending Salve',
    description: 'Restore 28 HP to the acting unit.',
    effect: {
      kind: 'heal',
      amount: 28
    }
  },
  'quick-tonic': {
    id: 'quick-tonic',
    name: 'Quick Tonic',
    description: 'Grant 35 CT to the acting unit for a faster next turn.',
    effect: {
      kind: 'ct',
      amount: 35
    }
  }
};

export function getItemDefinition(itemId: ItemId): ItemDefinition {
  const item = ITEM_DEFINITIONS[itemId];

  if (!item) {
    throw new Error(`Unknown item: ${itemId}`);
  }

  return item;
}

export function getInventoryEntries(inventory: Partial<Record<ItemId, number>>): Array<{ itemId: ItemId; count: number }> {
  return Object.entries(inventory)
    .map(([itemId, count]) => ({ itemId: itemId as ItemId, count: count ?? 0 }))
    .filter((entry) => entry.count > 0);
}
