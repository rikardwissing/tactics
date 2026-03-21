import Phaser from 'phaser';
import {
  BattleUiChrome,
  UI_INSET_RADIUS,
  UI_NARROW_PLAQUE_HEADER_HEIGHT,
  UI_PANEL_COMPACT_GAP,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_GAP,
  UI_PANEL_MICRO_GAP,
  UI_PANEL_TIGHT_GAP,
  UI_PANEL_MINI_GAP,
  UI_PLAQUE_HEADER_HEIGHT
} from '../scenes/components/BattleUiChrome';
import {
  UI_COLOR_OVERLAY,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SHADOW,
  UI_COLOR_PANEL_SURFACE,
  UI_COLOR_PANEL_SURFACE_ALT,
  UI_COLOR_TEXT
} from '../scenes/components/UiColors';
import type { BattleUnit } from '../core/types';
import {
  DETAIL_PANEL_BODY_PADDING_X,
  DETAIL_PANEL_BODY_PADDING_Y,
  DETAIL_PANEL_CHIP_PADDING_X,
  DETAIL_PANEL_CHIP_PADDING_Y,
  DETAIL_PANEL_HEALTH_GAP,
  DETAIL_PANEL_META_GAP,
  DETAIL_PANEL_PORTRAIT_GAP,
  DETAIL_PANEL_PORTRAIT_HEIGHT,
  DETAIL_PANEL_PORTRAIT_WIDTH,
  DETAIL_PANEL_SECTION_GAP,
  DETAIL_PANEL_STAT_ROW_GAP,
  DETAIL_PANEL_TITLE_GAP,
  DETAIL_PANEL_TOP_PADDING_Y,
  coverImageBounds,
  createBattleResultOverlayButtonDescriptorOptions,
  createBattleResultOverlayCopy,
  createResultOverlayButtonDescriptors,
  type DetailPortraitKind,
  type ResultOverlayButtonDescriptor,
  type ResultOverlayButtonDescriptorOptions
} from './hudShared';
import { resolveDetailAccentColor } from './hudShared';
import { resolveSharedBattleResultOverlayLayout } from './hudLayout';
import { createUiSubGrid } from '../scenes/components/UiGrid';

export interface DetailPanelLayoutMetrics {
  contentBounds: Phaser.Geom.Rectangle;
  infoBounds: Phaser.Geom.Rectangle;
  portraitBounds: Phaser.Geom.Rectangle;
  healthBarBounds: Phaser.Geom.Rectangle;
  bodyBoxBounds: Phaser.Geom.Rectangle;
  statChipBounds: Phaser.Geom.Rectangle[];
  statPositions: Array<Phaser.Math.Vector2 | null>;
  metaY: number;
  titleY: number;
  bodyTextX: number;
  bodyTextY: number;
  requiredHeight: number;
}

interface MeasureDetailPanelLayoutArgs {
  panel: Phaser.Geom.Rectangle;
  portraitVisible: boolean;
  hasHealthBar: boolean;
  metaText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  bodyText: Phaser.GameObjects.Text;
  statTexts: Phaser.GameObjects.Text[];
}

interface SharedMapPlaqueOptions {
  graphics: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Image;
  artMask: Phaser.GameObjects.Graphics;
  panel: Phaser.Geom.Rectangle;
  alpha?: number;
  accentColor?: number;
}

interface SharedDetailPlaqueOptions {
  graphics: Phaser.GameObjects.Graphics;
  panel: Phaser.Geom.Rectangle;
  accentColor: number;
  alpha: number;
  bodyBoxBounds: Phaser.Geom.Rectangle;
  statChipBounds: Phaser.Geom.Rectangle[];
  statTexts: Phaser.GameObjects.Text[];
  healthBarBounds: Phaser.Geom.Rectangle;
  healthRatio: number | null;
  healthColor: number;
}

interface SharedPortraitOptions {
  image: Phaser.GameObjects.Image;
  mask: Phaser.GameObjects.Graphics;
  panel: Phaser.Geom.Rectangle;
  textureKey: string;
  kind: DetailPortraitKind;
  flipX?: boolean;
  visible?: boolean;
}

interface SharedHeaderMenuOverlayOptions {
  graphics: Phaser.GameObjects.Graphics;
  viewportWidth: number;
  viewportHeight: number;
  panel: Phaser.Geom.Rectangle;
  optionBounds: readonly Phaser.Geom.Rectangle[];
}

interface SharedMapTitleIntroOptions {
  graphics: Phaser.GameObjects.Graphics;
  overlayShade: Phaser.GameObjects.Rectangle;
  artBounds: Phaser.Geom.Rectangle;
  textBounds: Phaser.Geom.Rectangle;
  eyebrowBounds: Phaser.Geom.Rectangle;
  objectiveBounds: Phaser.Geom.Rectangle;
  alpha: number;
}

interface SharedMapTitlePanelsOptions {
  graphics: Phaser.GameObjects.Graphics;
  viewportWidth: number;
  viewportHeight: number;
  headerPanel: Phaser.Geom.Rectangle;
  mapPlaqueArt: Phaser.GameObjects.Image;
  mapPlaqueArtMask: Phaser.GameObjects.Graphics;
  mapPlaqueAlpha: number;
  mapPlaqueVisible: boolean;
  introOverlayShade: Phaser.GameObjects.Rectangle;
  mapIntroArt: Phaser.GameObjects.Image;
  mapIntroArtMask: Phaser.GameObjects.Graphics;
  mapIntroArtBounds: Phaser.Geom.Rectangle;
  mapIntroTextBounds: Phaser.Geom.Rectangle;
  mapIntroEyebrowBounds: Phaser.Geom.Rectangle;
  mapObjectiveBoxBounds: Phaser.Geom.Rectangle;
  mapIntroAlpha: number;
  mapIntroVisible: boolean;
  headerMenuOpen: boolean;
  headerMenuPanelBounds: Phaser.Geom.Rectangle;
  headerMenuOptionBounds: readonly Phaser.Geom.Rectangle[];
}

