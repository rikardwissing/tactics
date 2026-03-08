import Phaser from 'phaser';
import { BattleUnit } from '../../core/types';

interface TurnOrderRow {
  backing: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  avatar: Phaser.GameObjects.Image;
  teamMark: Phaser.GameObjects.Text;
  offsetText: Phaser.GameObjects.Text;
  badgeText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  hpBarBack: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  unitId: string | null;
  visible: boolean;
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

const HP_GOOD = '#9dd6a0';
const HP_LOW = '#d8a273';
const HP_CRITICAL = '#d77f7a';

export class TurnOrderPanel {
  private readonly rows: TurnOrderRow[];
  private rowWidth = 124;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly maxEntries: number,
    private readonly origin: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0),
    private readonly onSelectUnit?: (unitId: string) => void
  ) {
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

      const nameText = scene.add.text(origin.x, origin.y, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#efe0bf'
      }).setOrigin(0, 0.5).setVisible(false);

      const hpText = scene.add.text(origin.x, origin.y, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#ccb792'
      }).setOrigin(0, 0.5).setVisible(false);

      const hpBarBack = scene.add.rectangle(origin.x, origin.y, 42, 4, 0x1c1116, 1).setOrigin(0, 0.5).setVisible(false);
      const hpBarFill = scene.add.rectangle(origin.x, origin.y, 42, 4, 0x8ebb84, 1).setOrigin(0, 0.5).setVisible(false);

      const row: TurnOrderRow = {
        backing,
        border,
        avatar,
        teamMark,
        offsetText,
        badgeText,
        nameText,
        hpText,
        hpBarBack,
        hpBarFill,
        unitId: null,
        visible: false
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

        row.backing.setAlpha(hovered ? 1 : 0.94);
        row.nameText.setColor(hovered ? '#fff0cc' : '#efe0bf');
      };

      row.backing
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onSelect)
        .on('pointerover', () => onHover(true))
        .on('pointerout', () => onHover(false));

      row.avatar
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onSelect)
        .on('pointerover', () => onHover(true))
        .on('pointerout', () => onHover(false));

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
      row.badgeText,
      row.nameText,
      row.hpText,
      row.hpBarBack,
      row.hpBarFill
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
    this.rowWidth = Math.max(180, config.avatarSize + 152);
    const rowHeight = config.avatarSize + 14;

    for (const [index, row] of this.rows.entries()) {
      const y = config.startY + index * config.gap;
      const leftX = config.x - (this.rowWidth - config.avatarSize);
      const textX = config.x - config.avatarSize - 8;

      row.backing
        .setPosition(leftX, y - 4)
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.border
        .setPosition(leftX, y - 4)
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.avatar
        .setPosition(config.x, y)
        .setDisplaySize(config.avatarSize, config.avatarSize);
      row.teamMark.setPosition(leftX + 12, y + config.avatarSize * 0.5);
      row.badgeText.setPosition(leftX + 23, y + 10);
      row.offsetText.setPosition(leftX + this.rowWidth - 6, y + 10);
      row.nameText.setPosition(textX, y + config.avatarSize * 0.42);
      row.hpText.setPosition(textX, y + config.avatarSize * 0.72);
      row.hpBarBack.setPosition(textX, y + config.avatarSize * 0.94);
      row.hpBarFill.setPosition(textX, y + config.avatarSize * 0.94);
    }
  }

  setQueue(units: BattleUnit[], activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    const activeIndex = units.findIndex((unit) => unit.id === activeUnitId);

    for (const [index, row] of this.rows.entries()) {
      const unit = units[index];
      row.visible = visiblePanel && index < visibleCount && !!unit;
      row.unitId = unit?.id ?? null;
      this.applyVisibility(row, row.visible);

      if (!unit) {
        continue;
      }

      const isActive = activeUnitId === unit.id;
      const nextIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
      const isNext = !isActive && index === nextIndex;
      const badge = isActive ? 'NOW' : isNext ? 'NEXT' : 'LATER';
      const bgColor = isActive ? PANEL_ACTIVE_BG : isNext ? PANEL_NEXT_BG : PANEL_LATER_BG;
      const borderColor = isActive ? BORDER_ACTIVE : isNext ? BORDER_NEXT : BORDER_IDLE;
      const hpRatio = Phaser.Math.Clamp(unit.hp / Math.max(1, unit.maxHp), 0, 1);
      const hpColor = hpRatio <= 0.3 ? HP_CRITICAL : hpRatio <= 0.6 ? HP_LOW : HP_GOOD;

      row.backing.setFillStyle(bgColor, isActive ? 0.98 : 0.94);
      row.border.setStrokeStyle(isActive ? 3 : 2, borderColor, isActive ? 1 : 0.86);

      row.badgeText.setText(badge).setColor(isActive ? '#f8e6bd' : '#cfb58f');
      row.offsetText.setText(isActive ? '0' : `+${index + 1}`);
      row.teamMark.setText(unit.team === 'player' ? '▲' : '◆').setColor(unit.team === 'player' ? '#a7d0ff' : '#f0b2b2');
      row.nameText.setText(this.truncateLabel(unit.name, 13));
      row.hpText.setText(`HP ${unit.hp}/${unit.maxHp}`).setColor(hpColor);
      row.hpBarFill.setFillStyle(Phaser.Display.Color.HexStringToColor(hpColor).color, 1);
      row.hpBarFill.setDisplaySize(42 * hpRatio, 4);

      row.avatar
        .setTexture(unit.spriteKey)
        .setAlpha(isActive ? 1 : isNext ? 0.95 : 0.85)
        .setTint(unit.team === 'player' ? PLAYER_TINT : ENEMY_TINT);

      this.applyFaceCrop(row.avatar);
    }
  }

  private applyVisibility(row: TurnOrderRow, visible: boolean): void {
    row.backing.setVisible(visible);
    row.border.setVisible(visible);
    row.avatar.setVisible(visible);
    row.teamMark.setVisible(visible);
    row.offsetText.setVisible(visible);
    row.badgeText.setVisible(visible);
    row.nameText.setVisible(visible);
    row.hpText.setVisible(visible);
    row.hpBarBack.setVisible(visible);
    row.hpBarFill.setVisible(visible);
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

  private truncateLabel(value: string, length: number): string {
    if (value.length <= length) {
      return value;
    }

    return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
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
