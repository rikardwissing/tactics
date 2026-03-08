import { ItemId } from './items';

export type Team = 'player' | 'enemy';
export type TerrainType = 'grass' | 'stone' | 'moss' | 'sanctum';
export type IdleStyle = 'knight' | 'archer' | 'mage' | 'warden' | 'ranger' | 'priest';
export type AbilityKind = 'attack' | 'heal' | 'steal';
export type AbilityTarget = 'enemy' | 'ally';
export type AttackStyle =
  | 'blade-arc'
  | 'arrow-flight'
  | 'ember-burst'
  | 'grave-cleave'
  | 'feather-shot'
  | 'ash-hex';

export interface Point {
  x: number;
  y: number;
}

export interface TileData extends Point {
  height: number;
  terrain: TerrainType;
}

export interface UnitAbility {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  target: AbilityTarget;
  rangeMin: number;
  rangeMax: number;
  powerModifier?: number;
  healAmount?: number;
  attackStyle?: AttackStyle;
  effectKey?: string;
}

export interface UnitBlueprint {
  id: string;
  name: string;
  className: string;
  team: Team;
  spriteKey: string;
  accentColor: number;
  maxHp: number;
  move: number;
  speed: number;
  attack: number;
  defense: number;
  rangeMin: number;
  rangeMax: number;
  jump: number;
  attackName: string;
  attackText: string;
  spriteDisplayHeight: number;
  idleStyle: IdleStyle;
  attackStyle: AttackStyle;
  effectKey: string;
  abilities: readonly UnitAbility[];
  dropItemId?: ItemId;
  dropQuantity?: number;
}

export interface BattleUnit extends Point, UnitBlueprint {
  hp: number;
  ct: number;
  alive: boolean;
}

export interface ReachNode extends Point {
  cost: number;
  previousKey: string | null;
}