export interface SharedMapTitleLayoutOptions {
  width: number;
  height: number;
  headerRect: Phaser.Geom.Rectangle;
  mapPlaqueOffsetX: number;
  mapIntroOffsetY: number;
  mapIntroAlpha: number;
  mapPlaqueAlpha: number;
  mapIntroVisible: boolean;
  hudVisible: boolean;
  mapPlaqueTitleText: Phaser.GameObjects.Text;
  mapPlaqueMetaText: Phaser.GameObjects.Text;
  mapObjectiveText: Phaser.GameObjects.Text;
  mapIntroArt: Phaser.GameObjects.Image;
  mapIntroArtMask: Phaser.GameObjects.Graphics;
  mapIntroArtBounds: Phaser.Geom.Rectangle;
  mapIntroArtImageBounds: Phaser.Geom.Rectangle;
  mapIntroTextBounds: Phaser.Geom.Rectangle;
  mapIntroBounds: Phaser.Geom.Rectangle;
  mapIntroEyebrowBounds: Phaser.Geom.Rectangle;
  mapObjectiveBoxBounds: Phaser.Geom.Rectangle;
  mapIntroEyebrowText: Phaser.GameObjects.Text;
  mapIntroTitleText: Phaser.GameObjects.Text;
  mapIntroMetaText: Phaser.GameObjects.Text;
  mapIntroFlavorText: Phaser.GameObjects.Text;
  headerMenuTitleText: Phaser.GameObjects.Text;
  headerMenuButtonBounds: Phaser.Geom.Rectangle;
  headerMenuPanelBounds: Phaser.Geom.Rectangle;
  headerMenuOptionBounds: readonly Phaser.Geom.Rectangle[];
  headerMenuOptionTexts: Phaser.GameObjects.Text[];
  headerMenuActionCount: number;
  headerMenuOpen: boolean;
}

interface SharedBattleHudPanelsOptions {
  graphics: Phaser.GameObjects.Graphics;
  viewportWidth: number;
  viewportHeight: number;
  headerPanel: Phaser.Geom.Rectangle;
  mapPlaqueArt: Phaser.GameObjects.Image;
  mapPlaqueArtMask: Phaser.GameObjects.Graphics;
  mapPlaqueAlpha: number;
  mapPlaqueVisible: boolean;
  introOverlayShade: Phaser.GameObjects.Rectangle;
  mapIntroArt: Phaser.GameObjects.Image;
  mapIntroArtMask: Phaser.GameObjects.Graphics;
  mapIntroArtBounds: Phaser.Geom.Rectangle;
  mapIntroTextBounds: Phaser.Geom.Rectangle;
  mapIntroEyebrowBounds: Phaser.Geom.Rectangle;
  mapObjectiveBoxBounds: Phaser.Geom.Rectangle;
  mapIntroAlpha: number;
  mapIntroVisible: boolean;
  headerMenuOpen: boolean;
  headerMenuPanelBounds: Phaser.Geom.Rectangle;
  headerMenuOptionBounds: readonly Phaser.Geom.Rectangle[];
  drawDetailPanel: () => void;
  shouldDrawPortraitFrame: boolean;
  portraitPanel: Phaser.Geom.Rectangle;
  portraitAlpha: number;
}

interface SharedBattleResultOverlayButton {
  bounds: Phaser.Geom.Rectangle;
  labelText: Phaser.GameObjects.Text;
}

interface SharedDetailPlaqueFrameOptions extends Omit<SharedDetailPlaqueOptions, 'accentColor'> {
  focusUnitTeam?: BattleUnit['team'] | null;
  isExplorationMode?: boolean;
  inspectionUnitTeam?: BattleUnit['team'] | null;
  inspectionNpcHostile?: boolean | null;
  inspectionTileVisible?: boolean;
}

interface SharedBattleResultOverlayFrameOptions extends Omit<
  SharedBattleResultOverlayOptions,
  'eyebrowText' | 'bodyText' | 'buttonDescriptorOptions'
> {
  isWorldEncounterBattle: boolean;
}

interface SharedDetailPanelLayoutOptions {
  panel: Phaser.Geom.Rectangle;
  alpha: number;
  visible: boolean;
  portraitVisible: boolean;
  activeBadge: Phaser.GameObjects.Text;
  detailMetaText: Phaser.GameObjects.Text;
  detailTitleText: Phaser.GameObjects.Text;
  detailBodyText: Phaser.GameObjects.Text;
  detailStatTexts: Phaser.GameObjects.Text[];
  detailStatChipBounds: Phaser.Geom.Rectangle[];
  detailHealthBarBounds: Phaser.Geom.Rectangle;
  detailBodyBoxBounds: Phaser.Geom.Rectangle;
  portraitPanel: Phaser.Geom.Rectangle;
  portrait: Phaser.GameObjects.Image;
  portraitMask: Phaser.GameObjects.Graphics;
  metrics: DetailPanelLayoutMetrics;
  onSyncPortrait: () => void;
}

export interface SharedBattleResultOverlayOptions {
  overlayShade: Phaser.GameObjects.Rectangle;
  panel: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Image;
  artMask: Phaser.GameObjects.Graphics;
  eyebrow: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
  buttons: readonly SharedBattleResultOverlayButton[];
  result: 'Victory' | 'Defeat';
  viewportWidth: number;
  viewportHeight: number;
  panelBoundsTarget?: Phaser.Geom.Rectangle;
  eyebrowText: string;
  bodyText: string;
  buttonDescriptorOptions: ResultOverlayButtonDescriptorOptions;
}

