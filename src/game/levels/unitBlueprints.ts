import { UnitBlueprint } from '../core/types';

export const UNIT_BLUEPRINTS: Record<string, UnitBlueprint> = {
  alden: {
    id: 'alden',
    name: 'Alden',
    className: 'Dawn Knight',
    team: 'player',
    spriteKey: 'holy-knight',
    accentColor: 0xd5b567,
    maxHp: 92,
    move: 4,
    speed: 24,
    attack: 26,
    defense: 16,
    rangeMin: 1,
    rangeMax: 1,
    jump: 1,
    attackName: 'Radiant Steel',
    attackText: 'Heavy melee strike. Strongest on high ground.',
    spriteDisplayHeight: 132,
    idleStyle: 'knight',
    attackStyle: 'blade-arc',
    effectKey: 'radiant-slash',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Radiant Steel. Heavy melee strike that thrives on high ground.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 1,
        rangeMax: 1
      },
      {
        id: 'throw',
        name: 'Throw',
        description: 'Sunlance Toss. Hurl a radiant spear 2 to 4 tiles away.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 4,
        powerModifier: -6,
        attackStyle: 'arrow-flight',
        effectKey: 'skysting-arrow'
      }
    ]
  },
  mira: {
    id: 'mira',
    name: 'Mira',
    className: 'Falcon Archer',
    team: 'player',
    spriteKey: 'wild-archer',
    accentColor: 0x85d2c9,
    maxHp: 72,
    move: 5,
    speed: 28,
    attack: 22,
    defense: 10,
    rangeMin: 2,
    rangeMax: 4,
    jump: 1,
    attackName: 'Skysting Arrow',
    attackText: 'Long-range shot. Punishes exposed targets.',
    spriteDisplayHeight: 126,
    idleStyle: 'archer',
    attackStyle: 'arrow-flight',
    effectKey: 'skysting-arrow',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Skysting Arrow. Long-range shot for exposed targets.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 4
      },
      {
        id: 'steal',
        name: 'Steal',
        description: 'Slip in close and snatch a carried drop before the target falls.',
        kind: 'steal',
        target: 'enemy',
        rangeMin: 1,
        rangeMax: 1
      }
    ]
  },
  serin: {
    id: 'serin',
    name: 'Serin',
    className: 'Ember Savant',
    team: 'player',
    spriteKey: 'ember-mage',
    accentColor: 0xf4934f,
    maxHp: 64,
    move: 4,
    speed: 26,
    attack: 24,
    defense: 8,
    rangeMin: 2,
    rangeMax: 3,
    jump: 1,
    attackName: 'Cinder Brand',
    attackText: 'Arcane blast with reliable damage at mid range.',
    spriteDisplayHeight: 126,
    idleStyle: 'mage',
    attackStyle: 'ember-burst',
    effectKey: 'cinder-burst',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Cinder Brand. Arcane blast at mid range.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 3
      },
      {
        id: 'heal',
        name: 'Heal',
        description: 'Kindle Mending. Restore 24 HP to an ally within 3 tiles.',
        kind: 'heal',
        target: 'ally',
        rangeMin: 0,
        rangeMax: 3,
        healAmount: 24
      }
    ]
  },
  vark: {
    id: 'vark',
    name: 'Vark',
    className: 'Bone Warden',
    team: 'enemy',
    spriteKey: 'bone-warden',
    accentColor: 0xc58787,
    maxHp: 84,
    move: 4,
    speed: 23,
    attack: 24,
    defense: 13,
    rangeMin: 1,
    rangeMax: 1,
    jump: 1,
    attackName: 'Grave Cleave',
    attackText: 'Undead halberd sweep. Brutal when it closes.',
    spriteDisplayHeight: 136,
    idleStyle: 'warden',
    attackStyle: 'grave-cleave',
    effectKey: 'grave-cleave',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Grave Cleave. Brutal halberd sweep at close range.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 1,
        rangeMax: 1
      }
    ],
    dropItemId: 'mending-salve'
  },
  nyx: {
    id: 'nyx',
    name: 'Nyx',
    className: 'Grave Ranger',
    team: 'enemy',
    spriteKey: 'grave-ranger',
    accentColor: 0xb17ebb,
    maxHp: 70,
    move: 5,
    speed: 27,
    attack: 22,
    defense: 10,
    rangeMin: 2,
    rangeMax: 4,
    jump: 1,
    attackName: 'Blackfeather Shot',
    attackText: 'Ranged pressure that softens the back line.',
    spriteDisplayHeight: 126,
    idleStyle: 'ranger',
    attackStyle: 'feather-shot',
    effectKey: 'blackfeather-shot',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Blackfeather Shot. Ranged pressure on the back line.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 4
      }
    ],
    dropItemId: 'quick-tonic'
  },
  sable: {
    id: 'sable',
    name: 'Sable',
    className: 'Ash Priest',
    team: 'enemy',
    spriteKey: 'ash-priest',
    accentColor: 0xee8c7d,
    maxHp: 66,
    move: 4,
    speed: 25,
    attack: 25,
    defense: 8,
    rangeMin: 2,
    rangeMax: 3,
    jump: 1,
    attackName: 'Ash Hex',
    attackText: 'Scorching rite that spikes from the altar line.',
    spriteDisplayHeight: 128,
    idleStyle: 'priest',
    attackStyle: 'ash-hex',
    effectKey: 'ash-hex',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Ash Hex. Scorching rite from behind the altar line.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 3
      }
    ],
    dropItemId: 'mending-salve'
  }
};

export function getUnitBlueprint(blueprintId: string): UnitBlueprint {
  const blueprint = UNIT_BLUEPRINTS[blueprintId];

  if (!blueprint) {
    throw new Error(`Missing unit blueprint: ${blueprintId}`);
  }

  return blueprint;
}
