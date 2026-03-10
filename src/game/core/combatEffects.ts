export type CombatEffectId =
  | 'the-order-breacher-strike'
  | 'the-order-relay-lance'
  | 'the-order-tracer-volley'
  | 'the-order-cautery-charge'
  | 'the-order-field-mend'
  | 'the-order-strip-gear'
  | 'myrmidons-breaker-cleave'
  | 'myrmidons-brine-shot'
  | 'myrmidons-phase-lash'
  | 'item-mending-salve'
  | 'item-quick-tonic';

export type CombatEffectMotion =
  | 'projectile'
  | 'impact-arc'
  | 'impact-burst'
  | 'ground-sigil'
  | 'support-bloom'
  | 'transfer'
  | 'ct-surge';

export interface CombatEffectDefinition {
  id: CombatEffectId;
  assetKey: string | null;
  motion: CombatEffectMotion;
  startScale: number;
  peakScale: number;
  duration: number;
  additive?: boolean;
  launchAnchor?: number;
  impactAnchor?: number;
  sourceOffsetY?: number;
  impactOffsetY?: number;
  rotationOffset?: number;
  spin?: number;
  endScaleMultiplier?: number;
  burstTint?: number;
  travelFromTarget?: boolean;
}

export const COMBAT_EFFECT_DEFINITIONS = {
  'the-order-breacher-strike': {
    id: 'the-order-breacher-strike',
    assetKey: 'the-order-breacher-strike',
    motion: 'impact-arc',
    startScale: 0.1,
    peakScale: 0.56,
    duration: 170,
    additive: false,
    impactAnchor: 0.54,
    rotationOffset: 0.08
  },
  'the-order-relay-lance': {
    id: 'the-order-relay-lance',
    assetKey: 'the-order-relay-lance',
    motion: 'projectile',
    startScale: 0.16,
    peakScale: 0.34,
    duration: 230,
    launchAnchor: 0.55,
    impactAnchor: 0.54,
    burstTint: 0xe5b36a
  },
  'the-order-tracer-volley': {
    id: 'the-order-tracer-volley',
    assetKey: 'the-order-tracer-volley',
    motion: 'projectile',
    startScale: 0.13,
    peakScale: 0.3,
    duration: 210,
    launchAnchor: 0.58,
    impactAnchor: 0.56,
    spin: 0.18,
    burstTint: 0xd57a6e
  },
  'the-order-cautery-charge': {
    id: 'the-order-cautery-charge',
    assetKey: 'the-order-cautery-charge',
    motion: 'impact-burst',
    startScale: 0.1,
    peakScale: 0.58,
    duration: 220,
    additive: false,
    impactAnchor: 0.56
  },
  'the-order-field-mend': {
    id: 'the-order-field-mend',
    assetKey: 'the-order-field-mend',
    motion: 'support-bloom',
    startScale: 0.1,
    peakScale: 0.58,
    duration: 250,
    additive: false,
    impactAnchor: 0.72
  },
  'the-order-strip-gear': {
    id: 'the-order-strip-gear',
    assetKey: 'the-order-strip-gear',
    motion: 'transfer',
    startScale: 0.12,
    peakScale: 0.28,
    duration: 260,
    additive: true,
    launchAnchor: 0.62,
    impactAnchor: 0.62,
    burstTint: 0xf0d27d,
    travelFromTarget: true
  },
  'myrmidons-breaker-cleave': {
    id: 'myrmidons-breaker-cleave',
    assetKey: 'myrmidons-breaker-cleave',
    motion: 'impact-arc',
    startScale: 0.11,
    peakScale: 0.6,
    duration: 180,
    impactAnchor: 0.54,
    rotationOffset: -0.12,
    endScaleMultiplier: 1.06
  },
  'myrmidons-brine-shot': {
    id: 'myrmidons-brine-shot',
    assetKey: 'myrmidons-brine-shot',
    motion: 'projectile',
    startScale: 0.14,
    peakScale: 0.3,
    duration: 250,
    launchAnchor: 0.56,
    impactAnchor: 0.56,
    spin: 0.55,
    burstTint: 0x73d6c1
  },
  'myrmidons-phase-lash': {
    id: 'myrmidons-phase-lash',
    assetKey: 'myrmidons-phase-lash',
    motion: 'ground-sigil',
    startScale: 0.09,
    peakScale: 0.52,
    duration: 250,
    impactAnchor: 0.56,
    impactOffsetY: 26,
    rotationOffset: 0.2,
    endScaleMultiplier: 1.12
  },
  'item-mending-salve': {
    id: 'item-mending-salve',
    assetKey: 'item-mending-salve',
    motion: 'support-bloom',
    startScale: 0.09,
    peakScale: 0.5,
    duration: 230,
    additive: false,
    impactAnchor: 0.72
  },
  'item-quick-tonic': {
    id: 'item-quick-tonic',
    assetKey: 'item-quick-tonic',
    motion: 'ct-surge',
    startScale: 0.09,
    peakScale: 0.52,
    duration: 240,
    additive: false,
    impactAnchor: 0.68,
    burstTint: 0xdcbf70
  }
} satisfies Record<CombatEffectId, CombatEffectDefinition>;

export function getCombatEffectDefinition(effectId: CombatEffectId): CombatEffectDefinition {
  return COMBAT_EFFECT_DEFINITIONS[effectId];
}
