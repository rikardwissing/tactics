import Phaser from 'phaser';
import { UI_TEXT_HEADER_TITLE } from './UiTextStyles';
import { createUiSubGrid } from './UiGrid';
import {
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SHADOW,
  UI_COLOR_PANEL_SURFACE,
  UI_COLOR_PANEL_SURFACE_ALT,
  UI_COLOR_PANEL_SHINE
} from './UiColors';
import {
  UI_INSET_RADIUS,
  UI_NARROW_PLAQUE_HEADER_HEIGHT,
  UI_PANEL_COMPACT_GAP,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_GAP,
  UI_PANEL_HEADER_INSET,
  UI_PANEL_MICRO_GAP,
  UI_PANEL_MINI_GAP,
  UI_PANEL_TIGHT_GAP,
  UI_PLAQUE_HEADER_HEIGHT,
  UI_PLAQUE_RADIUS,
  UI_SCREEN_MARGIN
} from './UiMetrics';

export {
  UI_INSET_RADIUS,
  UI_NARROW_PLAQUE_HEADER_HEIGHT,
  UI_PANEL_COMPACT_GAP,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_GAP,
  UI_PANEL_HEADER_INSET,
  UI_PANEL_MICRO_GAP,
  UI_PANEL_MINI_GAP,
  UI_PANEL_TIGHT_GAP,
  UI_PLAQUE_HEADER_HEIGHT,
  UI_PLAQUE_RADIUS,
  UI_SCREEN_MARGIN
} from './UiMetrics';
export const UI_HEADER_TITLE_TEXT_STYLE = UI_TEXT_HEADER_TITLE;
export const UI_NARROW_HEADER_TITLE_TEXT_STYLE = UI_TEXT_HEADER_TITLE;

interface UiPanelLayout {
  headerBounds: Phaser.Geom.Rectangle;
  headerTextBounds: Phaser.Geom.Rectangle;
  contentBounds: Phaser.Geom.Rectangle;
}

export type UiPanelVariant = 'default' | 'narrow';

const UI_PANEL_VARIANTS: Record<
  UiPanelVariant,
  {
    headerHeight: number;
    insetX: number;
    headerInsetX: number;
    topGap: number;
    bottomInset: number;
    gutter: number;
  }
> = {
  default: {
    headerHeight: UI_PLAQUE_HEADER_HEIGHT,
    insetX: UI_PANEL_CONTENT_INSET,
    headerInsetX: UI_PANEL_HEADER_INSET,
    topGap: UI_PANEL_CONTENT_GAP,
    bottomInset: UI_PANEL_CONTENT_INSET,
    gutter: UI_PANEL_GAP
  },
  narrow: {
    headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
    insetX: UI_PANEL_CONTENT_INSET,
    headerInsetX: UI_PANEL_HEADER_INSET,
    topGap: UI_PANEL_CONTENT_GAP,
    bottomInset: UI_PANEL_CONTENT_INSET,
    gutter: UI_PANEL_GAP
  }
};

export interface UiPlaqueShellOptions {
  accentColor: number;
  alpha?: number;
  headerHeight?: number;
  radius?: number;
  headerAlpha?: number;
  sideRuleAlpha?: number;
  shineAlpha?: number;
  dividerAlpha?: number;
}

export interface UiInsetBoxOptions {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  radius?: number;
}

export interface UiPillOptions {
  fillColor: number;
  strokeColor: number;
  fillAlpha?: number;
  strokeAlpha?: number;
  radius?: number;
}

export class BattleUiChrome {
  static getPanelLayout(
    panel: Phaser.Geom.Rectangle,
    variant: UiPanelVariant = 'default'
  ): UiPanelLayout {
    const config = UI_PANEL_VARIANTS[variant];
    const gutter = config.gutter;
    const panelGrid = createUiSubGrid(panel, 1, 2, 2, gutter);
    const headerBounds = panelGrid.band(panelGrid.content.y, Math.min(config.headerHeight, panel.height - 4));
    const headerTextGrid = createUiSubGrid(headerBounds, 1, Math.max(0, config.headerInsetX - 2), 0, gutter);
    const contentFrame = new Phaser.Geom.Rectangle(
      panel.x,
      headerBounds.bottom + config.topGap,
      panel.width,
      Math.max(0, panel.bottom - config.bottomInset - (headerBounds.bottom + config.topGap))
    );
    const contentGrid = createUiSubGrid(contentFrame, 1, config.insetX, 0, gutter);

    return {
      headerBounds,
      headerTextBounds: headerTextGrid.content,
      contentBounds: contentGrid.content
    };
  }

