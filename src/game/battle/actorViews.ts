import Phaser from 'phaser';
import type { IdleStyle, SpriteFacing } from '../core/types';
import { UNIT_FOOTPRINT_OFFSET_Y } from '../world/rendering';
import { UI_TEXT_WORLD_LABEL } from '../scenes/components/UiTextStyles';

export interface BattleVisualActor {
  id: string;
  name: string;
  x: number;
  y: number;
  accentColor: number;
  spriteKey: string;
  spriteDisplayHeight: number;
  spriteOffsetX?: number;
  spriteOffsetY?: number;
  idleStyle: IdleStyle;
}

export interface BattleActorView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Ellipse;
  activeGlow: Phaser.GameObjects.Image;
  activeOutlineSprites: Phaser.GameObjects.Image[];
  sprite: Phaser.GameObjects.Image;
  hpBack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  facing: SpriteFacing;
  spriteBaseScale: number;
  spriteBaseY: number;
}

export const DEFAULT_BATTLE_FACING: SpriteFacing = 'right';

export const ACTIVE_UNIT_OUTLINE_OFFSETS = [
  { x: -1.8, y: 0, alpha: 0.82 },
  { x: 1.8, y: 0, alpha: 0.82 },
  { x: 0, y: -1.8, alpha: 0.88 },
  { x: 0, y: 1.8, alpha: 0.72 },
  { x: -1.35, y: -1.35, alpha: 0.7 },
  { x: 1.35, y: -1.35, alpha: 0.7 },
  { x: -1.35, y: 1.35, alpha: 0.62 },
  { x: 1.35, y: 1.35, alpha: 0.62 }
] as const;

export function shouldFlipSpriteForFacing(facing: SpriteFacing): boolean {
  return facing === 'left';
}

export function getSpriteOffsetXForFacing(
  offsetX: number | undefined,
  facing: SpriteFacing
): number {
  const resolvedOffsetX = offsetX ?? 0;
  return facing === 'left' ? -resolvedOffsetX : resolvedOffsetX;
}

export function createBattleActorView(
  scene: Phaser.Scene,
  actor: BattleVisualActor,
  initialFacing: SpriteFacing,
  onCreateObject?: (object: Phaser.GameObjects.GameObject) => void
): BattleActorView {
  const spriteFlipX = shouldFlipSpriteForFacing(initialFacing);
  const spriteOffsetX = getSpriteOffsetXForFacing(actor.spriteOffsetX, initialFacing);
  const spriteOffsetY = actor.spriteOffsetY ?? 0;
  const marker = scene.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 62, 26, actor.accentColor, 0);
  const shadow = scene.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 50, 18, 0x060205, 0.42);
  const activeGlow = scene.add.image(0, 0, actor.spriteKey).setOrigin(0.5, 1);
  activeGlow.displayHeight = actor.spriteDisplayHeight;
  activeGlow.scaleX = activeGlow.scaleY;
  activeGlow
    .setPosition(spriteOffsetX, spriteOffsetY)
    .setFlipX(spriteFlipX)
    .setTint(actor.accentColor)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0)
    .setVisible(false);

  const activeOutlineSprites = ACTIVE_UNIT_OUTLINE_OFFSETS.map(() => {
    const outline = scene.add.image(0, 0, actor.spriteKey).setOrigin(0.5, 1);
    outline.displayHeight = actor.spriteDisplayHeight;
    outline.scaleX = outline.scaleY;
    outline
      .setPosition(spriteOffsetX, spriteOffsetY)
      .setFlipX(spriteFlipX)
      .setTintFill(actor.accentColor)
      .setAlpha(0)
      .setVisible(false);
    return outline;
  });

  const sprite = scene.add.image(0, 0, actor.spriteKey).setOrigin(0.5, 1);
  sprite.displayHeight = actor.spriteDisplayHeight;
  sprite.scaleX = sprite.scaleY;
  sprite.setPosition(spriteOffsetX, spriteOffsetY).setFlipX(spriteFlipX);

  const hpBack = scene.add.rectangle(0, sprite.y - actor.spriteDisplayHeight - 12, 60, 8, 0x12070d, 0.92);
  const hpFill = scene.add
    .rectangle(-29, sprite.y - actor.spriteDisplayHeight - 12, 56, 4, 0x65d99e, 1)
    .setOrigin(0, 0.5);
  const label = scene.add.text(0, sprite.y - actor.spriteDisplayHeight - 28, actor.name, UI_TEXT_WORLD_LABEL);
  label.setOrigin(0.5);

  const children = [
    marker,
    shadow,
    activeGlow,
    ...activeOutlineSprites,
    sprite,
    hpBack,
    hpFill,
    label
  ];
  const container = scene.add.container(0, 0, children);

  for (const child of [marker, shadow, activeGlow, ...activeOutlineSprites, sprite, hpBack, hpFill, label, container]) {
    onCreateObject?.(child);
  }

  return {
    container,
    shadow,
    marker,
    activeGlow,
    activeOutlineSprites,
    sprite,
    hpBack,
    hpFill,
    label,
    facing: initialFacing,
    spriteBaseScale: sprite.scaleX,
    spriteBaseY: sprite.y
  };
}

