import Phaser from 'phaser';
import { createUiGrid, type UiGrid } from '../scenes/components/UiGrid';
import {
  UI_PANEL_COMPACT_GAP,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_GAP,
  UI_PANEL_MINI_GAP,
  UI_PANEL_MICRO_GAP,
  UI_SCREEN_MARGIN
} from '../scenes/components/UiMetrics';
import {
  DETAIL_PANEL_FIXED_WIDTH,
  DETAIL_PANEL_MIN_WIDTH,
  MAP_PLAQUE_FIXED_WIDTH
} from './hudShared';

export const SHARED_BATTLE_VISIBLE_TURN_ORDER_COUNT = 6;
export const SHARED_BATTLE_ACTION_MENU_ROW_HEIGHT = 28;
export const SHARED_BATTLE_AVATAR_SIZE = 38;
export const SHARED_BATTLE_TURN_ORDER_GAP = SHARED_BATTLE_AVATAR_SIZE + 12;
export const SHARED_BATTLE_ACTION_MENU_ROOT_WIDTH = 172;
export const SHARED_BATTLE_ACTION_MENU_PANEL_HEIGHT = 188;

export interface SharedBattleTopPanelLayout {
  grid: UiGrid;
  detailPanelWidth: number;
  stackedTopPanels: boolean;
  headerWidth: number;
}

export interface SharedBattleChromeLayout {
  headerRect: Phaser.Geom.Rectangle;
  detailRect: Phaser.Geom.Rectangle;
  playAreaRect: Phaser.Geom.Rectangle;
  turnOrderBounds: Phaser.Geom.Rectangle;
  turnOrderLayout: {
    x: number;
    startY: number;
    gap: number;
    avatarSize: number;
    reverse: boolean;
  };
  actionMenuLayout: {
    rootX: number;
    bottom: number;
    rootWidth: number;
    panelHeight: number;
    overlap: number;
    panelWidths: {
      list: number;
      detail: number;
    };
  };
}

export interface SharedBattleResultOverlayLayout {
  panelBounds: Phaser.Geom.Rectangle;
  artBounds: Phaser.Geom.Rectangle;
  copyX: number;
  copyTop: number;
  bodyY: number;
  buttonX: number;
  buttonAreaY: number;
  buttonWidth: number;
  buttonHeight: number;
  buttonGap: number;
  copyWidth: number;
  portraitLayout: boolean;
}

export function resolveSharedBattleDetailPanelWidth(viewportWidth: number): number {
  const maxWidth = Math.max(DETAIL_PANEL_MIN_WIDTH, viewportWidth - UI_SCREEN_MARGIN * 2);
  return Math.round(Phaser.Math.Clamp(DETAIL_PANEL_FIXED_WIDTH, DETAIL_PANEL_MIN_WIDTH, maxWidth));
}

export function shouldStackSharedBattleTopPanels(
  viewportWidth: number,
  viewportHeight: number,
  detailPanelWidth: number
): boolean {
  const grid = createUiGrid(viewportWidth, viewportHeight);
  if (grid.columns < 12) {
    return true;
  }

  return MAP_PLAQUE_FIXED_WIDTH + detailPanelWidth + UI_PANEL_GAP > grid.content.width;
}

export function resolveSharedBattleTopPanelLayout(
  viewportWidth: number,
  viewportHeight: number
): SharedBattleTopPanelLayout {
  const grid = createUiGrid(viewportWidth, viewportHeight);
  const detailPanelWidth = resolveSharedBattleDetailPanelWidth(viewportWidth);
  const stackedTopPanels = shouldStackSharedBattleTopPanels(viewportWidth, viewportHeight, detailPanelWidth);
  const headerWidth = stackedTopPanels ? grid.content.width : MAP_PLAQUE_FIXED_WIDTH;

  return {
    grid,
    detailPanelWidth,
    stackedTopPanels,
    headerWidth
  };
}

export function getSharedBattleMapPlaqueRequiredHeight(
  panelWidth: number,
  mapPlaqueMetaText: Phaser.GameObjects.Text,
  mapObjectiveText: Phaser.GameObjects.Text
): number {
  mapPlaqueMetaText.setWordWrapWidth(Math.max(80, panelWidth - 28), true);
  mapObjectiveText.setWordWrapWidth(Math.max(100, panelWidth - 28), true);

  const headerHeight = 32;
  const mainBlockHeight =
    mapPlaqueMetaText.height +
    UI_PANEL_MINI_GAP +
    mapObjectiveText.height;
  const bottomPadding = UI_PANEL_COMPACT_INSET;

  return Math.ceil(headerHeight + UI_PANEL_COMPACT_GAP + mainBlockHeight + bottomPadding);
}

export function getSharedBattleMapPlaqueHeight(
  panelWidth: number,
  mapPlaqueMetaText: Phaser.GameObjects.Text,
  mapObjectiveText: Phaser.GameObjects.Text,
  minHeight = 96
): number {
  return Math.max(
    minHeight,
    getSharedBattleMapPlaqueRequiredHeight(panelWidth, mapPlaqueMetaText, mapObjectiveText)
  );
}