  static getHeaderBounds(panel: Phaser.Geom.Rectangle, variant: UiPanelVariant = 'default'): Phaser.Geom.Rectangle {
    return BattleUiChrome.getPanelLayout(panel, variant).headerBounds;
  }

  static getHeaderCenterY(panel: Phaser.Geom.Rectangle, variant: UiPanelVariant = 'default'): number {
    return BattleUiChrome.getHeaderBounds(panel, variant).centerY;
  }

  static layoutHeaderTitle(
    text: Phaser.GameObjects.Text,
    panel: Phaser.Geom.Rectangle,
    variant: UiPanelVariant = 'default'
  ): Phaser.GameObjects.Text {
    const layout = BattleUiChrome.getPanelLayout(panel, variant);
    return text
      .setOrigin(0, 0.5)
      .setPosition(layout.headerTextBounds.x, layout.headerBounds.centerY);
  }

  static getContentBounds(panel: Phaser.Geom.Rectangle, variant: UiPanelVariant = 'default'): Phaser.Geom.Rectangle {
    return BattleUiChrome.getPanelLayout(panel, variant).contentBounds;
  }

  static drawPlaqueShell(
    graphics: Phaser.GameObjects.Graphics,
    panel: Phaser.Geom.Rectangle,
    {
      accentColor,
      alpha = 1,
      headerHeight = UI_PLAQUE_HEADER_HEIGHT,
      radius = UI_PLAQUE_RADIUS,
      headerAlpha = 0.54,
      sideRuleAlpha = 0.24,
      shineAlpha = 0.08,
      dividerAlpha = 0.24
    }: UiPlaqueShellOptions
  ): void {
    graphics.fillStyle(UI_COLOR_PANEL_SHADOW, 0.32 * alpha);
    graphics.fillRoundedRect(panel.x + 4, panel.y + 6, panel.width, panel.height, radius);
    graphics.fillStyle(UI_COLOR_PANEL_SURFACE, 0.96 * alpha);
    graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    graphics.fillStyle(UI_COLOR_PANEL_SURFACE_ALT, 0.96 * alpha);
    graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    graphics.fillStyle(accentColor, headerAlpha * alpha);
    graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, Math.min(headerHeight, panel.height - 4), Math.max(8, radius - 2));
    graphics.fillStyle(accentColor, sideRuleAlpha * alpha);
    graphics.fillRoundedRect(panel.x + 6, panel.y + 10, 8, panel.height - 20, 4);
    graphics.fillStyle(UI_COLOR_PANEL_SHINE, shineAlpha * alpha);
    graphics.fillRoundedRect(panel.x + 18, panel.y + 9, panel.width - 36, 6, 3);
    graphics.lineStyle(2, UI_COLOR_PANEL_BORDER, 0.42 * alpha);
    graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    graphics.lineStyle(1, accentColor, 0.34 * alpha);
    graphics.strokeRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    graphics.lineStyle(1, accentColor, dividerAlpha * alpha);
    graphics.lineBetween(panel.x + 18, panel.y + headerHeight, panel.right - 18, panel.y + headerHeight);
  }

  static drawInsetBox(
    graphics: Phaser.GameObjects.Graphics,
    bounds: Phaser.Geom.Rectangle,
    {
      fillColor = UI_COLOR_PANEL_SURFACE_ALT,
      fillAlpha = 0.86,
      strokeColor = UI_COLOR_PANEL_BORDER,
      strokeAlpha = 0.2,
      radius = UI_INSET_RADIUS
    }: UiInsetBoxOptions = {}
  ): void {
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    graphics.lineStyle(1, strokeColor, strokeAlpha);
    graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
  }

  static drawPill(
    graphics: Phaser.GameObjects.Graphics,
    bounds: Phaser.Geom.Rectangle,
    {
      fillColor,
      strokeColor,
      fillAlpha = 0.92,
      strokeAlpha = 0.4,
      radius = 12
    }: UiPillOptions
  ): void {
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    graphics.lineStyle(1, strokeColor, strokeAlpha);
    graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
  }

  static drawPanelShell(
    graphics: Phaser.GameObjects.Graphics,
    panel: Phaser.Geom.Rectangle,
    alpha = 1,
    headerHeight = 34,
    radius = 20,
    accentColor = UI_COLOR_ACCENT_WARM
  ): void {
    BattleUiChrome.drawPlaqueShell(graphics, panel, {
      accentColor,
      alpha,
      headerHeight,
      radius,
      headerAlpha: 0.54,
      sideRuleAlpha: 0.24,
      dividerAlpha: 0.24
    });
  }
}
