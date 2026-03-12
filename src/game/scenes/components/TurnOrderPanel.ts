import Phaser from 'phaser';
import { DEFAULT_UNIT_IMAGE_KEY, getUnitPortraitImageKey } from '../../assets';
import { BattleUnit } from '../../core/types';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_DANGER,
  UI_COLOR_PANEL_SHADOW,
  UI_COLOR_PANEL_SURFACE,
  UI_COLOR_PANEL_BORDER
} from './UiColors';

interface TurnOrderRow {
  backing: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Graphics;
  border: Phaser.GameObjects.Rectangle;
  avatar: Phaser.GameObjects.Image;
  avatarMaskShape: Phaser.GameObjects.Graphics;
  pulseTween?: Phaser.Tweens.Tween;
  moveTween?: Phaser.Tweens.Tween;
  enterTween?: Phaser.Tweens.Tween;
  exitTween?: Phaser.Tweens.Tween;
  accentTween?: Phaser.Tweens.Tween;
  avatarTextureKey: string | null;
  avatarRenderSize: number;
  avatarUsesCrop: boolean;
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

type TurnOrderOrientation = 'vertical' | 'horizontal';

interface TurnOrderLayoutConfig {
  x: number;
  startY: number;
  gap: number;
  avatarSize: number;
  orientation: TurnOrderOrientation;
  reverse: boolean;
}

interface TurnOrderEntry {
  unitId: string | null;
  spriteKey: string | null;
  team: BattleUnit['team'] | null;
  visible: boolean;
  isCurrentTurn: boolean;
}

const MOVE_DURATION = 180;
const ENTER_DURATION = 160;
const EXIT_DURATION = 150;
const REFRESH_DURATION = 140;
const ACCENT_DURATION = 120;
const STAGGER_DELAY = 12;
const TRANSITION_OFFSET_FACTOR = 0.55;
const TOP_ENTRY_ALPHA = 0.3;

type TransitionTweenKey = 'moveTween' | 'enterTween' | 'exitTween' | 'accentTween';

export class TurnOrderPanel {
  private rows: TurnOrderRow[];
  private readonly rowLayouts: RowLayout[];
  private rowWidth = 40;
  private avatarSize = 40;
  private displayedEntries: TurnOrderEntry[];
  private displayedVisibleCount = 0;
  private displayedPanelVisible = false;
  private displayedActiveUnitId: string | null = null;
  private hasDisplayedQueue = false;
  private layoutDirty = true;
  private enterTimer?: Phaser.Time.TimerEvent;
  private finalizeTimer?: Phaser.Time.TimerEvent;
  private isTransitioning = false;
  private orientation: TurnOrderOrientation = 'vertical';
  private reverse = false;
  private layoutConfig: TurnOrderLayoutConfig | null = null;

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
      avatarY: origin.y
    }));

    this.rows = Array.from({ length: maxEntries }, () => {
      const backing = scene.add
        .rectangle(origin.x, origin.y, this.rowWidth, 40, UI_COLOR_PANEL_SURFACE, 0.92)
        .setOrigin(0, 0)
        .setVisible(false)
        .setStrokeStyle(1, UI_COLOR_PANEL_BORDER, 0.9);

      const border = scene.add
        .rectangle(origin.x, origin.y, this.rowWidth, 40, 0x000000, 0)
        .setOrigin(0, 0)
        .setVisible(false)
        .setStrokeStyle(2, UI_COLOR_PANEL_BORDER, 0.82);

      const glow = scene.add
        .graphics()
        .setPosition(origin.x, origin.y)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD);

      const avatar = scene.add
        .image(origin.x, origin.y, DEFAULT_UNIT_IMAGE_KEY)
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
        moveTween: undefined,
        enterTween: undefined,
        exitTween: undefined,
        accentTween: undefined,
        avatarTextureKey: null,
        avatarRenderSize: 0,
        avatarUsesCrop: false,
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

      row.backing
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onSelect();
        });

      row.avatar
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onSelect();
        });

      return row;
    });

    this.displayedEntries = Array.from({ length: maxEntries }, () => this.createHiddenEntry());
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
    if (!visible && this.isTransitioning) {
      this.finishTransitionsToDisplayedState();
    }

    for (const row of this.rows) {
      this.applyVisibility(row, visible && row.visible);
    }
  }

  setLayout(config: {
    x: number;
    startY: number;
    gap: number;
    avatarSize: number;
    orientation?: TurnOrderOrientation;
    reverse?: boolean;
  }): void {
    const nextLayout: TurnOrderLayoutConfig = {
      x: config.x,
      startY: config.startY,
      gap: config.gap,
      avatarSize: config.avatarSize,
      orientation: config.orientation ?? 'vertical',
      reverse: config.reverse ?? false
    };
    if (
      this.layoutConfig &&
      this.layoutConfig.x === nextLayout.x &&
      this.layoutConfig.startY === nextLayout.startY &&
      this.layoutConfig.gap === nextLayout.gap &&
      this.layoutConfig.avatarSize === nextLayout.avatarSize &&
      this.layoutConfig.orientation === nextLayout.orientation &&
      this.layoutConfig.reverse === nextLayout.reverse
    ) {
      return;
    }

    this.layoutConfig = nextLayout;
    this.rowWidth = nextLayout.avatarSize;
    this.avatarSize = nextLayout.avatarSize;
    const rowHeight = nextLayout.avatarSize;
    this.orientation = nextLayout.orientation;
    this.reverse = nextLayout.reverse;

    for (const [index, row] of this.rows.entries()) {
      const visualIndex = this.reverse ? this.maxEntries - 1 - index : index;
      const leftX =
        this.orientation === 'horizontal'
          ? nextLayout.x + visualIndex * nextLayout.gap
          : nextLayout.x;
      const y =
        this.orientation === 'horizontal'
          ? nextLayout.startY
          : nextLayout.startY + visualIndex * nextLayout.gap;

      row.backing
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      row.border
        .setSize(this.rowWidth, rowHeight)
        .setDisplaySize(this.rowWidth, rowHeight);
      this.updateAvatarMask(row, leftX, y, nextLayout.avatarSize);

      const avatarHitArea = row.avatar.input?.hitArea;
      if (avatarHitArea instanceof Phaser.Geom.Rectangle) {
        avatarHitArea.setTo(0, 0, nextLayout.avatarSize, nextLayout.avatarSize);
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
        if (row.avatarUsesCrop) {
          this.applyFaceCrop(row);
        } else {
          this.applyPortraitFit(row);
        }
      }
    }

    this.layoutDirty = true;
    this.finishTransitionsToDisplayedState();
  }

  setQueue(units: BattleUnit[], activeUnitId: string | null, visibleCount: number, visiblePanel: boolean): void {
    const previousEntries = this.displayedEntries.map((entry) => ({ ...entry }));
    const previousVisibleCount = this.displayedVisibleCount;
    const previousPanelVisible = this.displayedPanelVisible;
    const previousActiveUnitId = this.displayedActiveUnitId;
    const nextEntries = this.buildEntries(units, activeUnitId, visibleCount, visiblePanel);

    if (this.isTransitioning) {
      const matchesTransitionTarget =
        previousVisibleCount === visibleCount &&
        previousPanelVisible === visiblePanel &&
        previousActiveUnitId === activeUnitId &&
        this.entriesMatchQueue(previousEntries, nextEntries) &&
        this.entriesMatchState(previousEntries, nextEntries);
      if (matchesTransitionTarget) {
        return;
      }

      this.finishTransitionsToDisplayedState();
    }

    const hasSameQueue =
      this.hasDisplayedQueue &&
      previousVisibleCount === visibleCount &&
      previousPanelVisible === visiblePanel &&
      this.entriesMatchQueue(previousEntries, nextEntries);
    const hasSameState =
      hasSameQueue &&
      previousActiveUnitId === activeUnitId &&
      this.entriesMatchState(previousEntries, nextEntries);
    const shouldSnap =
      !this.hasDisplayedQueue ||
      this.layoutDirty ||
      previousVisibleCount !== visibleCount ||
      previousPanelVisible !== visiblePanel ||
      !visiblePanel;
    const shouldAdvance =
      !shouldSnap &&
      !hasSameQueue &&
      this.isStandardAdvance(previousEntries, nextEntries, visibleCount);
    const shouldRefresh = !shouldSnap && !hasSameQueue;
    const shouldAccent =
      hasSameQueue &&
      !hasSameState &&
      nextEntries[0]?.visible === true &&
      nextEntries[0].unitId !== null &&
      nextEntries[0].unitId === activeUnitId;

    this.displayedEntries = nextEntries.map((entry) => ({ ...entry }));
    this.displayedVisibleCount = visibleCount;
    this.displayedPanelVisible = visiblePanel;
    this.displayedActiveUnitId = activeUnitId;
    this.hasDisplayedQueue = true;
    this.layoutDirty = false;

    if (shouldSnap) {
      this.applyEntriesToRows(nextEntries, visibleCount, visiblePanel);
      return;
    }

    if (shouldAdvance) {
      this.animateAdvance(nextEntries, visibleCount, visiblePanel);
      return;
    }

    if (shouldRefresh) {
      this.animateRefresh(previousEntries, nextEntries, visibleCount, visiblePanel);
      return;
    }

    this.applyEntriesToRows(nextEntries, visibleCount, visiblePanel);
    if (shouldAccent) {
      this.playNowAccent(this.rows[0]);
    }
  }

  private applyRowInteractionState(row: TurnOrderRow, hovered: boolean): void {
    if (!row.unitId || !row.team) {
      row.backing.setAlpha(1);
      row.glow.setAlpha(0).setVisible(false);
      row.border.setAlpha(1);
      return;
    }

    const borderColor = row.team === 'player' ? UI_COLOR_ACCENT_COOL : UI_COLOR_DANGER;
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

  private applyPortraitFit(row: TurnOrderRow): void {
    const avatar = row.avatar;
    const frame = avatar.frame;
    if (!frame) {
      avatar.setCrop();
      avatar.setDisplayOrigin(0, 0);
      avatar.setScale(1);
      row.avatarRenderSize = 0;
      return;
    }

    avatar.setCrop();
    avatar.setDisplayOrigin(0, 0);
    avatar.setScale(this.avatarSize / Math.max(1, frame.width));
    row.avatarRenderSize = this.avatarSize;
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
      this.clearTween(row, 'pulseTween');
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

    this.setRowPosition(row, target.avatarX, target.avatarY);
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

  private createHiddenEntry(): TurnOrderEntry {
    return {
      unitId: null,
      spriteKey: null,
      team: null,
      visible: false,
      isCurrentTurn: false
    };
  }

  private buildEntries(
    units: BattleUnit[],
    activeUnitId: string | null,
    visibleCount: number,
    visiblePanel: boolean
  ): TurnOrderEntry[] {
    return Array.from({ length: this.maxEntries }, (_, index) => {
      const unit = units[index];
      const visible = visiblePanel && index < visibleCount;

      return {
        unitId: unit?.id ?? null,
        spriteKey: unit?.spriteKey ?? null,
        team: unit?.team ?? null,
        visible,
        isCurrentTurn: visible && index === 0 && unit?.id === activeUnitId
      };
    });
  }

  private entriesMatchQueue(left: TurnOrderEntry[], right: TurnOrderEntry[]): boolean {
    for (let index = 0; index < this.maxEntries; index += 1) {
      const leftEntry = left[index] ?? this.createHiddenEntry();
      const rightEntry = right[index] ?? this.createHiddenEntry();
      if (
        leftEntry.visible !== rightEntry.visible ||
        leftEntry.unitId !== rightEntry.unitId ||
        leftEntry.spriteKey !== rightEntry.spriteKey ||
        leftEntry.team !== rightEntry.team
      ) {
        return false;
      }
    }

    return true;
  }

  private entriesMatchState(left: TurnOrderEntry[], right: TurnOrderEntry[]): boolean {
    for (let index = 0; index < this.maxEntries; index += 1) {
      if ((left[index]?.isCurrentTurn ?? false) !== (right[index]?.isCurrentTurn ?? false)) {
        return false;
      }
    }

    return true;
  }

  private isStandardAdvance(previous: TurnOrderEntry[], next: TurnOrderEntry[], visibleCount: number): boolean {
    if (visibleCount <= 1) {
      return false;
    }

    for (let index = 0; index < visibleCount - 1; index += 1) {
      const previousEntry = previous[index + 1] ?? this.createHiddenEntry();
      const nextEntry = next[index] ?? this.createHiddenEntry();
      if (
        previousEntry.visible !== nextEntry.visible ||
        previousEntry.unitId !== nextEntry.unitId ||
        previousEntry.spriteKey !== nextEntry.spriteKey ||
        previousEntry.team !== nextEntry.team
      ) {
        return false;
      }
    }

    return true;
  }

  private applyEntriesToRows(entries: TurnOrderEntry[], visibleCount: number, visiblePanel: boolean): void {
    for (let index = 0; index < this.maxEntries; index += 1) {
      const row = this.rows[index];
      const entry = entries[index] ?? this.createHiddenEntry();
      this.configureRow(row, entry, visiblePanel && index < visibleCount);
      this.applyRowLayout(row, index);
    }
  }

  private configureRow(row: TurnOrderRow, entry: TurnOrderEntry, forceVisible = entry.visible): void {
    row.visible = forceVisible;
    row.unitId = entry.unitId;
    row.team = entry.team;
    row.isCurrentTurn = entry.isCurrentTurn;
    this.clearTween(row, 'moveTween');
    this.clearTween(row, 'enterTween');
    this.clearTween(row, 'exitTween');
    this.applyTransitionAlpha(row, 1);
    this.applyVisibility(row, row.visible);

    if (!row.visible) {
      row.avatarTextureKey = null;
      row.avatarRenderSize = 0;
      row.avatarUsesCrop = false;
      row.avatar.setVisible(false).clearTint().setAlpha(0);
      row.glow.clear().setVisible(false);
      return;
    }

    if (!entry.unitId || !entry.spriteKey) {
      row.backing.setFillStyle(UI_COLOR_PANEL_SHADOW, 0.68);
      row.border.setStrokeStyle(1, UI_COLOR_PANEL_BORDER, 0.62);
      row.glow.clear().setVisible(false);
      row.avatarTextureKey = null;
      row.avatarRenderSize = 0;
      row.avatarUsesCrop = false;
      row.avatar.setVisible(false).clearTint().setAlpha(0);
      this.applyRowInteractionState(row, false);
      return;
    }

    const borderColor = entry.team === 'player' ? UI_COLOR_ACCENT_COOL : UI_COLOR_DANGER;
    const portraitTextureKey = getUnitPortraitImageKey(entry.spriteKey);
    const avatarTextureKey = portraitTextureKey ?? entry.spriteKey;
    const avatarUsesCrop = portraitTextureKey === null;
    const needsAvatarRefresh =
      row.avatarTextureKey !== avatarTextureKey ||
      row.avatarRenderSize !== this.avatarSize ||
      row.avatarUsesCrop !== avatarUsesCrop;

    row.backing.setFillStyle(UI_COLOR_PANEL_SURFACE, entry.isCurrentTurn ? 0.95 : 0.9);
    row.border.setStrokeStyle(entry.isCurrentTurn ? 3 : 2, borderColor, entry.isCurrentTurn ? 1 : 0.92);
    row.avatar
      .setVisible(true)
      .clearTint()
      .setAlpha(entry.isCurrentTurn ? 1 : 0.95);

    if (needsAvatarRefresh) {
      row.avatar.setTexture(avatarTextureKey);
      row.avatarTextureKey = avatarTextureKey;
      row.avatarUsesCrop = avatarUsesCrop;
      if (avatarUsesCrop) {
        this.applyFaceCrop(row);
      } else {
        this.applyPortraitFit(row);
      }
    }

    this.applyRowInteractionState(row, false);
  }

  private animateAdvance(entries: TurnOrderEntry[], visibleCount: number, visiblePanel: boolean): void {
    if (!visiblePanel || visibleCount <= 1) {
      this.applyEntriesToRows(entries, visibleCount, visiblePanel);
      return;
    }

    this.isTransitioning = true;

    const exitingRow = this.rows[0];
    const shiftedRows = this.rows.slice(1, visibleCount);
    const hiddenRows = this.rows.slice(visibleCount);
    this.rows = [...shiftedRows, exitingRow, ...hiddenRows];
    const transitionOffset = this.getTransitionOffset();

    for (let index = 0; index < visibleCount - 1; index += 1) {
      const row = this.rows[index];
      const entry = entries[index];
      this.configureRow(row, entry, true);
      this.tweenRowState(row, 'moveTween', {
        index,
        toX: this.rowLayouts[index].avatarX,
        toY: this.rowLayouts[index].avatarY,
        duration: MOVE_DURATION,
        delay: index * STAGGER_DELAY,
        ease: 'Cubic.easeInOut'
      });
    }

    this.clearTween(exitingRow, 'pulseTween');
    this.clearTween(exitingRow, 'accentTween');
    this.tweenRowState(exitingRow, 'exitTween', {
      index: 0,
      toX: this.rowLayouts[0].avatarX + transitionOffset.exitX,
      toY: this.rowLayouts[0].avatarY + transitionOffset.exitY,
      toAlpha: 0,
      duration: EXIT_DURATION,
      ease: 'Cubic.easeIn'
    });

    const enteringEntry = entries[visibleCount - 1] ?? this.createHiddenEntry();
    const topIndex = visibleCount - 1;
    const topLayout = this.rowLayouts[topIndex];

    this.enterTimer = this.scene.time.delayedCall(EXIT_DURATION, () => {
      this.configureRow(exitingRow, enteringEntry, visiblePanel && topIndex < visibleCount);
      this.setRowPosition(
        exitingRow,
        topLayout.avatarX + transitionOffset.enterX,
        topLayout.avatarY + transitionOffset.enterY
      );
      this.applyTransitionAlpha(exitingRow, TOP_ENTRY_ALPHA);
      this.tweenRowState(exitingRow, 'enterTween', {
        index: topIndex,
        fromX: topLayout.avatarX + transitionOffset.enterX,
        toX: topLayout.avatarX,
        fromY: topLayout.avatarY + transitionOffset.enterY,
        toY: topLayout.avatarY,
        fromAlpha: TOP_ENTRY_ALPHA,
        toAlpha: 1,
        duration: ENTER_DURATION,
        ease: 'Cubic.easeOut'
      });
    });

    const totalDuration = Math.max(
      EXIT_DURATION + ENTER_DURATION,
      MOVE_DURATION + Math.max(0, visibleCount - 2) * STAGGER_DELAY
    );
    this.scheduleTransitionFinalize(totalDuration + 24, () => {
      this.applyEntriesToRows(entries, visibleCount, visiblePanel);
      if (entries[0]?.isCurrentTurn) {
        this.playNowAccent(this.rows[0]);
      }
    });
  }

  private animateRefresh(
    previousEntries: TurnOrderEntry[],
    entries: TurnOrderEntry[],
    visibleCount: number,
    visiblePanel: boolean
  ): void {
    this.isTransitioning = true;
    const transitionOffset = this.getTransitionOffset();

    for (let index = 0; index < this.maxEntries; index += 1) {
      const row = this.rows[index];
      const previousEntry = previousEntries[index] ?? this.createHiddenEntry();
      const entry = entries[index] ?? this.createHiddenEntry();
      const shouldShow = visiblePanel && index < visibleCount;

      if (!shouldShow) {
        if (previousEntry.visible) {
          this.tweenRowState(row, 'exitTween', {
            index,
            toX: this.rowLayouts[index].avatarX + transitionOffset.exitX * 0.48,
            toY: this.rowLayouts[index].avatarY + transitionOffset.exitY * 0.48,
            toAlpha: 0,
            duration: REFRESH_DURATION,
            delay: index * 8,
            ease: 'Quad.easeIn'
          });
        }
        continue;
      }

      const changed =
        previousEntry.unitId !== entry.unitId ||
        previousEntry.spriteKey !== entry.spriteKey ||
        previousEntry.team !== entry.team ||
        previousEntry.visible !== entry.visible;

      this.configureRow(row, entry, true);
      this.applyRowLayout(row, index);

      if (changed) {
        this.applyTransitionAlpha(row, 0);
        this.tweenRowState(row, 'enterTween', {
          index,
          toX: this.rowLayouts[index].avatarX,
          toY: this.rowLayouts[index].avatarY,
          toAlpha: 1,
          duration: REFRESH_DURATION,
          delay: index * 8,
          ease: 'Quad.easeOut'
        });
      }
    }

    this.scheduleTransitionFinalize(REFRESH_DURATION + Math.max(0, visibleCount - 1) * 8 + 20, () => {
      this.applyEntriesToRows(entries, visibleCount, visiblePanel);
      if (entries[0]?.isCurrentTurn) {
        this.playNowAccent(this.rows[0]);
      }
    });
  }

  private playNowAccent(row: TurnOrderRow): void {
    if (!row.visible || !row.unitId || !row.isCurrentTurn) {
      return;
    }

    this.clearTween(row, 'pulseTween');
    this.clearTween(row, 'accentTween');
    row.glow.setVisible(true);
    row.accentTween = this.scene.tweens.add({
      targets: [row.backing, row.border, row.avatar, row.glow],
      alpha: { from: 1, to: 0.65 },
      duration: ACCENT_DURATION,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onComplete: () => {
        row.accentTween = undefined;
        this.applyRowInteractionState(row, false);
        this.syncPulse(row);
      }
    });
  }

  private tweenRowState(
    row: TurnOrderRow,
    tweenKey: Exclude<TransitionTweenKey, 'accentTween'>,
    config: {
      index: number;
      fromX?: number;
      toX: number;
      fromY?: number;
      toY: number;
      fromAlpha?: number;
      toAlpha?: number;
      duration: number;
      delay?: number;
      ease: string;
    }
  ): void {
    const state = {
      x: config.fromX ?? row.avatar.x,
      y: config.fromY ?? row.avatar.y,
      alpha: config.fromAlpha ?? 1
    };

    this.setRowPosition(row, state.x, state.y);
    this.applyTransitionAlpha(row, state.alpha);
    this.clearTween(row, tweenKey);
    row[tweenKey] = this.scene.tweens.add({
      targets: state,
      x: config.toX,
      y: config.toY,
      alpha: config.toAlpha ?? 1,
      duration: config.duration,
      delay: config.delay ?? 0,
      ease: config.ease,
      onUpdate: () => {
        this.setRowPosition(row, state.x, state.y);
        this.applyTransitionAlpha(row, state.alpha);
      },
      onComplete: () => {
        row[tweenKey] = undefined;
      }
    });
  }

  private scheduleTransitionFinalize(delay: number, onComplete: () => void): void {
    this.finalizeTimer?.remove(false);
    this.finalizeTimer = this.scene.time.delayedCall(delay, () => {
      this.finalizeTimer = undefined;
      this.isTransitioning = false;
      onComplete();
    });
  }

  private finishTransitionsToDisplayedState(): void {
    this.stopTransitionTweens();
    if (this.hasDisplayedQueue) {
      this.applyEntriesToRows(this.displayedEntries, this.displayedVisibleCount, this.displayedPanelVisible);
    }
    this.isTransitioning = false;
  }

  private stopTransitionTweens(): void {
    this.enterTimer?.remove(false);
    this.enterTimer = undefined;
    this.finalizeTimer?.remove(false);
    this.finalizeTimer = undefined;
    for (const row of this.rows) {
      this.clearTween(row, 'moveTween');
      this.clearTween(row, 'enterTween');
      this.clearTween(row, 'exitTween');
      this.clearTween(row, 'accentTween');
    }
  }

  private clearTween(row: TurnOrderRow, key: TransitionTweenKey | 'pulseTween'): void {
    row[key]?.stop();
    row[key]?.remove();
    row[key] = undefined;
  }

  private getTransitionOffset(): {
    exitX: number;
    exitY: number;
    enterX: number;
    enterY: number;
  } {
    const distance = Math.round(this.avatarSize * TRANSITION_OFFSET_FACTOR);

    if (this.orientation === 'horizontal') {
      return this.reverse
        ? { exitX: distance, exitY: 0, enterX: -distance, enterY: 0 }
        : { exitX: -distance, exitY: 0, enterX: distance, enterY: 0 };
    }

    return this.reverse
      ? { exitX: 0, exitY: distance, enterX: 0, enterY: -distance }
      : { exitX: 0, exitY: -distance, enterX: 0, enterY: distance };
  }

  private setRowPosition(row: TurnOrderRow, x: number, y: number): void {
    row.backing.setPosition(x, y);
    row.glow.setPosition(x, y);
    row.border.setPosition(x, y);
    row.avatar.setPosition(x, y);
    row.avatarMaskShape.setPosition(x, y);
  }

  private applyTransitionAlpha(row: TurnOrderRow, alpha: number): void {
    row.backing.setAlpha(alpha);
    row.border.setAlpha(alpha);
    row.avatar.setAlpha(alpha);
    row.glow.setAlpha(alpha);
  }
}
