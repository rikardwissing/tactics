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
  private frame!: Phaser.GameObjects.Rectangle;
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
      letterSpacing: 12,
      stroke: '#18070f',
      strokeThickness: 8
    })
      .setOrigin(0.5)
      .setDepth(3);

    this.subtitleText = this.add.text(0, 0, 'A pixel-art tactics skirmish inspired by the classics', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '22px',
      color: '#cde7e3',
      letterSpacing: 2
    })
      .setOrigin(0.5)
      .setDepth(3);

    this.frame = this.add.rectangle(0, 0, 0, 0, 0x10131b, 0.3)
      .setStrokeStyle(2, 0xe1c27f, 0.58)
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
      'The chapel ridge has fallen to gravebound raiders.',
      'Use speed, elevation, and turn timing to break their line.'
    ].join('\n');

    this.descriptionText = this.add.text(0, 0, description, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '24px',
      color: '#f4e8c8',
      align: 'center',
      lineSpacing: 12
    })
      .setOrigin(0.5)
      .setDepth(4);

    const startBattle = () => {
      void audioDirector.unlock();
      audioDirector.playUiConfirm();
      this.scene.start('battle');
    };

    this.createButton('Begin Skirmish', startBattle);

    this.controlsText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '20px',
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
      .rectangle(0, 0, 270, 62, 0x1f4c4e, 0.94)
      .setStrokeStyle(2, 0xf1d79a, 0.92);
    this.startButtonShine = this.add.rectangle(0, -12, 248, 18, 0xf4dba1, 0.16);
    this.startButtonText = this.add.text(0, 0, label, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '28px',
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
      .zone(0, 0, 270, 62)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);

    this.startButtonHitArea.on('pointerover', () => {
      this.startButtonBacking.setFillStyle(0x276164, 0.98);
      this.startButton.setScale(this.startButtonBaseScale * 1.035);
    });

    this.startButtonHitArea.on('pointerout', () => {
      this.startButtonBacking.setFillStyle(0x1f4c4e, 0.94);
      this.startButton.setScale(this.startButtonBaseScale);
    });

    this.startButtonHitArea.on('pointerdown', onClick);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    const isPortrait = height > width;
    const compact = width < 920 || height < 620;
    const frameWidth = Math.min(width - 32, isPortrait ? width - 28 : width - 140);
    const frameHeight = Math.min(height - 180, isPortrait ? height * 0.64 : height - 220);
    const frameCenterY = isPortrait ? height * 0.55 : height * 0.56;
    const titleY = Math.max(72, height * 0.16);
    const subtitleY = titleY + (compact ? 42 : 58);
    const descriptionY = frameCenterY - frameHeight * 0.3;
    const buttonY = frameCenterY + frameHeight * 0.1;
    const controlsY = frameCenterY + frameHeight * 0.28;
    const buttonScale = compact ? 0.92 : 1;

    this.backdropImage
      .setPosition(width / 2, height / 2)
      .setDisplaySize(width * 1.16, height * 1.16);
    this.backdropShade
      .setPosition(width / 2, height / 2)
      .setSize(width * 1.18, height * 1.18);
    this.frame
      .setPosition(width / 2, frameCenterY)
      .setSize(frameWidth, frameHeight);

    this.titleText
      .setPosition(width / 2, titleY)
      .setFontSize(isPortrait ? 34 : compact ? 42 : 56)
      .setLetterSpacing(isPortrait ? 7 : 12)
      .setStroke('#2f1119', isPortrait ? 6 : 8);
    this.subtitleText
      .setPosition(width / 2, subtitleY)
      .setFontSize(isPortrait ? 16 : compact ? 18 : 22)
      .setWordWrapWidth(Math.max(240, width - 80), true);
    this.descriptionText
      .setPosition(width / 2, descriptionY)
      .setFontSize(isPortrait ? 18 : compact ? 21 : 24)
      .setWordWrapWidth(frameWidth - (isPortrait ? 56 : 120), true);

    const controlsText = isPortrait
      ? 'Tap units and tiles to command them.\nDrag the field to pan.\nUse the HUD buttons in battle to zoom, rotate, and mute.'
      : compact
        ? 'Tap or click to command units. Drag to pan. Use the battle HUD to zoom, rotate, and mute.'
        : 'Tap or click to command units. Drag to pan. Use the battle HUD to zoom, rotate, and mute. R restarts.';

    this.controlsText
      .setPosition(width / 2, controlsY)
      .setFontSize(isPortrait ? 14 : compact ? 16 : 20)
      .setText(controlsText)
      .setWordWrapWidth(frameWidth - 56, true);

    const buttonWidth = isPortrait ? Math.min(286, width - 80) : compact ? 252 : 270;
    const buttonHeight = isPortrait ? 68 : compact ? 60 : 62;
    const shineWidth = Math.max(120, buttonWidth - 22);

    this.startButtonBaseScale = buttonScale;
    this.startButton.setPosition(width / 2, buttonY).setScale(buttonScale);
    this.startButtonBacking.setSize(buttonWidth, buttonHeight);
    this.startButtonShine.setSize(shineWidth, Math.max(14, buttonHeight * 0.28));
    this.startButtonText.setFontSize(isPortrait ? 24 : compact ? 26 : 28);
    this.startButtonHitArea
      .setPosition(width / 2, buttonY)
      .setSize(buttonWidth * buttonScale, buttonHeight * buttonScale);

    if (isPortrait) {
      const portraitSlots = [0.22, 0.5, 0.78];

      for (const [index, cast] of this.castSprites.entries()) {
        cast.sprite
          .setPosition(width * portraitSlots[index], height - 28)
          .setScale(cast.baseScale * 0.42);
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
