export const COMBAT_FX_TEXTURE_KEYS = {
  arc: 'combat-fx-arc',
  lance: 'combat-fx-lance',
  feather: 'combat-fx-feather',
  burst: 'combat-fx-burst',
  bloom: 'combat-fx-bloom',
  sigil: 'combat-fx-sigil',
  wave: 'combat-fx-wave',
  orb: 'combat-fx-orb',
  ring: 'combat-fx-ring'
} as const;

export type CombatFxTextureKey = (typeof COMBAT_FX_TEXTURE_KEYS)[keyof typeof COMBAT_FX_TEXTURE_KEYS];

export const COMBAT_EFFECT_IDS = [
  'breacher-strike',
  'aevum-staff',
  'breaker-cleave',
  'relay-lance',
  'chrono-carbine',
  'anchor-spike',
  'scrapline-shot',
  'tracer-volley',
  'brine-shot',
  'cautery-charge',
  'reactor-pulse',
  'relic-pulse',
  'mirage-bind',
  'phase-lash',
  'chronal-rend',
  'time-shear',
  'field-mend',
  'rewind-patch',
  'memory-mend',
  'strip-gear',
  'salvage-sweep',
  'mending-salve',
  'quick-tonic'
] as const;

export type CombatEffectId = (typeof COMBAT_EFFECT_IDS)[number];

export type CombatEffectFamilyId =
  | 'sanctified-arc'
  | 'chrono-ranged'
  | 'burst-discharge'
  | 'psychic-sigil'
  | 'temporal-rend'
  | 'support-bloom'
  | 'utility-extract'
  | 'item-use';

export type CombatEffectAnchor = 'source' | 'target';
export type CombatEffectAudioProfileId = CombatEffectFamilyId;
export type CombatEffectAudioPhase = 'telegraph' | 'travel' | 'impact' | 'afterglow';
export type CombatEffectSourceReactionKind = 'lunge' | 'brace' | 'lift' | 'phase-step' | 'none';
export type CombatEffectTargetReactionKind = 'recoil' | 'uplift' | 'phase' | 'none';
export type CombatEffectTextureKey = CombatFxTextureKey | CombatEffectFamilyId;

export interface CombatEffectSpriteLayer {
  textureKey: CombatEffectTextureKey;
  tint: number;
  alpha: number;
  startScale: number;
  endScale: number;
  duration: number;
  additive?: boolean;
  rotationOffset?: number;
  spin?: number;
  offsetY?: number;
}

export interface CombatEffectGroundRing {
  tint: number;
  alpha: number;
  width: number;
  height: number;
  duration: number;
  startScale: number;
  endScale: number;
  fillAlpha?: number;
  strokeAlpha?: number;
  strokeWidth?: number;
  additive?: boolean;
  offsetY?: number;
}

export interface CombatEffectParticleBurst {
  tint: readonly number[];
  count: number;
  lifespan: number;
  speedMin: number;
  speedMax: number;
  scaleStart: number;
  scaleEnd: number;
  gravityY?: number;
  angleSpread?: number;
  angleOffset?: number;
  blendMode?: 'ADD' | 'NORMAL';
  offsetY?: number;
}

export interface CombatEffectTelegraph {
  anchor: CombatEffectAnchor;
  duration: number;
  sprite?: CombatEffectSpriteLayer;
  ring?: CombatEffectGroundRing;
  glowTint?: number;
  glowAlpha?: number;
  glowScale?: number;
  particles?: CombatEffectParticleBurst;
}

export interface CombatEffectTravel {
  from: CombatEffectAnchor;
  to: CombatEffectAnchor;
  duration: number;
  textureKey: CombatEffectTextureKey;
  tint: number;
  alpha: number;
  startScale: number;
  endScale: number;
  additive?: boolean;
  rotationOffset?: number;
  spin?: number;
  arcHeight?: number;
  trailTint?: readonly number[];
  trailScaleStart?: number;
  trailScaleEnd?: number;
  burstCount?: number;
  burstDelay?: number;
  spread?: number;
  alphaFalloff?: number;
}

export interface CombatEffectImpact {
  anchor: CombatEffectAnchor;
  duration: number;
  sprite?: CombatEffectSpriteLayer;
  ring?: CombatEffectGroundRing;
  glowTint?: number;
  glowAlpha?: number;
  glowScale?: number;
  particles?: CombatEffectParticleBurst;
}

export interface CombatEffectAfterglow {
  anchor: CombatEffectAnchor;
  duration: number;
  sprite?: CombatEffectSpriteLayer;
  ring?: CombatEffectGroundRing;
  glowTint?: number;
  glowAlpha?: number;
  glowScale?: number;
  particles?: CombatEffectParticleBurst;
}

export interface CombatEffectCamera {
  shakeDuration: number;
  shakeIntensity: number;
  hitStop: number;
}

export interface CombatEffectSourceReaction {
  kind: CombatEffectSourceReactionKind;
  distance: number;
  lift: number;
  duration: number;
  returnDuration: number;
}

export interface CombatEffectTargetReaction {
  kind: CombatEffectTargetReactionKind;
  flashTint: number;
  alphaMin: number;
  offsetX: number;
  offsetY: number;
  duration: number;
  repeat: number;
}

export interface CombatEffectAudioDefinition {
  profile: CombatEffectAudioProfileId;
  telegraphDetune?: number;
  travelDetune?: number;
  impactDetune?: number;
}

export interface CombatEffectDefinition {
  id: CombatEffectId;
  family: CombatEffectFamilyId;
  telegraph?: CombatEffectTelegraph;
  travel?: CombatEffectTravel;
  impact: CombatEffectImpact;
  afterglow?: CombatEffectAfterglow;
  camera: CombatEffectCamera;
  sourceReaction: CombatEffectSourceReaction;
  targetReaction: CombatEffectTargetReaction;
  audio: CombatEffectAudioDefinition;
  launchAnchor?: number;
  impactAnchor?: number;
  sourceOffsetY?: number;
  impactOffsetY?: number;
}

type CombatEffectFamilyDefinition = Omit<CombatEffectDefinition, 'id'>;

function defineEffect(
  id: CombatEffectId,
  family: CombatEffectFamilyId,
  overrides: Partial<Omit<CombatEffectDefinition, 'id' | 'family'>>
): CombatEffectDefinition {
  const base = COMBAT_EFFECT_FAMILY_DEFINITIONS[family];

  return {
    id,
    family,
    telegraph: overrides.telegraph ?? base.telegraph,
    travel: overrides.travel ?? base.travel,
    impact: overrides.impact ?? base.impact,
    afterglow: overrides.afterglow ?? base.afterglow,
    camera: overrides.camera ?? base.camera,
    sourceReaction: overrides.sourceReaction ?? base.sourceReaction,
    targetReaction: overrides.targetReaction ?? base.targetReaction,
    audio: { ...base.audio, ...overrides.audio },
    launchAnchor: overrides.launchAnchor ?? base.launchAnchor,
    impactAnchor: overrides.impactAnchor ?? base.impactAnchor,
    sourceOffsetY: overrides.sourceOffsetY ?? base.sourceOffsetY,
    impactOffsetY: overrides.impactOffsetY ?? base.impactOffsetY
  };
}