export function measureDetailPanelLayout({
  panel,
  portraitVisible,
  hasHealthBar,
  metaText,
  titleText,
  bodyText,
  statTexts
}: MeasureDetailPanelLayoutArgs): DetailPanelLayoutMetrics {
  const contentBounds = BattleUiChrome.getContentBounds(panel, 'narrow');
  const portraitWidth = portraitVisible ? DETAIL_PANEL_PORTRAIT_WIDTH : 0;
  const portraitHeight = portraitVisible ? DETAIL_PANEL_PORTRAIT_HEIGHT : 0;
  const portraitGap = portraitVisible ? DETAIL_PANEL_PORTRAIT_GAP : 0;
  const infoWidth = Math.max(132, contentBounds.width - portraitWidth - portraitGap);
  const infoBounds = new Phaser.Geom.Rectangle(contentBounds.x, contentBounds.y, infoWidth, contentBounds.height);
  const portraitBounds = portraitVisible
    ? new Phaser.Geom.Rectangle(contentBounds.right - portraitWidth, contentBounds.y, portraitWidth, portraitHeight)
    : new Phaser.Geom.Rectangle(0, 0, 0, 0);
  const statColumnGap = UI_PANEL_GAP;
  const statColumnWidth = Math.max(72, Math.floor((infoBounds.width - statColumnGap) / 2));
  const bodyBoxWidth = Math.max(180, contentBounds.width);
  const bodyTextWidth = Math.max(144, bodyBoxWidth - DETAIL_PANEL_BODY_PADDING_X * 2);

  metaText.setWordWrapWidth(infoBounds.width, true);
  titleText.setWordWrapWidth(infoBounds.width, true);
  bodyText.setWordWrapWidth(bodyTextWidth, true);

  const metaY = Math.round(contentBounds.y + DETAIL_PANEL_TOP_PADDING_Y);
  const titleY = Math.round(metaY + metaText.height + DETAIL_PANEL_META_GAP);
  let cursorY = titleY + titleText.height + DETAIL_PANEL_TITLE_GAP;
  const healthBarBounds = hasHealthBar
    ? new Phaser.Geom.Rectangle(infoBounds.x, Math.round(cursorY), infoBounds.width, 10)
    : new Phaser.Geom.Rectangle(0, 0, 0, 0);

  if (hasHealthBar) {
    cursorY = healthBarBounds.bottom + DETAIL_PANEL_HEALTH_GAP;
  }

  const statRowHeights: number[] = [];
  for (const [index, text] of statTexts.entries()) {
    if (!text.text) {
      continue;
    }

    const row = Math.floor(index / 2);
    statRowHeights[row] = Math.max(statRowHeights[row] ?? 0, text.height + DETAIL_PANEL_CHIP_PADDING_Y * 2);
  }

  const statPositions: Array<Phaser.Math.Vector2 | null> = statTexts.map(() => null);
  const statChipBounds: Phaser.Geom.Rectangle[] = statTexts.map(() => new Phaser.Geom.Rectangle(0, 0, 0, 0));

  if (statRowHeights.length > 0) {
    for (const [index, text] of statTexts.entries()) {
      if (!text.text) {
        continue;
      }

      const column = index % 2;
      const row = Math.floor(index / 2);
      const rowHeight = statRowHeights[row] ?? text.height;
      const rowTop = cursorY + statRowHeights.slice(0, row).reduce((sum, rowSize) => sum + rowSize + DETAIL_PANEL_STAT_ROW_GAP, 0);
      const chipX = infoBounds.x + column * (statColumnWidth + statColumnGap);
      const chipY = Math.round(rowTop);

      statPositions[index] = new Phaser.Math.Vector2(
        chipX + DETAIL_PANEL_CHIP_PADDING_X,
        Math.round(chipY + Math.max(0, (rowHeight - text.height) * 0.5) - 1)
      );
      statChipBounds[index].setTo(chipX, chipY, statColumnWidth, rowHeight);
    }

    cursorY += statRowHeights.reduce((sum, rowSize) => sum + rowSize, 0) + Math.max(0, statRowHeights.length - 1) * DETAIL_PANEL_STAT_ROW_GAP;
  }

  const topSectionHeight = Math.max(cursorY - contentBounds.y, portraitHeight);
  const portraitY = portraitVisible
    ? Math.round(contentBounds.y + Math.max(0, (topSectionHeight - portraitHeight) * 0.5))
    : 0;
  const bodyBoxBounds = new Phaser.Geom.Rectangle(
    contentBounds.x,
    Math.round(contentBounds.y + topSectionHeight + DETAIL_PANEL_SECTION_GAP),
    bodyBoxWidth,
    Math.max(52, bodyText.height + DETAIL_PANEL_BODY_PADDING_Y * 2)
  );
  const topOffset = 2 + UI_NARROW_PLAQUE_HEADER_HEIGHT + UI_PANEL_CONTENT_GAP;
  const requiredHeight = Math.ceil(
    topOffset +
      topSectionHeight +
      DETAIL_PANEL_SECTION_GAP +
      bodyBoxBounds.height +
      UI_PANEL_CONTENT_INSET
  );

  return {
    contentBounds,
    infoBounds,
    portraitBounds: portraitVisible
      ? new Phaser.Geom.Rectangle(portraitBounds.x, portraitY, portraitBounds.width, portraitBounds.height)
      : portraitBounds,
    healthBarBounds,
    bodyBoxBounds,
    statChipBounds,
    statPositions,
    metaY,
    titleY,
    bodyTextX: bodyBoxBounds.x + DETAIL_PANEL_BODY_PADDING_X,
    bodyTextY: Math.round(bodyBoxBounds.y + DETAIL_PANEL_BODY_PADDING_Y),
    requiredHeight
  };
}

export function clearSharedDetailPanelLayout({
  detailBodyBoxBounds,
  detailHealthBarBounds,
  detailStatChipBounds,
  activeBadge,
  detailMetaText,
  detailTitleText,
  detailBodyText,
  portrait,
  portraitMask,
  detailStatTexts
}: Pick<
  SharedDetailPanelLayoutOptions,
  | 'detailBodyBoxBounds'
  | 'detailHealthBarBounds'
  | 'detailStatChipBounds'
  | 'activeBadge'
  | 'detailMetaText'
  | 'detailTitleText'
  | 'detailBodyText'
  | 'portrait'
  | 'portraitMask'
  | 'detailStatTexts'
>): void {
  detailBodyBoxBounds.setTo(0, 0, 0, 0);
  detailHealthBarBounds.setTo(0, 0, 0, 0);
  for (const bounds of detailStatChipBounds) {
    bounds.setTo(0, 0, 0, 0);
  }
  activeBadge.setVisible(false).setAlpha(0);
  detailMetaText.setVisible(false).setAlpha(0);
  detailTitleText.setVisible(false).setAlpha(0);
  detailBodyText.setVisible(false).setAlpha(0);
  portrait.setVisible(false).setAlpha(0);
  portraitMask.clear();
  for (const text of detailStatTexts) {
    text.setVisible(false).setAlpha(0);
  }
}

export function applySharedDetailPanelLayout({
  panel,
  alpha,
  visible,
  portraitVisible,
  activeBadge,
  detailMetaText,
  detailTitleText,
  detailBodyText,
  detailStatTexts,
  detailStatChipBounds,
  detailHealthBarBounds,
  detailBodyBoxBounds,
  portraitPanel,
  portrait,
  portraitMask,
  metrics,
  onSyncPortrait
}: SharedDetailPanelLayoutOptions): void {
  BattleUiChrome.layoutHeaderTitle(activeBadge, panel, 'narrow');
  activeBadge.setAlpha(alpha).setVisible(visible);

  detailMetaText
    .setPosition(metrics.infoBounds.x, 0)
    .setAlpha(alpha)
    .setVisible(visible);
  detailTitleText
    .setPosition(metrics.infoBounds.x, 0)
    .setAlpha(alpha)
    .setVisible(visible);
  detailBodyText.setAlpha(alpha).setVisible(visible);
  for (const text of detailStatTexts) {
    text.setAlpha(alpha).setVisible(visible && text.text.length > 0);
  }

  detailMetaText.setY(metrics.metaY);
  detailTitleText.setY(metrics.titleY);
  detailHealthBarBounds.setTo(
    metrics.healthBarBounds.x,
    metrics.healthBarBounds.y,
    metrics.healthBarBounds.width,
    metrics.healthBarBounds.height
  );

  for (const [index, text] of detailStatTexts.entries()) {
    const position = metrics.statPositions[index];
    const chipBounds = metrics.statChipBounds[index];
    detailStatChipBounds[index].setTo(chipBounds.x, chipBounds.y, chipBounds.width, chipBounds.height);

    if (!position || !text.text) {
      detailStatChipBounds[index].setTo(0, 0, 0, 0);
      continue;
    }

    text.setPosition(position.x, position.y);
  }

  portraitPanel.setTo(
    metrics.portraitBounds.x,
    metrics.portraitBounds.y,
    metrics.portraitBounds.width,
    metrics.portraitBounds.height
  );
  detailBodyBoxBounds.setTo(
    metrics.bodyBoxBounds.x,
    metrics.bodyBoxBounds.y,
    metrics.bodyBoxBounds.width,
    metrics.bodyBoxBounds.height
  );
  detailBodyText.setPosition(metrics.bodyTextX, metrics.bodyTextY);
  onSyncPortrait();
  portrait
    .setPosition(portraitPanel.centerX, portraitPanel.centerY)
    .setAlpha(alpha)
    .setVisible(visible && portraitVisible);
  portraitMask.clear();
  if (visible && portraitVisible) {
    portraitMask.fillStyle(0xffffff, 1);
    portraitMask.fillRoundedRect(
      portraitPanel.x,
      portraitPanel.y,
      portraitPanel.width,
      portraitPanel.height,
      UI_INSET_RADIUS
    );
  }
  portraitMask.setVisible(false);
}

