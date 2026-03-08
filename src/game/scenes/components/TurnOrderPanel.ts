import Phaser from 'phaser';
import { BattleUnit } from '../../core/types';

interface TurnOrderRow {
  borderShadow: Phaser.GameObjects.Rectangle;
  borderGlow: Phaser.GameObjects.Rectangle;
  borderFrame: Phaser.GameObjects.Rectangle;
  avatar: Phaser.GameObjects.Image;
  unitId: string | null;
}

const PLAYER_BORDER_COLOR = 0x89b9ff;
const ENEMY_BORDER_COLOR = 0xe39898;
const ACTIVE_BORDER_COLOR = 0xf3d690;

const PLAYER_TINT = 0xb7d5ff;
const ENEMY_TINT = 0xffc0c0;

export class TurnOrderPanel {
  private readonly rows: TurnOrderRow[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxEntries: number,
    private readonly origin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0),
    private readonly onSelectUnit?: (unitId: string) => void
  ) {
    this.rows = Array.from({ length: maxEntries }, () => {
      const borderShadow = scene.add
        .rectangle(origin.x + 2, origin.y + 3, 42, 42, 0x050203, 0.36)
        .setOrigin(0, 0)
        .setVisible(false);
      const borderGlow = scene.add
        .rectangle(origin.x, origin.y, 42, 42, 0xf4d99a, 0.12)
        .setOrigin(0, 0)
        .setVisible(false);
      const borderFrame = scene.add
        .rectangle(origin.x, origin.y, 42, 42, 0x170f15, 0.68)
        .setOrigin(0, 0)
        .setStrokeStyle(2, ENEMY_BORDER_COLOR, 0.94)
        .setVisible(false);
      const avatar = scene.add
        .image(origin.x, origin.y, 'holy-knight')
        .setDisplaySize(36, 36)
        .setOrigin(0, 0)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });

      const row: TurnOrderRow = {
        borderShadow,
        borderGlow,
        borderFrame,
        avatar,
        unitId: null
      };

      row.avatar.on('pointerdown', () => {
        if (!row.unitId) {
          return;
        }

        this.onSelectUnit?.(row.unitId);
      });

      return row;
    });
  }

  getDisplayObjects(): Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image> {
    return this.rows.flatMap((row) => [row.borderShadow, row.borderGlow, row.borderFrame, row.avatar]);
  }

  setVisible(visible: boolean): void {
    for (const row of this.rows) {
      row.avatar.setVisible(visible && row.avatar.visible);
      row.borderShadow.setVisible(visible && row.borderShadow.visible);
      row.borderGlow.setVisible(visible && row.borderGlow.visible);
      row.borderFrame.setVisible(visible && row.borderFrame.visible);
    }
  }

  setLayout(config: {
    x: number;
    startY: number;
    gap: number;
    avatarSize: number;
  }): void {
    const frameSize = config.avatarSize + 8;

    for (const [index, row] of this.rows.entries()) {
      const y = config.startY + index * config.gap;
      row.borderShadow.setPosition(config.x + 2, y + 3).setSize(frameSize, frameSize);
      row.borderGlow.setPosition(config.x, y).setSize(frameSize, frameSize);
      row.borderFrame.setPosition(config.x, y).setSize(frameSize, frameSize);
      row.avatar
        .setPosition(config.x + 4, y + 4)
        .setDisplaySize(config.avatarSize, config.avatarSize);
    }
  }

  setQueue(units: BattleUnit[], activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    for (const [index, row] of this.rows.entries()) {
      const unit = units[index];
      const visible = visiblePanel && index < visibleCount && !!unit;
      row.avatar.setVisible(visible);
      row.borderShadow.setVisible(visible);
      row.borderGlow.setVisible(visible);
      row.borderFrame.setVisible(visible);
      row.unitId = unit?.id ?? null;

      if (!unit) {
        continue;
      }

      const borderColor = activeUnitId === unit.id
        ? ACTIVE_BORDER_COLOR
        : unit.team === 'player'
          ? PLAYER_BORDER_COLOR
          : ENEMY_BORDER_COLOR;

      row.borderFrame
        .setStrokeStyle(2, borderColor, 0.96)
        .setFillStyle(0x120b10, activeUnitId === unit.id ? 0.8 : 0.72);
      row.borderGlow
        .setFillStyle(borderColor, activeUnitId === unit.id ? 0.18 : 0.08);
      row.avatar
        .setTexture(unit.spriteKey)
        .setAlpha(activeUnitId === unit.id ? 1 : 0.92)
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
    const cropWidth = width * 0.68;
    const cropHeight = height * 0.5;
    const cropX = (width - cropWidth) / 2;
    const cropY = height * 0.03;

    avatar.setCrop(cropX, cropY, cropWidth, cropHeight);
  }

  getUnitIdAt(pointerX: number, pointerY: number): string | null {
    for (const row of this.rows) {
      if (!row.avatar.visible) {
        continue;
      }

      if (row.borderFrame.getBounds().contains(pointerX, pointerY)) {
        return row.unitId;
      }
    }

    return null;
  }
}