export function applyBattleActorFacing(
  actor: BattleVisualActor,
  view: BattleActorView,
  facing: SpriteFacing
): void {
  view.facing = facing;
  const spriteOffsetX = getSpriteOffsetXForFacing(actor.spriteOffsetX, facing);
  const spriteOffsetY = actor.spriteOffsetY ?? 0;
  const spriteFlipX = shouldFlipSpriteForFacing(facing);

  view.activeGlow.setPosition(spriteOffsetX, spriteOffsetY).setFlipX(spriteFlipX);
  for (const outline of view.activeOutlineSprites) {
    outline.setPosition(spriteOffsetX, spriteOffsetY).setFlipX(spriteFlipX);
  }
  view.sprite.setPosition(spriteOffsetX, spriteOffsetY).setFlipX(spriteFlipX);
  syncBattleActorGlow(view);
}

export function syncBattleActorGlow(view: BattleActorView): void {
  const scaleRatio = view.spriteBaseScale > 0 ? view.sprite.scaleX / view.spriteBaseScale : 1;

  view.activeGlow
    .setPosition(view.sprite.x, view.sprite.y)
    .setScale(view.sprite.scaleX * 1.1, view.sprite.scaleY * 1.1)
    .setAngle(view.sprite.angle);

  for (const [index, outline] of view.activeOutlineSprites.entries()) {
    const offset = ACTIVE_UNIT_OUTLINE_OFFSETS[index];
    outline
      .setPosition(view.sprite.x + offset.x * scaleRatio, view.sprite.y + offset.y * scaleRatio)
      .setScale(view.sprite.scaleX, view.sprite.scaleY)
      .setAngle(view.sprite.angle);
  }
}

export function applyBattleIdleAnimation(
  scene: Phaser.Scene,
  actor: BattleVisualActor,
  view: BattleActorView,
  onUpdate?: () => void
): void {
  const delay = (actor.x + actor.y) * 110;
  const profile = getIdleProfile(actor.idleStyle);

  scene.tweens.add({
    targets: view.sprite,
    y: view.spriteBaseY - profile.spriteLift,
    angle: profile.spriteTilt,
    duration: profile.duration,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    delay,
    onUpdate: () => {
      syncBattleActorGlow(view);
      onUpdate?.();
    }
  });

  scene.tweens.add({
    targets: view.shadow,
    scaleX: profile.shadowScaleX,
    scaleY: profile.shadowScaleY,
    alpha: profile.shadowAlpha,
    duration: profile.duration,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
    delay
  });

  if (profile.markerScale > 1) {
    scene.tweens.add({
      targets: view.marker,
      scaleX: profile.markerScale,
      scaleY: profile.markerScale,
      duration: profile.duration * 0.7,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });
  }
}

function getIdleProfile(idleStyle: IdleStyle): {
  duration: number;
  spriteLift: number;
  spriteTilt: number;
  shadowScaleX: number;
  shadowScaleY: number;
  shadowAlpha: number;
  markerScale: number;
} {
  switch (idleStyle) {
    case 'knight':
      return {
        duration: 1500,
        spriteLift: 0,
        spriteTilt: -0.8,
        shadowScaleX: 0.97,
        shadowScaleY: 0.95,
        shadowAlpha: 0.34,
        markerScale: 1
      };
    case 'archer':
      return {
        duration: 1350,
        spriteLift: 0,
        spriteTilt: -1.1,
        shadowScaleX: 0.96,
        shadowScaleY: 0.94,
        shadowAlpha: 0.32,
        markerScale: 1
      };
    case 'mage':
      return {
        duration: 1650,
        spriteLift: 0,
        spriteTilt: 0.9,
        shadowScaleX: 0.95,
        shadowScaleY: 0.93,
        shadowAlpha: 0.3,
        markerScale: 1
      };
    case 'warden':
      return {
        duration: 1180,
        spriteLift: 0,
        spriteTilt: -0.6,
        shadowScaleX: 0.98,
        shadowScaleY: 0.96,
        shadowAlpha: 0.35,
        markerScale: 1
      };
    case 'ranger':
      return {
        duration: 1280,
        spriteLift: 0,
        spriteTilt: -1,
        shadowScaleX: 0.96,
        shadowScaleY: 0.94,
        shadowAlpha: 0.31,
        markerScale: 1
      };
    case 'priest':
      return {
        duration: 1760,
        spriteLift: 0,
        spriteTilt: 0.7,
        shadowScaleX: 0.95,
        shadowScaleY: 0.93,
        shadowAlpha: 0.29,
        markerScale: 1
      };
    default:
      return {
        duration: 1500,
        spriteLift: 0,
        spriteTilt: -0.8,
        shadowScaleX: 0.97,
        shadowScaleY: 0.95,
        shadowAlpha: 0.33,
        markerScale: 1
      };
  }
}