export function clearDetailPortrait(image: Phaser.GameObjects.Image, mask: Phaser.GameObjects.Graphics): void {
  image.setVisible(false);
  mask.clear().setVisible(false);
}

export interface SharedDetailPortraitDescriptor {
  textureKey: string;
  kind: DetailPortraitKind;
  flipX: boolean;
}

export interface SyncDetailPortraitOptions {
  image: Phaser.GameObjects.Image;
  mask: Phaser.GameObjects.Graphics;
  panel: Phaser.Geom.Rectangle;
  descriptor: SharedDetailPortraitDescriptor | null;
  visible: boolean;
}

export function syncDetailPortrait({
  image,
  mask,
  panel,
  descriptor,
  visible
}: SyncDetailPortraitOptions): void {
  if (!descriptor || panel.width <= 0 || panel.height <= 0 || !visible) {
    clearDetailPortrait(image, mask);
    return;
  }

  renderDetailPortrait({
    image,
    mask,
    panel,
    textureKey: descriptor.textureKey,
    kind: descriptor.kind,
    flipX: descriptor.flipX,
    visible
  });
}

export function renderDetailPortrait({
  image,
  mask,
  panel,
  textureKey,
  kind,
  flipX = false,
  visible = true
}: SharedPortraitOptions): boolean {
  if (!visible || panel.width <= 0 || panel.height <= 0) {
    clearDetailPortrait(image, mask);
    return false;
  }

  image.setTexture(textureKey);
  const frame = image.frame;
  if (!frame) {
    clearDetailPortrait(image, mask);
    return false;
  }

  const panelWidth = panel.width;
  const panelHeight = panel.height;
  const maxWidth = Math.max(24, panelWidth - 20);
  const maxHeight = Math.max(24, panelHeight - 20);
  const frameWidth = Math.max(1, frame.width);
  const frameHeight = Math.max(1, frame.height);

  if (kind === 'unit-portrait') {
    const coverWidth = Math.max(24, panelWidth);
    const coverHeight = Math.max(24, panelHeight);
    const targetAspect = coverWidth / coverHeight;
    const frameAspect = frameWidth / frameHeight;
    let cropWidth = frameWidth;
    let cropHeight = frameHeight;
    let cropX = 0;
    let cropY = 0;

    if (frameAspect > targetAspect) {
      cropWidth = frameHeight * targetAspect;
      cropX = (frameWidth - cropWidth) * 0.5;
    } else {
      cropHeight = frameWidth / targetAspect;
      cropY = (frameHeight - cropHeight) * 0.5;
    }

    image
      .setOrigin(0.5, 0.5)
      .setFlipX(false)
      .setCrop(cropX, cropY, cropWidth, cropHeight)
      .setDisplaySize(coverWidth, coverHeight)
      .setPosition(panel.centerX, panel.centerY)
      .setAlpha(1)
      .setVisible(true);
  } else {
    let widthScale = maxWidth / frameWidth;
    let heightScale = maxHeight / frameHeight;

    switch (kind) {
      case 'unit':
        image.setCrop();
        heightScale = Math.max(72, panelHeight - 12) / frameHeight;
        widthScale = heightScale;
        break;
      case 'prop':
        image.setCrop();
        widthScale *= 0.88;
        heightScale *= 0.88;
        break;
      case 'chest':
        image.setCrop();
        widthScale *= 0.84;
        heightScale *= 0.84;
        break;
      case 'terrain':
        image.setCrop();
        widthScale *= 0.88;
        heightScale *= 0.66;
        break;
    }

    const scale = Math.max(0.01, Math.min(widthScale, heightScale));
    image
      .setOrigin(0.5, 0.5)
      .setFlipX(flipX)
      .setScale(scale)
      .setPosition(panel.centerX, panel.centerY)
      .setAlpha(1)
      .setVisible(true);
  }

  mask.clear();
  mask.fillStyle(0xffffff, 1);
  mask.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, UI_INSET_RADIUS);
  mask.setVisible(false);
  return true;
}

export function drawSharedMapPlaque({
  graphics,
  art,
  artMask,
  panel,
  alpha = 1,
  accentColor = UI_COLOR_ACCENT_WARM
}: SharedMapPlaqueOptions): void {
  if (panel.width <= 0 || panel.height <= 0 || alpha <= 0.01) {
    art.setVisible(false);
    artMask.clear().setVisible(false);
    return;
  }

  BattleUiChrome.applyPanelBackgroundImage(art, artMask, panel, {
    alpha,
    radius: 24,
    inset: 2,
    visible: true
  });
  BattleUiChrome.drawPlaqueShell(graphics, panel, {
    accentColor,
    alpha,
    headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
    radius: 24,
    surfaceAlpha: 0.3,
    innerSurfaceAlpha: 0.3,
    headerAlpha: 0.74,
    sideRuleAlpha: 0.14,
    dividerAlpha: 0.22
  });
}

