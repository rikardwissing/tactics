import Phaser from 'phaser';
import {
  BattleUiChrome,
  UI_INSET_RADIUS,
  UI_NARROW_PLAQUE_HEADER_HEIGHT,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_GAP,
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
  createResultOverlayButtonDescriptors,
  type DetailPortraitKind,
  type ResultOverlayButtonDescriptor,
  type ResultOverlayButtonDescriptorOptions
} from './hudShared';
import { resolveSharedBattleResultOverlayLayout } from './hudLayout';

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

export function clearDetailPortrait(image: Phaser.GameObjects.Image, mask: Phaser.GameObjects.Graphics): void {
  image.setVisible(false);
  mask.clear().setVisible(false);
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
