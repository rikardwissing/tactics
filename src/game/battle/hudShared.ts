import Phaser from 'phaser';
import type { TerrainType } from '../core/types';
import type { BattleUnit } from '../core/types';
import type { SpriteFacing } from '../core/types';
import type { TileData } from '../core/types';
import type { MapPropAssetId } from '../levels/types';
import { getFactionProfile } from '../levels/factions';
import { getUnitPortraitImageKey } from '../assets';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_DANGER,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_SUCCESS
} from '../scenes/components/UiColors';
import { shouldFlipSpriteForFacing } from './actorViews';
import { PROP_RENDER_CONFIG, getTerrainTileAssetKey } from '../world/rendering';

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

export interface StatusHudViewModelOptions {
  badgeText: string;
  metaText: string;
  titleText: string;
  bodyText: string;
  statValues: string[];
  healthRatio?: number | null;
  healthColor: number;
}

export interface BattleHudTextTargets {
  activeBadge: Phaser.GameObjects.Text;
  detailMetaText: Phaser.GameObjects.Text;
  detailTitleText: Phaser.GameObjects.Text;
  detailBodyText: Phaser.GameObjects.Text;
  detailStatTexts: Phaser.GameObjects.Text[];
}

export interface CombatUnitHudOptions {
  unit: BattleUnit;
  badgeText: string;
  bodyText: string;
  healthColor: number;
}

export type CombatUnitBodyMode = 'idle' | 'move' | 'items' | 'abilities';

export interface CombatUnitBodyModeOptions {
  isMove: boolean;
  isItems: boolean;
  isAbilities: boolean;
}

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

export interface CombatUnitInspectionHudOptions extends CombatUnitBodyTextOptions {
  badgeText: string;
  healthColor: number;
}

export interface NpcInspectionHudOptions {
  npc: {
    factionId: BattleUnit['factionId'];
    className?: string;
    name: string;
    summary: string;
  };
  badgeText: string;
  bodyText: string;
  statValues: string[];
  healthColor: number;
}

export interface ActorPortraitDescriptor {
  textureKey: string;
  kind: DetailPortraitKind;
  flipX: boolean;
}

export interface DetailPortraitDescriptorOptions {
  unit?: {
    spriteKey: string;
    facing: SpriteFacing;
  } | null;
  npc?: {
    spriteKey: string;
    facing: SpriteFacing;
  } | null;
  tile?: Pick<TileData, 'x' | 'y' | 'height' | 'terrain'> | null;
  propAssetId?: MapPropAssetId | null;
  hasChest?: boolean;
  chestOpened?: boolean | null;
}

export interface HeaderMenuLabelOptions {
  autoBattleEnabled: boolean;
  audioMuted: boolean;
  restartLabel: string;
  setupLabel: string;
}

export interface HeaderMenuTextTargets {
  headerMenuTitleText: Phaser.GameObjects.Text;
  headerMenuOptionTexts: Phaser.GameObjects.Text[];
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

export interface BattleResultOverlayCopy {
  eyebrowText: string;
  bodyText: string;
  secondaryLabel: string;
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

export function createStatusHudViewModel({
  badgeText,
  metaText,
  titleText,
  bodyText,
  statValues,
  healthRatio = null,
  healthColor
}: StatusHudViewModelOptions): BattleHudViewModel {
  return {
    badgeText,
    metaText,
    titleText,
    bodyText,
    statValues,
    healthRatio,
    healthColor
  };
}

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

export function formatMapPlaqueEyebrow(
  prefix: string | null | undefined,
  region: string | null | undefined,
  fallback = 'FIELD ENGAGEMENT'
): string {
  const parts = [prefix, region]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toUpperCase());

