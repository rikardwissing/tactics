import Phaser from 'phaser';
import type { TerrainType } from '../core/types';
import type { BattleUnit } from '../core/types';
import type { TileData } from '../core/types';
import type { MapPropAssetId } from '../levels/types';
import { getFactionProfile } from '../levels/factions';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM
} from '../scenes/components/UiColors';
import { PROP_RENDER_CONFIG } from '../world/rendering';

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

export interface CombatUnitHudOptions {
  unit: BattleUnit;
  badgeText: string;
  bodyText: string;
  healthColor: number;
}

export type CombatUnitBodyMode = 'idle' | 'move' | 'items' | 'abilities';

export interface CombatUnitBodyTextOptions {
  unit: BattleUnit;
  isCommandFocus: boolean;
  mode: CombatUnitBodyMode;
  moveSpentText: string;
  movePromptText: string;
  itemDescriptionText?: string;
  itemRangeText?: string;
  itemPromptText?: string;
  abilityDescriptionText?: string;
  abilityRangeText?: string;
  abilityPromptText?: string;
}

export interface HeaderMenuLabelOptions {
  autoBattleEnabled: boolean;
  audioMuted: boolean;
  restartLabel: string;
  setupLabel: string;
}

export interface DetailAccentColorOptions {
  focusUnitTeam?: BattleUnit['team'] | null;
  isExplorationMode?: boolean;
  inspectionUnitTeam?: BattleUnit['team'] | null;
  inspectionNpcHostile?: boolean | null;
  inspectionTileVisible?: boolean;
}

export interface TerrainInspectionHudOptions {
  tile: Pick<TileData, 'x' | 'y' | 'height' | 'terrain'>;
  propAssetId?: MapPropAssetId | null;
  badgeText?: string;
  titleText?: string;
  bodyLines: string[];
  statValues: string[];
  healthColor: number;
}

export interface ResultOverlayButtonDescriptor {
  label: string;
  fillColor: number;
  strokeColor: number;
  fillAlpha: number;
}

