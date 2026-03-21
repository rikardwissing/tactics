import Phaser from 'phaser';
import type { TerrainType } from '../core/types';
import type { MapPropAssetId } from '../levels/types';

export type BattleInspectionTarget =
  | { kind: 'unit'; unitId: string }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'mission' };

export interface BattleHudViewModel {
  badgeText: string;
  metaText: string;
  titleText: string;
  bodyText: string;
  statValues: string[];
  healthRatio: number | null;
  healthColor: number;
}

export type BattleIntroPhase = 'intro' | 'hud';
export type HeaderMenuAction = 'auto' | 'audio' | 'restart' | 'setup' | 'title';
export type DetailPortraitKind = 'unit' | 'unit-portrait' | 'prop' | 'chest' | 'terrain';

export const MAP_TITLE_INTRO_DURATION = 320;
export const MAP_TITLE_INTRO_HOLD = 880;
export const MAP_TITLE_OUTRO_DURATION = 360;
export const MAP_TITLE_TOTAL_DURATION = MAP_TITLE_INTRO_DURATION + MAP_TITLE_INTRO_HOLD + MAP_TITLE_OUTRO_DURATION + 120;
export const MAP_PLAQUE_FIXED_WIDTH = 392;
export const DETAIL_PANEL_FIXED_WIDTH = 352;
export const DETAIL_PANEL_MIN_WIDTH = 260;
export const DETAIL_PANEL_PORTRAIT_WIDTH = 90;
export const DETAIL_PANEL_PORTRAIT_HEIGHT = 90;
export const DETAIL_PANEL_PORTRAIT_GAP = 10;
export const DETAIL_PANEL_BODY_PADDING_X = 10;
export const DETAIL_PANEL_BODY_PADDING_Y = 8;
export const DETAIL_PANEL_TOP_PADDING_Y = 6;
export const DETAIL_PANEL_META_GAP = 6;
export const DETAIL_PANEL_TITLE_GAP = 8;
export const DETAIL_PANEL_HEALTH_GAP = 8;
export const DETAIL_PANEL_STAT_ROW_GAP = 8;
export const DETAIL_PANEL_SECTION_GAP = 10;
export const DETAIL_PANEL_CHIP_PADDING_X = 10;
export const DETAIL_PANEL_CHIP_PADDING_Y = 5;

export function formatPlaqueHeaderTitle(
  prefix: string | undefined,
  region: string | undefined,
  fallbackName: string,
  defaultPrefix = 'Mission'
): string {
  const resolvedPrefix = prefix ?? defaultPrefix;
  const resolvedRegion = region ?? fallbackName;
  return `${resolvedPrefix} - ${resolvedRegion}`.toUpperCase();
}

export function coverImageBounds(
  image: Phaser.GameObjects.Image,
  bounds: Phaser.Geom.Rectangle,
  overscan = 1
): void {
  const textureSource = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const textureWidth = textureSource.width || 1;
  const textureHeight = textureSource.height || 1;
  const scale = Math.max(bounds.width / textureWidth, bounds.height / textureHeight) * overscan;

  image.setPosition(bounds.centerX, bounds.centerY);
  image.setScale(scale);
}

export function formatBattleTerrainName(terrain: TerrainType): string {
  switch (terrain) {
    case 'grass':
      return 'Grass';
    case 'moss':
      return 'Moss';
    case 'stone':
      return 'Stone';
    case 'sanctum':
      return 'Sanctum';
    case 'chrono':
      return 'Chrono Relay';
    case 'brine':
      return 'Brine Stone';
    case 'bastion':
      return 'Bastion Floor';
    case 'aevum':
      return 'Aevum Court';
    default:
      return terrain;
  }
}

export function getBattlePropTitle(assetId: MapPropAssetId): string {
  switch (assetId) {
    case 'obstacle-rubble-barricade':
      return 'Stone Monolith';
    case 'light-torch':
      return 'Torch Stand';
    case 'sanctum-brazier':
      return 'Sanctum Brazier';
    default:
      return 'Map Prop';
  }
}
