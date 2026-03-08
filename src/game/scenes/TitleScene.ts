import Phaser from 'phaser';
import { audioDirector } from '../audio/audioDirector';

type CastSprite = {
  sprite: Phaser.GameObjects.Image;
  desktopOffsetX: number;
  baseScale: number;
};

export class TitleScene extends Phaser.Scene {
  private backdropImage!: Phaser.GameObjects.Image;
  private backdropShade!: Phaser.GameObjects.Rectangle;
  private vignette!: Phaser.GameObjects.Rectangle;
  private topBanner!: Phaser.GameObjects.Rectangle;
  private frame!: Phaser.GameObjects.Rectangle;
  private frameInner!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;
  private startButtonBacking!: Phaser.GameObjects.Rectangle;
  private startButtonShine!: Phaser.GameObjects.Rectangle;
  private startButtonText!: Phaser.GameObjects.Text;
  private startButtonHitArea!: Phaser.GameObjects.Zone;
  private castSprites: CastSprite[] = [];
  private startButtonBaseScale = 1;

  constructor() {
    super('title');
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('title');

    this.backdropImage = this.add.image(0, 0, 'title-backdrop').setAlpha(0.94);
    this.backdropShade = this.add.rectangle(0, 0, 0, 0, 0x081018, 0.48);
    this.vignette = this.add.rectangle(0, 0, 0, 0, 0x08040b, 0.24).setDepth(1);
    this.topBanner = this.add.rectangle(0, 0, 0, 0, 0x2a1018, 0.34).setDepth(2);

    this.add
      .particles(0, 0, 'spark', {
        x: { min: 0, max: this.scale.width },
        y: { min: 0, max: this.scale.height },
        lifespan: 4400,
        speedY: { min: -4, max: 6 },
        speedX: { min: -3, max: 3 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.3, end: 0 },
        frequency: 160,
        quantity: 1,
        blendMode: 'ADD'
      })
      .setDepth(2);

    this.titleText = this.add.text(0, 0, 'CRIMSON TACTICS', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '56px',
      color: '#fff3dc',
      fontStyle: 'bold',
      letterSpacing: 10,
      stroke: '#17060c',
      strokeThickness: 8
    })
      .setOrigin(0.5)
      .setDepth(3);