export function resolveSharedBattleChromeLayout(
  viewportWidth: number,
  viewportHeight: number,
  topPanelLayout: SharedBattleTopPanelLayout,
  plaqueHeight: number,
  detailHeight: number,
  visibleTurnOrderCount = SHARED_BATTLE_VISIBLE_TURN_ORDER_COUNT
): SharedBattleChromeLayout {
  const { grid, detailPanelWidth, stackedTopPanels, headerWidth } = topPanelLayout;
  const margin = grid.margin;
  const headerRect = new Phaser.Geom.Rectangle(
    grid.content.x,
    margin,
    headerWidth,
    plaqueHeight
  );
  const detailRect = new Phaser.Geom.Rectangle(
    viewportWidth - margin - detailPanelWidth,
    stackedTopPanels ? headerRect.bottom + UI_PANEL_GAP : margin,
    detailPanelWidth,
    detailHeight
  );
  const topContentBottom = stackedTopPanels
    ? detailRect.bottom
    : Math.max(headerRect.bottom, detailRect.bottom);
  const playAreaRect = new Phaser.Geom.Rectangle(
    grid.content.x,
    topContentBottom + UI_PANEL_GAP,
    grid.content.width,
    Math.max(48, grid.content.bottom - (topContentBottom + UI_PANEL_GAP))
  );

  const turnOrderHeight =
    SHARED_BATTLE_AVATAR_SIZE +
    Math.max(0, visibleTurnOrderCount - 1) * SHARED_BATTLE_TURN_ORDER_GAP;
  const turnOrderColumn = grid.column(0, 1, grid.content.y, turnOrderHeight + UI_PANEL_GAP);
  const turnOrderBand = grid.band(
    Math.max(grid.content.y, grid.content.bottom - turnOrderHeight - UI_PANEL_COMPACT_GAP),
    turnOrderHeight + UI_PANEL_GAP
  );
  const turnOrderBounds = new Phaser.Geom.Rectangle(
    turnOrderColumn.x,
    turnOrderBand.y,
    turnOrderColumn.width,
    turnOrderBand.height
  );
  const actionMenuRootX = Math.min(
    grid.content.right - SHARED_BATTLE_ACTION_MENU_ROOT_WIDTH,
    turnOrderBounds.x + SHARED_BATTLE_AVATAR_SIZE + UI_PANEL_GAP
  );
  const actionMenuBottom = Math.max(
    grid.content.bottom,
    headerRect.bottom + SHARED_BATTLE_ACTION_MENU_PANEL_HEIGHT + UI_PANEL_GAP
  );

  return {
    headerRect,
    detailRect,
    playAreaRect,
    turnOrderBounds,
    turnOrderLayout: {
      x: turnOrderBounds.x,
      startY: turnOrderBounds.y + UI_PANEL_MICRO_GAP,
      gap: SHARED_BATTLE_TURN_ORDER_GAP,
      avatarSize: SHARED_BATTLE_AVATAR_SIZE,
      reverse: true
    },
    actionMenuLayout: {
      rootX: actionMenuRootX,
      bottom: actionMenuBottom,
      rootWidth: SHARED_BATTLE_ACTION_MENU_ROOT_WIDTH,
      panelHeight: SHARED_BATTLE_ACTION_MENU_PANEL_HEIGHT,
      overlap: Math.round(SHARED_BATTLE_ACTION_MENU_ROOT_WIDTH * 0.7),
      panelWidths: {
        list: SHARED_BATTLE_ACTION_MENU_ROOT_WIDTH,
        detail: SHARED_BATTLE_ACTION_MENU_ROOT_WIDTH
      }
    }
  };
}

export function resolveSharedBattleResultOverlayLayout(
  viewportWidth: number,
  viewportHeight: number
): SharedBattleResultOverlayLayout {
  const grid = createUiGrid(viewportWidth, viewportHeight, viewportWidth >= viewportHeight ? 12 : 4);
  const portraitLayout = viewportHeight > viewportWidth;
  const panelWidth = portraitLayout
    ? Math.min(grid.content.width, 430)
    : Math.min(grid.content.width, 920);
  const panelHeight = portraitLayout
    ? Math.min(grid.content.height, 610)
    : Math.min(grid.content.height, 430);
  const panelX = Math.round(grid.content.centerX - panelWidth / 2);
  const panelY = Math.round(grid.content.centerY - panelHeight / 2);
  const panelBounds = new Phaser.Geom.Rectangle(panelX, panelY, Math.round(panelWidth), Math.round(panelHeight));
  const contentInsetX = 22;
  const contentInsetY = 18;
  const contentX = panelBounds.x + contentInsetX;
  const contentY = panelBounds.y + contentInsetY;
  const contentWidth = panelBounds.width - contentInsetX * 2;
  const buttonAreaY = portraitLayout ? panelBounds.bottom - 166 : panelBounds.bottom - 98;
  const artTop = contentY + 72;
  const artHeight = portraitLayout ? 170 : Math.max(148, buttonAreaY - artTop - 14);
  const artWidth = portraitLayout ? contentWidth : Math.round(Math.min(330, panelBounds.width * 0.38));
  const artBounds = new Phaser.Geom.Rectangle(contentX, artTop, Math.round(artWidth), Math.round(artHeight));
  const copyX = portraitLayout ? panelBounds.centerX : artBounds.right + 22;
  const copyWidth = portraitLayout ? contentWidth : Math.max(180, panelBounds.right - 22 - copyX);
  const copyTop = portraitLayout ? artBounds.bottom + 18 : artBounds.y + 8;
  const bodyY = copyTop + 78;
  const buttonHeight = portraitLayout ? 60 : 74;
  const buttonGap = 14;
  const buttonWidth = portraitLayout ? contentWidth : Math.floor((copyWidth - buttonGap) / 2);
  const buttonX = portraitLayout ? contentX : copyX;

  return {
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
  };
}
