import Phaser from 'phaser';
import { audioDirector } from '../audio/audioDirector';
import { DEFAULT_EXPLORATION_LOCATION_ID } from '../exploration';
import type { BoardSceneStartData } from '../sceneSession';

const SOFT_LIGHT_TEXTURE_KEY = 'title-soft-light';
const TITLE_LOGO_MAX_WIDTH = 620;
const TITLE_LOGO_MAX_HEIGHT = 220;

export class TitleScene extends Phaser.Scene {
  private transitionStarted = false;
  private promptPulseTween: Phaser.Tweens.Tween | null = null;

  private backdrop!: Phaser.GameObjects.Image;
  private topGlow!: Phaser.GameObjects.Image;
  private sigilGlow!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private sigil!: Phaser.GameObjects.Graphics;
  private frameLines!: Phaser.GameObjects.Graphics;
  private logo!: Phaser.GameObjects.Image;
  private subtitleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private explorePromptText!: Phaser.GameObjects.Text;
  private editorPromptText!: Phaser.GameObjects.Text;
  private embers!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('title');
  }

  create(): void {
    this.transitionStarted = false;
    this.input.enabled = true;
    this.promptPulseTween = null;

    audioDirector.bindScene(this);
    audioDirector.setMusic('title');
    void audioDirector.unlock().catch(() => undefined);

    this.createSoftLightTexture();

    this.backdrop = this.add.image(0, 0, 'renations-global-backdrop').setOrigin(0.5);
    this.topGlow = this.add.image(0, 0, SOFT_LIGHT_TEXTURE_KEY).setBlendMode(Phaser.BlendModes.SCREEN);
    this.sigilGlow = this.add.image(0, 0, SOFT_LIGHT_TEXTURE_KEY).setBlendMode(Phaser.BlendModes.SCREEN);
    this.shade = this.add.rectangle(0, 0, 0, 0, 0x060306, 0.42).setOrigin(0);
    this.sigil = this.add.graphics();
    this.frameLines = this.add.graphics();
    this.logo = this.add.image(0, 0, 'renations-tactics-logo').setOrigin(0.5);
    this.subtitleText = this.add
      .text(0, 0, 'AFTERFALL', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#f0dfbf',
        letterSpacing: 6,
        shadow: {
          color: '#12080d',
          blur: 4,
          fill: true,
          stroke: false,
          offsetX: 0,
          offsetY: 1
        }
      })
      .setOrigin(0.5);
    this.promptText = this.add
      .text(0, 0, 'START GAME', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#f7edd9',
        letterSpacing: 5
      })
      .setOrigin(0.5);
    this.explorePromptText = this.add
      .text(0, 0, 'EXPLORE CAMP', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#e9d2a2',
        letterSpacing: 4
      })
      .setOrigin(0.5);
    this.editorPromptText = this.add
      .text(0, 0, 'UNIT EDITOR', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#dfc79b',
        letterSpacing: 4
      })
      .setOrigin(0.5);

    this.embers = this.add.particles(0, 0, 'spark', {
      x: { min: 110, max: 1170 },
      y: { min: 76, max: 676 },
      lifespan: 4600,
      frequency: 240,
      quantity: 1,
      speedY: { min: -16, max: -7 },
      speedX: { min: -4, max: 4 },
      angle: { min: 248, max: 292 },
      alpha: { start: 0.18, end: 0 },
      scale: { start: 0.72, end: 0.06 },
      tint: [0xf7edd9, 0xe3c183, 0xc8895d]
    });

    this.backdrop.setDepth(0);
    this.topGlow.setDepth(1);
    this.sigilGlow.setDepth(2);
    this.shade.setDepth(3);
    this.sigil.setDepth(4);
    this.frameLines.setDepth(5);
    this.logo.setDepth(6);
    this.subtitleText.setDepth(7);
    this.promptText.setDepth(8);
    this.explorePromptText.setDepth(8);
    this.editorPromptText.setDepth(8);
    this.embers.setDepth(9);

    this.input.keyboard?.on('keydown-ENTER', this.beginSetup, this);
    this.input.keyboard?.on('keydown-SPACE', this.beginSetup, this);
    this.input.keyboard?.on('keydown-Z', this.beginSetup, this);
    this.input.keyboard?.on('keydown-X', this.beginExploration, this);
    this.input.keyboard?.on('keydown-U', this.beginUnitEditor, this);
    this.promptText.setInteractive({ useHandCursor: true }).on('pointerdown', this.beginSetup, this);
    this.explorePromptText.setInteractive({ useHandCursor: true }).on('pointerdown', this.beginExploration, this);
    this.editorPromptText.setInteractive({ useHandCursor: true }).on('pointerdown', this.beginUnitEditor, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ENTER', this.beginSetup, this);
      this.input.keyboard?.off('keydown-SPACE', this.beginSetup, this);
      this.input.keyboard?.off('keydown-Z', this.beginSetup, this);
      this.input.keyboard?.off('keydown-X', this.beginExploration, this);
      this.input.keyboard?.off('keydown-U', this.beginUnitEditor, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.promptPulseTween?.stop();
      this.promptPulseTween = null;
    });

    this.layoutScene();
    this.prepareIntroState();
    this.playIntroSequence();
  }

  private beginSetup(): void {
    this.beginScene('setup');
  }

  private beginExploration(): void {
    this.beginScene('battle', {
      mode: 'exploration',
      locationId: DEFAULT_EXPLORATION_LOCATION_ID
    });
  }

  private beginUnitEditor(): void {
    this.beginScene('unit-editor');
  }

  private beginScene(sceneKey: 'setup' | 'unit-editor' | 'battle', sceneData?: BoardSceneStartData): void {
    if (this.transitionStarted) {
      return;
    }

    this.transitionStarted = true;
    audioDirector.playUiConfirm();
    this.input.enabled = false;

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(sceneKey, sceneData);
    });
    this.cameras.main.fadeOut(700, 12, 6, 10);
  }

  private handleResize(): void {
    this.layoutScene();
  }

  private prepareIntroState(): void {
    this.backdrop.setAlpha(0);
    this.shade.setAlpha(0);
    this.topGlow.setAlpha(0);
    this.sigilGlow.setAlpha(0);
    this.sigil.setAlpha(0);
    this.frameLines.setAlpha(0);
    this.logo.setAlpha(0);
    this.logo.y += 26;
    this.subtitleText.setAlpha(0);
    this.subtitleText.y += 18;
    this.promptText.setAlpha(0);
    this.promptText.y += 12;
    this.explorePromptText.setAlpha(0);
    this.explorePromptText.y += 12;
    this.editorPromptText.setAlpha(0);
    this.editorPromptText.y += 12;
    this.embers.stop();
  }

  private playIntroSequence(): void {
    this.cameras.main.fadeIn(900, 4, 2, 6);

    this.tweens.add({
      targets: this.backdrop,
      alpha: 1,
      duration: 1200,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: this.shade,
      alpha: 0.42,
      duration: 1100,
      delay: 120,
      ease: 'Sine.Out'
    });

    this.tweens.add({
      targets: [this.topGlow, this.sigilGlow],
      alpha: 0.48,
      duration: 1400,
      delay: 360,
      ease: 'Sine.Out',
      onComplete: () => {
        this.startAmbientGlowTween();
      }
    });

    this.tweens.add({
      targets: [this.sigil, this.frameLines],
      alpha: 1,
      duration: 900,
      delay: 700,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: this.logo,
      alpha: 1,
      y: '-=26',
      duration: 1000,
      delay: 980,
      ease: 'Cubic.Out'
    });

    this.tweens.add({
      targets: this.subtitleText,
      alpha: 1,
      y: '-=18',
      duration: 900,
      delay: 1260,
      ease: 'Cubic.Out'
    });

    this.tweens.add({
      targets: this.promptText,
      alpha: 1,
      y: '-=12',
      duration: 720,
      delay: 1780,
      ease: 'Quad.Out',
      onStart: () => {
        this.embers.start();
      },
      onComplete: () => {
        this.startPromptPulse();
        this.startBackdropDrift();
      }
    });

    this.tweens.add({
      targets: this.explorePromptText,
      alpha: 1,
      y: '-=12',
      duration: 720,
      delay: 1910,
      ease: 'Quad.Out'
    });

    this.tweens.add({
      targets: this.editorPromptText,
      alpha: 1,
      y: '-=12',
      duration: 720,
      delay: 2040,
      ease: 'Quad.Out'
    });
  }

  private startBackdropDrift(): void {
    this.tweens.add({
      targets: this.backdrop,
      scaleX: 1.015,
      scaleY: 1.015,
      duration: 22000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private startAmbientGlowTween(): void {
    this.tweens.add({
      targets: [this.topGlow, this.sigilGlow],
      alpha: { from: 0.42, to: 0.62 },
      duration: 3600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private startPromptPulse(): void {
    this.promptPulseTween?.stop();
    this.promptPulseTween = this.tweens.add({
      targets: [this.promptText, this.explorePromptText, this.editorPromptText],
      alpha: { from: 0.42, to: 1 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }

  private layoutScene(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const logoWidth = Phaser.Math.Clamp(width * 0.46, 320, TITLE_LOGO_MAX_WIDTH);
    const centerX = width * 0.5;
    const sigilY = height * 0.34;
    const logoY = height * 0.33;
    const sigilRadius = Phaser.Math.Clamp(Math.min(width, height) * 0.18, 110, 170);

    this.shade.setSize(width, height);
    this.shade.setPosition(0, 0);

    this.fitBackdrop(this.backdrop, width, height, 1.08);

    this.topGlow.setPosition(centerX, height * 0.17);
    this.topGlow.setDisplaySize(width * 0.92, Math.max(220, height * 0.36));
    this.topGlow.setTint(0xc48a57);

    this.sigilGlow.setPosition(centerX, sigilY);
    this.sigilGlow.setDisplaySize(sigilRadius * 3.2, sigilRadius * 3.2);
    this.sigilGlow.setTint(0xf1d39a);

    this.logo.setPosition(centerX, logoY);
    this.logo.displayWidth = logoWidth;
    this.logo.scaleY = this.logo.scaleX;
    if (this.logo.displayHeight > TITLE_LOGO_MAX_HEIGHT) {
      this.logo.displayHeight = TITLE_LOGO_MAX_HEIGHT;
      this.logo.scaleX = this.logo.scaleY;
    }

    this.subtitleText.setPosition(centerX, logoY + this.logo.displayHeight * 0.42 + 34);
    this.subtitleText.setFontSize(`${Phaser.Math.Clamp(Math.round(width * 0.016), 14, 20)}px`);

    this.promptText.setPosition(centerX, height * 0.74);
    this.promptText.setFontSize(`${Phaser.Math.Clamp(Math.round(width * 0.019), 18, 26)}px`);
    this.explorePromptText.setPosition(centerX, height * 0.79);
    this.explorePromptText.setFontSize(`${Phaser.Math.Clamp(Math.round(width * 0.017), 17, 24)}px`);
    this.editorPromptText.setPosition(centerX, height * 0.84);
    this.editorPromptText.setFontSize(`${Phaser.Math.Clamp(Math.round(width * 0.016), 16, 22)}px`);

    const emitBounds = new Phaser.Geom.Rectangle(width * 0.08, height * 0.16, width * 0.84, height * 0.52);
    this.embers.setPosition(0, 0);
    this.embers.setEmitZone(
      new Phaser.GameObjects.Particles.Zones.RandomZone({
        getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
          point.x = Phaser.Math.FloatBetween(emitBounds.left, emitBounds.right);
          point.y = Phaser.Math.FloatBetween(emitBounds.top, emitBounds.bottom);
        }
      })
    );

    this.drawSigil(centerX, sigilY, sigilRadius);
    this.drawFrame(width, height);
  }

  private drawSigil(centerX: number, centerY: number, radius: number): void {
    this.sigil.clear();

    this.sigil.lineStyle(2, 0xd7b784, 0.18);
    this.sigil.strokeCircle(centerX, centerY, radius);
    this.sigil.strokeCircle(centerX, centerY, radius * 0.74);

    this.sigil.lineStyle(1, 0xf3e0b7, 0.14);
    this.sigil.beginPath();
    this.sigil.moveTo(centerX, centerY - radius * 1.08);
    this.sigil.lineTo(centerX, centerY + radius * 1.08);
    this.sigil.moveTo(centerX - radius * 1.08, centerY);
    this.sigil.lineTo(centerX + radius * 1.08, centerY);
    this.sigil.moveTo(centerX - radius * 0.78, centerY - radius * 0.78);
    this.sigil.lineTo(centerX + radius * 0.78, centerY + radius * 0.78);
    this.sigil.moveTo(centerX + radius * 0.78, centerY - radius * 0.78);
    this.sigil.lineTo(centerX - radius * 0.78, centerY + radius * 0.78);
    this.sigil.strokePath();

    this.sigil.lineStyle(3, 0xf0d39b, 0.24);
    this.sigil.beginPath();
    this.sigil.moveTo(centerX, centerY - radius * 1.24);
    this.sigil.lineTo(centerX + radius * 0.19, centerY - radius * 0.12);
    this.sigil.lineTo(centerX, centerY + radius * 1.34);
    this.sigil.lineTo(centerX - radius * 0.19, centerY - radius * 0.12);
    this.sigil.closePath();
    this.sigil.strokePath();

    this.sigil.fillStyle(0xf0d39b, 0.1);
    this.sigil.fillTriangle(
      centerX,
      centerY - radius * 1.16,
      centerX + radius * 0.16,
      centerY - radius * 0.18,
      centerX - radius * 0.16,
      centerY - radius * 0.18
    );

    this.sigil.fillStyle(0xe4bf82, 0.12);
    for (const angle of [0, 90, 180, 270]) {
      const point = Phaser.Math.RotateAround(
        { x: centerX, y: centerY - radius * 0.92 },
        centerX,
        centerY,
        Phaser.Math.DegToRad(angle)
      );
      this.sigil.fillCircle(point.x, point.y, Math.max(3, radius * 0.028));
    }
  }

  private drawFrame(width: number, height: number): void {
    const inset = Phaser.Math.Clamp(Math.min(width, height) * 0.03, 16, 28);
    const innerInset = inset + 8;

    this.frameLines.clear();
    this.frameLines.lineStyle(1, 0xe2c08a, 0.22);
    this.frameLines.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    this.frameLines.lineStyle(1, 0xf7edd9, 0.06);
    this.frameLines.strokeRect(innerInset, innerInset, width - innerInset * 2, height - innerInset * 2);

    this.frameLines.lineStyle(2, 0xca9c63, 0.2);
    this.frameLines.beginPath();
    this.frameLines.moveTo(width * 0.2, height * 0.14);
    this.frameLines.lineTo(width * 0.8, height * 0.14);
    this.frameLines.moveTo(width * 0.26, height * 0.86);
    this.frameLines.lineTo(width * 0.74, height * 0.86);
    this.frameLines.strokePath();

    this.frameLines.fillStyle(0xf2d59d, 0.2);
    for (const point of [
      { x: width * 0.18, y: height * 0.14 },
      { x: width * 0.82, y: height * 0.14 },
      { x: width * 0.24, y: height * 0.86 },
      { x: width * 0.76, y: height * 0.86 }
    ]) {
      this.frameLines.fillCircle(point.x, point.y, 2.5);
    }
  }

  private fitBackdrop(image: Phaser.GameObjects.Image, width: number, height: number, overscan = 1): void {
    const textureSource = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const textureWidth = textureSource.width || 1;
    const textureHeight = textureSource.height || 1;
    const scale = Math.max(width / textureWidth, height / textureHeight) * overscan;

    image.setPosition(width * 0.5, height * 0.5);
    image.setScale(scale);
  }

  private createSoftLightTexture(): void {
    if (this.textures.exists(SOFT_LIGHT_TEXTURE_KEY)) {
      return;
    }

    const size = 320;
    const graphics = this.add.graphics().setVisible(false);

    for (let step = 18; step >= 1; step -= 1) {
      const ratio = step / 18;
      graphics.fillStyle(0xffffff, 0.09 * ratio * ratio);
      graphics.fillCircle(size / 2, size / 2, (size / 2) * ratio);
    }

    graphics.generateTexture(SOFT_LIGHT_TEXTURE_KEY, size, size);
    graphics.destroy();
  }
}
