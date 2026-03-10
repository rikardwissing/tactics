import Phaser from 'phaser';
import { UI_PANEL_GAP, UI_SCREEN_MARGIN } from './UiMetrics';

export type UiGrid = {
  width: number;
  height: number;
  columns: number;
  margin: number;
  gutter: number;
  columnWidth: number;
  content: Phaser.Geom.Rectangle;
  column: (start: number, span: number, y: number, height: number) => Phaser.Geom.Rectangle;
  band: (y: number, height: number) => Phaser.Geom.Rectangle;
};

function buildGrid(content: Phaser.Geom.Rectangle, columns: number, margin: number, gutter: number): UiGrid {
  const columnWidth =
    columns > 0
      ? Math.max(0, (content.width - gutter * Math.max(0, columns - 1)) / columns)
      : 0;

  return {
    width: content.width,
    height: content.height,
    columns,
    margin,
    gutter,
    columnWidth,
    content,
    column(start: number, span: number, y: number, rectHeight: number): Phaser.Geom.Rectangle {
      const x = content.x + start * (columnWidth + gutter);
      const rectWidth = columnWidth * span + gutter * Math.max(0, span - 1);
      return new Phaser.Geom.Rectangle(Math.round(x), Math.round(y), Math.round(rectWidth), Math.round(rectHeight));
    },
    band(y: number, rectHeight: number): Phaser.Geom.Rectangle {
      return new Phaser.Geom.Rectangle(Math.round(content.x), Math.round(y), Math.round(content.width), Math.round(rectHeight));
    }
  };
}

export function createUiGrid(width: number, height: number, columns?: number): UiGrid {
  const resolvedColumns = columns ?? (height > width ? 4 : 12);
  const margin = UI_SCREEN_MARGIN;
  const gutter = UI_PANEL_GAP;
  return buildGrid(
    new Phaser.Geom.Rectangle(
      margin,
      margin,
      Math.max(0, width - margin * 2),
      Math.max(0, height - margin * 2)
    ),
    resolvedColumns,
    margin,
    gutter
  );
}

export function createUiSubGrid(
  bounds: Phaser.Geom.Rectangle,
  columns = 1,
  insetX = 0,
  insetY = insetX,
  gutter = UI_PANEL_GAP
): UiGrid {
  return buildGrid(
    new Phaser.Geom.Rectangle(
      bounds.x + insetX,
      bounds.y + insetY,
      Math.max(0, bounds.width - insetX * 2),
      Math.max(0, bounds.height - insetY * 2)
    ),
    columns,
    0,
    gutter
  );
}
