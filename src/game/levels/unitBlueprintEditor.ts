import type { UnitAbility, UnitBlueprint } from '../core/types';

export const EDITABLE_UNIT_BLUEPRINT_FIELDS = [
  'spriteDisplayHeight',
  'spriteOffsetX',
  'spriteOffsetY',
  'maxHp',
  'move',
  'speed',
  'attack',
  'defense',
  'rangeMin',
  'rangeMax',
  'jump'
] as const;

export const EDITABLE_UNIT_ABILITY_FIELDS = [
  'rangeMin',
  'rangeMax',
  'powerModifier',
  'healAmount'
] as const;

export type EditableUnitBlueprintField = (typeof EDITABLE_UNIT_BLUEPRINT_FIELDS)[number];
export type EditableUnitAbilityField = (typeof EDITABLE_UNIT_ABILITY_FIELDS)[number];
export interface EditableUnitAbilityDraft {
  id: string;
  name: string;
  kind: UnitAbility['kind'];
  target: UnitAbility['target'];
  description: string;
  rangeMin: number;
  rangeMax: number;
  powerModifier: number | null;
  healAmount: number | null;
}

export interface EditableUnitBlueprintDraft extends Required<Pick<UnitBlueprint, EditableUnitBlueprintField>> {
  abilities: EditableUnitAbilityDraft[];
}

export type UnitAbilityEditorPatch = Partial<Pick<UnitAbility, EditableUnitAbilityField>>;
export type UnitBlueprintEditorPatch = Partial<Pick<EditableUnitBlueprintDraft, EditableUnitBlueprintField>> & {
  abilities?: Record<string, UnitAbilityEditorPatch>;
};
export type UnitBlueprintEditorPatchMap = Record<string, UnitBlueprintEditorPatch>;

function getPrimaryAttackAbilityIndex(abilities: readonly UnitAbility[]): number {
  const attackIndex = abilities.findIndex((ability) => ability.id === 'attack');

  if (attackIndex >= 0) {
    return attackIndex;
  }

  const firstAttackIndex = abilities.findIndex((ability) => ability.kind === 'attack');
  return firstAttackIndex;
}

function sanitizeInteger(value: number, minimum: number): number {
  return Math.max(minimum, Math.round(value));
}

function sanitizeSignedInteger(value: number): number {
  return Math.round(value);
}

function createEditableUnitAbilityDraft(ability: UnitAbility): EditableUnitAbilityDraft {
  return {
    id: ability.id,
    name: ability.name,
    kind: ability.kind,
    target: ability.target,
    description: ability.description,
    rangeMin: ability.rangeMin,
    rangeMax: ability.rangeMax,
    powerModifier: ability.kind === 'attack' ? ability.powerModifier ?? 0 : null,
    healAmount: ability.kind === 'heal' ? ability.healAmount ?? 0 : null
  };
}

function sanitizeEditableUnitAbilityDraft(draft: EditableUnitAbilityDraft): EditableUnitAbilityDraft {
  const minimumRange = draft.kind === 'heal' ? 0 : 1;
  const nextRangeMin = sanitizeInteger(draft.rangeMin, minimumRange);

  return {
    ...draft,
    rangeMin: nextRangeMin,
    rangeMax: Math.max(nextRangeMin, sanitizeInteger(draft.rangeMax, 0)),
    powerModifier: draft.powerModifier === null ? null : sanitizeSignedInteger(draft.powerModifier),
    healAmount: draft.healAmount === null ? null : sanitizeInteger(draft.healAmount, 0)
  };
}

export function getEditableAbilityFields(ability: EditableUnitAbilityDraft): EditableUnitAbilityField[] {
  const fields: EditableUnitAbilityField[] = ['rangeMin', 'rangeMax'];

  if (ability.kind === 'attack') {
    fields.push('powerModifier');
  }

  if (ability.kind === 'heal') {
    fields.push('healAmount');
  }

  return fields;
}

