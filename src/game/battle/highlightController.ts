import Phaser from 'phaser';
import type { TileData } from '../core/types';
import { drawActiveTileMarker } from '../world/rendering';

interface DrawActiveTileArgs {
  tile: TileData;
  tilePoints: Phaser.Math.Vector2[];
  center: Phaser.Math.Vector2;
  depth: number;
}

export class BattleHighlightController {
  private readonly graphicsPool: Phaser.GameObjects.Graphics[] = [];
  private activeCount = 0;
  private drawCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registerWorldObject: <T extends Phaser.GameObjects.GameObject>(object: T) => T
  ) {}

  beginFrame(): void {
    this.activeCount = 0;
    this.drawCount += 1;

    for (const graphics of this.graphicsPool) {
      graphics
        .clear()
        .setVisible(false)
        .setAlpha(1)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setScale(1, 1);
    }
  }

  acquireGraphics(blendMode: Phaser.BlendModes | number = Phaser.BlendModes.NORMAL): Phaser.GameObjects.Graphics {
    const graphics =
      this.graphicsPool[this.activeCount] ??
      this.registerWorldObject(this.scene.add.graphics());

    if (this.activeCount >= this.graphicsPool.length) {
      this.graphicsPool.push(graphics);
    }

    this.activeCount += 1;
    graphics.clear().setVisible(true).setAlpha(1).setBlendMode(blendMode).setScale(1, 1);
    return graphics;
  }

  drawDiamond(
    tilePoints: Phaser.Math.Vector2[],
    depth: number,
    fill: number,
    fillAlpha: number,
    lineWidth: number,
    stroke: number,
    strokeAlpha: number
  ): void {
    const overlay = this.acquireGraphics();
    overlay.fillStyle(fill, fillAlpha);
    overlay.fillPoints(tilePoints, true);
    overlay.lineStyle(lineWidth, stroke, strokeAlpha);
    overlay.strokePoints(tilePoints, true, true);
    overlay.setDepth(depth);
  }

  drawActiveTileMarker({ tilePoints, center, depth }: DrawActiveTileArgs): void {
    drawActiveTileMarker({
      createGraphics: () => this.acquireGraphics(),
      tilePoints,
      center,
      depth
    });
  }

  clear(): void {
    this.beginFrame();
  }

  destroy(): void {
    for (const graphics of this.graphicsPool) {
      graphics.destroy();
    }

    this.graphicsPool.length = 0;
    this.activeCount = 0;
  }

  getPoolSize(): number {
    return this.graphicsPool.length;
  }

  getDrawCount(): number {
    return this.drawCount;
  }

  getManagedObjects(): readonly Phaser.GameObjects.Graphics[] {
    return this.graphicsPool;
  }
}