export function drawSharedDetailPlaque({
  graphics,
  panel,
  accentColor,
  alpha,
  bodyBoxBounds,
  statChipBounds,
  statTexts,
  healthBarBounds,
  healthRatio,
  healthColor
}: SharedDetailPlaqueOptions): void {
  if (panel.width <= 0 || panel.height <= 0 || alpha <= 0.01) {
    return;
  }

  BattleUiChrome.drawPlaqueShell(graphics, panel, {
    accentColor,
    alpha,
    headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
    radius: 24,
    headerAlpha: 0.62,
    sideRuleAlpha: 0.18,
    dividerAlpha: 0.32
  });

  if (bodyBoxBounds.width > 0 && bodyBoxBounds.height > 0) {
    BattleUiChrome.drawInsetBox(graphics, bodyBoxBounds, {
      fillAlpha: 0.92 * alpha,
      strokeAlpha: 0.28 * alpha,
      radius: UI_INSET_RADIUS
    });
  }

  for (const [index, text] of statTexts.entries()) {
    const chipBounds = statChipBounds[index];
    if (!text.text || chipBounds.width <= 0 || chipBounds.height <= 0) {
      continue;
    }

    BattleUiChrome.drawInsetBox(graphics, chipBounds, {
      fillAlpha: 0.86 * alpha,
      strokeAlpha: 0.2 * alpha,
      radius: 10
    });
  }

  if (healthRatio !== null && healthBarBounds.width > 0) {
    BattleUiChrome.drawInsetBox(graphics, healthBarBounds, {
      fillColor: UI_COLOR_PANEL_SHADOW,
      fillAlpha: 0.92 * alpha,
      strokeAlpha: 0.2 * alpha,
      radius: 6
    });
    graphics.fillStyle(healthColor, 0.95 * alpha);
    graphics.fillRoundedRect(
      healthBarBounds.x + 2,
      healthBarBounds.y + 2,
      Math.max(6, (healthBarBounds.width - 4) * healthRatio),
      healthBarBounds.height - 4,
      4
    );
  }
}

export function drawSharedDetailPlaqueFrame({
  focusUnitTeam = null,
  isExplorationMode = false,
  inspectionUnitTeam = null,
  inspectionNpcHostile = null,
  inspectionTileVisible = false,
  ...options
}: SharedDetailPlaqueFrameOptions): void {
  drawSharedDetailPlaque({
    ...options,
    accentColor: resolveDetailAccentColor({
      focusUnitTeam,
      isExplorationMode,
      inspectionUnitTeam,
      inspectionNpcHostile,
      inspectionTileVisible
    })
  });
}

export function drawSharedPortraitFrame(
  graphics: Phaser.GameObjects.Graphics,
  panel: Phaser.Geom.Rectangle,
  alpha: number
): void {
  if (panel.width <= 0 || panel.height <= 0 || alpha <= 0.01) {
    return;
  }

  BattleUiChrome.drawPanelShell(graphics, panel, alpha * 0.86, UI_PLAQUE_HEADER_HEIGHT, 14, UI_COLOR_ACCENT_NEUTRAL);
  graphics.fillStyle(UI_COLOR_PANEL_BORDER, 0.08 * alpha);
  graphics.fillRoundedRect(panel.x + 10, panel.y + 10, panel.width - 20, 10, 4);
}

export function drawSharedHeaderMenuOverlay({
  graphics,
  viewportWidth,
  viewportHeight,
  panel,
  optionBounds
}: SharedHeaderMenuOverlayOptions): void {
  if (panel.width <= 0 || panel.height <= 0) {
    return;
  }

  graphics.fillStyle(UI_COLOR_OVERLAY, 0.56);
  graphics.fillRect(0, 0, viewportWidth, viewportHeight);

  BattleUiChrome.drawPlaqueShell(graphics, panel, {
    accentColor: UI_COLOR_ACCENT_WARM,
    alpha: 1,
    headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
    radius: 18,
    headerAlpha: 0.56,
    sideRuleAlpha: 0.12,
    dividerAlpha: 0.14
  });

  for (const bounds of optionBounds) {
    if (bounds.width <= 0 || bounds.height <= 0) {
      continue;
    }

    BattleUiChrome.drawInsetBox(graphics, bounds, {
      fillColor: UI_COLOR_PANEL_SURFACE_ALT,
      fillAlpha: 0.88,
      strokeAlpha: 0.18,
      radius: 10
    });
  }
}

export function drawSharedMapTitleIntro({
  graphics,
  overlayShade,
  artBounds,
  textBounds,
  eyebrowBounds,
  objectiveBounds,
  alpha
}: SharedMapTitleIntroOptions): void {
  if (alpha <= 0.01) {
    overlayShade.setAlpha(0);
    return;
  }

  overlayShade.setFillStyle(UI_COLOR_OVERLAY, 0.44 * alpha);

  BattleUiChrome.drawInsetBox(graphics, artBounds, {
    fillColor: UI_COLOR_PANEL_SURFACE_ALT,
    fillAlpha: 0,
    strokeAlpha: 0.3 * alpha,
    radius: 24
  });
  graphics.fillStyle(UI_COLOR_OVERLAY, 0.02 * alpha);
  graphics.fillRoundedRect(
    artBounds.x,
    artBounds.bottom - Math.round(artBounds.height * 0.34),
    artBounds.width,
    Math.round(artBounds.height * 0.34),
    0
  );

  graphics.fillStyle(UI_COLOR_PANEL_SHADOW, 0.3 * alpha);
  graphics.fillRoundedRect(
    textBounds.x + 8,
    textBounds.y + 14,
    textBounds.width,
    textBounds.height,
    24
  );
  BattleUiChrome.drawInsetBox(graphics, textBounds, {
    fillColor: UI_COLOR_PANEL_SURFACE,
    fillAlpha: 0.94 * alpha,
    strokeAlpha: 0.26 * alpha,
    radius: 22
  });

  graphics.fillStyle(UI_COLOR_ACCENT_WARM, 0.3 * alpha);
  graphics.fillRoundedRect(
    textBounds.x + 16,
    textBounds.y + 16,
    5,
    textBounds.height - 32,
    2
  );

  BattleUiChrome.drawPill(graphics, eyebrowBounds, {
    fillColor: UI_COLOR_ACCENT_WARM,
    strokeColor: UI_COLOR_PANEL_BORDER,
    fillAlpha: 0.9 * alpha,
    strokeAlpha: 0.34 * alpha,
    radius: 14
  });

  if (objectiveBounds.width > 0 && objectiveBounds.height > 0) {
    BattleUiChrome.drawInsetBox(graphics, objectiveBounds, {
      fillColor: UI_COLOR_PANEL_SURFACE_ALT,
      fillAlpha: 0.92 * alpha,
      strokeAlpha: 0.24 * alpha,
      radius: UI_INSET_RADIUS
    });
  }
}