    this.subtitleText = this.add.text(0, 0, 'War-torn heirs, ember rites, and highland steel', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '22px',
      color: '#e3cf9f',
      letterSpacing: 2
    })
      .setOrigin(0.5)
      .setDepth(3);

    this.frame = this.add.rectangle(0, 0, 0, 0, 0x10131b, 0.3)
      .setStrokeStyle(2, 0xe1c27f, 0.58)
      .setDepth(2);
    this.frameInner = this.add.rectangle(0, 0, 0, 0, 0x2a1118, 0.38)
      .setStrokeStyle(1, 0xf0dda8, 0.35)
      .setDepth(2);

    const cast = [
      { key: 'holy-knight', desktopOffsetX: -200, scale: 0.56 },
      { key: 'wild-archer', desktopOffsetX: 10, scale: 0.54 },
      { key: 'ember-mage', desktopOffsetX: 205, scale: 0.53 }
    ];

    for (const [index, entry] of cast.entries()) {
      const sprite = this.add
        .image(0, 0, entry.key)
        .setOrigin(0.5, 1)
        .setScale(entry.scale)
        .setAlpha(0.96)
        .setDepth(3 + index);

      this.castSprites.push({
        sprite,
        desktopOffsetX: entry.desktopOffsetX,
        baseScale: entry.scale
      });

      this.tweens.add({
        targets: sprite,
        angle: index === 0 ? -1.3 : index === 1 ? -1.8 : 1.4,
        duration: 2200 + index * 140,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true
      });
    }

    const description = [
      'At the bells of vespers, the chapel ridge fell to gravebound raiders.',
      'Gather your sworn companies and reclaim the pass before dawn.'
    ].join('\n');

    this.descriptionText = this.add.text(0, 0, description, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '23px',
      color: '#f4e8c8',
      align: 'center',
      lineSpacing: 10
    })
      .setOrigin(0.5)
      .setDepth(4);

    const startBattle = () => {
      void audioDirector.unlock();
      audioDirector.playUiConfirm();
      this.scene.start('battle');
    };

    this.createButton('Begin Campaign', startBattle);

    this.controlsText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '19px',
      color: '#d7c8a8',
      align: 'center',
      lineSpacing: 8
    })
      .setOrigin(0.5)
      .setDepth(4);

    this.tweens.add({
      targets: [this.startButton, this.controlsText],
      alpha: { from: 0.82, to: 1 },
      duration: 980,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
    this.handleResize(this.scale.gameSize);

    this.input.keyboard?.once('keydown-ENTER', () => {
      startBattle();
    });
    this.input.keyboard?.on('keydown-M', () => {
      audioDirector.toggleMute();
    });
  }

  private createButton(label: string, onClick: () => void): void {
    this.startButtonBacking = this.add
      .rectangle(0, 0, 300, 72, 0x58202a, 0.96)
      .setStrokeStyle(3, 0xf1d79a, 0.92);
    this.startButtonShine = this.add.rectangle(0, -14, 276, 20, 0xffe6b0, 0.2);
    this.startButtonText = this.add.text(0, 0, label, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '30px',
      color: '#fff6e1',
      fontStyle: 'bold',
      letterSpacing: 1
    });
    this.startButtonText.setOrigin(0.5);

    this.startButton = this.add.container(0, 0, [
      this.startButtonBacking,
      this.startButtonShine,
      this.startButtonText
    ]).setDepth(4);

    this.startButtonHitArea = this.add
      .zone(0, 0, 300, 72)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);

    this.startButtonHitArea.on('pointerover', () => {
      this.startButtonBacking.setFillStyle(0x6b2d37, 0.98);
      this.startButton.setScale(this.startButtonBaseScale * 1.035);
    });

    this.startButtonHitArea.on('pointerout', () => {
      this.startButtonBacking.setFillStyle(0x58202a, 0.96);
      this.startButton.setScale(this.startButtonBaseScale);
    });

    this.startButtonHitArea.on('pointerdown', onClick);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const isPortrait = height > width;
    const tiny = width < 460 || height < 760;
    const compact = width < 920 || height < 620;
    const frameWidth = Math.min(width - (isPortrait ? 24 : 72), isPortrait ? width - 24 : width - 140);
    const frameHeight = Math.min(height - (isPortrait ? 210 : 200), isPortrait ? height * 0.58 : height - 220);
    const frameCenterY = isPortrait ? height * 0.56 : height * 0.57;
    const titleY = Math.max(56, height * (isPortrait ? 0.11 : 0.14));
    const subtitleY = titleY + (compact ? 34 : 48);
    const descriptionY = frameCenterY - frameHeight * 0.26;
    const buttonY = frameCenterY + frameHeight * (isPortrait ? 0.16 : 0.12);
    const controlsY = frameCenterY + frameHeight * (isPortrait ? 0.35 : 0.3);
    const buttonScale = isPortrait ? (tiny ? 0.9 : 0.95) : compact ? 0.95 : 1;

    this.backdropImage
      .setPosition(width / 2, height / 2)
      .setDisplaySize(width * 1.16, height * 1.16);
    this.backdropShade
      .setPosition(width / 2, height / 2)
      .setSize(width * 1.18, height * 1.18);
    this.vignette
      .setPosition(width / 2, height / 2)
      .setSize(width * 1.18, height * 1.18);
    this.topBanner
      .setPosition(width / 2, titleY + 20)
      .setSize(Math.min(width - 12, 960), isPortrait ? 88 : 102);
    this.frame
      .setPosition(width / 2, frameCenterY)
      .setSize(frameWidth, frameHeight);
    this.frameInner
      .setPosition(width / 2, frameCenterY)
      .setSize(frameWidth - 18, frameHeight - 18);

    this.titleText
      .setPosition(width / 2, titleY)
      .setFontSize(isPortrait ? (tiny ? 28 : 32) : compact ? 40 : 56)
      .setLetterSpacing(isPortrait ? (tiny ? 4 : 6) : 10)
      .setStroke('#2f1119', isPortrait ? 6 : 8);
    this.subtitleText
      .setPosition(width / 2, subtitleY)
      .setFontSize(isPortrait ? (tiny ? 14 : 15) : compact ? 17 : 21)
      .setWordWrapWidth(Math.max(240, width - 80), true);
    this.descriptionText
      .setPosition(width / 2, descriptionY)
      .setFontSize(isPortrait ? (tiny ? 15 : 17) : compact ? 20 : 23)
      .setWordWrapWidth(frameWidth - (isPortrait ? 36 : 120), true);

    const controlsText = isPortrait
      ? 'Tap units and tiles to command your company.\nDrag the battlefield to pan.\nUse the battle HUD to zoom, rotate, and mute.'
      : compact
        ? 'Tap or click to command units. Drag to pan. Use the battle HUD to zoom, rotate, and mute.'
        : 'Tap or click to command units. Drag to pan. Use the battle HUD to zoom, rotate, and mute. R restarts.';

    this.controlsText
      .setPosition(width / 2, controlsY)
      .setFontSize(isPortrait ? (tiny ? 12 : 13) : compact ? 15 : 19)
      .setText(controlsText)
      .setWordWrapWidth(frameWidth - (isPortrait ? 28 : 56), true);

    const buttonWidth = isPortrait ? Math.min(340, width - 42) : compact ? 286 : 300;
    const buttonHeight = isPortrait ? (tiny ? 64 : 70) : compact ? 66 : 72;
    const shineWidth = Math.max(120, buttonWidth - 22);

    this.startButtonBaseScale = buttonScale;
    this.startButton.setPosition(width / 2, buttonY).setScale(buttonScale);
    this.startButtonBacking.setSize(buttonWidth, buttonHeight);
    this.startButtonShine.setSize(shineWidth, Math.max(14, buttonHeight * 0.28));
    this.startButtonText.setFontSize(isPortrait ? (tiny ? 22 : 24) : compact ? 27 : 30);
    this.startButtonHitArea
      .setPosition(width / 2, buttonY)
      .setSize(buttonWidth * buttonScale, buttonHeight * buttonScale);

    if (isPortrait) {
      const portraitSlots = [0.18, 0.5, 0.82];

      for (const [index, cast] of this.castSprites.entries()) {
        cast.sprite
          .setPosition(width * portraitSlots[index], height - 16)
          .setScale(cast.baseScale * (tiny ? 0.33 : 0.4));
      }

      return;
    }

    for (const cast of this.castSprites) {
      cast.sprite
        .setPosition(width / 2 + cast.desktopOffsetX, height - 28)
        .setScale(cast.baseScale * (compact ? 0.82 : 1));
    }
  }
}
