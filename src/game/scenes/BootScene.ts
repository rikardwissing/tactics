import Phaser from 'phaser';
import { AUDIO_ASSETS, IMAGE_ASSETS } from '../assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    for (const asset of IMAGE_ASSETS) {
      this.load.image(asset.key, asset.url);
    }

    for (const asset of AUDIO_ASSETS) {
      this.load.audio(asset.key, asset.url);
    }
  }

  create(): void {
    this.createSharedTextures();
    this.scene.start('setup');
  }

  private createSharedTextures(): void {
    const spark = this.add.graphics();
    spark.fillStyle(0xffffff, 1);
    spark.fillRect(0, 0, 4, 4);
    spark.generateTexture('spark', 4, 4);
    spark.destroy();
  }
}
