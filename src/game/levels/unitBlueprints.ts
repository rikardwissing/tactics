import rawBlueprints from './data/unitBlueprints.json';
import { COMBAT_EFFECT_IDS, type CombatEffectId } from '../core/combatEffects';
import type { ItemId } from '../core/items';
import type {
  AbilityKind,
  AbilityTarget,
  AttackStyle,
  FactionId,
  IdleStyle,
  MovementStyle,
  UnitAbility,
  UnitBlueprint,
  UnitGender,
  UnitRoleId
} from '../core/types';

const FACTION_IDS = ['time-travelers', 'myrmidons', 'the-order', 'children-of-the-prophecy'] as const satisfies readonly FactionId[];
const UNIT_GENDERS = ['male', 'female'] as const satisfies readonly UnitGender[];
const UNIT_ROLE_IDS = [
  'aion-trooper',
  'time-lord',
  'rift-engineer',
  'chronomedic',
  'scavenger-marksman',
  'paradox-warden',
  'tide-legionary',
  'hunter',
  'spectre',
  'brine-shaper',
  'reef-champion',
  'house-marshal',
  'squire-operative',
  'banner-surgeon',
  'relic-marksman',
  'palatine-enforcer',
  'aevum-guardian',
  'mirage-seer',
  'sand-strider',
  'memory-keeper',
  'oracle-lancer'
] as const satisfies readonly UnitRoleId[];
const IDLE_STYLES = ['knight', 'archer', 'mage', 'warden', 'ranger', 'priest'] as const satisfies readonly IdleStyle[];
const MOVEMENT_STYLES = ['standard', 'blink'] as const satisfies readonly MovementStyle[];
const ABILITY_KINDS = ['attack', 'heal', 'steal'] as const satisfies readonly AbilityKind[];
const ABILITY_TARGETS = ['enemy', 'ally'] as const satisfies readonly AbilityTarget[];
const ATTACK_STYLES = [
  'blade-arc',
  'arrow-flight',
  'ember-burst',
  'grave-cleave',
  'feather-shot',
  'ash-hex'
] as const satisfies readonly AttackStyle[];
const ITEM_IDS = ['mending-salve', 'quick-tonic'] as const satisfies readonly ItemId[];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid unit blueprint data: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string`);
  return value;
}

function assertNumber(value: unknown, label: string): number {
  assert(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`);
  return value;
}

function assertOptionalNumber(value: unknown, label: string): number | undefined {
  assert(value === undefined || (typeof value === 'number' && Number.isFinite(value)), `${label} must be a finite number`);
  return value as number | undefined;
}

function assertOptionalBoolean(value: unknown, label: string): boolean | undefined {
  assert(value === undefined || typeof value === 'boolean', `${label} must be a boolean`);
  return value as boolean | undefined;
}

function assertOptionalString<T extends string>(value: unknown, label: string, allowed: readonly T[]): T | undefined {
  assert(value === undefined || (typeof value === 'string' && allowed.includes(value as T)), `${label} must be one of ${allowed.join(', ')}`);
  return value as T | undefined;
}

function assertEnum<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  assert(typeof value === 'string' && allowed.includes(value as T), `${label} must be one of ${allowed.join(', ')}`);
  return value as T;
}

function validateAbility(blueprintId: string, rawAbility: unknown): UnitAbility {
  assert(isRecord(rawAbility), `${blueprintId} ability must be an object`);

  return {
    id: assertString(rawAbility.id, `${blueprintId} ability.id`),
    name: assertString(rawAbility.name, `${blueprintId} ability.name`),
    description: assertString(rawAbility.description, `${blueprintId} ability.description`),
    kind: assertEnum(rawAbility.kind, `${blueprintId} ability.kind`, ABILITY_KINDS),
    target: assertEnum(rawAbility.target, `${blueprintId} ability.target`, ABILITY_TARGETS),
    rangeMin: assertNumber(rawAbility.rangeMin, `${blueprintId} ability.rangeMin`),
    rangeMax: assertNumber(rawAbility.rangeMax, `${blueprintId} ability.rangeMax`),
    powerModifier: assertOptionalNumber(rawAbility.powerModifier, `${blueprintId} ability.powerModifier`),
    healAmount: assertOptionalNumber(rawAbility.healAmount, `${blueprintId} ability.healAmount`),
    splashRadius: assertOptionalNumber(rawAbility.splashRadius, `${blueprintId} ability.splashRadius`),
    splashDamageMultiplier: assertOptionalNumber(rawAbility.splashDamageMultiplier, `${blueprintId} ability.splashDamageMultiplier`),
    attackStyle: assertOptionalString(rawAbility.attackStyle, `${blueprintId} ability.attackStyle`, ATTACK_STYLES),
    effectKey: assertOptionalString(rawAbility.effectKey, `${blueprintId} ability.effectKey`, COMBAT_EFFECT_IDS),
    counterable: assertOptionalBoolean(rawAbility.counterable, `${blueprintId} ability.counterable`)
  };
}

