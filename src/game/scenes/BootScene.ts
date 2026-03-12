import Phaser from 'phaser';
import { AUDIO_ASSETS, IMAGE_ASSETS } from '../assets';
import { COMBAT_FX_TEXTURE_KEYS } from '../core/combatEffects';

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
    this.scene.start('title');
  }

  private createSharedTextures(): void {
    this.generateSharedTexture('spark', 4, 4, (graphics) => {
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 4, 4);
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.arc, 256, 256, (graphics) => {
      graphics.lineStyle(24, 0xffffff, 1);
      graphics.beginPath();
      graphics.arc(128, 150, 78, Phaser.Math.DegToRad(208), Phaser.Math.DegToRad(342), false);
      graphics.strokePath();
      graphics.lineStyle(10, 0xffffff, 0.9);
      graphics.beginPath();
      graphics.arc(128, 152, 58, Phaser.Math.DegToRad(214), Phaser.Math.DegToRad(332), false);
      graphics.strokePath();
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.lance, 256, 128, (graphics) => {
      graphics.fillStyle(0xffffff, 1);
      graphics.fillTriangle(228, 64, 88, 18, 88, 110);
      graphics.fillRoundedRect(24, 40, 88, 48, 18);
      graphics.fillRoundedRect(96, 48, 72, 32, 14);
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.feather, 256, 128, (graphics) => {
      graphics.fillStyle(0xffffff, 1);
      graphics.fillPoints([
        new Phaser.Geom.Point(228, 64),
        new Phaser.Geom.Point(150, 28),
        new Phaser.Geom.Point(126, 40),
        new Phaser.Geom.Point(86, 30),
        new Phaser.Geom.Point(52, 46),
        new Phaser.Geom.Point(20, 42),
        new Phaser.Geom.Point(84, 64),
        new Phaser.Geom.Point(20, 86),
        new Phaser.Geom.Point(52, 82),
        new Phaser.Geom.Point(86, 98),
        new Phaser.Geom.Point(126, 88),
        new Phaser.Geom.Point(150, 100)
      ], true);
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.burst, 220, 220, (graphics) => {
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(110, 110, 28);
      graphics.lineStyle(18, 0xffffff, 1);
      for (let index = 0; index < 8; index += 1) {
        const angle = (Math.PI * 2 * index) / 8;
        const inner = 48;
        const outer = index % 2 === 0 ? 92 : 76;
        graphics.beginPath();
        graphics.moveTo(110 + Math.cos(angle) * inner, 110 + Math.sin(angle) * inner);
        graphics.lineTo(110 + Math.cos(angle) * outer, 110 + Math.sin(angle) * outer);
        graphics.strokePath();
      }
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.bloom, 220, 220, (graphics) => {
      graphics.lineStyle(20, 0xffffff, 1);
      graphics.beginPath();
      graphics.moveTo(110, 24);
      graphics.lineTo(110, 196);
      graphics.strokePath();
      graphics.beginPath();
      graphics.moveTo(24, 110);
      graphics.lineTo(196, 110);
      graphics.strokePath();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(110, 110, 22);
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.sigil, 240, 240, (graphics) => {
      graphics.lineStyle(8, 0xffffff, 1);
      graphics.strokeCircle(120, 120, 76);
      graphics.lineStyle(4, 0xffffff, 0.92);
      graphics.strokeCircle(120, 120, 50);
      graphics.strokePoints([
        new Phaser.Geom.Point(120, 28),
        new Phaser.Geom.Point(196, 120),
        new Phaser.Geom.Point(120, 212),
        new Phaser.Geom.Point(44, 120)
      ], true, true);
      graphics.beginPath();
      graphics.moveTo(58, 120);
      graphics.lineTo(182, 120);
      graphics.moveTo(120, 58);
      graphics.lineTo(120, 182);
      graphics.strokePath();
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.wave, 240, 160, (graphics) => {
      graphics.lineStyle(14, 0xffffff, 1);
      graphics.strokeEllipse(120, 92, 176, 56);
      graphics.lineStyle(10, 0xffffff, 0.82);
      graphics.strokeEllipse(120, 92, 136, 42);
      graphics.lineStyle(8, 0xffffff, 0.64);
      graphics.strokeEllipse(120, 92, 96, 28);
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.orb, 96, 96, (graphics) => {
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(48, 48, 24);
      graphics.lineStyle(6, 0xffffff, 0.82);
      graphics.strokeCircle(48, 48, 34);
    });

    this.generateSharedTexture(COMBAT_FX_TEXTURE_KEYS.ring, 128, 128, (graphics) => {
      graphics.lineStyle(10, 0xffffff, 1);
      graphics.strokeCircle(64, 64, 42);
    });
  }

  private generateSharedTexture(
    key: string,
    width: number,
    height: number,
    draw: (graphics: Phaser.GameObjects.Graphics) => void
  ): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics().setVisible(false);
    draw(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
