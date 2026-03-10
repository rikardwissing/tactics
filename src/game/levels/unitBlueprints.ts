import { UnitBlueprint } from '../core/types';

export const UNIT_BLUEPRINTS: Record<string, UnitBlueprint> = {
  'the-order-house-marshal': {
    id: 'the-order-house-marshal',
    factionId: 'the-order',
    roleId: 'house-marshal',
    name: 'House Marshal',
    className: 'Surface Commander',
    team: 'player',
    spriteKey: 'the-order-house-marshal',
    accentColor: 0xc7a35e,
    maxHp: 92,
    move: 4,
    speed: 24,
    attack: 26,
    defense: 16,
    rangeMin: 1,
    rangeMax: 1,
    jump: 1,
    attackName: 'Breacher Strike',
    attackText: 'Heavy close-quarters assault. Strongest on high ground.',
    spriteDisplayHeight: 132,
    idleStyle: 'knight',
    attackStyle: 'blade-arc',
    effectKey: 'radiant-slash',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Breacher Strike. Heavy close-quarters assault that thrives on high ground.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 1,
        rangeMax: 1
      },
      {
        id: 'throw',
        name: 'Relay Lance',
        description: 'Relay Lance. Launch a hardened signal spear 2 to 4 tiles away.',
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
  'the-order-squire-operative': {
    id: 'the-order-squire-operative',
    factionId: 'the-order',
    roleId: 'squire-operative',
    name: 'Squire Operative',
    className: 'Recon Marksman',
    team: 'player',
    spriteKey: 'the-order-squire-operative',
    accentColor: 0xb55f53,
    maxHp: 72,
    move: 5,
    speed: 28,
    attack: 22,
    defense: 10,
    rangeMin: 2,
    rangeMax: 4,
    jump: 1,
    attackName: 'Tracer Volley',
    attackText: 'Long-range burst. Punishes exposed targets.',
    spriteDisplayHeight: 126,
    idleStyle: 'archer',
    attackStyle: 'arrow-flight',
    effectKey: 'skysting-arrow',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Tracer Volley. Long-range burst for exposed targets.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 4
      },
      {
        id: 'steal',
        name: 'Strip Gear',
        description: 'Strip Gear. Slip in close and strip a carried drop before the target falls.',
        kind: 'steal',
        target: 'enemy',
        rangeMin: 1,
        rangeMax: 1
      }
    ]
  },
  'the-order-banner-surgeon': {
    id: 'the-order-banner-surgeon',
    factionId: 'the-order',
    roleId: 'banner-surgeon',
    name: 'Banner Surgeon',
    className: 'Field Medic',
    team: 'player',
    spriteKey: 'the-order-banner-surgeon',
    accentColor: 0xde8b5e,
    maxHp: 64,
    move: 4,
    speed: 26,
    attack: 24,
    defense: 8,
    rangeMin: 2,
    rangeMax: 3,
    jump: 1,
    attackName: 'Cautery Charge',
    attackText: 'Mid-range surgical blast with reliable damage.',
    spriteDisplayHeight: 126,
    idleStyle: 'mage',
    attackStyle: 'ember-burst',
    effectKey: 'cinder-burst',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Cautery Charge. Focused mid-range shot for reliable damage.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 3
      },
      {
        id: 'heal',
        name: 'Field Mend',
        description: 'Field Mend. Restore 24 HP to an ally within 3 tiles.',
        kind: 'heal',
        target: 'ally',
        rangeMin: 0,
        rangeMax: 3,
        healAmount: 24
      }
    ]
  },
  'myrmidons-tide-legionary': {
    id: 'myrmidons-tide-legionary',
    factionId: 'myrmidons',
    roleId: 'tide-legionary',
    name: 'Tide Legionary',
    className: 'Shock Infantry',
    team: 'enemy',
    spriteKey: 'myrmidons-tide-legionary',
    accentColor: 0x48a79c,
    maxHp: 84,
    move: 4,
    speed: 23,
    attack: 24,
    defense: 13,
    rangeMin: 1,
    rangeMax: 1,
    jump: 1,
    attackName: 'Breaker Cleave',
    attackText: 'Heavy polearm sweep. Brutal when it closes.',
    spriteDisplayHeight: 136,
    idleStyle: 'warden',
    attackStyle: 'grave-cleave',
    effectKey: 'grave-cleave',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Breaker Cleave. Brutal polearm sweep at close range.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 1,
        rangeMax: 1
      }
    ],
    dropItemId: 'mending-salve'
  },
  'myrmidons-hunter': {
    id: 'myrmidons-hunter',
    factionId: 'myrmidons',
    roleId: 'hunter',
    name: 'Hunter',
    className: 'Amphibious Marksman',
    team: 'enemy',
    spriteKey: 'myrmidons-hunter',
    accentColor: 0x7fc9ba,
    maxHp: 70,
    move: 5,
    speed: 27,
    attack: 22,
    defense: 10,
    rangeMin: 2,
    rangeMax: 4,
    jump: 1,
    attackName: 'Brine Shot',
    attackText: 'Ranged pressure that softens exposed targets.',
    spriteDisplayHeight: 126,
    idleStyle: 'ranger',
    attackStyle: 'feather-shot',
    effectKey: 'blackfeather-shot',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Brine Shot. Ranged pressure on exposed targets.',
        kind: 'attack',
        target: 'enemy',
        rangeMin: 2,
        rangeMax: 4
      }
    ],
    dropItemId: 'quick-tonic'
  },
  'myrmidons-spectre': {
    id: 'myrmidons-spectre',
    factionId: 'myrmidons',
    roleId: 'spectre',
    name: 'Spectre',
    className: 'Bio-Psionic Raider',
    team: 'enemy',
    spriteKey: 'myrmidons-spectre',
    accentColor: 0x7f9fc8,
    maxHp: 66,
    move: 4,
    speed: 25,
    attack: 25,
    defense: 8,
    rangeMin: 2,
    rangeMax: 3,
    jump: 1,
    attackName: 'Phase Lash',
    attackText: 'Psionic strike that spikes from the second line.',
    spriteDisplayHeight: 128,
    idleStyle: 'priest',
    attackStyle: 'ash-hex',
    effectKey: 'ash-hex',
    abilities: [
      {
        id: 'attack',
        name: 'Attack',
        description: 'Phase Lash. Psionic strike from behind the front line.',
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
