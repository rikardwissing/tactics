import Phaser from 'phaser';
import { BattleUnit } from '../../core/types';

interface TurnOrderRow {
  avatar: Phaser.GameObjects.Image;
  unitId: string | null;
}

const PLAYER_TINT = 0xb7d5ff;
const ENEMY_TINT = 0xffb9b9;

export class TurnOrderPanel {
  private readonly rows: TurnOrderRow[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxEntries: number,
    private readonly origin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0),
    private readonly onSelectUnit?: (unitId: string) => void
  ) {
    this.rows = Array.from({ length: maxEntries }, () => {
      const row: TurnOrderRow = {
        avatar: scene.add
          .image(origin.x, origin.y, 'holy-knight')
          .setDisplaySize(36, 36)
          .setOrigin(0, 0)
          .setVisible(false),
        unitId: null
      };

      row.avatar
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (!row.unitId) {
            return;
          }

          this.onSelectUnit?.(row.unitId);
        });

      return row;
    });
  }

  getDisplayObjects(): Phaser.GameObjects.Image[] {
    return this.rows.map((row) => row.avatar);
  }

  setVisible(visible: boolean): void {
    for (const row of this.rows) {
      row.avatar.setVisible(visible && row.avatar.visible);
    }
  }

  setLayout(config: {
    x: number;
    startY: number;
    gap: number;
    avatarSize: number;
  }): void {
    for (const [index, row] of this.rows.entries()) {
      const y = config.startY + index * config.gap;
      row.avatar
        .setPosition(config.x, y)
        .setDisplaySize(config.avatarSize, config.avatarSize);
    }
  }

  setQueue(units: BattleUnit[], activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    for (const [index, row] of this.rows.entries()) {
      const unit = units[index];
      const visible = visiblePanel && index < visibleCount && !!unit;
      row.avatar.setVisible(visible);
      row.unitId = unit?.id ?? null;

      if (!unit) {
        continue;
      }

      row.avatar
        .setTexture(unit.spriteKey)
        .setAlpha(activeUnitId === unit.id ? 1 : 0.9)
        .setTint(unit.team === 'player' ? PLAYER_TINT : ENEMY_TINT);

      this.applyFaceCrop(row.avatar);
    }
  }

  private applyFaceCrop(avatar: Phaser.GameObjects.Image): void {
    const frame = avatar.frame;
    if (!frame) {
      avatar.setCrop();
      return;
    }

    const width = frame.width;
    const height = frame.height;
    const cropWidth = width * 0.7;
    const cropHeight = height * 0.52;
    const cropX = (width - cropWidth) / 2;
    const cropY = height * 0.04;

    avatar.setCrop(cropX, cropY, cropWidth, cropHeight);
  }

  getUnitIdAt(pointerX: number, pointerY: number): string | null {
    for (const row of this.rows) {
      if (!row.avatar.visible) {
        continue;
      }

      if (row.avatar.getBounds().contains(pointerX, pointerY)) {
        return row.unitId;
      }
    }

    return null;
  }
}