const COMBAT_EFFECT_FAMILY_DEFINITIONS: Record<CombatEffectFamilyId, CombatEffectFamilyDefinition> = {
  'sanctified-arc': {
    family: 'sanctified-arc',
    telegraph: {
      anchor: 'source',
      duration: 90,
      ring: {
        tint: 0xf0d7a1,
        alpha: 0.22,
        width: 36,
        height: 14,
        duration: 90,
        startScale: 0.7,
        endScale: 1.2,
        strokeWidth: 2,
        strokeAlpha: 0.82
      },
      glowTint: 0xf3d7a2,
      glowAlpha: 0.16,
      glowScale: 0.44,
      particles: {
        tint: [0xffefc4, 0xf0c574, 0xcf8f47],
        count: 8,
        lifespan: 220,
        speedMin: 22,
        speedMax: 72,
        scaleStart: 0.72,
        scaleEnd: 0.04,
        angleSpread: 120,
        gravityY: 38,
        blendMode: 'ADD'
      }
    },
    impact: {
      anchor: 'target',
      duration: 150,
      sprite: {
        textureKey: 'sanctified-arc',
        tint: 0xf0d7a1,
        alpha: 0.96,
        startScale: 0.22,
        endScale: 0.72,
        duration: 150,
        additive: true,
        rotationOffset: 0.08,
        spin: 0.18
      },
      ring: {
        tint: 0xf1d5a1,
        alpha: 0.18,
        width: 56,
        height: 20,
        duration: 140,
        startScale: 0.78,
        endScale: 1.28,
        strokeWidth: 2,
        strokeAlpha: 0.62
      },
      glowTint: 0xf4d694,
      glowAlpha: 0.18,
      glowScale: 0.56,
      particles: {
        tint: [0xfff1c7, 0xf0c574, 0xc46f35],
        count: 16,
        lifespan: 300,
        speedMin: 28,
        speedMax: 102,
        scaleStart: 0.88,
        scaleEnd: 0.05,
        angleSpread: 150,
        gravityY: 80,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 120,
      ring: {
        tint: 0xe4c77f,
        alpha: 0.14,
        width: 64,
        height: 24,
        duration: 120,
        startScale: 0.92,
        endScale: 1.44,
        strokeWidth: 2,
        strokeAlpha: 0.42
      },
      glowTint: 0xf2c86f,
      glowAlpha: 0.1,
      glowScale: 0.52
    },
    camera: {
      shakeDuration: 90,
      shakeIntensity: 0.0018,
      hitStop: 28
    },
    sourceReaction: {
      kind: 'lunge',
      distance: 16,
      lift: 4,
      duration: 110,
      returnDuration: 95
    },
    targetReaction: {
      kind: 'recoil',
      flashTint: 0xffecd1,
      alphaMin: 0.44,
      offsetX: 9,
      offsetY: 6,
      duration: 78,
      repeat: 1
    },
    audio: {
      profile: 'sanctified-arc'
    },
    launchAnchor: 0.56,
    impactAnchor: 0.54
  },
  'chrono-ranged': {
    family: 'chrono-ranged',
    telegraph: {
      anchor: 'source',
      duration: 80,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xc6f3f0,
        alpha: 0.8,
        startScale: 0.08,
        endScale: 0.24,
        duration: 80,
        additive: true
      },
      ring: {
        tint: 0x9fe3dd,
        alpha: 0.18,
        width: 34,
        height: 12,
        duration: 80,
        startScale: 0.72,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.78
      },
      glowTint: 0x9fe3dd,
      glowAlpha: 0.16,
      glowScale: 0.38,
      particles: {
        tint: [0xe7fffb, 0x94e0d6, 0x4eb2af],
        count: 7,
        lifespan: 180,
        speedMin: 16,
        speedMax: 52,
        scaleStart: 0.56,
        scaleEnd: 0.04,
        angleSpread: 90,
        gravityY: 20,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 210,
      textureKey: 'chrono-ranged',
      tint: 0xb9efe6,
      alpha: 0.94,
      startScale: 0.2,
      endScale: 0.34,
      additive: true,
      trailTint: [0xf7f2de, 0x8fe1d4, 0x4cb0ac],
      trailScaleStart: 0.52,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 130,
      sprite: {
        textureKey: 'burst-discharge',
        tint: 0xc8f1ec,
        alpha: 0.86,
        startScale: 0.16,
        endScale: 0.42,
        duration: 130,
        additive: true,
        spin: 0.16
      },
      ring: {
        tint: 0x9fe3dd,
        alpha: 0.16,
        width: 46,
        height: 18,
        duration: 130,
        startScale: 0.78,
        endScale: 1.32,
        strokeWidth: 2,
        strokeAlpha: 0.62
      },
      glowTint: 0xb9eee1,
      glowAlpha: 0.12,
      glowScale: 0.42,
      particles: {
        tint: [0xf7f2de, 0x8fe1d4, 0x4cb0ac],
        count: 12,
        lifespan: 220,
        speedMin: 24,
        speedMax: 88,
        scaleStart: 0.68,
        scaleEnd: 0.05,
        angleSpread: 120,
        gravityY: 28,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 90,
      ring: {
        tint: 0x87d5cd,
        alpha: 0.14,
        width: 52,
        height: 20,
        duration: 90,
        startScale: 0.9,
        endScale: 1.36,
        strokeWidth: 2,
        strokeAlpha: 0.42
      }
    },
    camera: {
      shakeDuration: 70,
      shakeIntensity: 0.00115,
      hitStop: 12
    },
    sourceReaction: {
      kind: 'brace',
      distance: 8,
      lift: 2,
      duration: 90,
      returnDuration: 80
    },
    targetReaction: {
      kind: 'recoil',
      flashTint: 0xe7fff9,
      alphaMin: 0.5,
      offsetX: 7,
      offsetY: 4,
      duration: 72,
      repeat: 1
    },
    audio: {
      profile: 'chrono-ranged'
    },
    launchAnchor: 0.56,
    impactAnchor: 0.56
  },
  'burst-discharge': {
    family: 'burst-discharge',
    telegraph: {
      anchor: 'source',
      duration: 96,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xffb463,
        alpha: 0.78,
        startScale: 0.1,
        endScale: 0.28,
        duration: 96,
        additive: true
      },
      ring: {
        tint: 0xffb463,
        alpha: 0.18,
        width: 38,
        height: 14,
        duration: 96,
        startScale: 0.76,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.78
      },
      glowTint: 0xffa94c,
      glowAlpha: 0.18,
      glowScale: 0.44,
      particles: {
        tint: [0xfff0c4, 0xffb463, 0xd65b32],
        count: 10,
        lifespan: 220,
        speedMin: 16,
        speedMax: 68,
        scaleStart: 0.62,
        scaleEnd: 0.04,
        angleSpread: 140,
        gravityY: 48,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 170,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xffb463,
      alpha: 0.86,
      startScale: 0.14,
      endScale: 0.26,
      additive: true,
      arcHeight: 14,
      spin: 0.2,
      trailTint: [0xfff0c4, 0xffb463, 0xd65b32],
      trailScaleStart: 0.5,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 160,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.burst,
        tint: 0xff9c45,
        alpha: 0.94,
        startScale: 0.16,
        endScale: 0.62,
        duration: 160,
        additive: true,
        spin: 0.24
      },
      ring: {
        tint: 0xffc978,
        alpha: 0.18,
        width: 50,
        height: 18,
        duration: 160,
        startScale: 0.82,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.62
      },
      glowTint: 0xffa94c,
      glowAlpha: 0.18,
      glowScale: 0.54,
      particles: {
        tint: [0xfff0c4, 0xffb463, 0xd65b32],
        count: 18,
        lifespan: 280,
        speedMin: 30,
        speedMax: 110,
        scaleStart: 0.86,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: 64,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 110,
      ring: {
        tint: 0xffaa4f,
        alpha: 0.14,
        width: 58,
        height: 22,
        duration: 110,
        startScale: 0.9,
        endScale: 1.45,
        strokeWidth: 2,
        strokeAlpha: 0.44
      },
      glowTint: 0xffa94c,
      glowAlpha: 0.12,
      glowScale: 0.52
    },
    camera: {
      shakeDuration: 88,
      shakeIntensity: 0.00145,
      hitStop: 18
    },
    sourceReaction: {
      kind: 'brace',
      distance: 6,
      lift: 2,
      duration: 92,
      returnDuration: 82
    },
    targetReaction: {
      kind: 'recoil',
      flashTint: 0xffedcf,
      alphaMin: 0.46,
      offsetX: 6,
      offsetY: 6,
      duration: 74,
      repeat: 1
    },
    audio: {
      profile: 'burst-discharge'
    },
    launchAnchor: 0.58,
    impactAnchor: 0.56
  },
  'psychic-sigil': {
    family: 'psychic-sigil',
    telegraph: {
      anchor: 'target',
      duration: 110,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.sigil,
        tint: 0xd39ff6,
        alpha: 0.62,
        startScale: 0.18,
        endScale: 0.42,
        duration: 110,
        additive: true,
        spin: 0.1,
        offsetY: 10
      },
      ring: {
        tint: 0x67ded5,
        alpha: 0.16,
        width: 52,
        height: 18,
        duration: 110,
        startScale: 0.82,
        endScale: 1.24,
        strokeWidth: 2,
        strokeAlpha: 0.66,
        offsetY: 10
      },
      glowTint: 0x8055b6,
      glowAlpha: 0.18,
      glowScale: 0.5,
      particles: {
        tint: [0x6ee3d8, 0xd29ef6, 0x3e2d64],
        count: 12,
        lifespan: 240,
        speedMin: 12,
        speedMax: 56,
        scaleStart: 0.54,
        scaleEnd: 0.04,
        angleSpread: 360,
        gravityY: -24,
        blendMode: 'ADD',
        offsetY: 10
      }
    },
    impact: {
      anchor: 'target',
      duration: 180,
      sprite: {
        textureKey: 'psychic-sigil',
        tint: 0x67ded5,
        alpha: 0.76,
        startScale: 0.2,
        endScale: 0.72,
        duration: 180,
        additive: true,
        spin: 0.16,
        offsetY: 12
      },
      ring: {
        tint: 0xd39ff6,
        alpha: 0.2,
        width: 62,
        height: 22,
        duration: 180,
        startScale: 0.82,
        endScale: 1.46,
        strokeWidth: 2,
        strokeAlpha: 0.62,
        offsetY: 12
      },
      glowTint: 0x6f48ae,
      glowAlpha: 0.16,
      glowScale: 0.6,
      particles: {
        tint: [0x6ee3d8, 0xd29ef6, 0x31234d],
        count: 20,
        lifespan: 320,
        speedMin: 18,
        speedMax: 74,
        scaleStart: 0.72,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: -26,
        blendMode: 'ADD',
        offsetY: 12
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 130,
      ring: {
        tint: 0x7a5cb8,
        alpha: 0.14,
        width: 64,
        height: 24,
        duration: 130,
        startScale: 0.92,
        endScale: 1.52,
        strokeWidth: 2,
        strokeAlpha: 0.44,
        offsetY: 12
      },
      glowTint: 0x5b47aa,
      glowAlpha: 0.1,
      glowScale: 0.56
    },
    camera: {
      shakeDuration: 82,
      shakeIntensity: 0.0011,
      hitStop: 20
    },
    sourceReaction: {
      kind: 'lift',
      distance: 0,
      lift: 10,
      duration: 120,
      returnDuration: 100
    },
    targetReaction: {
      kind: 'phase',
      flashTint: 0xe7d1ff,
      alphaMin: 0.38,
      offsetX: 3,
      offsetY: -8,
      duration: 78,
      repeat: 1
    },
    audio: {
      profile: 'psychic-sigil'
    },
    launchAnchor: 0.6,
    impactAnchor: 0.62,
    impactOffsetY: 20
  },
  'temporal-rend': {
    family: 'temporal-rend',
    telegraph: {
      anchor: 'source',
      duration: 96,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xcaf8f2,
        alpha: 0.74,
        startScale: 0.16,
        endScale: 0.36,
        duration: 96,
        additive: true
      },
      ring: {
        tint: 0x96ece0,
        alpha: 0.18,
        width: 38,
        height: 14,
        duration: 96,
        startScale: 0.74,
        endScale: 1.2,
        strokeWidth: 2,
        strokeAlpha: 0.8
      },
      glowTint: 0x8ee7de,
      glowAlpha: 0.18,
      glowScale: 0.44,
      particles: {
        tint: [0xeefffd, 0x8ee7de, 0xffb86b],
        count: 10,
        lifespan: 220,
        speedMin: 18,
        speedMax: 64,
        scaleStart: 0.56,
        scaleEnd: 0.04,
        angleSpread: 160,
        gravityY: 18,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 180,
      textureKey: 'temporal-rend',
      tint: 0xa6efe6,
      alpha: 0.9,
      startScale: 0.18,
      endScale: 0.38,
      additive: true,
      rotationOffset: 0.14,
      arcHeight: 18,
      spin: 0.2,
      trailTint: [0xeefffd, 0x8ee7de, 0xffb86b],
      trailScaleStart: 0.48,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 150,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.arc,
        tint: 0xcaf8f2,
        alpha: 0.9,
        startScale: 0.22,
        endScale: 0.6,
        duration: 150,
        additive: true,
        rotationOffset: 0.22,
        spin: 0.24
      },
      ring: {
        tint: 0x8ee7de,
        alpha: 0.18,
        width: 54,
        height: 20,
        duration: 150,
        startScale: 0.84,
        endScale: 1.38,
        strokeWidth: 2,
        strokeAlpha: 0.62
      },
      glowTint: 0x90ebdf,
      glowAlpha: 0.14,
      glowScale: 0.5,
      particles: {
        tint: [0xeefffd, 0x8ee7de, 0xffb86b],
        count: 16,
        lifespan: 250,
        speedMin: 24,
        speedMax: 94,
        scaleStart: 0.72,
        scaleEnd: 0.05,
        angleSpread: 150,
        gravityY: 30,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 120,
      ring: {
        tint: 0xffb86b,
        alpha: 0.12,
        width: 62,
        height: 22,
        duration: 120,
        startScale: 0.94,
        endScale: 1.48,
        strokeWidth: 2,
        strokeAlpha: 0.38
      },
      glowTint: 0x90ebdf,
      glowAlpha: 0.08,
      glowScale: 0.52
    },
    camera: {
      shakeDuration: 78,
      shakeIntensity: 0.0015,
      hitStop: 22
    },
    sourceReaction: {
      kind: 'phase-step',
      distance: 10,
      lift: 6,
      duration: 90,
      returnDuration: 84
    },
    targetReaction: {
      kind: 'phase',
      flashTint: 0xeefffd,
      alphaMin: 0.42,
      offsetX: 6,
      offsetY: -6,
      duration: 72,
      repeat: 1
    },
    audio: {
      profile: 'temporal-rend'
    },
    launchAnchor: 0.58,
    impactAnchor: 0.56
  },
  'support-bloom': {
    family: 'support-bloom',
    telegraph: {
      anchor: 'source',
      duration: 88,
      sprite: {
        textureKey: 'support-bloom',
        tint: 0xf4dc9e,
        alpha: 0.74,
        startScale: 0.14,
        endScale: 0.32,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0xf4dc9e,
        alpha: 0.16,
        width: 36,
        height: 14,
        duration: 88,
        startScale: 0.76,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.78
      },
      glowTint: 0xf4dc9e,
      glowAlpha: 0.18,
      glowScale: 0.42,
      particles: {
        tint: [0xfff4d0, 0xf4dc9e, 0xb3ffc9],
        count: 10,
        lifespan: 220,
        speedMin: 12,
        speedMax: 52,
        scaleStart: 0.56,
        scaleEnd: 0.04,
        angleSpread: 160,
        gravityY: -18,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 160,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xf4dc9e,
      alpha: 0.84,
      startScale: 0.12,
      endScale: 0.24,
      additive: true,
      arcHeight: 12,
      spin: 0.16,
      trailTint: [0xfff4d0, 0xf4dc9e, 0xb3ffc9],
      trailScaleStart: 0.44,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 160,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.bloom,
        tint: 0xf4dc9e,
        alpha: 0.9,
        startScale: 0.18,
        endScale: 0.52,
        duration: 160,
        additive: true,
        spin: 0.18
      },
      ring: {
        tint: 0x9ae4b0,
        alpha: 0.18,
        width: 54,
        height: 20,
        duration: 160,
        startScale: 0.84,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.6
      },
      glowTint: 0xe0db97,
      glowAlpha: 0.18,
      glowScale: 0.56,
      particles: {
        tint: [0xfff4d0, 0xf4dc9e, 0xb3ffc9],
        count: 18,
        lifespan: 280,
        speedMin: 18,
        speedMax: 72,
        scaleStart: 0.74,
        scaleEnd: 0.05,
        angleSpread: 220,
        gravityY: -12,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 140,
      ring: {
        tint: 0xb3ffc9,
        alpha: 0.16,
        width: 60,
        height: 22,
        duration: 140,
        startScale: 0.94,
        endScale: 1.5,
        strokeWidth: 2,
        strokeAlpha: 0.44
      },
      glowTint: 0xe0db97,
      glowAlpha: 0.12,
      glowScale: 0.56
    },
    camera: {
      shakeDuration: 0,
      shakeIntensity: 0,
      hitStop: 0
    },
    sourceReaction: {
      kind: 'lift',
      distance: 0,
      lift: 8,
      duration: 110,
      returnDuration: 100
    },
    targetReaction: {
      kind: 'uplift',
      flashTint: 0xf6ffd7,
      alphaMin: 0.56,
      offsetX: 0,
      offsetY: -10,
      duration: 82,
      repeat: 1
    },
    audio: {
      profile: 'support-bloom'
    },
    launchAnchor: 0.6,
    impactAnchor: 0.72
  },
  'utility-extract': {
    family: 'utility-extract',
    telegraph: {
      anchor: 'target',
      duration: 88,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xf1d78e,
        alpha: 0.68,
        startScale: 0.16,
        endScale: 0.34,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0xf1d78e,
        alpha: 0.16,
        width: 44,
        height: 16,
        duration: 88,
        startScale: 0.78,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.72
      },
      glowTint: 0xf1d78e,
      glowAlpha: 0.14,
      glowScale: 0.42,
      particles: {
        tint: [0xfff2c8, 0xf1d78e, 0xb77841],
        count: 8,
        lifespan: 200,
        speedMin: 18,
        speedMax: 64,
        scaleStart: 0.52,
        scaleEnd: 0.04,
        angleSpread: 180,
        gravityY: 36,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'target',
      to: 'source',
      duration: 180,
      textureKey: 'utility-extract',
      tint: 0xf1d78e,
      alpha: 0.88,
      startScale: 0.18,
      endScale: 0.32,
      additive: true,
      spin: 0.18,
      trailTint: [0xfff2c8, 0xf1d78e, 0xb77841],
      trailScaleStart: 0.46,
      trailScaleEnd: 0.04
    },
    impact: {
      anchor: 'source',
      duration: 130,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.bloom,
        tint: 0xf1d78e,
        alpha: 0.8,
        startScale: 0.16,
        endScale: 0.36,
        duration: 130,
        additive: true,
        spin: 0.12
      },
      ring: {
        tint: 0xf1d78e,
        alpha: 0.16,
        width: 44,
        height: 16,
        duration: 130,
        startScale: 0.82,
        endScale: 1.3,
        strokeWidth: 2,
        strokeAlpha: 0.52
      },
      glowTint: 0xf1d78e,
      glowAlpha: 0.12,
      glowScale: 0.4,
      particles: {
        tint: [0xfff2c8, 0xf1d78e, 0xb77841],
        count: 12,
        lifespan: 220,
        speedMin: 20,
        speedMax: 78,
        scaleStart: 0.6,
        scaleEnd: 0.04,
        angleSpread: 160,
        gravityY: 44,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'source',
      duration: 100,
      ring: {
        tint: 0xf1d78e,
        alpha: 0.12,
        width: 52,
        height: 18,
        duration: 100,
        startScale: 0.92,
        endScale: 1.38,
        strokeWidth: 2,
        strokeAlpha: 0.34
      }
    },
    camera: {
      shakeDuration: 40,
      shakeIntensity: 0.00055,
      hitStop: 0
    },
    sourceReaction: {
      kind: 'lift',
      distance: 0,
      lift: 4,
      duration: 88,
      returnDuration: 80
    },
    targetReaction: {
      kind: 'phase',
      flashTint: 0xfff4d9,
      alphaMin: 0.48,
      offsetX: 4,
      offsetY: -4,
      duration: 70,
      repeat: 0
    },
    audio: {
      profile: 'utility-extract'
    },
    launchAnchor: 0.62,
    impactAnchor: 0.62
  },
  'item-use': {
    family: 'item-use',
    telegraph: {
      anchor: 'source',
      duration: 76,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xf2dca2,
        alpha: 0.74,
        startScale: 0.1,
        endScale: 0.24,
        duration: 76,
        additive: true
      },
      ring: {
        tint: 0xf2dca2,
        alpha: 0.14,
        width: 34,
        height: 14,
        duration: 76,
        startScale: 0.74,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.7
      },
      glowTint: 0xf2dca2,
      glowAlpha: 0.14,
      glowScale: 0.38,
      particles: {
        tint: [0xfff5d4, 0xf2dca2, 0x9adfb2],
        count: 8,
        lifespan: 180,
        speedMin: 12,
        speedMax: 48,
        scaleStart: 0.48,
        scaleEnd: 0.04,
        angleSpread: 150,
        gravityY: 12,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 140,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xf2dca2,
      alpha: 0.82,
      startScale: 0.12,
      endScale: 0.24,
      additive: true,
      arcHeight: 10,
      spin: 0.14,
      trailTint: [0xfff5d4, 0xf2dca2, 0x9adfb2],
      trailScaleStart: 0.42,
      trailScaleEnd: 0.04
    },
    impact: {
      anchor: 'target',
      duration: 150,
      sprite: {
        textureKey: 'item-use',
        tint: 0xf2dca2,
        alpha: 0.86,
        startScale: 0.18,
        endScale: 0.44,
        duration: 150,
        additive: true
      },
      ring: {
        tint: 0x9adfb2,
        alpha: 0.16,
        width: 52,
        height: 20,
        duration: 150,
        startScale: 0.82,
        endScale: 1.38,
        strokeWidth: 2,
        strokeAlpha: 0.56
      },
      glowTint: 0xf2dca2,
      glowAlpha: 0.14,
      glowScale: 0.5,
      particles: {
        tint: [0xfff5d4, 0xf2dca2, 0x9adfb2],
        count: 14,
        lifespan: 220,
        speedMin: 16,
        speedMax: 64,
        scaleStart: 0.62,
        scaleEnd: 0.04,
        angleSpread: 220,
        gravityY: -8,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 110,
      ring: {
        tint: 0x9adfb2,
        alpha: 0.14,
        width: 58,
        height: 22,
        duration: 110,
        startScale: 0.92,
        endScale: 1.44,
        strokeWidth: 2,
        strokeAlpha: 0.4
      }
    },
    camera: {
      shakeDuration: 0,
      shakeIntensity: 0,
      hitStop: 0
    },
    sourceReaction: {
      kind: 'lift',
      distance: 0,
      lift: 5,
      duration: 88,
      returnDuration: 82
    },
    targetReaction: {
      kind: 'uplift',
      flashTint: 0xfff7dd,
      alphaMin: 0.58,
      offsetX: 0,
      offsetY: -8,
      duration: 74,
      repeat: 0
    },
    audio: {
      profile: 'item-use'
    },
    launchAnchor: 0.6,
    impactAnchor: 0.72
  }
};

export const COMBAT_EFFECT_DEFINITIONS = {
  'breacher-strike': defineEffect('breacher-strike', 'sanctified-arc', {
    telegraph: {
      anchor: 'source',
      duration: 96,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.arc,
        tint: 0xe4c77e,
        alpha: 0.66,
        startScale: 0.14,
        endScale: 0.36,
        duration: 96,
        additive: true,
        rotationOffset: -0.26,
        spin: 0.28
      },
      ring: {
        tint: 0xe4c77e,
        alpha: 0.2,
        width: 38,
        height: 14,
        duration: 96,
        startScale: 0.74,
        endScale: 1.24,
        strokeWidth: 2,
        strokeAlpha: 0.82
      },
      glowTint: 0xe4c77e,
      glowAlpha: 0.16,
      glowScale: 0.46,
      particles: {
        tint: [0xffefc4, 0xe4c77e, 0x7e2e2c],
        count: 9,
        lifespan: 220,
        speedMin: 24,
        speedMax: 76,
        scaleStart: 0.74,
        scaleEnd: 0.04,
        angleSpread: 120,
        gravityY: 44,
        blendMode: 'ADD'
      }
    },
    impact: {
      anchor: 'target',
      duration: 158,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.arc,
        tint: 0xe6c779,
        alpha: 0.96,
        startScale: 0.2,
        endScale: 0.68,
        duration: 158,
        additive: true,
        rotationOffset: -0.18,
        spin: 0.34
      },
      ring: {
        tint: 0x7e2e2c,
        alpha: 0.14,
        width: 60,
        height: 20,
        duration: 150,
        startScale: 0.82,
        endScale: 1.32,
        strokeWidth: 2,
        strokeAlpha: 0.48
      },
      glowTint: 0xe4c77e,
      glowAlpha: 0.2,
      glowScale: 0.58,
      particles: {
        tint: [0xffefc4, 0xe4c77e, 0x7e2e2c],
        count: 18,
        lifespan: 310,
        speedMin: 28,
        speedMax: 108,
        scaleStart: 0.9,
        scaleEnd: 0.05,
        angleSpread: 160,
        gravityY: 90,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 126,
      sprite: {
        textureKey: 'sanctified-arc',
        tint: 0xe4c77e,
        alpha: 0.46,
        startScale: 0.16,
        endScale: 0.34,
        duration: 126,
        additive: true,
        rotationOffset: 0.08,
        spin: 0.14
      },
      ring: {
        tint: 0x7e2e2c,
        alpha: 0.12,
        width: 64,
        height: 22,
        duration: 126,
        startScale: 0.94,
        endScale: 1.44,
        strokeWidth: 2,
        strokeAlpha: 0.34
      },
      glowTint: 0xe4c77e,
      glowAlpha: 0.12,
      glowScale: 0.54
    },
    camera: {
      shakeDuration: 94,
      shakeIntensity: 0.00195,
      hitStop: 32
    }
  }),
  'aevum-staff': defineEffect('aevum-staff', 'sanctified-arc', {
    telegraph: {
      anchor: 'source',
      duration: 92,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xf0d7a1,
        alpha: 0.62,
        startScale: 0.12,
        endScale: 0.28,
        duration: 92,
        additive: true,
        spin: 0.16
      },
      ring: {
        tint: 0xf0d7a1,
        alpha: 0.18,
        width: 36,
        height: 14,
        duration: 92,
        startScale: 0.72,
        endScale: 1.2,
        strokeWidth: 2,
        strokeAlpha: 0.78
      },
      glowTint: 0xf0d7a1,
      glowAlpha: 0.16,
      glowScale: 0.44,
      particles: {
        tint: [0xfff0cf, 0xf0d7a1, 0xca6d41],
        count: 8,
        lifespan: 210,
        speedMin: 22,
        speedMax: 72,
        scaleStart: 0.7,
        scaleEnd: 0.04,
        angleSpread: 120,
        gravityY: 38,
        blendMode: 'ADD'
      }
    },
    impact: {
      anchor: 'target',
      duration: 146,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.bloom,
        tint: 0xf0d7a1,
        alpha: 0.92,
        startScale: 0.18,
        endScale: 0.5,
        duration: 146,
        additive: true,
        rotationOffset: 0.02,
        spin: 0.18
      },
      ring: {
        tint: 0xc96f42,
        alpha: 0.12,
        width: 56,
        height: 20,
        duration: 140,
        startScale: 0.82,
        endScale: 1.3,
        strokeWidth: 2,
        strokeAlpha: 0.42
      },
      glowTint: 0xf0d7a1,
      glowAlpha: 0.18,
      glowScale: 0.54,
      particles: {
        tint: [0xfff0cf, 0xf0d7a1, 0xca6d41],
        count: 16,
        lifespan: 290,
        speedMin: 24,
        speedMax: 96,
        scaleStart: 0.84,
        scaleEnd: 0.05,
        angleSpread: 150,
        gravityY: 82,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 116,
      sprite: {
        textureKey: 'sanctified-arc',
        tint: 0xf0d7a1,
        alpha: 0.4,
        startScale: 0.14,
        endScale: 0.32,
        duration: 116,
        additive: true,
        spin: 0.12
      },
      ring: {
        tint: 0xc96f42,
        alpha: 0.1,
        width: 60,
        height: 22,
        duration: 116,
        startScale: 0.92,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.32
      },
      glowTint: 0xf0d7a1,
      glowAlpha: 0.1,
      glowScale: 0.48
    },
    sourceReaction: {
      kind: 'lift',
      distance: 0,
      lift: 6,
      duration: 106,
      returnDuration: 92
    }
  }),
  'breaker-cleave': defineEffect('breaker-cleave', 'sanctified-arc', {
    telegraph: {
      anchor: 'source',
      duration: 98,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
        tint: 0x63d9cb,
        alpha: 0.64,
        startScale: 0.16,
        endScale: 0.4,
        duration: 98,
        additive: true,
        rotationOffset: -0.2,
        spin: 0.24
      },
      ring: {
        tint: 0x63d9cb,
        alpha: 0.18,
        width: 40,
        height: 14,
        duration: 98,
        startScale: 0.76,
        endScale: 1.24,
        strokeWidth: 2,
        strokeAlpha: 0.76
      },
      glowTint: 0x63d9cb,
      glowAlpha: 0.12,
      glowScale: 0.42,
      particles: {
        tint: [0x9df4e6, 0x63d9cb, 0xae4b2f],
        count: 10,
        lifespan: 220,
        speedMin: 24,
        speedMax: 80,
        scaleStart: 0.74,
        scaleEnd: 0.04,
        angleSpread: 130,
        gravityY: 50,
        blendMode: 'ADD'
      }
    },
    impact: {
      anchor: 'target',
      duration: 166,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
        tint: 0xae4b2f,
        alpha: 0.96,
        startScale: 0.2,
        endScale: 0.7,
        duration: 166,
        additive: true,
        rotationOffset: -0.08,
        spin: 0.3
      },
      ring: {
        tint: 0x63d9cb,
        alpha: 0.14,
        width: 62,
        height: 22,
        duration: 158,
        startScale: 0.84,
        endScale: 1.34,
        strokeWidth: 2,
        strokeAlpha: 0.46
      },
      glowTint: 0x63d9cb,
      glowAlpha: 0.14,
      glowScale: 0.56,
      particles: {
        tint: [0x9df4e6, 0x63d9cb, 0xae4b2f],
        count: 20,
        lifespan: 320,
        speedMin: 34,
        speedMax: 116,
        scaleStart: 0.94,
        scaleEnd: 0.05,
        angleSpread: 170,
        gravityY: 92,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 118,
      sprite: {
        textureKey: 'sanctified-arc',
        tint: 0x63d9cb,
        alpha: 0.38,
        startScale: 0.16,
        endScale: 0.36,
        duration: 118,
        additive: true,
        spin: 0.12
      },
      ring: {
        tint: 0xae4b2f,
        alpha: 0.1,
        width: 66,
        height: 24,
        duration: 118,
        startScale: 0.94,
        endScale: 1.46,
        strokeWidth: 2,
        strokeAlpha: 0.32
      }
    },
    camera: {
      shakeDuration: 102,
      shakeIntensity: 0.0021,
      hitStop: 34
    },
    sourceReaction: {
      kind: 'lunge',
      distance: 20,
      lift: 5,
      duration: 118,
      returnDuration: 100
    }
  }),
  'relay-lance': defineEffect('relay-lance', 'chrono-ranged', {
    telegraph: {
      anchor: 'source',
      duration: 88,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.lance,
        tint: 0xe6c679,
        alpha: 0.7,
        startScale: 0.16,
        endScale: 0.34,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0xe6c679,
        alpha: 0.16,
        width: 36,
        height: 12,
        duration: 88,
        startScale: 0.74,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.76
      },
      glowTint: 0xe6c679,
      glowAlpha: 0.14,
      glowScale: 0.4
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 236,
      textureKey: COMBAT_FX_TEXTURE_KEYS.lance,
      tint: 0xe6c679,
      alpha: 0.96,
      startScale: 0.26,
      endScale: 0.48,
      additive: true,
      arcHeight: 4,
      trailTint: [0xffefc4, 0xe6c679, 0x7a2c2b],
      trailScaleStart: 0.54,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 136,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xe6c679,
        alpha: 0.88,
        startScale: 0.14,
        endScale: 0.34,
        duration: 136,
        additive: true,
        spin: 0.14
      },
      ring: {
        tint: 0x7a2c2b,
        alpha: 0.12,
        width: 46,
        height: 18,
        duration: 130,
        startScale: 0.82,
        endScale: 1.32,
        strokeWidth: 2,
        strokeAlpha: 0.44
      },
      glowTint: 0xe6c679,
      glowAlpha: 0.12,
      glowScale: 0.44,
      particles: {
        tint: [0xffefc4, 0xe6c679, 0x7a2c2b],
        count: 12,
        lifespan: 220,
        speedMin: 24,
        speedMax: 88,
        scaleStart: 0.68,
        scaleEnd: 0.05,
        angleSpread: 120,
        gravityY: 32,
        blendMode: 'ADD'
      }
    }
  }),
  'chrono-carbine': defineEffect('chrono-carbine', 'chrono-ranged', {
    travel: {
      from: 'source',
      to: 'target',
      duration: 176,
      textureKey: 'chrono-ranged',
      tint: 0xa0ece1,
      alpha: 0.96,
      startScale: 0.14,
      endScale: 0.22,
      additive: true,
      arcHeight: 2,
      trailTint: [0xf3fffd, 0xa0ece1, 0xf4a15d],
      trailScaleStart: 0.38,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 112,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xa0ece1,
        alpha: 0.82,
        startScale: 0.12,
        endScale: 0.26,
        duration: 112,
        additive: true,
        spin: 0.12
      },
      ring: {
        tint: 0xf4a15d,
        alpha: 0.1,
        width: 38,
        height: 14,
        duration: 108,
        startScale: 0.8,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.34
      },
      glowTint: 0xa0ece1,
      glowAlpha: 0.1,
      glowScale: 0.34,
      particles: {
        tint: [0xf3fffd, 0xa0ece1, 0xf4a15d],
        count: 10,
        lifespan: 180,
        speedMin: 18,
        speedMax: 72,
        scaleStart: 0.48,
        scaleEnd: 0.04,
        angleSpread: 100,
        gravityY: 18,
        blendMode: 'ADD'
      }
    }
  }),
  'anchor-spike': defineEffect('anchor-spike', 'chrono-ranged', {
    telegraph: {
      anchor: 'source',
      duration: 90,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xf4a15d,
        alpha: 0.82,
        startScale: 0.1,
        endScale: 0.28,
        duration: 90,
        additive: true
      },
      ring: {
        tint: 0xa0ece1,
        alpha: 0.16,
        width: 36,
        height: 14,
        duration: 90,
        startScale: 0.76,
        endScale: 1.2,
        strokeWidth: 2,
        strokeAlpha: 0.78
      },
      glowTint: 0xa0ece1,
      glowAlpha: 0.14,
      glowScale: 0.42,
      particles: {
        tint: [0xf3fffd, 0xa0ece1, 0xf4a15d],
        count: 8,
        lifespan: 200,
        speedMin: 18,
        speedMax: 58,
        scaleStart: 0.58,
        scaleEnd: 0.04,
        angleSpread: 100,
        gravityY: 22,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 246,
      textureKey: COMBAT_FX_TEXTURE_KEYS.lance,
      tint: 0xf4a15d,
      alpha: 0.94,
      startScale: 0.26,
      endScale: 0.52,
      additive: true,
      arcHeight: 6,
      spin: 0.08,
      trailTint: [0xf3fffd, 0xa0ece1, 0xf4a15d],
      trailScaleStart: 0.56,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 150,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.lance,
        tint: 0xf4a15d,
        alpha: 0.86,
        startScale: 0.18,
        endScale: 0.34,
        duration: 150,
        additive: true,
        rotationOffset: 1.57,
        spin: 0.06
      },
      ring: {
        tint: 0xa0ece1,
        alpha: 0.14,
        width: 52,
        height: 18,
        duration: 144,
        startScale: 0.84,
        endScale: 1.34,
        strokeWidth: 2,
        strokeAlpha: 0.42
      },
      glowTint: 0xf4a15d,
      glowAlpha: 0.14,
      glowScale: 0.46,
      particles: {
        tint: [0xf3fffd, 0xa0ece1, 0xf4a15d],
        count: 16,
        lifespan: 240,
        speedMin: 26,
        speedMax: 96,
        scaleStart: 0.72,
        scaleEnd: 0.05,
        angleSpread: 120,
        gravityY: 36,
        blendMode: 'ADD'
      }
    }
  }),
  'scrapline-shot': defineEffect('scrapline-shot', 'chrono-ranged', {
    travel: {
      from: 'source',
      to: 'target',
      duration: 205,
      textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
      tint: 0xf0a060,
      alpha: 0.94,
      startScale: 0.18,
      endScale: 0.34,
      additive: true,
      arcHeight: 8,
      spin: 0.22,
      trailTint: [0xfdf5dd, 0xf0a060, 0x8fcfc8],
      trailScaleStart: 0.48,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 130,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
        tint: 0xf0a060,
        alpha: 0.86,
        startScale: 0.16,
        endScale: 0.5,
        duration: 130,
        additive: true,
        spin: 0.22
      },
      ring: {
        tint: 0x8fcfc8,
        alpha: 0.12,
        width: 46,
        height: 18,
        duration: 130,
        startScale: 0.82,
        endScale: 1.3,
        strokeWidth: 2,
        strokeAlpha: 0.4
      },
      glowTint: 0xf0a060,
      glowAlpha: 0.12,
      glowScale: 0.42,
      particles: {
        tint: [0xfdf5dd, 0xf0a060, 0x8fcfc8],
        count: 12,
        lifespan: 220,
        speedMin: 22,
        speedMax: 84,
        scaleStart: 0.66,
        scaleEnd: 0.05,
        angleSpread: 120,
        gravityY: 28,
        blendMode: 'ADD'
      }
    }
  }),
  'tracer-volley': defineEffect('tracer-volley', 'chrono-ranged', {
    travel: {
      from: 'source',
      to: 'target',
      duration: 198,
      textureKey: COMBAT_FX_TEXTURE_KEYS.lance,
      tint: 0xde6a52,
      alpha: 0.94,
      startScale: 0.14,
      endScale: 0.24,
      additive: true,
      burstCount: 3,
      burstDelay: 32,
      spread: 12,
      alphaFalloff: 0.16,
      trailTint: [0xfff0d0, 0xde6a52, 0x7a2c2b],
      trailScaleStart: 0.48,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 128,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.burst,
        tint: 0xde6a52,
        alpha: 0.84,
        startScale: 0.14,
        endScale: 0.34,
        duration: 128,
        additive: true,
        spin: 0.14
      },
      ring: {
        tint: 0x7a2c2b,
        alpha: 0.12,
        width: 46,
        height: 18,
        duration: 126,
        startScale: 0.82,
        endScale: 1.28,
        strokeWidth: 2,
        strokeAlpha: 0.38
      },
      glowTint: 0xde6a52,
      glowAlpha: 0.1,
      glowScale: 0.4,
      particles: {
        tint: [0xfff0d0, 0xde6a52, 0x7a2c2b],
        count: 11,
        lifespan: 210,
        speedMin: 22,
        speedMax: 80,
        scaleStart: 0.64,
        scaleEnd: 0.05,
        angleSpread: 120,
        gravityY: 26,
        blendMode: 'ADD'
      }
    }
  }),
  'brine-shot': defineEffect('brine-shot', 'chrono-ranged', {
    telegraph: {
      anchor: 'source',
      duration: 84,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0x73e0d6,
        alpha: 0.78,
        startScale: 0.1,
        endScale: 0.24,
        duration: 84,
        additive: true
      },
      ring: {
        tint: 0x73e0d6,
        alpha: 0.16,
        width: 34,
        height: 12,
        duration: 84,
        startScale: 0.72,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.74
      },
      glowTint: 0x73e0d6,
      glowAlpha: 0.14,
      glowScale: 0.38,
      particles: {
        tint: [0xc4fff7, 0x73e0d6, 0xaf5d33],
        count: 8,
        lifespan: 180,
        speedMin: 18,
        speedMax: 56,
        scaleStart: 0.54,
        scaleEnd: 0.04,
        angleSpread: 100,
        gravityY: 22,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 225,
      textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
      tint: 0x73e0d6,
      alpha: 0.94,
      startScale: 0.18,
      endScale: 0.4,
      additive: true,
      arcHeight: 16,
      spin: 0.24,
      trailTint: [0xc4fff7, 0x73e0d6, 0xaf5d33],
      trailScaleStart: 0.5,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 138,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
        tint: 0x73e0d6,
        alpha: 0.82,
        startScale: 0.18,
        endScale: 0.46,
        duration: 138,
        additive: true,
        spin: 0.18
      },
      ring: {
        tint: 0xaf5d33,
        alpha: 0.12,
        width: 48,
        height: 18,
        duration: 132,
        startScale: 0.84,
        endScale: 1.32,
        strokeWidth: 2,
        strokeAlpha: 0.4
      },
      glowTint: 0x73e0d6,
      glowAlpha: 0.12,
      glowScale: 0.44,
      particles: {
        tint: [0xc4fff7, 0x73e0d6, 0xaf5d33],
        count: 14,
        lifespan: 240,
        speedMin: 22,
        speedMax: 88,
        scaleStart: 0.7,
        scaleEnd: 0.05,
        angleSpread: 140,
        gravityY: 30,
        blendMode: 'ADD'
      }
    }
  }),
  'cautery-charge': defineEffect('cautery-charge', 'burst-discharge', {
    travel: {
      from: 'source',
      to: 'target',
      duration: 156,
      textureKey: COMBAT_FX_TEXTURE_KEYS.lance,
      tint: 0xffb463,
      alpha: 0.9,
      startScale: 0.2,
      endScale: 0.38,
      additive: true,
      arcHeight: 8,
      spin: 0.16,
      trailTint: [0xfff0c4, 0xffb463, 0xd65b32],
      trailScaleStart: 0.46,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 152,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.burst,
        tint: 0xff9c45,
        alpha: 0.94,
        startScale: 0.18,
        endScale: 0.58,
        duration: 152,
        additive: true,
        spin: 0.28
      },
      ring: {
        tint: 0xffc978,
        alpha: 0.18,
        width: 52,
        height: 18,
        duration: 152,
        startScale: 0.82,
        endScale: 1.4,
        strokeWidth: 2,
        strokeAlpha: 0.58
      },
      glowTint: 0xffa94c,
      glowAlpha: 0.18,
      glowScale: 0.56,
      particles: {
        tint: [0xfff0c4, 0xffb463, 0xd65b32],
        count: 20,
        lifespan: 260,
        speedMin: 30,
        speedMax: 116,
        scaleStart: 0.82,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: 62,
        blendMode: 'ADD'
      }
    }
  }),
  'reactor-pulse': defineEffect('reactor-pulse', 'burst-discharge', {
    telegraph: {
      anchor: 'source',
      duration: 96,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xa4ece3,
        alpha: 0.8,
        startScale: 0.1,
        endScale: 0.28,
        duration: 96,
        additive: true
      },
      ring: {
        tint: 0xa4ece3,
        alpha: 0.16,
        width: 38,
        height: 14,
        duration: 96,
        startScale: 0.76,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.76
      },
      glowTint: 0xa4ece3,
      glowAlpha: 0.16,
      glowScale: 0.44,
      particles: {
        tint: [0xf2fffd, 0xa4ece3, 0xf4a15d],
        count: 10,
        lifespan: 220,
        speedMin: 16,
        speedMax: 68,
        scaleStart: 0.62,
        scaleEnd: 0.04,
        angleSpread: 140,
        gravityY: 48,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 176,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xa4ece3,
      alpha: 0.88,
      startScale: 0.14,
      endScale: 0.26,
      additive: true,
      arcHeight: 14,
      spin: 0.2,
      trailTint: [0xf2fffd, 0xa4ece3, 0xf4a15d],
      trailScaleStart: 0.5,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 164,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xa4ece3,
        alpha: 0.92,
        startScale: 0.14,
        endScale: 0.34,
        duration: 164,
        additive: true,
        spin: 0.26
      },
      ring: {
        tint: 0xf4a15d,
        alpha: 0.16,
        width: 50,
        height: 18,
        duration: 160,
        startScale: 0.82,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.54
      },
      glowTint: 0xa4ece3,
      glowAlpha: 0.16,
      glowScale: 0.56,
      particles: {
        tint: [0xf2fffd, 0xa4ece3, 0xf4a15d],
        count: 18,
        lifespan: 280,
        speedMin: 30,
        speedMax: 110,
        scaleStart: 0.86,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: 64,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 120,
      sprite: {
        textureKey: 'burst-discharge',
        tint: 0xa4ece3,
        alpha: 0.34,
        startScale: 0.18,
        endScale: 0.4,
        duration: 120,
        additive: true,
        spin: 0.16
      },
      ring: {
        tint: 0xf4a15d,
        alpha: 0.12,
        width: 56,
        height: 22,
        duration: 120,
        startScale: 0.92,
        endScale: 1.48,
        strokeWidth: 2,
        strokeAlpha: 0.34
      }
    }
  }),
  'relic-pulse': defineEffect('relic-pulse', 'burst-discharge', {
    telegraph: {
      anchor: 'source',
      duration: 96,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xf0d8a5,
        alpha: 0.8,
        startScale: 0.1,
        endScale: 0.28,
        duration: 96,
        additive: true
      },
      ring: {
        tint: 0xd4a4ed,
        alpha: 0.14,
        width: 38,
        height: 14,
        duration: 96,
        startScale: 0.76,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.68
      },
      glowTint: 0xf0d8a5,
      glowAlpha: 0.16,
      glowScale: 0.44,
      particles: {
        tint: [0xfff4d0, 0xf0d8a5, 0xd4a4ed],
        count: 10,
        lifespan: 220,
        speedMin: 16,
        speedMax: 68,
        scaleStart: 0.62,
        scaleEnd: 0.04,
        angleSpread: 140,
        gravityY: 48,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 168,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xf0d8a5,
      alpha: 0.86,
      startScale: 0.14,
      endScale: 0.26,
      additive: true,
      arcHeight: 12,
      spin: 0.16,
      trailTint: [0xfff4d0, 0xf0d8a5, 0xd4a4ed],
      trailScaleStart: 0.48,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 162,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.bloom,
        tint: 0xf0d8a5,
        alpha: 0.9,
        startScale: 0.18,
        endScale: 0.48,
        duration: 162,
        additive: true,
        spin: 0.2
      },
      ring: {
        tint: 0xd4a4ed,
        alpha: 0.16,
        width: 50,
        height: 18,
        duration: 160,
        startScale: 0.82,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.56
      },
      glowTint: 0xf0d8a5,
      glowAlpha: 0.16,
      glowScale: 0.54,
      particles: {
        tint: [0xfff4d0, 0xf0d8a5, 0xd4a4ed],
        count: 18,
        lifespan: 280,
        speedMin: 30,
        speedMax: 110,
        scaleStart: 0.86,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: 64,
        blendMode: 'ADD'
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 124,
      sprite: {
        textureKey: 'burst-discharge',
        tint: 0xd4a4ed,
        alpha: 0.32,
        startScale: 0.16,
        endScale: 0.38,
        duration: 124,
        additive: true,
        spin: 0.14
      },
      ring: {
        tint: 0xf0d8a5,
        alpha: 0.1,
        width: 58,
        height: 22,
        duration: 124,
        startScale: 0.92,
        endScale: 1.46,
        strokeWidth: 2,
        strokeAlpha: 0.34
      }
    }
  }),
  'mirage-bind': defineEffect('mirage-bind', 'psychic-sigil', {
    telegraph: {
      anchor: 'target',
      duration: 112,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.sigil,
        tint: 0xd4a4ed,
        alpha: 0.64,
        startScale: 0.18,
        endScale: 0.44,
        duration: 112,
        additive: true,
        spin: 0.1,
        offsetY: 10
      },
      ring: {
        tint: 0xf0d8a5,
        alpha: 0.14,
        width: 52,
        height: 18,
        duration: 112,
        startScale: 0.82,
        endScale: 1.24,
        strokeWidth: 2,
        strokeAlpha: 0.6,
        offsetY: 10
      },
      glowTint: 0xa267cf,
      glowAlpha: 0.16,
      glowScale: 0.5,
      particles: {
        tint: [0xf0d8a5, 0xd4a4ed, 0x3e2d64],
        count: 12,
        lifespan: 240,
        speedMin: 12,
        speedMax: 56,
        scaleStart: 0.54,
        scaleEnd: 0.04,
        angleSpread: 360,
        gravityY: -24,
        blendMode: 'ADD',
        offsetY: 10
      }
    },
    impact: {
      anchor: 'target',
      duration: 182,
      sprite: {
        textureKey: 'psychic-sigil',
        tint: 0xf0d8a5,
        alpha: 0.74,
        startScale: 0.2,
        endScale: 0.74,
        duration: 182,
        additive: true,
        spin: 0.14,
        offsetY: 12
      },
      ring: {
        tint: 0xd4a4ed,
        alpha: 0.18,
        width: 62,
        height: 22,
        duration: 182,
        startScale: 0.82,
        endScale: 1.46,
        strokeWidth: 2,
        strokeAlpha: 0.56,
        offsetY: 12
      },
      glowTint: 0xa267cf,
      glowAlpha: 0.16,
      glowScale: 0.6,
      particles: {
        tint: [0xf0d8a5, 0xd4a4ed, 0x3e2d64],
        count: 20,
        lifespan: 320,
        speedMin: 18,
        speedMax: 74,
        scaleStart: 0.72,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: -26,
        blendMode: 'ADD',
        offsetY: 12
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 128,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xd4a4ed,
        alpha: 0.34,
        startScale: 0.18,
        endScale: 0.34,
        duration: 128,
        additive: true,
        spin: 0.16,
        offsetY: 12
      },
      ring: {
        tint: 0xf0d8a5,
        alpha: 0.12,
        width: 66,
        height: 24,
        duration: 128,
        startScale: 0.94,
        endScale: 1.5,
        strokeWidth: 2,
        strokeAlpha: 0.34,
        offsetY: 12
      }
    }
  }),
  'phase-lash': defineEffect('phase-lash', 'psychic-sigil', {
    telegraph: {
      anchor: 'target',
      duration: 110,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.sigil,
        tint: 0x67ded5,
        alpha: 0.64,
        startScale: 0.18,
        endScale: 0.42,
        duration: 110,
        additive: true,
        spin: 0.12,
        offsetY: 12
      },
      ring: {
        tint: 0x8654c5,
        alpha: 0.16,
        width: 54,
        height: 18,
        duration: 110,
        startScale: 0.82,
        endScale: 1.24,
        strokeWidth: 2,
        strokeAlpha: 0.6,
        offsetY: 12
      },
      glowTint: 0x3f8f8b,
      glowAlpha: 0.16,
      glowScale: 0.52,
      particles: {
        tint: [0xb3fff7, 0x67ded5, 0x8654c5],
        count: 12,
        lifespan: 240,
        speedMin: 12,
        speedMax: 56,
        scaleStart: 0.54,
        scaleEnd: 0.04,
        angleSpread: 360,
        gravityY: -20,
        blendMode: 'ADD',
        offsetY: 12
      }
    },
    impact: {
      anchor: 'target',
      duration: 182,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
        tint: 0x67ded5,
        alpha: 0.76,
        startScale: 0.2,
        endScale: 0.62,
        duration: 182,
        additive: true,
        rotationOffset: -0.22,
        spin: 0.28,
        offsetY: 14
      },
      ring: {
        tint: 0x8654c5,
        alpha: 0.18,
        width: 62,
        height: 22,
        duration: 182,
        startScale: 0.82,
        endScale: 1.46,
        strokeWidth: 2,
        strokeAlpha: 0.56,
        offsetY: 14
      },
      glowTint: 0x3f8f8b,
      glowAlpha: 0.16,
      glowScale: 0.6,
      particles: {
        tint: [0xb3fff7, 0x67ded5, 0x8654c5],
        count: 20,
        lifespan: 320,
        speedMin: 18,
        speedMax: 74,
        scaleStart: 0.72,
        scaleEnd: 0.05,
        angleSpread: 180,
        gravityY: -24,
        blendMode: 'ADD',
        offsetY: 14
      }
    },
    afterglow: {
      anchor: 'target',
      duration: 120,
      sprite: {
        textureKey: 'psychic-sigil',
        tint: 0x8654c5,
        alpha: 0.3,
        startScale: 0.16,
        endScale: 0.36,
        duration: 120,
        additive: true,
        spin: 0.16,
        offsetY: 14
      },
      ring: {
        tint: 0x67ded5,
        alpha: 0.12,
        width: 64,
        height: 24,
        duration: 120,
        startScale: 0.92,
        endScale: 1.48,
        strokeWidth: 2,
        strokeAlpha: 0.34,
        offsetY: 14
      }
    }
  }),
  'chronal-rend': defineEffect('chronal-rend', 'temporal-rend', {
    impact: {
      anchor: 'target',
      duration: 152,
      sprite: {
        textureKey: 'temporal-rend',
        tint: 0xa6efe6,
        alpha: 0.88,
        startScale: 0.18,
        endScale: 0.5,
        duration: 152,
        additive: true,
        rotationOffset: 0.1,
        spin: 0.18
      },
      ring: {
        tint: 0x8ee7de,
        alpha: 0.18,
        width: 56,
        height: 20,
        duration: 150,
        startScale: 0.84,
        endScale: 1.38,
        strokeWidth: 2,
        strokeAlpha: 0.58
      },
      glowTint: 0x90ebdf,
      glowAlpha: 0.14,
      glowScale: 0.52,
      particles: {
        tint: [0xeefffd, 0x8ee7de, 0xffb86b],
        count: 18,
        lifespan: 250,
        speedMin: 24,
        speedMax: 96,
        scaleStart: 0.74,
        scaleEnd: 0.05,
        angleSpread: 160,
        gravityY: 26,
        blendMode: 'ADD'
      }
    }
  }),
  'time-shear': defineEffect('time-shear', 'temporal-rend', {
    telegraph: {
      anchor: 'source',
      duration: 100,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xffb86b,
        alpha: 0.76,
        startScale: 0.1,
        endScale: 0.28,
        duration: 100,
        additive: true
      },
      ring: {
        tint: 0x96ece0,
        alpha: 0.18,
        width: 38,
        height: 14,
        duration: 100,
        startScale: 0.74,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.8
      },
      glowTint: 0x8ee7de,
      glowAlpha: 0.18,
      glowScale: 0.44,
      particles: {
        tint: [0xeefffd, 0x8ee7de, 0xffb86b],
        count: 12,
        lifespan: 220,
        speedMin: 18,
        speedMax: 64,
        scaleStart: 0.56,
        scaleEnd: 0.04,
        angleSpread: 170,
        gravityY: 18,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 190,
      textureKey: COMBAT_FX_TEXTURE_KEYS.arc,
      tint: 0xffb86b,
      alpha: 0.92,
      startScale: 0.2,
      endScale: 0.42,
      additive: true,
      rotationOffset: 0.18,
      arcHeight: 20,
      spin: 0.28,
      trailTint: [0xeefffd, 0x8ee7de, 0xffb86b],
      trailScaleStart: 0.5,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 144,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.wave,
        tint: 0xffb86b,
        alpha: 0.88,
        startScale: 0.18,
        endScale: 0.52,
        duration: 144,
        additive: true,
        rotationOffset: -0.16,
        spin: 0.32
      },
      ring: {
        tint: 0x8ee7de,
        alpha: 0.16,
        width: 54,
        height: 20,
        duration: 144,
        startScale: 0.84,
        endScale: 1.34,
        strokeWidth: 2,
        strokeAlpha: 0.52
      },
      glowTint: 0xffb86b,
      glowAlpha: 0.14,
      glowScale: 0.48,
      particles: {
        tint: [0xeefffd, 0x8ee7de, 0xffb86b],
        count: 16,
        lifespan: 220,
        speedMin: 24,
        speedMax: 94,
        scaleStart: 0.7,
        scaleEnd: 0.05,
        angleSpread: 140,
        gravityY: 24,
        blendMode: 'ADD'
      }
    }
  }),
  'field-mend': defineEffect('field-mend', 'support-bloom', {}),
  'rewind-patch': defineEffect('rewind-patch', 'support-bloom', {
    telegraph: {
      anchor: 'source',
      duration: 88,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.bloom,
        tint: 0xa6ebe3,
        alpha: 0.74,
        startScale: 0.14,
        endScale: 0.32,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0xa6ebe3,
        alpha: 0.16,
        width: 36,
        height: 14,
        duration: 88,
        startScale: 0.76,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.76
      },
      glowTint: 0xa6ebe3,
      glowAlpha: 0.18,
      glowScale: 0.42,
      particles: {
        tint: [0xf5fffd, 0xa6ebe3, 0xf0d58d],
        count: 10,
        lifespan: 220,
        speedMin: 12,
        speedMax: 52,
        scaleStart: 0.56,
        scaleEnd: 0.04,
        angleSpread: 160,
        gravityY: -18,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 160,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xa6ebe3,
      alpha: 0.84,
      startScale: 0.12,
      endScale: 0.24,
      additive: true,
      arcHeight: 12,
      spin: 0.16,
      trailTint: [0xf5fffd, 0xa6ebe3, 0xf0d58d],
      trailScaleStart: 0.44,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 160,
      sprite: {
        textureKey: 'support-bloom',
        tint: 0xa6ebe3,
        alpha: 0.9,
        startScale: 0.18,
        endScale: 0.52,
        duration: 160,
        additive: true,
        spin: 0.18
      },
      ring: {
        tint: 0xf0d58d,
        alpha: 0.16,
        width: 54,
        height: 20,
        duration: 160,
        startScale: 0.84,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.52
      },
      glowTint: 0xa6ebe3,
      glowAlpha: 0.18,
      glowScale: 0.56,
      particles: {
        tint: [0xf5fffd, 0xa6ebe3, 0xf0d58d],
        count: 18,
        lifespan: 280,
        speedMin: 18,
        speedMax: 72,
        scaleStart: 0.74,
        scaleEnd: 0.05,
        angleSpread: 220,
        gravityY: -12,
        blendMode: 'ADD'
      }
    }
  }),
  'memory-mend': defineEffect('memory-mend', 'support-bloom', {
    telegraph: {
      anchor: 'source',
      duration: 88,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.bloom,
        tint: 0xf0d8a5,
        alpha: 0.74,
        startScale: 0.14,
        endScale: 0.32,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0xd4a4ed,
        alpha: 0.14,
        width: 36,
        height: 14,
        duration: 88,
        startScale: 0.76,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.72
      },
      glowTint: 0xf0d8a5,
      glowAlpha: 0.18,
      glowScale: 0.42,
      particles: {
        tint: [0xfff4d0, 0xf0d8a5, 0xd4a4ed],
        count: 10,
        lifespan: 220,
        speedMin: 12,
        speedMax: 52,
        scaleStart: 0.56,
        scaleEnd: 0.04,
        angleSpread: 160,
        gravityY: -18,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 160,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xf0d8a5,
      alpha: 0.84,
      startScale: 0.12,
      endScale: 0.24,
      additive: true,
      arcHeight: 12,
      spin: 0.16,
      trailTint: [0xfff4d0, 0xf0d8a5, 0xd4a4ed],
      trailScaleStart: 0.44,
      trailScaleEnd: 0.05
    },
    impact: {
      anchor: 'target',
      duration: 160,
      sprite: {
        textureKey: 'support-bloom',
        tint: 0xf0d8a5,
        alpha: 0.9,
        startScale: 0.18,
        endScale: 0.52,
        duration: 160,
        additive: true,
        spin: 0.18
      },
      ring: {
        tint: 0xd4a4ed,
        alpha: 0.16,
        width: 54,
        height: 20,
        duration: 160,
        startScale: 0.84,
        endScale: 1.42,
        strokeWidth: 2,
        strokeAlpha: 0.52
      },
      glowTint: 0xf0d8a5,
      glowAlpha: 0.18,
      glowScale: 0.56,
      particles: {
        tint: [0xfff4d0, 0xf0d8a5, 0xd4a4ed],
        count: 18,
        lifespan: 280,
        speedMin: 18,
        speedMax: 72,
        scaleStart: 0.74,
        scaleEnd: 0.05,
        angleSpread: 220,
        gravityY: -12,
        blendMode: 'ADD'
      }
    }
  }),
  'strip-gear': defineEffect('strip-gear', 'utility-extract', {
    telegraph: {
      anchor: 'target',
      duration: 88,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xe6c679,
        alpha: 0.68,
        startScale: 0.16,
        endScale: 0.34,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0x7a2c2b,
        alpha: 0.12,
        width: 44,
        height: 16,
        duration: 88,
        startScale: 0.78,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.62
      },
      glowTint: 0xe6c679,
      glowAlpha: 0.12,
      glowScale: 0.42,
      particles: {
        tint: [0xfff2c8, 0xe6c679, 0x7a2c2b],
        count: 8,
        lifespan: 200,
        speedMin: 18,
        speedMax: 64,
        scaleStart: 0.52,
        scaleEnd: 0.04,
        angleSpread: 180,
        gravityY: 36,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'target',
      to: 'source',
      duration: 180,
      textureKey: 'utility-extract',
      tint: 0xe6c679,
      alpha: 0.88,
      startScale: 0.18,
      endScale: 0.32,
      additive: true,
      spin: 0.18,
      trailTint: [0xfff2c8, 0xe6c679, 0x7a2c2b],
      trailScaleStart: 0.46,
      trailScaleEnd: 0.04
    }
  }),
  'salvage-sweep': defineEffect('salvage-sweep', 'utility-extract', {
    telegraph: {
      anchor: 'target',
      duration: 88,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.ring,
        tint: 0xf4a15d,
        alpha: 0.68,
        startScale: 0.16,
        endScale: 0.34,
        duration: 88,
        additive: true
      },
      ring: {
        tint: 0x8fcfc8,
        alpha: 0.12,
        width: 44,
        height: 16,
        duration: 88,
        startScale: 0.78,
        endScale: 1.22,
        strokeWidth: 2,
        strokeAlpha: 0.62
      },
      glowTint: 0xf4a15d,
      glowAlpha: 0.12,
      glowScale: 0.42,
      particles: {
        tint: [0xfdf5dd, 0xf4a15d, 0x8fcfc8],
        count: 8,
        lifespan: 200,
        speedMin: 18,
        speedMax: 64,
        scaleStart: 0.52,
        scaleEnd: 0.04,
        angleSpread: 180,
        gravityY: 36,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'target',
      to: 'source',
      duration: 176,
      textureKey: 'utility-extract',
      tint: 0xf4a15d,
      alpha: 0.88,
      startScale: 0.18,
      endScale: 0.32,
      additive: true,
      spin: 0.18,
      trailTint: [0xfdf5dd, 0xf4a15d, 0x8fcfc8],
      trailScaleStart: 0.46,
      trailScaleEnd: 0.04
    }
  }),
  'mending-salve': defineEffect('mending-salve', 'item-use', {
    telegraph: {
      anchor: 'source',
      duration: 76,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xf0d58d,
        alpha: 0.74,
        startScale: 0.1,
        endScale: 0.24,
        duration: 76,
        additive: true
      },
      ring: {
        tint: 0xf0d58d,
        alpha: 0.14,
        width: 34,
        height: 14,
        duration: 76,
        startScale: 0.74,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.7
      },
      glowTint: 0xf0d58d,
      glowAlpha: 0.14,
      glowScale: 0.38,
      particles: {
        tint: [0xfff5d4, 0xf0d58d, 0x9adfb2],
        count: 8,
        lifespan: 180,
        speedMin: 12,
        speedMax: 48,
        scaleStart: 0.48,
        scaleEnd: 0.04,
        angleSpread: 150,
        gravityY: 12,
        blendMode: 'ADD'
      }
    }
  }),
  'quick-tonic': defineEffect('quick-tonic', 'item-use', {
    telegraph: {
      anchor: 'source',
      duration: 80,
      sprite: {
        textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
        tint: 0xa4ece3,
        alpha: 0.76,
        startScale: 0.1,
        endScale: 0.24,
        duration: 80,
        additive: true
      },
      ring: {
        tint: 0xf0d58d,
        alpha: 0.14,
        width: 34,
        height: 14,
        duration: 80,
        startScale: 0.74,
        endScale: 1.18,
        strokeWidth: 2,
        strokeAlpha: 0.7
      },
      glowTint: 0xa4ece3,
      glowAlpha: 0.14,
      glowScale: 0.38,
      particles: {
        tint: [0xf5fffd, 0xa4ece3, 0xf0d58d],
        count: 8,
        lifespan: 180,
        speedMin: 12,
        speedMax: 48,
        scaleStart: 0.48,
        scaleEnd: 0.04,
        angleSpread: 150,
        gravityY: 12,
        blendMode: 'ADD'
      }
    },
    travel: {
      from: 'source',
      to: 'target',
      duration: 146,
      textureKey: COMBAT_FX_TEXTURE_KEYS.orb,
      tint: 0xa4ece3,
      alpha: 0.82,
      startScale: 0.12,
      endScale: 0.24,
      additive: true,
      arcHeight: 10,
      spin: 0.14,
      trailTint: [0xf5fffd, 0xa4ece3, 0xf0d58d],
      trailScaleStart: 0.42,
      trailScaleEnd: 0.04
    },
    impact: {
      anchor: 'target',
      duration: 150,
      sprite: {
        textureKey: 'item-use',
        tint: 0xa4ece3,
        alpha: 0.86,
        startScale: 0.18,
        endScale: 0.44,
        duration: 150,
        additive: true
      },
      ring: {
        tint: 0xf0d58d,
        alpha: 0.14,
        width: 52,
        height: 20,
        duration: 150,
        startScale: 0.82,
        endScale: 1.38,
        strokeWidth: 2,
        strokeAlpha: 0.5
      },
      glowTint: 0xa4ece3,
      glowAlpha: 0.14,
      glowScale: 0.5,
      particles: {
        tint: [0xf5fffd, 0xa4ece3, 0xf0d58d],
        count: 14,
        lifespan: 220,
        speedMin: 16,
        speedMax: 64,
        scaleStart: 0.62,
        scaleEnd: 0.04,
        angleSpread: 220,
        gravityY: -8,
        blendMode: 'ADD'
      }
    }
  })
} satisfies Record<CombatEffectId, CombatEffectDefinition>;

export function getCombatEffectDefinition(effectId: CombatEffectId): CombatEffectDefinition {
  return COMBAT_EFFECT_DEFINITIONS[effectId];
}