export function drawSharedMapTitlePanels({
  graphics,
  viewportWidth,
  viewportHeight,
  headerPanel,
  mapPlaqueArt,
  mapPlaqueArtMask,
  mapPlaqueAlpha,
  mapPlaqueVisible,
  introOverlayShade,
  mapIntroArt,
  mapIntroArtMask,
  mapIntroArtBounds,
  mapIntroTextBounds,
  mapIntroEyebrowBounds,
  mapObjectiveBoxBounds,
  mapIntroAlpha,
  mapIntroVisible,
  headerMenuOpen,
  headerMenuPanelBounds,
  headerMenuOptionBounds
}: SharedMapTitlePanelsOptions): void {
  if (mapPlaqueVisible && mapPlaqueAlpha > 0.01 && headerPanel.width > 0 && headerPanel.height > 0) {
    drawSharedMapPlaque({
      graphics,
      art: mapPlaqueArt,
      artMask: mapPlaqueArtMask,
      panel: headerPanel,
      alpha: mapPlaqueAlpha
    });
  } else {
    mapPlaqueArt.setVisible(false);
    mapPlaqueArtMask.clear().setVisible(false);
  }

  if (mapIntroVisible && mapIntroAlpha > 0.01) {
    drawSharedMapTitleIntro({
      graphics,
      overlayShade: introOverlayShade,
      artBounds: mapIntroArtBounds,
      textBounds: mapIntroTextBounds,
      eyebrowBounds: mapIntroEyebrowBounds,
      objectiveBounds: mapObjectiveBoxBounds,
      alpha: mapIntroAlpha
    });
  } else {
    introOverlayShade.setAlpha(0);
    mapIntroArt.setVisible(false);
    mapIntroArtMask.clear().setVisible(false);
  }

  if (headerMenuOpen) {
    drawSharedHeaderMenuOverlay({
      graphics,
      viewportWidth,
      viewportHeight,
      panel: headerMenuPanelBounds,
      optionBounds: headerMenuOptionBounds
    });
  }
}

