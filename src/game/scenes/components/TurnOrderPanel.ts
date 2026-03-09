import Phaser from 'phaser';
import { BattleUnit } from '../../core/types';

interface TurnOrderRow {
  backing: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  avatar: Phaser.GameObjects.Image;
  teamMark: Phaser.GameObjects.Text;
  offsetText: Phaser.GameObjects.Text;
  badgeText: Phaser.GameObjects.Text;
  unitId: string | null;
  visible: boolean;
  pressed: boolean;
}

interface RowLayout {
  backingX: number;
  backingY: number;
  borderX: number;
  borderY: number;
  avatarX: number;
  avatarY: number;
  teamMarkX: number;
  teamMarkY: number;
  badgeX: number;
  badgeY: number;
  offsetX: number;
  offsetY: number;
}

const PLAYER_TINT = 0xb7d5ff;
const ENEMY_TINT = 0xffb9b9;
const PANEL_BG = 0x120a0f;
const PANEL_ACTIVE_BG = 0x2c1721;
const PANEL_NEXT_BG = 0x22121a;
const PANEL_LATER_BG = 0x140c12;
const BORDER_IDLE = 0x4c3630;
const BORDER_ACTIVE = 0xd5ba7a;
const BORDER_NEXT = 0xab8e61;
const PANEL_OVERFLOW_BG = 0x10090e;
const BORDER_OVERFLOW = 0x6d5850;