function diffEditableUnitAbilityDraft(
  sourceAbility: UnitAbility,
  draft: EditableUnitAbilityDraft
): UnitAbilityEditorPatch | null {
  const source = createEditableUnitAbilityDraft(sourceAbility);
  const nextDraft = sanitizeEditableUnitAbilityDraft(draft);
  const patch: UnitAbilityEditorPatch = {};

  for (const field of getEditableAbilityFields(source)) {
    if (source[field] !== nextDraft[field]) {
      patch[field] = nextDraft[field] ?? undefined;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function createEditableUnitBlueprintDraft(blueprint: UnitBlueprint): EditableUnitBlueprintDraft {
  return {
    spriteDisplayHeight: blueprint.spriteDisplayHeight,
    spriteOffsetX: blueprint.spriteOffsetX ?? 0,
    spriteOffsetY: blueprint.spriteOffsetY ?? 0,
    maxHp: blueprint.maxHp,
    move: blueprint.move,
    speed: blueprint.speed,
    attack: blueprint.attack,
    defense: blueprint.defense,
    rangeMin: blueprint.rangeMin,
    rangeMax: blueprint.rangeMax,
    jump: blueprint.jump,
    abilities: blueprint.abilities.map(createEditableUnitAbilityDraft)
  };
}

export function sanitizeEditableUnitBlueprintDraft(draft: EditableUnitBlueprintDraft): EditableUnitBlueprintDraft {
  const nextRangeMin = sanitizeInteger(draft.rangeMin, 1);

  return {
    spriteDisplayHeight: sanitizeInteger(draft.spriteDisplayHeight, 1),
    spriteOffsetX: Math.round(draft.spriteOffsetX),
    spriteOffsetY: Math.round(draft.spriteOffsetY),
    maxHp: sanitizeInteger(draft.maxHp, 1),
    move: sanitizeInteger(draft.move, 0),
    speed: sanitizeInteger(draft.speed, 1),
    attack: sanitizeInteger(draft.attack, 0),
    defense: sanitizeInteger(draft.defense, 0),
    rangeMin: nextRangeMin,
    rangeMax: Math.max(nextRangeMin, sanitizeInteger(draft.rangeMax, 1)),
    jump: sanitizeInteger(draft.jump, 0),
    abilities: draft.abilities.map(sanitizeEditableUnitAbilityDraft)
  };
}

export function resolveEditableUnitBlueprint(
  blueprint: UnitBlueprint,
  draft: EditableUnitBlueprintDraft
): UnitBlueprint {
  const nextDraft = sanitizeEditableUnitBlueprintDraft(draft);
  const abilities = [...blueprint.abilities];
  const primaryAttackIndex = getPrimaryAttackAbilityIndex(abilities);

  if (primaryAttackIndex >= 0) {
    const primaryAttack = abilities[primaryAttackIndex];
    abilities[primaryAttackIndex] = {
      ...primaryAttack,
      rangeMin: nextDraft.rangeMin,
      rangeMax: nextDraft.rangeMax
    };
  }

  for (const [index, ability] of abilities.entries()) {
    const abilityDraft = nextDraft.abilities.find((entry) => entry.id === ability.id);

    if (!abilityDraft) {
      continue;
    }

    const nextAbility: UnitAbility = {
      ...ability,
      rangeMin: abilityDraft.rangeMin,
      rangeMax: abilityDraft.rangeMax
    };

    if (ability.kind === 'attack' && abilityDraft.powerModifier !== null) {
      nextAbility.powerModifier = abilityDraft.powerModifier === 0 && ability.powerModifier === undefined
        ? undefined
        : abilityDraft.powerModifier;
    }

    if (ability.kind === 'heal' && abilityDraft.healAmount !== null) {
      nextAbility.healAmount = abilityDraft.healAmount;
    }

    abilities[index] = nextAbility;
  }

  return {
    ...blueprint,
    ...nextDraft,
    spriteOffsetX: nextDraft.spriteOffsetX,
    spriteOffsetY: nextDraft.spriteOffsetY,
    abilities
  };
}

export function diffEditableUnitBlueprintDraft(
  blueprint: UnitBlueprint,
  draft: EditableUnitBlueprintDraft
): UnitBlueprintEditorPatch | null {
  const source = createEditableUnitBlueprintDraft(blueprint);
  const nextDraft = sanitizeEditableUnitBlueprintDraft(draft);
  const patch: UnitBlueprintEditorPatch = {};

  for (const field of EDITABLE_UNIT_BLUEPRINT_FIELDS) {
    if (source[field] !== nextDraft[field]) {
      patch[field] = nextDraft[field];
    }
  }

  const abilityPatches: Record<string, UnitAbilityEditorPatch> = {};

  for (const sourceAbility of blueprint.abilities) {
    const abilityDraft = nextDraft.abilities.find((entry) => entry.id === sourceAbility.id);

    if (!abilityDraft) {
      continue;
    }

    const abilityPatch = diffEditableUnitAbilityDraft(sourceAbility, abilityDraft);

    if (abilityPatch) {
      abilityPatches[sourceAbility.id] = abilityPatch;
    }
  }

  if (Object.keys(abilityPatches).length > 0) {
    patch.abilities = abilityPatches;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildUnitBlueprintEditorPatchMap(
  blueprints: readonly UnitBlueprint[],
  dirtyDrafts: ReadonlyMap<string, EditableUnitBlueprintDraft>
): UnitBlueprintEditorPatchMap {
  const patchMap: UnitBlueprintEditorPatchMap = {};

  for (const blueprint of blueprints) {
    const dirtyDraft = dirtyDrafts.get(blueprint.id);

    if (!dirtyDraft) {
      continue;
    }

    const patch = diffEditableUnitBlueprintDraft(blueprint, dirtyDraft);

    if (patch) {
      patchMap[blueprint.id] = patch;
    }
  }

  return patchMap;
}