export function applySharedMapTitleLayout({
  width,
  height,
  headerRect,
  mapPlaqueOffsetX,
  mapIntroOffsetY,
  mapIntroAlpha,
  mapPlaqueAlpha,
  mapIntroVisible,
  hudVisible,
  mapPlaqueTitleText,
  mapPlaqueMetaText,
  mapObjectiveText,
  mapIntroArt,
  mapIntroArtMask,
  mapIntroArtBounds,
  mapIntroArtImageBounds,
  mapIntroTextBounds,
  mapIntroBounds,
  mapIntroEyebrowBounds,
  mapObjectiveBoxBounds,
  mapIntroEyebrowText,
  mapIntroTitleText,
  mapIntroMetaText,
  mapIntroFlavorText,
  headerMenuTitleText,
  headerMenuButtonBounds,
  headerMenuPanelBounds,
  headerMenuOptionBounds,
  headerMenuOptionTexts,
  headerMenuActionCount,
  headerMenuOpen
}: SharedMapTitleLayoutOptions): void {
  const introVisible = mapIntroAlpha > 0.01;
  const introMargin = width <= 540 ? 18 : 28;
  const portraitIntro = height >= width;
  const shortLandscapeIntro = width > height && height < 620;
  const introTextInsetX = 18;
  const introTextInsetY = 18;
  const introTextGap = UI_PANEL_TIGHT_GAP;
  const introGap = portraitIntro ? 12 : 18;
  const introGroupWidth = Phaser.Math.Clamp(
    width - introMargin * 2,
    320,
    portraitIntro ? 400 : shortLandscapeIntro ? 760 : 900
  );
  const introArtWidth = portraitIntro
    ? introGroupWidth
    : Phaser.Math.Clamp(Math.round(introGroupWidth * (shortLandscapeIntro ? 0.6 : 0.62)), 420, 600);
  const introArtHeight = portraitIntro
    ? Phaser.Math.Clamp(Math.round(height * 0.24), 168, 208)
    : shortLandscapeIntro
      ? 164
      : 196;
  const introTextWidth = portraitIntro
    ? Math.min(introArtWidth - 24, 360)
    : Phaser.Math.Clamp(introGroupWidth - introArtWidth - introGap, 270, 340);
  const introTextInnerWidth = Math.max(180, introTextWidth - introTextInsetX * 2);

  mapIntroMetaText.setWordWrapWidth(introTextInnerWidth, true);
  mapIntroFlavorText.setWordWrapWidth(introTextInnerWidth - UI_PANEL_COMPACT_INSET * 2, true);

  const eyebrowWidth = Phaser.Math.Clamp(mapIntroEyebrowText.width + 28, 132, introTextInnerWidth);
  const eyebrowHeight = Math.max(24, mapIntroEyebrowText.height + 10);
  const summaryBoxHeight = Math.max(34, mapIntroFlavorText.height + UI_PANEL_COMPACT_INSET * 2);
  const introTextHeight = Math.ceil(
    introTextInsetY +
    eyebrowHeight +
    introTextGap +
    mapIntroTitleText.height +
    UI_PANEL_MICRO_GAP +
    mapIntroMetaText.height +
    UI_PANEL_GAP +
    summaryBoxHeight +
    introTextInsetY
  );
  const introGroupHeight = portraitIntro
    ? introArtHeight + introGap + introTextHeight
    : Math.max(introArtHeight, introTextHeight);
  const introTop = Phaser.Math.Clamp(
    Math.round(height * (portraitIntro ? 0.11 : 0.14)) + mapIntroOffsetY,
    36 + mapIntroOffsetY,
    Math.max(36 + mapIntroOffsetY, height - introGroupHeight - 48)
  );
  const introLeft = Math.round((width - introGroupWidth) * 0.5);

  if (portraitIntro) {
    mapIntroArtBounds.setTo(introLeft, introTop, introArtWidth, introArtHeight);
    mapIntroTextBounds.setTo(
      Math.round((width - introTextWidth) * 0.5),
      mapIntroArtBounds.bottom + introGap,
      introTextWidth,
      introTextHeight
    );
  } else {
    mapIntroArtBounds.setTo(introLeft, introTop, introArtWidth, introArtHeight);
    mapIntroTextBounds.setTo(
      mapIntroArtBounds.right + introGap,
      Math.round(introTop + Math.max(0, (introArtHeight - introTextHeight) * 0.5)),
      introTextWidth,
      introTextHeight
    );
  }

  const introGroupLeft = Math.min(mapIntroArtBounds.x, mapIntroTextBounds.x);
  const introGroupTop = Math.min(mapIntroArtBounds.y, mapIntroTextBounds.y);
  const introGroupRight = Math.max(mapIntroArtBounds.right, mapIntroTextBounds.right);
  const introGroupBottom = Math.max(mapIntroArtBounds.bottom, mapIntroTextBounds.bottom);
  mapIntroArtImageBounds.setTo(
    mapIntroArtBounds.x,
    mapIntroArtBounds.y,
    mapIntroArtBounds.width,
    mapIntroArtBounds.height
  );
  mapIntroBounds.setTo(
    introGroupLeft,
    introGroupTop,
    introGroupRight - introGroupLeft,
    introGroupBottom - introGroupTop
  );

  const introTextGrid = createUiSubGrid(
    mapIntroTextBounds,
    1,
    introTextInsetX,
    introTextInsetY,
    introTextGap
  );
  const headerPanel = new Phaser.Geom.Rectangle(
    headerRect.x + mapPlaqueOffsetX,
    headerRect.y,
    headerRect.width,
    headerRect.height
  );
  const plaqueContentBounds = BattleUiChrome.getContentBounds(headerPanel, 'narrow');
  const plaqueGrid = createUiSubGrid(plaqueContentBounds, 1, 0, 0, UI_PANEL_MINI_GAP);

  mapIntroEyebrowText
    .setPosition(plaqueContentBounds.x, plaqueContentBounds.y)
    .setAlpha(mapPlaqueAlpha)
    .setVisible(false);
  BattleUiChrome.layoutHeaderTitle(mapPlaqueTitleText, headerPanel, 'narrow');
  mapPlaqueTitleText
    .setAlpha(mapPlaqueAlpha)
    .setVisible(hudVisible && mapPlaqueAlpha > 0.01);
  mapPlaqueMetaText
    .setPosition(plaqueGrid.content.x, plaqueGrid.content.y)
    .setAlpha(mapPlaqueAlpha)
    .setVisible(hudVisible && mapPlaqueAlpha > 0.01);
  mapObjectiveText
    .setPosition(plaqueGrid.content.x, mapPlaqueMetaText.y + mapPlaqueMetaText.height + plaqueGrid.gutter)
    .setWordWrapWidth(plaqueGrid.content.width, true)
    .setAlpha(mapPlaqueAlpha)
    .setVisible(hudVisible && mapPlaqueAlpha > 0.01);
  headerMenuButtonBounds.setTo(
    hudVisible ? headerPanel.x : 0,
    hudVisible ? headerPanel.y : 0,
    hudVisible ? headerPanel.width : 0,
    hudVisible ? headerPanel.height : 0
  );
  headerMenuTitleText.setVisible(hudVisible && headerMenuOpen);
  headerMenuPanelBounds.setTo(
    Math.round((width - 248) * 0.5),
    Math.round((height - (UI_NARROW_PLAQUE_HEADER_HEIGHT + UI_PANEL_CONTENT_GAP + headerMenuActionCount * 30 + Math.max(0, headerMenuActionCount - 1) * UI_PANEL_COMPACT_GAP + UI_PANEL_CONTENT_INSET)) * 0.5),
    248,
    UI_NARROW_PLAQUE_HEADER_HEIGHT + UI_PANEL_CONTENT_GAP + headerMenuActionCount * 30 + Math.max(0, headerMenuActionCount - 1) * UI_PANEL_COMPACT_GAP + UI_PANEL_CONTENT_INSET
  );
  const menuContentBounds = BattleUiChrome.getContentBounds(headerMenuPanelBounds, 'narrow');
  const menuGrid = createUiSubGrid(menuContentBounds, 1, 0, 0, UI_PANEL_COMPACT_GAP);
  BattleUiChrome.layoutHeaderTitle(headerMenuTitleText, headerMenuPanelBounds, 'narrow').setVisible(hudVisible && headerMenuOpen);

  for (const [index, text] of headerMenuOptionTexts.entries()) {
    const optionBounds = headerMenuOptionBounds[index];
    if (index >= headerMenuActionCount) {
      optionBounds.setTo(0, 0, 0, 0);
      text.setVisible(false);
      continue;
    }

    const rowBounds = menuGrid.band(menuGrid.content.y + index * (30 + menuGrid.gutter), 30);
    optionBounds.setTo(rowBounds.x, rowBounds.y, rowBounds.width, rowBounds.height);
    text
      .setPosition(optionBounds.x + UI_PANEL_COMPACT_INSET, optionBounds.centerY)
      .setOrigin(0, 0.5)
      .setVisible(hudVisible && headerMenuOpen);
  }

  mapIntroEyebrowBounds.setTo(
    introTextGrid.content.x,
    introTextGrid.content.y,
    eyebrowWidth,
    eyebrowHeight
  );
  const introTitleBand = introTextGrid.band(mapIntroEyebrowBounds.bottom + introTextGap, mapIntroTitleText.height);
  const introMetaBand = introTextGrid.band(introTitleBand.bottom + UI_PANEL_MICRO_GAP, mapIntroMetaText.height);
  mapObjectiveBoxBounds.setTo(
    introTextGrid.content.x,
    introMetaBand.bottom + UI_PANEL_GAP,
    introTextGrid.content.width,
    summaryBoxHeight
  );
  const introFlavorBand = introTextGrid.band(
    mapObjectiveBoxBounds.y + UI_PANEL_COMPACT_INSET,
    mapIntroFlavorText.height
  );

  const introFrame = mapIntroArt.frame;
  if (introFrame) {
    const artVisible = mapIntroAlpha > 0.01;
    mapIntroArt
      .setCrop(0, 0, introFrame.width, introFrame.height)
      .setDisplaySize(mapIntroArtImageBounds.width, mapIntroArtImageBounds.height)
      .setPosition(mapIntroArtImageBounds.centerX, mapIntroArtImageBounds.centerY)
      .setAlpha(mapIntroAlpha)
      .setTint(0xffffff)
      .setVisible(artVisible);
    mapIntroArtMask.clear();
    mapIntroArtMask.setPosition(mapIntroArtImageBounds.x, mapIntroArtImageBounds.y);
    mapIntroArtMask.fillStyle(0xffffff, 1);
    mapIntroArtMask.fillRoundedRect(0, 0, mapIntroArtImageBounds.width, mapIntroArtImageBounds.height, 24);
  }

  mapIntroEyebrowText
    .setOrigin(0, 0.5)
    .setPosition(mapIntroEyebrowBounds.x + 14, mapIntroEyebrowBounds.centerY)
    .setAlpha(mapIntroAlpha)
    .setVisible(introVisible);
  mapIntroTitleText
    .setOrigin(0, 0)
    .setPosition(introTextGrid.content.x, introTitleBand.y)
    .setAlpha(mapIntroAlpha)
    .setVisible(introVisible);
  mapIntroMetaText
    .setOrigin(0, 0)
    .setPosition(introTextGrid.content.x, introMetaBand.y)
    .setAlpha(mapIntroAlpha)
    .setVisible(introVisible)
    .setWordWrapWidth(introTextInnerWidth, true);
  mapIntroFlavorText
    .setOrigin(0, 0)
    .setPosition(mapObjectiveBoxBounds.x + UI_PANEL_COMPACT_INSET, introFlavorBand.y)
    .setAlpha(mapIntroAlpha)
    .setVisible(introVisible)
    .setWordWrapWidth(introTextInnerWidth - UI_PANEL_COMPACT_INSET * 2, true);
}