export class TurnOrderPanel {
  private readonly rows: TurnOrderRow[];
  private readonly rowLayouts: RowLayout[];
  private rowWidth = 40;
  private previousActiveUnitId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxEntries: number,
    private readonly origin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0),
    private readonly onSelectUnit?: (unitId: string) => void
  ) {
    this.rowLayouts = Array.from({ length: maxEntries }, () => ({
      backingX: origin.x,
      backingY: origin.y,
      borderX: origin.x,
      borderY: origin.y,
      avatarX: origin.x,
      avatarY: origin.y,
      teamMarkX: origin.x,
      teamMarkY: origin.y,
      badgeX: origin.x,
      badgeY: origin.y,
      offsetX: origin.x,
      offsetY: origin.y
    }));

    this.rows = Array.from({ length: maxEntries }, () => {
      const backing = scene.add
        .rectangle(origin.x, origin.y, this.rowWidth, 40, PANEL_BG, 0.94)
        .setOrigin(0, 0)
        .setVisible(false)
        .setStrokeStyle(1, BORDER_IDLE, 0.9);

      const border = scene.add
        .rectangle(origin.x, origin.y, this.rowWidth, 40, 0x000000, 0)
        .setOrigin(0, 0)
        .setVisible(false)
        .setStrokeStyle(2, BORDER_IDLE, 0.7);

      const avatar = scene.add
        .image(origin.x, origin.y, 'holy-knight')
        .setDisplaySize(36, 36)
        .setOrigin(0, 0)
        .setVisible(false);

      const teamMark = scene.add.text(origin.x, origin.y, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#e9d9b7'
      }).setOrigin(0.5, 0.5).setVisible(false);

      const offsetText = scene.add.text(origin.x, origin.y, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#cdb58c',
        letterSpacing: 0.5
      }).setOrigin(1, 0.5).setVisible(false);

      const badgeText = scene.add.text(origin.x, origin.y, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#f5dfb4',
        letterSpacing: 1
      }).setOrigin(0, 0.5).setVisible(false);

      const row: TurnOrderRow = {
        backing,
        border,
        avatar,
        teamMark,
        offsetText,
        badgeText,
        unitId: null,
        visible: false,
        pressed: false
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

        this.applyRowInteractionState(row, hovered, row.pressed);
      };

      const onPress = (pressed: boolean) => {
        row.pressed = pressed;

        if (!row.visible) {
          return;
        }

        this.applyRowInteractionState(row, true, row.pressed);
      };

      row.backing
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onPress(true);
          onSelect();
        })
        .on('pointerup', () => onPress(false))
        .on('pointerupoutside', () => onPress(false))
        .on('pointerout', () => {
          onPress(false);
          onHover(false);
        })
        .on('pointerover', () => onHover(true));

      row.avatar
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onPress(true);
          onSelect();
        })
        .on('pointerup', () => onPress(false))
        .on('pointerupoutside', () => onPress(false))
        .on('pointerout', () => {
          onPress(false);
          onHover(false);
        })
        .on('pointerover', () => onHover(true));

      return row;
    });
  }

  getDisplayObjects(): Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> {
    return this.rows.flatMap((row) => [
      row.backing,
      row.border,
      row.avatar,
      row.teamMark,
      row.offsetText,
      row.badgeText
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
  }): void {
    this.rowWidth = config.avatarSize;
    const rowHeight = config.avatarSize;

    for (const [index, row] of this.rows.entries()) {
      const y = config.startY + index * config.gap;
      const leftX = config.x;

      row.backing
        .setPosition(leftX, y)
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.border
        .setPosition(leftX, y)
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.avatar
        .setPosition(config.x, y)
        .setDisplaySize(config.avatarSize, config.avatarSize);
      row.teamMark.setPosition(leftX + 10, y + config.avatarSize - 9);
      row.badgeText.setPosition(leftX + 4, y + 7);
      row.offsetText.setPosition(leftX + this.rowWidth - 4, y + 7);

      this.rowLayouts[index] = {
        backingX: leftX,
        backingY: y,
        borderX: leftX,
        borderY: y,
        avatarX: config.x,
        avatarY: y,
        teamMarkX: leftX + 10,
        teamMarkY: y + config.avatarSize - 9,
        badgeX: leftX + 4,
        badgeY: y + 7,
        offsetX: leftX + this.rowWidth - 4,
        offsetY: y + 7
      };
    }
  }

  setQueue(units: BattleUnit[], activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    const activeIndex = units.findIndex((unit) => unit.id === activeUnitId);
    const hasOverflow = units.length > visibleCount;
    const entryCount = hasOverflow ? Math.max(0, visibleCount - 1) : visibleCount;
    const previousRowByUnitId = new Map<string, number>();
    let previousOverflowIndex: number | undefined;

    for (const [index, row] of this.rows.entries()) {
      if (row.unitId) {
        previousRowByUnitId.set(row.unitId, index);
      }

      if (row.visible && row.unitId === null && row.badgeText.text === 'MORE') {
        previousOverflowIndex = index;
      }
    }

    for (const [index, row] of this.rows.entries()) {
      const isOverflowRow = hasOverflow && index === visibleCount - 1;
      const unit = units[index];
      row.visible = visiblePanel && index < visibleCount && (isOverflowRow || !!unit);
      row.unitId = isOverflowRow ? null : unit?.id ?? null;
      row.pressed = false;
      this.applyVisibility(row, row.visible);

      if (!row.visible) {
        continue;
      }

      if (isOverflowRow) {
        const overflowCount = Math.max(1, units.length - entryCount);
        row.backing.setFillStyle(PANEL_OVERFLOW_BG, 0.94);
        row.border.setStrokeStyle(2, BORDER_OVERFLOW, 0.82);
        row.badgeText.setText('MORE').setColor('#c9b18f');
        row.offsetText.setText(`+${overflowCount}`);
        row.teamMark.setText('•').setColor('#a58f7a');
        row.avatar.setVisible(false).clearTint().setAlpha(0.7);
        this.animateRowToLayout(row, index, previousOverflowIndex);
        this.applyRowInteractionState(row, false, false);
        continue;
      }

      if (!unit) {
        continue;
      }

      const isActive = activeUnitId === unit.id;
      const nextIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
      const isNext = !isActive && index === nextIndex;
      const badge = isActive ? 'NOW' : isNext ? 'NEXT' : 'LATER';
      const bgColor = isActive ? PANEL_ACTIVE_BG : isNext ? PANEL_NEXT_BG : PANEL_LATER_BG;
      const borderColor = isActive ? BORDER_ACTIVE : isNext ? BORDER_NEXT : BORDER_IDLE;
      row.backing.setFillStyle(bgColor, isActive ? 0.98 : 0.94);
      row.border.setStrokeStyle(isActive ? 3 : 2, borderColor, isActive ? 1 : 0.86);

      row.badgeText.setText(badge).setColor(isActive ? '#f8e6bd' : '#cfb58f');
      row.offsetText.setText(isActive ? '0' : `+${index + 1}`);
      row.teamMark.setText(unit.team === 'player' ? '▲' : '◆').setColor(unit.team === 'player' ? '#a7d0ff' : '#f0b2b2');

      row.avatar
        .setVisible(true)
        .setTexture(unit.spriteKey)
        .setAlpha(isActive ? 1 : isNext ? 0.95 : 0.85)
        .setTint(unit.team === 'player' ? PLAYER_TINT : ENEMY_TINT);

      this.applyFaceCrop(row.avatar);
      const previousIndex = previousRowByUnitId.get(unit.id);
      this.animateRowToLayout(row, index, previousIndex);
      this.animateEntryTransition(row, previousIndex);
      this.animateStateTransition(row, isActive, activeUnitId);
      this.applyRowInteractionState(row, false, false);
    }

    this.previousActiveUnitId = activeUnitId;
  }

  private animateRowToLayout(row: TurnOrderRow, targetIndex: number, previousIndex?: number): void {
    const target = this.rowLayouts[targetIndex];
    if (!target) {
      return;
    }

    const reducedMotion = this.prefersReducedMotion();
    const duration = reducedMotion ? 1 : 170;
    const delay = reducedMotion ? 0 : Math.min(60, targetIndex * 12);

    if (previousIndex !== undefined && previousIndex !== targetIndex) {
      const previous = this.rowLayouts[previousIndex];
      if (previous) {
        row.backing.setPosition(target.backingX, previous.backingY);
        row.border.setPosition(target.borderX, previous.borderY);
        row.avatar.setPosition(target.avatarX, previous.avatarY);
        row.teamMark.setPosition(target.teamMarkX, previous.teamMarkY);
        row.badgeText.setPosition(target.badgeX, previous.badgeY);
        row.offsetText.setPosition(target.offsetX, previous.offsetY);
      }
    }

    const targets = [
      { object: row.backing, y: target.backingY },
      { object: row.border, y: target.borderY },
      { object: row.avatar, y: target.avatarY },
      { object: row.teamMark, y: target.teamMarkY },
      { object: row.badgeText, y: target.badgeY },
      { object: row.offsetText, y: target.offsetY }
    ];

    for (const targetEntry of targets) {
      this.scene.tweens.killTweensOf(targetEntry.object);
      this.scene.tweens.add({
        targets: targetEntry.object,
        y: targetEntry.y,
        duration,
        delay,
        ease: 'Sine.easeOut'
      });
    }
  }

  private animateEntryTransition(row: TurnOrderRow, previousIndex: number | undefined): void {
    if (previousIndex !== undefined) {
      return;
    }

    const reducedMotion = this.prefersReducedMotion();
    const duration = reducedMotion ? 1 : 160;
    const targets = [row.backing, row.border, row.teamMark, row.badgeText, row.offsetText, row.avatar];

    for (const target of targets) {
      this.scene.tweens.killTweensOf(target);
    }

    const targetBackingAlpha = row.backing.alpha;
    const targetBorderAlpha = row.border.alpha;
    const targetTeamMarkAlpha = row.teamMark.alpha;
    const targetBadgeAlpha = row.badgeText.alpha;
    const targetOffsetAlpha = row.offsetText.alpha;
    const targetAvatarAlpha = row.avatar.alpha;

    row.backing.setAlpha(0);
    row.border.setAlpha(0);
    row.teamMark.setAlpha(0);
    row.badgeText.setAlpha(0);
    row.offsetText.setAlpha(0);
    row.avatar.setAlpha(0);

    this.scene.tweens.add({ targets: row.backing, alpha: targetBackingAlpha, duration, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: row.border, alpha: targetBorderAlpha, duration, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: row.teamMark, alpha: targetTeamMarkAlpha, duration, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: row.badgeText, alpha: targetBadgeAlpha, duration, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: row.offsetText, alpha: targetOffsetAlpha, duration, ease: 'Sine.easeOut' });
    this.scene.tweens.add({ targets: row.avatar, alpha: targetAvatarAlpha, duration, ease: 'Sine.easeOut' });
  }

  private animateStateTransition(row: TurnOrderRow, isActive: boolean, activeUnitId: string | null): void {
    const reducedMotion = this.prefersReducedMotion();
    const duration = reducedMotion ? 1 : 140;

    if (isActive && activeUnitId !== this.previousActiveUnitId) {
      this.scene.tweens.killTweensOf(row.border);
      this.scene.tweens.add({
        targets: row.border,
        alpha: { from: 0.65, to: 1 },
        duration,
        yoyo: !reducedMotion,
        ease: 'Sine.easeInOut'
      });
      return;
    }

    if (row.unitId && row.unitId === this.previousActiveUnitId && !isActive) {
      this.scene.tweens.killTweensOf(row.backing);
      this.scene.tweens.add({
        targets: row.backing,
        alpha: { from: 1, to: 0.94 },
        duration,
        ease: 'Sine.easeOut'
      });
    }
  }

  private applyRowInteractionState(row: TurnOrderRow, hovered: boolean, pressed: boolean): void {
    const tone = row.badgeText.text;
    const isActive = tone === 'NOW';
    const isNext = tone === 'NEXT';
    const isOverflow = tone === 'MORE';

    const baseBackingAlpha = isActive ? 0.98 : 0.94;
    const hoverBackingAlpha = isActive ? 1 : isNext ? 0.98 : isOverflow ? 0.97 : 0.96;
    const pressBackingAlpha = isActive ? 1 : 0.99;
    const baseBorderAlpha = isActive ? 1 : isNext ? 0.86 : 0.82;
    const hoverBorderAlpha = Math.min(1, baseBorderAlpha + (isOverflow ? 0.08 : 0.14));

    const baseBadgeColor = isActive ? '#f8e6bd' : isOverflow ? '#c9b18f' : '#cfb58f';
    const hoverBadgeColor = isActive ? '#fff4d9' : '#f6e4bd';
    const pressBadgeColor = '#fff0cc';

    row.backing.setAlpha(pressed ? pressBackingAlpha : hovered ? hoverBackingAlpha : baseBackingAlpha);
    row.border.setAlpha(hovered || pressed ? hoverBorderAlpha : baseBorderAlpha);
    row.badgeText.setColor(pressed ? pressBadgeColor : hovered ? hoverBadgeColor : baseBadgeColor);
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private applyVisibility(row: TurnOrderRow, visible: boolean): void {
    row.backing.setVisible(visible);
    row.border.setVisible(visible);
    row.avatar.setVisible(visible);
    row.teamMark.setVisible(visible);
    row.offsetText.setVisible(visible);
    row.badgeText.setVisible(visible);
  }

  private applyFaceCrop(avatar: Phaser.GameObjects.Image): void {
    const frame = avatar.frame;
    if (!frame) {
      avatar.setCrop();
      return;
    }

    const width = frame.width;
    const height = frame.height;
    const cropWidth = width * 0.5;
    const cropHeight = height * 0.4;
    const cropX = (width - cropWidth) / 2;
    const cropY = height * 0.03;

    avatar.setCrop(cropX, cropY, cropWidth, cropHeight);
  }

  getUnitIdAt(pointerX: number, pointerY: number): string | null {
    for (const row of this.rows) {
      if (!row.backing.visible) {
        continue;
      }

      if (row.backing.getBounds().contains(pointerX, pointerY) || row.avatar.getBounds().contains(pointerX, pointerY)) {
        return row.unitId;
      }
    }

    return null;
  }
}
