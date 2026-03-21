import Phaser from 'phaser';
import { GraphicsPool } from '../core/graphicsPool';
import type { TileData } from '../core/types';
import { drawActiveTileMarker } from '../world/rendering';

interface DrawActiveTileArgs {
  tile: TileData;
  tilePoints: Phaser.Math.Vector2[];
  center: Phaser.Math.Vector2;
  depth: number;
}

export class BattleHighlightController {
  private readonly graphicsPool: GraphicsPool;
  private drawCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registerWorldObject: <T extends Phaser.GameObjects.GameObject>(object: T) => T
  ) {
    this.graphicsPool = new GraphicsPool(scene, registerWorldObject);
  }

  beginFrame(): void {
    this.drawCount += 1;
    this.graphicsPool.beginFrame();
  }

  acquireGraphics(blendMode: Phaser.BlendModes | number = Phaser.BlendModes.NORMAL): Phaser.GameObjects.Graphics {
    return this.graphicsPool.acquire(blendMode);
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
    this.graphicsPool.destroy();
  }

  getPoolSize(): number {
    return this.graphicsPool.getPoolSize();
  }

  getDrawCount(): number {
    return this.drawCount;
  }

  getManagedObjects(): readonly Phaser.GameObjects.Graphics[] {
    return this.graphicsPool.getManagedObjects();
  }
}