export function drawSharedBattleHudPanels({
  graphics,
  viewportWidth,
  viewportHeight,
  headerPanel,
  mapPlaqueArt,
  mapPlaqueArtMask,
  mapPlaqueAlpha,
  mapPlaqueVisible,
  introOverlayShade,
  mapIntroArt,
  mapIntroArtMask,
  mapIntroArtBounds,
  mapIntroTextBounds,
  mapIntroEyebrowBounds,
  mapObjectiveBoxBounds,
  mapIntroAlpha,
  mapIntroVisible,
  headerMenuOpen,
  headerMenuPanelBounds,
  headerMenuOptionBounds,
  drawDetailPanel,
  shouldDrawPortraitFrame,
  portraitPanel,
  portraitAlpha
}: SharedBattleHudPanelsOptions): void {
  graphics.clear();
  drawSharedMapTitlePanels({
    graphics,
    viewportWidth,
    viewportHeight,
    headerPanel,
    mapPlaqueArt,
    mapPlaqueArtMask,
    mapPlaqueAlpha,
    mapPlaqueVisible,
    introOverlayShade,
    mapIntroArt,
    mapIntroArtMask,
    mapIntroArtBounds,
    mapIntroTextBounds,
    mapIntroEyebrowBounds,
    mapObjectiveBoxBounds,
    mapIntroAlpha,
    mapIntroVisible,
    headerMenuOpen,
    headerMenuPanelBounds,
    headerMenuOptionBounds
  });
  drawDetailPanel();
  if (shouldDrawPortraitFrame && portraitAlpha > 0.01) {
    drawSharedPortraitFrame(graphics, portraitPanel, portraitAlpha);
  }
}

export function drawSharedBattleResultOverlay({
  overlayShade,
  panel,
  art,
  artMask,
  eyebrow,
  title,
  body,
  buttons,
  result,
  viewportWidth,
  viewportHeight,
  panelBoundsTarget,
  eyebrowText,
  bodyText,
  buttonDescriptorOptions
}: SharedBattleResultOverlayOptions): void {
  const layout = resolveSharedBattleResultOverlayLayout(viewportWidth, viewportHeight);
  const {
    panelBounds,
    artBounds,
    copyX,
    copyTop,
    bodyY,
    buttonX,
    buttonAreaY,
    buttonWidth,
    buttonHeight,
    buttonGap,
    copyWidth,
    portraitLayout
  } = layout;

  panelBoundsTarget?.setTo(panelBounds.x, panelBounds.y, panelBounds.width, panelBounds.height);

  const accentColor = result === 'Victory' ? UI_COLOR_ACCENT_WARM : UI_COLOR_ACCENT_DANGER;
  const titleText = result.toUpperCase();
  const titleColor = result === 'Victory' ? '#f7edd9' : '#f3d9de';
  const eyebrowColor = result === 'Victory' ? '#f0d8a2' : '#e7a4ab';
  const imageAlpha = result === 'Victory' ? 0.74 : 0.54;
  const imageTint = result === 'Victory' ? 0xf0d8a2 : 0xb98696;

  overlayShade
    .setPosition(viewportWidth / 2, viewportHeight / 2)
    .setSize(viewportWidth, viewportHeight);

  panel.clear();
  BattleUiChrome.drawPanelShell(panel, panelBounds, 1, 38, 24, accentColor);
  BattleUiChrome.drawInsetBox(panel, artBounds, {
    fillColor: UI_COLOR_PANEL_SURFACE_ALT,
    fillAlpha: 0.94,
    strokeColor: UI_COLOR_PANEL_BORDER,
    strokeAlpha: 0.28,
    radius: 18
  });

  artMask.clear();
  artMask.fillStyle(0xffffff, 1);
  artMask.fillRoundedRect(artBounds.x + 2, artBounds.y + 2, artBounds.width - 4, artBounds.height - 4, 16);
  coverImageBounds(art, artBounds, 1.06);
  art
    .setVisible(true)
    .setAlpha(imageAlpha)
    .setTint(imageTint);

  const buttonDescriptors = createResultOverlayButtonDescriptors(result, buttonDescriptorOptions);
  for (const [index, button] of buttons.entries()) {
    const descriptor: ResultOverlayButtonDescriptor | undefined = buttonDescriptors[index];
    if (!descriptor) {
      continue;
    }

    const row = portraitLayout ? index : 0;
    const column = portraitLayout ? 0 : index;
    button.bounds.setTo(
      buttonX + column * (buttonWidth + buttonGap),
      buttonAreaY + row * (buttonHeight + 12),
      buttonWidth,
      buttonHeight
    );

    BattleUiChrome.drawPill(panel, button.bounds, {
      fillColor: descriptor.fillColor,
      strokeColor: descriptor.strokeColor,
      fillAlpha: descriptor.fillAlpha,
      strokeAlpha: 0.56,
      radius: 16
    });

    button.labelText
      .setText(descriptor.label)
      .setPosition(button.bounds.centerX, button.bounds.centerY)
      .setOrigin(0.5, 0.5)
      .setColor(UI_COLOR_TEXT);
  }

  eyebrow
    .setText(eyebrowText)
    .setPosition(copyX, copyTop)
    .setOrigin(portraitLayout ? 0.5 : 0, 0.5)
    .setColor(eyebrowColor);
  title
    .setText(titleText)
    .setPosition(copyX, copyTop + 28)
    .setOrigin(portraitLayout ? 0.5 : 0, 0.5)
    .setStyle({
      align: portraitLayout ? 'center' : 'left',
      color: titleColor
    });
  body
    .setText(bodyText)
    .setPosition(copyX, bodyY)
    .setOrigin(portraitLayout ? 0.5 : 0, 0)
    .setStyle({ align: portraitLayout ? 'center' : 'left' })
    .setWordWrapWidth(Math.min(copyWidth, portraitLayout ? copyWidth : 360), true);
}

export function drawSharedBattleResultOverlayFrame({
  isWorldEncounterBattle,
  result,
  ...options
}: SharedBattleResultOverlayFrameOptions): void {
  const overlayCopy = createBattleResultOverlayCopy(result, isWorldEncounterBattle);

  drawSharedBattleResultOverlay({
    ...options,
    result,
    eyebrowText: overlayCopy.eyebrowText,
    bodyText: overlayCopy.bodyText,
    buttonDescriptorOptions: createBattleResultOverlayButtonDescriptorOptions(overlayCopy.secondaryLabel)
  });
}