function validateBlueprint(entryId: string, rawBlueprint: unknown): UnitBlueprint {
  assert(isRecord(rawBlueprint), `${entryId} must be an object`);
  assert(Array.isArray(rawBlueprint.abilities), `${entryId}.abilities must be an array`);

  const blueprint: UnitBlueprint = {
    id: assertString(rawBlueprint.id, `${entryId}.id`),
    factionId: assertEnum(rawBlueprint.factionId, `${entryId}.factionId`, FACTION_IDS),
    roleId: assertEnum(rawBlueprint.roleId, `${entryId}.roleId`, UNIT_ROLE_IDS),
    gender: assertEnum(rawBlueprint.gender, `${entryId}.gender`, UNIT_GENDERS),
    name: assertString(rawBlueprint.name, `${entryId}.name`),
    className: assertString(rawBlueprint.className, `${entryId}.className`),
    turnStartCatchPhrase: assertString(rawBlueprint.turnStartCatchPhrase, `${entryId}.turnStartCatchPhrase`),
    spriteKey: assertString(rawBlueprint.spriteKey, `${entryId}.spriteKey`),
    accentColor: assertNumber(rawBlueprint.accentColor, `${entryId}.accentColor`),
    maxHp: assertNumber(rawBlueprint.maxHp, `${entryId}.maxHp`),
    move: assertNumber(rawBlueprint.move, `${entryId}.move`),
    speed: assertNumber(rawBlueprint.speed, `${entryId}.speed`),
    attack: assertNumber(rawBlueprint.attack, `${entryId}.attack`),
    defense: assertNumber(rawBlueprint.defense, `${entryId}.defense`),
    rangeMin: assertNumber(rawBlueprint.rangeMin, `${entryId}.rangeMin`),
    rangeMax: assertNumber(rawBlueprint.rangeMax, `${entryId}.rangeMax`),
    jump: assertNumber(rawBlueprint.jump, `${entryId}.jump`),
    attackName: assertString(rawBlueprint.attackName, `${entryId}.attackName`),
    attackText: assertString(rawBlueprint.attackText, `${entryId}.attackText`),
    spriteDisplayHeight: assertNumber(rawBlueprint.spriteDisplayHeight, `${entryId}.spriteDisplayHeight`),
    spriteOffsetX: assertOptionalNumber(rawBlueprint.spriteOffsetX, `${entryId}.spriteOffsetX`),
    spriteOffsetY: assertOptionalNumber(rawBlueprint.spriteOffsetY, `${entryId}.spriteOffsetY`),
    movementStyle: assertOptionalString(rawBlueprint.movementStyle, `${entryId}.movementStyle`, MOVEMENT_STYLES) ?? 'standard',
    idleStyle: assertEnum(rawBlueprint.idleStyle, `${entryId}.idleStyle`, IDLE_STYLES),
    attackStyle: assertEnum(rawBlueprint.attackStyle, `${entryId}.attackStyle`, ATTACK_STYLES),
    effectKey: assertEnum(rawBlueprint.effectKey, `${entryId}.effectKey`, COMBAT_EFFECT_IDS),
    abilities: rawBlueprint.abilities.map((ability) => validateAbility(entryId, ability)),
    dropItemId: assertOptionalString(rawBlueprint.dropItemId, `${entryId}.dropItemId`, ITEM_IDS),
    dropQuantity: assertOptionalNumber(rawBlueprint.dropQuantity, `${entryId}.dropQuantity`)
  };

  assert(blueprint.id === entryId, `${entryId}.id must match its object key`);

  return blueprint;
}

function validateBlueprintMap(raw: unknown): Record<string, UnitBlueprint> {
  assert(isRecord(raw), 'blueprint root must be an object');

  return Object.fromEntries(
    Object.entries(raw).map(([blueprintId, rawBlueprint]) => [blueprintId, validateBlueprint(blueprintId, rawBlueprint)])
  );
}

export const UNIT_BLUEPRINTS: Record<string, UnitBlueprint> = validateBlueprintMap(rawBlueprints);

export function getUnitBlueprint(blueprintId: string): UnitBlueprint {
  const blueprint = UNIT_BLUEPRINTS[blueprintId];

  if (!blueprint) {
    throw new Error(`Missing unit blueprint: ${blueprintId}`);
  }

  return blueprint;
}

export function getAllUnitBlueprints(): UnitBlueprint[] {
  return Object.values(UNIT_BLUEPRINTS);
}
