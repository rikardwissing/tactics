import Phaser from 'phaser';
import { BattleUnit } from '../../core/types';

interface TurnOrderRow {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Rectangle;
  backing: Phaser.GameObjects.Rectangle;
  portrait: Phaser.GameObjects.Image;
}

const PLAYER_BORDER_COLOR = 0x5a96e8;
const ENEMY_BORDER_COLOR = 0xd26464;
const ACTIVE_BORDER_COLOR = 0xf3d690;

export class TurnOrderPanel {
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly rows: TurnOrderRow[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxEntries: number,
    private readonly origin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0)
  ) {
    this.titleText = scene.add.text(origin.x, origin.y, 'TURN ORDER', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#d9c18a',
      letterSpacing: 2
    });

    this.rows = Array.from({ length: maxEntries }, () => {
      const shadow = scene.add.rectangle(2, 2, 44, 44, 0x050203, 0.34).setOrigin(0);
      const backing = scene.add
        .rectangle(0, 0, 44, 44, 0x1a1218, 0.84)
        .setOrigin(0)
        .setStrokeStyle(2, ENEMY_BORDER_COLOR, 0.8);
      const portrait = scene.add.image(22, 22, 'holy-knight').setDisplaySize(32, 32).setOrigin(0.5);
      const container = scene.add.container(origin.x, origin.y, [shadow, backing, portrait]).setVisible(false);

      return { container, shadow, backing, portrait };
    });
  }

  getDisplayObjects(): Array<Phaser.GameObjects.Text | Phaser.GameObjects.Container> {
    return [this.titleText, ...this.rows.map((row) => row.container)];
  }

  setVisible(visible: boolean): void {
    this.titleText.setVisible(visible);
    for (const row of this.rows) {
      row.container.setVisible(visible && row.container.visible);
    }
  }

  setLayout(config: {
    x: number;
    labelY: number;
    startY: number;
    gap: number;
    boxSize: number;
    titleFontSize: number;
  }): void {
    this.titleText
      .setPosition(config.x, config.labelY)
      .setFontSize(config.titleFontSize);

    for (const [index, row] of this.rows.entries()) {
      const y = config.startY + index * config.gap;
      row.container.setPosition(config.x, y);
      row.shadow.setSize(config.boxSize, config.boxSize);
      row.backing
        .setSize(config.boxSize, config.boxSize)
        .setStrokeStyle(2, ENEMY_BORDER_COLOR, 0.8);
      row.portrait
        .setPosition(config.boxSize / 2, config.boxSize / 2)
        .setDisplaySize(Math.max(16, config.boxSize - 12), Math.max(16, config.boxSize - 12));
    }
  }

  setQueue(units: BattleUnit[], activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    this.titleText.setVisible(visiblePanel);

    for (const [index, row] of this.rows.entries()) {
      const unit = units[index];
      const visible = visiblePanel && index < visibleCount && !!unit;
      row.container.setVisible(visible);

      if (!unit) {
        continue;
      }

      const borderColor = activeUnitId === unit.id
        ? ACTIVE_BORDER_COLOR
        : unit.team === 'player'
          ? PLAYER_BORDER_COLOR
          : ENEMY_BORDER_COLOR;

      row.backing.setStrokeStyle(2, borderColor, 0.96);
      row.portrait.setTexture(unit.spriteKey).clearTint();
    }
  }
}
