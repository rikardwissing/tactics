import Phaser from 'phaser';

export class GraphicsPool {
  private readonly graphicsPool: Phaser.GameObjects.Graphics[] = [];
  private activeCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registerWorldObject: <T extends Phaser.GameObjects.GameObject>(object: T) => T
  ) {}

  beginFrame(): void {
    this.activeCount = 0;

    for (const graphics of this.graphicsPool) {
      graphics
        .clear()
        .setVisible(false)
        .setAlpha(1)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setScale(1, 1);
    }
  }

  acquire(blendMode: Phaser.BlendModes | number = Phaser.BlendModes.NORMAL): Phaser.GameObjects.Graphics {
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

  getManagedObjects(): readonly Phaser.GameObjects.Graphics[] {
    return this.graphicsPool;
  }
}