  return parts.length > 0 ? parts.join('  •  ') : fallback;
}

export function formatMapPlaqueMeta(
  firstLabel: string,
  secondLabel: string | null | undefined
): string {
  const parts = [firstLabel, secondLabel].filter((value): value is string => Boolean(value));
  return parts.join('  •  ');
}

export function formatMapIntroEyebrow(
  titlePrefix: string | null | undefined,
  encounterType: string | null | undefined,
  fallback = 'Battle Report'
): string {
  return (titlePrefix ?? encounterType ?? fallback).toUpperCase();
}

export function formatMapIntroMeta(
  region: string | null | undefined,
  encounterType: string | null | undefined
): string {
  return formatMapPlaqueMeta(region ?? '', encounterType);
}

export function formatMapIntroSummary(
  shortObjective: string | null | undefined,
  objective: string,
  titleFlavor: string | null | undefined
): string {
  const resolvedShortObjective = shortObjective ?? objective;
  const flavor = titleFlavor?.trim() ?? '';
  if (!flavor) {
    return resolvedShortObjective;
  }

  return flavor.length <= resolvedShortObjective.length ? flavor : resolvedShortObjective;
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

export function resolveCombatUnitBodyMode({
  isMove,
  isItems,
  isAbilities
}: CombatUnitBodyModeOptions): CombatUnitBodyMode {
  if (isMove) {
    return 'move';
  }

  if (isItems) {
    return 'items';
  }

  if (isAbilities) {
    return 'abilities';
  }

  return 'idle';
}

export function createCombatUnitInspectionHudViewModel({
  badgeText,
  healthColor,
  ...bodyOptions
}: CombatUnitInspectionHudOptions): BattleHudViewModel {
  return createCombatUnitHudViewModel({
    unit: bodyOptions.unit,
    badgeText,
    bodyText: createCombatUnitBodyText(bodyOptions),
    healthColor
  });
}

export function createNpcInspectionHudViewModel({
  npc,
  badgeText,
  bodyText,
  statValues,
  healthColor
}: NpcInspectionHudOptions): BattleHudViewModel {
  return {
    badgeText,
    metaText: `${getFactionProfile(npc.factionId).displayName}  •  ${npc.className?.trim() || 'Wanderer'}`,
    titleText: npc.name,
    bodyText,
    statValues,
    healthRatio: null,
    healthColor
  };
}

export function resolveActorPortraitDescriptor(spriteKey: string, facing: SpriteFacing): ActorPortraitDescriptor {
  const portraitKey = getUnitPortraitImageKey(spriteKey) ?? spriteKey;

  return {
    textureKey: portraitKey,
    kind: portraitKey === spriteKey ? 'unit' : 'unit-portrait',
    flipX: portraitKey === spriteKey ? shouldFlipSpriteForFacing(facing) : false
  };
}

export function resolveDetailPortraitDescriptor({
  unit = null,
  npc = null,
  tile = null,
  propAssetId = null,
  hasChest = false,
  chestOpened = false
}: DetailPortraitDescriptorOptions): ActorPortraitDescriptor | null {
  if (unit) {
    return resolveActorPortraitDescriptor(unit.spriteKey, unit.facing);
  }

  if (npc) {
    return resolveActorPortraitDescriptor(npc.spriteKey, npc.facing);
  }

  if (tile) {
    if (hasChest) {
      return {
        textureKey: chestOpened ? 'chapel-chest-open' : 'chapel-chest-closed',
        kind: 'chest',
        flipX: false
      };
    }

    if (propAssetId) {
      return {
        textureKey: propAssetId,
        kind: 'prop',
        flipX: false
      };
    }

    return {
      textureKey: getTerrainTileAssetKey(tile),
      kind: 'terrain',
      flipX: false
    };
  }

  if (propAssetId) {
    return {
      textureKey: propAssetId,
      kind: 'prop',
      flipX: false
    };
  }

  return null;
}

export function syncBattleHudViewModelTexts(
  targets: BattleHudTextTargets,
  viewModel: BattleHudViewModel | null
): void {
  if (!viewModel) {
    targets.activeBadge.setText('');
    targets.detailMetaText.setText('');
    targets.detailTitleText.setText('');
    targets.detailBodyText.setText('');
    setTextValues(targets.detailStatTexts, []);
    return;
  }

  targets.activeBadge.setText(viewModel.badgeText);
  targets.detailMetaText.setText(viewModel.metaText);
  targets.detailTitleText.setText(viewModel.titleText);
  targets.detailBodyText.setText(viewModel.bodyText);
  setTextValues(targets.detailStatTexts, viewModel.statValues);
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

export function syncHeaderMenuTexts(
  targets: HeaderMenuTextTargets,
  titleText: string,
  labels: Record<HeaderMenuAction, string>,
  actions: readonly HeaderMenuAction[]
): void {
  targets.headerMenuTitleText.setText(titleText);
  for (const [index, text] of targets.headerMenuOptionTexts.entries()) {
    const action = actions[index];
    text.setText(action ? labels[action] : '');
  }
}

export function resolveHeaderMenuActions(isExplorationMode: boolean): HeaderMenuAction[] {
  return isExplorationMode ? ['audio', 'restart', 'title'] : ['auto', 'audio', 'restart', 'setup'];
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

export function createBattleResultOverlayCopy(
  result: 'Victory' | 'Defeat',
  isWorldEncounterBattle: boolean
): BattleResultOverlayCopy {
  return {
    eyebrowText: isWorldEncounterBattle ? 'MISSION SECURED' : 'MISSION BROKEN',
    bodyText:
      result === 'Victory'
        ? 'The road ahead is yours again.\nReturn to the wilderness or fight the encounter again from this ridge.'
        : 'The ambush scatters your force back into the ash.\nRetry the clash immediately or fall back to the road.',
    secondaryLabel: isWorldEncounterBattle ? 'RETURN TO ROAD' : 'MAP SELECT'
  };
}

export function createBattleResultOverlayButtonDescriptorOptions(
  secondaryLabel: string
): ResultOverlayButtonDescriptorOptions {
  return {
    secondaryLabel,
    victoryRetryFillColor: UI_COLOR_ACCENT_NEUTRAL,
    victoryRetryStrokeColor: UI_COLOR_PANEL_BORDER,
    victoryRetryFillAlpha: 0.82,
    victorySecondaryFillColor: UI_COLOR_SUCCESS,
    victorySecondaryStrokeColor: UI_COLOR_PANEL_BORDER,
    victorySecondaryFillAlpha: 0.3,
    defeatRetryFillColor: UI_COLOR_ACCENT_DANGER,
    defeatRetryStrokeColor: UI_COLOR_DANGER,
    defeatRetryFillAlpha: 0.48,
    defeatSecondaryFillColor: UI_COLOR_ACCENT_COOL,
    defeatSecondaryStrokeColor: UI_COLOR_PANEL_BORDER,
    defeatSecondaryFillAlpha: 0.82
  };
}