export interface ResultOverlayButtonDescriptorOptions {
  secondaryLabel: string;
  victoryRetryFillColor: number;
  victoryRetryStrokeColor: number;
  victoryRetryFillAlpha: number;
  victorySecondaryFillColor: number;
  victorySecondaryStrokeColor: number;
  victorySecondaryFillAlpha: number;
  defeatRetryFillColor: number;
  defeatRetryStrokeColor: number;
  defeatRetryFillAlpha: number;
  defeatSecondaryFillColor: number;
  defeatSecondaryStrokeColor: number;
  defeatSecondaryFillAlpha: number;
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

export function setTextValues(texts: Phaser.GameObjects.Text[], values: string[]): void {
  for (const [index, text] of texts.entries()) {
    const value = values[index] ?? '';
    text.setText(value).setVisible(value.length > 0);
  }
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

export function resolveDetailAccentColor({
  focusUnitTeam = null,
  isExplorationMode = false,
  inspectionUnitTeam = null,
  inspectionNpcHostile = null,
  inspectionTileVisible = false
}: DetailAccentColorOptions): number {
  if (focusUnitTeam) {
    return focusUnitTeam === 'player' ? UI_COLOR_ACCENT_COOL : UI_COLOR_ACCENT_DANGER;
  }

  if (isExplorationMode && inspectionUnitTeam) {
    return UI_COLOR_ACCENT_COOL;
  }

  if (inspectionNpcHostile !== null) {
    return inspectionNpcHostile ? UI_COLOR_ACCENT_DANGER : UI_COLOR_ACCENT_WARM;
  }

  if (inspectionTileVisible) {
    return UI_COLOR_ACCENT_WARM;
  }

  return UI_COLOR_ACCENT_NEUTRAL;
}

export function createCombatUnitHudViewModel({
  unit,
  badgeText,
  bodyText,
  healthColor
}: CombatUnitHudOptions): BattleHudViewModel {
  return {
    badgeText,
    metaText: `${getFactionProfile(unit.factionId).displayName}  •  ${unit.className}`,
    titleText: unit.name,
    bodyText,
    statValues: [
      `HP ${unit.hp}/${unit.maxHp}`,
      `MOVE ${unit.move}`,
      `SPD ${unit.speed}`,
      `RNG ${unit.rangeMin}-${unit.rangeMax}`
    ],
    healthRatio: unit.hp / unit.maxHp,
    healthColor
  };
}

export function createCombatUnitBodyText(options: CombatUnitBodyTextOptions): string {
  const {
    unit,
    isCommandFocus,
    mode,
    moveSpentText,
    movePromptText,
    itemDescriptionText,
    itemRangeText,
    itemPromptText,
    abilityDescriptionText,
    abilityRangeText,
    abilityPromptText
  } = options;

  if (!isCommandFocus) {
    return [unit.attackName, unit.attackText].join('\n');
  }

  if (mode === 'move') {
    return [moveSpentText, movePromptText].join('\n');
  }

  if (mode === 'items') {
    if (itemDescriptionText) {
      return [itemDescriptionText, itemRangeText ?? '', itemPromptText ?? 'Choose an item below.']
        .filter((line) => line.trim().length > 0)
        .join('\n');
    }

    return 'Choose an item below.';
  }

  if (mode === 'abilities') {
    if (abilityDescriptionText) {
      return [abilityDescriptionText, abilityRangeText ?? '', abilityPromptText ?? 'Choose an ability below.']
        .filter((line) => line.trim().length > 0)
        .join('\n');
    }

    return 'Choose an ability below.';
  }

  return [unit.attackName, unit.attackText].join('\n');
}

export function createHeaderMenuLabels({
  autoBattleEnabled,
  audioMuted,
  restartLabel,
  setupLabel
}: HeaderMenuLabelOptions): Record<HeaderMenuAction, string> {
  return {
    auto: `AUTO ${autoBattleEnabled ? 'ON' : 'OFF'}`,
    audio: `AUDIO ${audioMuted ? 'OFF' : 'ON'}`,
    restart: restartLabel,
    setup: setupLabel,
    title: 'TITLE'
  };
}

export function describeTerrain(terrain: TerrainType): string {
  switch (terrain) {
    case 'grass':
      return 'Open footing with clean routes for melee pressure.';
    case 'moss':
      return 'Uneven, muted stone that favors careful flanks.';
    case 'stone':
      return 'Broken chapel stone grants slight protection.';
    case 'sanctum':
      return 'The altar crest hardens defenders against direct blows.';
    case 'chrono':
      return 'Steel relay flooring funnels the fight along hard-edged lanes.';
    case 'brine':
      return 'Wet sanctuary stone rewards committed pushes across the flooded line.';
    case 'bastion':
      return 'Fortress parade flooring favors disciplined advances and holdouts.';
    case 'aevum':
      return 'Terraced prophecy courts invite patient rotations toward the center.';
    default:
      return '';
  }
}

export function describeProp(assetId: MapPropAssetId): string {
  return PROP_RENDER_CONFIG[assetId].description ?? '';
}

export function createTerrainInspectionHudViewModel({
  tile,
  propAssetId,
  badgeText,
  titleText,
  bodyLines,
  statValues,
  healthColor
}: TerrainInspectionHudOptions): BattleHudViewModel {
  const terrainName = formatBattleTerrainName(tile.terrain);
  const prop = propAssetId ? { assetId: propAssetId } : null;

  return {
    badgeText: badgeText ?? (prop ? 'FIELD PROP' : 'TERRAIN TILE'),
    metaText: `${terrainName}  •  ${tile.x}, ${tile.y}`,
    titleText: titleText ?? (prop ? getBattlePropTitle(prop.assetId) : `${terrainName} Ground`),
    bodyText: bodyLines.join('\n'),
    statValues,
    healthRatio: null,
    healthColor
  };
}

export function createResultOverlayButtonDescriptors(
  result: 'Victory' | 'Defeat',
  options: ResultOverlayButtonDescriptorOptions
): ResultOverlayButtonDescriptor[] {
  if (result === 'Victory') {
    return [
      {
        label: 'RETRY BATTLE',
        fillColor: options.victoryRetryFillColor,
        strokeColor: options.victoryRetryStrokeColor,
        fillAlpha: options.victoryRetryFillAlpha
      },
      {
        label: options.secondaryLabel,
        fillColor: options.victorySecondaryFillColor,
        strokeColor: options.victorySecondaryStrokeColor,
        fillAlpha: options.victorySecondaryFillAlpha
      }
    ];
  }

  return [
    {
      label: 'RETRY BATTLE',
      fillColor: options.defeatRetryFillColor,
      strokeColor: options.defeatRetryStrokeColor,
      fillAlpha: options.defeatRetryFillAlpha
    },
    {
      label: options.secondaryLabel,
      fillColor: options.defeatSecondaryFillColor,
      strokeColor: options.defeatSecondaryStrokeColor,
      fillAlpha: options.defeatSecondaryFillAlpha
    }
  ];
}
