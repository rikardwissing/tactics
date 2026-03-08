import Phaser from 'phaser';
import { audioDirector } from '../audio/audioDirector';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('title');

    const { width, height } = this.scale;

    this.add
      .image(width / 2, height / 2, 'title-backdrop')
      .setDisplaySize(width, height)
      .setAlpha(0.92);

    this.add.rectangle(width / 2, height / 2, width, height, 0x12070d, 0.42);

    this.add
      .particles(0, 0, 'spark', {
        x: { min: 0, max: width },
        y: { min: 0, max: height },
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

    this.add
      .text(width / 2, 118, 'CRIMSON TACTICS', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '56px',
        color: '#f8edd0',
        fontStyle: 'bold',
        letterSpacing: 12,
        stroke: '#2f1119',
        strokeThickness: 8
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.add
      .text(width / 2, 176, 'A pixel-art tactics skirmish inspired by the classics', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '22px',
        color: '#e1cc96',
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setDepth(3);

    const frame = this.add
      .rectangle(width / 2, height / 2 + 42, width - 220, height - 220, 0x2a1320, 0.18)
      .setStrokeStyle(2, 0xdabf83, 0.55)
      .setDepth(2);

    const cast = [
      { key: 'holy-knight', x: width / 2 - 200, y: height - 28, scale: 0.56 },
      { key: 'wild-archer', x: width / 2 + 10, y: height - 36, scale: 0.54 },
      { key: 'ember-mage', x: width / 2 + 205, y: height - 40, scale: 0.53 }
    ];

    for (const [index, entry] of cast.entries()) {
      const sprite = this.add
        .image(entry.x, entry.y, entry.key)
        .setOrigin(0.5, 1)
        .setScale(entry.scale)
        .setAlpha(0.96)
        .setDepth(3 + index);

      this.tweens.add({
        targets: sprite,
        y: entry.y - 12,
        duration: 2600 + index * 180,
        ease: 'Sine.easeInOut',
        repeat: -1,
        yoyo: true
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

    this.add
      .text(width / 2, frame.y - 86, description, {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '24px',
        color: '#f3e5bd',
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

    const startButton = this.createButton(width / 2, frame.y + 40, 'Begin Skirmish', startBattle);

    const controlsText = this.add
      .text(width / 2, frame.y + 118, 'Mouse: move and target   |   Space: wait   |   Q/E: rotate   |   R: restart   |   M: mute', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '20px',
        color: '#d3c19a',
        letterSpacing: 1
      })
      .setOrigin(0.5)
      .setDepth(4);

    this.tweens.add({
      targets: [startButton, controlsText],
      alpha: { from: 0.82, to: 1 },
      duration: 980,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.input.keyboard?.once('keydown-ENTER', () => {
      startBattle();
    });
    this.input.keyboard?.on('keydown-M', () => {
      audioDirector.toggleMute();
    });
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const backing = this.add
      .rectangle(0, 0, 270, 62, 0x6d3a28, 0.9)
      .setStrokeStyle(2, 0xf1d79a, 0.9);
    const shine = this.add.rectangle(0, -12, 248, 18, 0xf4dba1, 0.12);
    const text = this.add.text(0, 0, label, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '28px',
      color: '#fff5dd',
      fontStyle: 'bold',
      letterSpacing: 1
    });
    text.setOrigin(0.5);

    const button = this.add.container(x, y, [backing, shine, text]).setDepth(4);
    const hitArea = this.add
      .zone(x, y, 270, 62)
      .setInteractive({ useHandCursor: true })
      .setDepth(5);

    hitArea.on('pointerover', () => {
      backing.setFillStyle(0x84503a, 0.96);
      button.setScale(1.03);
    });

    hitArea.on('pointerout', () => {
      backing.setFillStyle(0x6d3a28, 0.9);
      button.setScale(1);
    });

    hitArea.on('pointerdown', onClick);

    return button;
  }
}
