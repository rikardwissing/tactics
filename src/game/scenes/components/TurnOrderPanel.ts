import Phaser from 'phaser';
import { BattleUnit } from '../../core/types';

interface TurnOrderRow {
  backing: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Graphics;
  border: Phaser.GameObjects.Rectangle;
  avatar: Phaser.GameObjects.Image;
  avatarMaskShape: Phaser.GameObjects.Graphics;
  pulseTween?: Phaser.Tweens.Tween;
  avatarTextureKey: string | null;
  avatarRenderSize: number;
  unitId: string | null;
  team: BattleUnit['team'] | null;
  visible: boolean;
  isCurrentTurn: boolean;
}

interface RowLayout {
  backingX: number;
  backingY: number;
  borderX: number;
  borderY: number;
  avatarX: number;
  avatarY: number;
}

const EMPTY_BG = 0x080509;
const PANEL_BG = 0x120a0f;
const EMPTY_BORDER = 0x3a2930;
const PLAYER_BORDER = 0x67b8ff;
const ENEMY_BORDER = 0xff7272;

export class TurnOrderPanel {
  private readonly rows: TurnOrderRow[];
  private readonly rowLayouts: RowLayout[];
  private rowWidth = 40;
  private avatarSize = 40;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxEntries: number,
    private readonly origin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0),
    private readonly onSelectUnit?: (unitId: string) => void,
    private readonly onHoverUnit?: (unitId: string | null) => void
  ) {
    this.rowLayouts = Array.from({ length: maxEntries }, () => ({
      backingX: origin.x,
      backingY: origin.y,
      borderX: origin.x,
      borderY: origin.y,
      avatarX: origin.x,
      avatarY: origin.y
    }));

    this.rows = Array.from({ length: maxEntries }, () => {
      const backing = scene.add
        .rectangle(origin.x, origin.y, this.rowWidth, 40, PANEL_BG, 0.92)
        .setOrigin(0, 0)
        .setVisible(false)
        .setStrokeStyle(1, EMPTY_BORDER, 0.9);

      const border = scene.add
        .rectangle(origin.x, origin.y, this.rowWidth, 40, 0x000000, 0)
        .setOrigin(0, 0)
        .setVisible(false)
        .setStrokeStyle(2, EMPTY_BORDER, 0.82);

      const glow = scene.add
        .graphics()
        .setPosition(origin.x, origin.y)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD);

      const avatar = scene.add
        .image(origin.x, origin.y, 'holy-knight')
        .setOrigin(0, 0)
        .setVisible(false);
      const avatarMaskShape = scene.make.graphics({ x: origin.x, y: origin.y }, false);
      avatarMaskShape.fillStyle(0xffffff, 1).fillRect(0, 0, this.avatarSize, this.avatarSize);
      avatar.setMask(avatarMaskShape.createGeometryMask());

      const row: TurnOrderRow = {
        backing,
        glow,
        border,
        avatar,
        avatarMaskShape,
        pulseTween: undefined,
        avatarTextureKey: null,
        avatarRenderSize: 0,
        unitId: null,
        team: null,
        visible: false,
        isCurrentTurn: false
      };

      const onSelect = () => {
        if (!row.unitId) {
          return;
        }

        this.onSelectUnit?.(row.unitId);
      };

      const onHover = (hovered: boolean) => {
        if (!row.visible) {
          return;
        }

        this.onHoverUnit?.(hovered ? row.unitId : null);
        this.applyRowInteractionState(row, hovered);
      };

      row.backing
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onSelect();
        })
        .on('pointerout', () => onHover(false))
        .on('pointerover', () => onHover(true));

      row.avatar
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onSelect();
        })
        .on('pointerout', () => onHover(false))
        .on('pointerover', () => onHover(true));

      return row;
    });
  }

  getDisplayObjects(): Array<
    Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics
  > {
    return this.rows.flatMap((row) => [
      row.backing,
      row.glow,
      row.avatar,
      row.border
    ]);
  }

  setVisible(visible: boolean): void {
    for (const row of this.rows) {
      this.applyVisibility(row, visible && row.visible);
    }
  }

  setLayout(config: {
    x: number;
    startY: number;
    gap: number;
    avatarSize: number;
    reverse?: boolean;
  }): void {
    this.rowWidth = config.avatarSize;
    this.avatarSize = config.avatarSize;
    const rowHeight = config.avatarSize;
    const reverse = config.reverse ?? false;

    for (const [index, row] of this.rows.entries()) {
      const visualIndex = reverse ? this.maxEntries - 1 - index : index;
      const y = config.startY + visualIndex * config.gap;
      const leftX = config.x;

      row.backing
        .setPosition(leftX, y)
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.border
        .setPosition(leftX, y)
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.glow
        .setPosition(leftX, y);
      row.avatar.setPosition(leftX, y);
      this.updateAvatarMask(row, leftX, y, config.avatarSize);

      const avatarHitArea = row.avatar.input?.hitArea;
      if (avatarHitArea instanceof Phaser.Geom.Rectangle) {
        avatarHitArea.setTo(0, 0, config.avatarSize, config.avatarSize);
      }

      this.rowLayouts[index] = {
        backingX: leftX,
        backingY: y,
        borderX: leftX,
        borderY: y,
        avatarX: leftX,
        avatarY: y
      };

      if (row.visible && row.unitId && row.avatarTextureKey && row.avatarRenderSize !== this.avatarSize) {
        this.applyFaceCrop(row);
      }
    }
  }

  setQueue(units: BattleUnit[], _activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    for (const [index, row] of this.rows.entries()) {
      const unit = units[index];
      row.visible = visiblePanel && index < visibleCount;
      row.unitId = unit?.id ?? null;
      row.team = unit?.team ?? null;
      row.isCurrentTurn = !!unit && index === 0;
      this.applyVisibility(row, row.visible);
      this.syncPulse(row);

      if (!row.visible) {
        continue;
      }

      if (!unit) {
        row.backing.setFillStyle(EMPTY_BG, 0.68);
        row.border.setAlpha(1);
        row.glow.setAlpha(1);
        row.glow.clear().setVisible(false);
        row.border.setStrokeStyle(1, EMPTY_BORDER, 0.62);
        row.avatarTextureKey = null;
        row.avatarRenderSize = 0;
        row.avatar.setVisible(false).clearTint().setAlpha(0);
        this.applyRowLayout(row, index);
        continue;
      }

      const borderColor = unit.team === 'player' ? PLAYER_BORDER : ENEMY_BORDER;

      row.backing.setFillStyle(PANEL_BG, row.isCurrentTurn ? 0.95 : 0.9);
      row.border.setStrokeStyle(row.isCurrentTurn ? 3 : 2, borderColor, row.isCurrentTurn ? 1 : 0.92);
      row.avatar
        .setVisible(true)
        .clearTint()
        .setAlpha(row.isCurrentTurn ? 1 : 0.95);

      const needsAvatarRefresh =
        row.avatarTextureKey !== unit.spriteKey || row.avatarRenderSize !== this.avatarSize;

      if (needsAvatarRefresh) {
        row.avatar.setTexture(unit.spriteKey);
        row.avatarTextureKey = unit.spriteKey;
        this.applyFaceCrop(row);
      }

      this.applyRowLayout(row, index);
      this.applyRowInteractionState(row, false);
    }
  }

  private applyRowInteractionState(row: TurnOrderRow, hovered: boolean): void {
    if (!row.unitId || !row.team) {
      row.backing.setAlpha(1);
      row.glow.setAlpha(0).setVisible(false);
      row.border.setAlpha(1);
      return;
    }

    const borderColor = row.team === 'player' ? PLAYER_BORDER : ENEMY_BORDER;
    const baseBackingAlpha = row.isCurrentTurn ? 0.95 : 0.9;
    const hoverBackingAlpha = row.isCurrentTurn ? 1 : 0.95;
    const glowAlpha = row.isCurrentTurn ? (hovered ? 0.28 : 0.24) : 0;
    const glowWidth = row.isCurrentTurn ? (hovered ? 10 : 8) : 8;
    const borderWidth = row.isCurrentTurn ? 3 : hovered ? 3 : 2;
    const borderAlpha = row.isCurrentTurn ? 1 : hovered ? 1 : 0.92;

    row.backing.setAlpha(hovered ? hoverBackingAlpha : baseBackingAlpha);
    this.drawGlow(row, borderColor, glowWidth, glowAlpha, row.isCurrentTurn);
    row.border.setStrokeStyle(borderWidth, borderColor, borderAlpha);
    this.syncPulse(row);
  }

  private applyVisibility(row: TurnOrderRow, visible: boolean): void {
    row.backing.setVisible(visible);
    row.glow.setVisible(visible && row.unitId !== null && row.isCurrentTurn);
    row.border.setVisible(visible);
    row.avatar.setVisible(visible && row.unitId !== null);
    this.syncPulse(row);
  }

  private applyFaceCrop(row: TurnOrderRow): void {
    const avatar = row.avatar;
    const frame = avatar.frame;
    if (!frame) {
      avatar.setCrop();
      avatar.setDisplayOrigin(0, 0);
      avatar.setScale(1);
      row.avatarRenderSize = 0;
      return;
    }

    const width = frame.width;
    const height = frame.height;
    const cropSize = Math.max(1, Math.round(Math.min(width * 0.48, height * 0.36)));
    const faceCenterX = width * 0.5;
    const faceCenterY = height * 0.21;
    const cropX = Math.round(Phaser.Math.Clamp(faceCenterX - cropSize * 0.5, 0, width - cropSize));
    const cropY = Math.round(Phaser.Math.Clamp(faceCenterY - cropSize * 0.46, 0, height - cropSize));

    avatar.setCrop(cropX, cropY, cropSize, cropSize);
    avatar.setDisplayOrigin(cropX, cropY);
    avatar.setScale(this.avatarSize / cropSize);
    row.avatarRenderSize = this.avatarSize;
  }

  private updateAvatarMask(row: TurnOrderRow, x: number, y: number, size: number): void {
    row.avatarMaskShape.clear();
    row.avatarMaskShape.fillStyle(0xffffff, 1).fillRect(0, 0, size, size);
    row.avatarMaskShape.setPosition(x, y);
  }

  private drawGlow(
    row: TurnOrderRow,
    color: number,
    lineWidth: number,
    alpha: number,
    visible: boolean
  ): void {
    row.glow.clear();

    if (!visible || alpha <= 0) {
      row.glow.setVisible(false);
      return;
    }

    const inset = Math.max(1, Math.round(lineWidth * 0.5));
    const width = Math.max(2, this.rowWidth - inset * 2);
    const height = Math.max(2, this.avatarSize - inset * 2);
    const radius = Math.max(4, Math.round(this.avatarSize * 0.16));

    row.glow
      .lineStyle(lineWidth, color, alpha)
      .strokeRoundedRect(inset, inset, width, height, radius)
      .setVisible(true);
  }

  private syncPulse(row: TurnOrderRow): void {
    const shouldPulse = row.visible && row.unitId !== null && row.isCurrentTurn;

    if (!shouldPulse) {
      row.pulseTween?.stop();
      row.pulseTween?.remove();
      row.pulseTween = undefined;
      row.border.setAlpha(1);
      row.glow.setAlpha(1);
      return;
    }

    if (row.pulseTween) {
      return;
    }

    row.border.setAlpha(1);
    row.glow.setAlpha(0.9);
    row.pulseTween = this.scene.tweens.add({
      targets: [row.border, row.glow],
      alpha: { from: 1, to: 0.35 },
      duration: 260,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1
    });
  }

  private applyRowLayout(row: TurnOrderRow, index: number): void {
    const target = this.rowLayouts[index];
    if (!target) {
      return;
    }

    row.backing.setPosition(target.backingX, target.backingY);
    row.glow.setPosition(target.borderX, target.borderY);
    row.border.setPosition(target.borderX, target.borderY);
    row.avatar.setPosition(target.avatarX, target.avatarY);
    row.avatarMaskShape.setPosition(target.avatarX, target.avatarY);
  }

  getUnitIdAt(pointerX: number, pointerY: number): string | null {
    for (const row of this.rows) {
      if (!row.backing.visible) {
        continue;
      }

      if (row.backing.getBounds().contains(pointerX, pointerY)) {
        return row.unitId;
      }
    }

    return null;
  }
}
