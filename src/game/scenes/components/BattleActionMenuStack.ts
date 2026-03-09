import Phaser from 'phaser';

export interface ActionMenuEntryDescriptor {
  id: string;
  label: string;
  enabled: boolean;
  active?: boolean;
}

export interface ActionMenuPanelDescriptor {
  id: string;
  kind: 'list' | 'detail';
  title: string;
  entries?: ActionMenuEntryDescriptor[];
  body?: string;
  width?: number;
  blocksWorldInput?: boolean;
  accentColor?: number;
}

export interface ActionMenuStackLayout {
  rootX: number;
  bottom: number;
  rootWidth: number;
  panelHeight: number;
  panelWidths: {
    list: number;
    detail: number;
  };
  overlap?: number;
  gap?: number;
  slideDistance?: number;
}

export interface ActionMenuStackTypography {
  titleFontSize: number;
  entryFontSize: number;
  bodyFontSize: number;
  rowHeight: number;
}

export interface ActionMenuHitResult {
  panelId: string;
  blocksWorldInput: boolean;
  entryId?: string;
}

interface PanelState {
  descriptor: ActionMenuPanelDescriptor | null;
  targetBounds: Phaser.Geom.Rectangle;
  displayX: number;
  alpha: number;
  targetX: number;
  targetAlpha: number;
  order: number;
  targetActive: boolean;
  titleText: Phaser.GameObjects.Text;
  bodyText: Phaser.GameObjects.Text;
  entryTexts: Phaser.GameObjects.Text[];
  tween?: Phaser.Tweens.Tween;
}

interface StackObjectOptions {
  onCreateObject?: (object: Phaser.GameObjects.GameObject) => void;
}

const BASE_DEPTH = 900;
const SHADOW_COLOR = 0x040203;
const PANEL_OUTER_COLOR = 0x0b1018;
const PANEL_INNER_COLOR = 0x17131d;
const PANEL_STROKE = 0xd5ba7a;
const ROOT_ACCENT = 0x6d5430;
const CHILD_ACCENT = 0x345168;

export class BattleActionMenuStack {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly panelStates = new Map<string, PanelState>();
  private layout: ActionMenuStackLayout = {
    rootX: 0,
    bottom: 0,
    rootWidth: 186,
    panelHeight: 188,
    panelWidths: {
      list: 286,
      detail: 228
    },
    overlap: 22,
    gap: 12,
    slideDistance: 26
  };
  private typography: ActionMenuStackTypography = {
    titleFontSize: 20,
    entryFontSize: 14,
    bodyFontSize: 12,
    rowHeight: 28
  };
  private descriptors: ActionMenuPanelDescriptor[] = [];
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: StackObjectOptions = {}
  ) {
    this.graphics = scene.add.graphics().setDepth(BASE_DEPTH).setScrollFactor(0);
    this.options.onCreateObject?.(this.graphics);
  }

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [
      this.graphics,
      ...Array.from(this.panelStates.values()).flatMap((state) => [
        state.titleText,
        state.bodyText,
        ...state.entryTexts
      ])
    ];
  }

  setLayout(layout: ActionMenuStackLayout): void {
    this.layout = {
      ...this.layout,
      ...layout,
      panelWidths: {
        ...this.layout.panelWidths,
        ...layout.panelWidths
      }
    };
    this.syncPanels();
  }

  setTypography(typography: ActionMenuStackTypography): void {
    this.typography = typography;
    this.syncPanels();
  }

  setPanels(descriptors: ActionMenuPanelDescriptor[]): void {
    this.descriptors = descriptors;
    this.syncPanels();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.syncPanels();
  }

  draw(): void {
    this.redraw();
  }

  layoutText(): void {
    this.redraw();
  }

  hitTest(x: number, y: number): ActionMenuHitResult | null {
    const states = this.getRenderableStates().sort((left, right) => {
      if (left.order === right.order) {
        return Number(left.targetActive) - Number(right.targetActive);
      }

      return left.order - right.order;
    });

    for (const state of [...states].reverse()) {
      const descriptor = state.descriptor;
      if (!descriptor || state.alpha <= 0.01) {
        continue;
      }

      const bounds = this.getDisplayedBounds(state);
      if (!bounds.contains(x, y)) {
        continue;
      }

      if (descriptor.kind === 'list') {
        const entries = descriptor.entries ?? [];
        for (const [index, entry] of entries.entries()) {
          if (this.getEntryBounds(bounds, index).contains(x, y)) {
            return {
              panelId: descriptor.id,
              entryId: entry.id,
              blocksWorldInput: descriptor.blocksWorldInput ?? true
            };
          }
        }
      }

      return {
        panelId: descriptor.id,
        blocksWorldInput: descriptor.blocksWorldInput ?? true
      };
    }

    return null;
  }

  containsPoint(x: number, y: number): boolean {
    return this.hitTest(x, y) !== null;
  }

  getRootTop(): number {
    return this.layout.bottom - this.layout.panelHeight;
  }

  destroy(): void {
    for (const state of this.panelStates.values()) {
      state.tween?.stop();
      state.titleText.destroy();
      state.bodyText.destroy();
      for (const text of state.entryTexts) {
        text.destroy();
      }
    }

    this.panelStates.clear();
    this.graphics.destroy();
  }

  private syncPanels(): void {
    const descriptors = this.visible ? this.descriptors : [];
    const targetBounds = this.getTargetBounds(descriptors);
    const activeIds = new Set(descriptors.map((descriptor) => descriptor.id));

    for (const [order, descriptor] of descriptors.entries()) {
      const state = this.ensurePanelState(descriptor.id);
      const bounds = targetBounds.get(descriptor.id);

      if (!bounds) {
        continue;
      }

      state.descriptor = descriptor;
      state.targetBounds = bounds;
      state.order = order;
      state.targetActive = true;
      this.ensureEntryTexts(state, descriptor.entries?.length ?? 0);
      this.animatePanel(state, bounds.x, 1);
    }

    for (const [panelId, state] of this.panelStates.entries()) {
      if (activeIds.has(panelId)) {
        continue;
      }

      state.targetActive = false;
      const closedX = state.targetBounds.x - (this.layout.slideDistance ?? 26);
      this.animatePanel(state, closedX, 0);
    }

    this.redraw();
  }

  private getTargetBounds(descriptors: ActionMenuPanelDescriptor[]): Map<string, Phaser.Geom.Rectangle> {
    const boundsById = new Map<string, Phaser.Geom.Rectangle>();
    const rootY = this.layout.bottom - this.layout.panelHeight;
    const overlap = this.layout.overlap ?? 22;

    let previousBounds: Phaser.Geom.Rectangle | null = null;

    for (const [index, descriptor] of descriptors.entries()) {
      const width: number =
        descriptor.width ??
        (index === 0
          ? this.layout.rootWidth
          : descriptor.kind === 'list'
            ? this.layout.panelWidths.list
            : this.layout.panelWidths.detail);
      const x: number =
        previousBounds === null
          ? this.layout.rootX
          : previousBounds.right - overlap;
      const bounds: Phaser.Geom.Rectangle = new Phaser.Geom.Rectangle(x, rootY, width, this.layout.panelHeight);

      boundsById.set(descriptor.id, bounds);
      previousBounds = bounds;
    }

    return boundsById;
  }

  private ensurePanelState(panelId: string): PanelState {
    const existing = this.panelStates.get(panelId);
    if (existing) {
      return existing;
    }

    const state: PanelState = {
      descriptor: null,
      targetBounds: new Phaser.Geom.Rectangle(this.layout.rootX, this.getRootTop(), this.layout.rootWidth, this.layout.panelHeight),
      displayX: this.layout.rootX - (this.layout.slideDistance ?? 26),
      alpha: 0,
      targetX: this.layout.rootX - (this.layout.slideDistance ?? 26),
      targetAlpha: 0,
      order: this.panelStates.size,
      targetActive: false,
      titleText: this.createText({
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#fff3da'
      }),
      bodyText: this.createText({
        fontSize: '12px',
        color: '#d9c7a8',
        lineSpacing: 4
      }),
      entryTexts: []
    };

    this.panelStates.set(panelId, state);
    return state;
  }

  private ensureEntryTexts(state: PanelState, targetCount: number): void {
    while (state.entryTexts.length < targetCount) {
      state.entryTexts.push(
        this.createText({
          fontSize: '14px',
          color: '#f5e9cf'
        })
      );
    }
  }

  private createText(style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const text = this.scene.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      ...style
    });

    text.setScrollFactor(0).setDepth(BASE_DEPTH + 1).setVisible(false);
    this.options.onCreateObject?.(text);
    return text;
  }

  private animatePanel(state: PanelState, targetX: number, targetAlpha: number): void {
    if (
      state.tween &&
      Math.abs(state.targetX - targetX) <= 0.01 &&
      Math.abs(state.targetAlpha - targetAlpha) <= 0.01
    ) {
      return;
    }

    const isOpening = targetAlpha > state.alpha;
    const duration = isOpening ? 180 : 120;
    const ease = isOpening ? 'Cubic.easeOut' : 'Quad.easeIn';

    if (targetAlpha > 0 && state.alpha <= 0.01) {
      state.displayX = targetX - (this.layout.slideDistance ?? 26);
    }

    const xDelta = Math.abs(state.displayX - targetX);
    const alphaDelta = Math.abs(state.alpha - targetAlpha);

    state.targetX = targetX;
    state.targetAlpha = targetAlpha;
    state.tween?.stop();

    if (xDelta <= 0.01 && alphaDelta <= 0.01) {
      state.displayX = targetX;
      state.alpha = targetAlpha;
      this.redraw();
      return;
    }

    state.tween = this.scene.tweens.add({
      targets: state,
      displayX: targetX,
      alpha: targetAlpha,
      duration,
      ease,
      onUpdate: () => this.redraw(),
      onComplete: () => {
        state.tween = undefined;
        if (targetAlpha <= 0.01) {
          state.alpha = 0;
        }
        this.redraw();
      }
    });
  }

  private getRenderableStates(): PanelState[] {
    return Array.from(this.panelStates.values()).filter((state) => state.descriptor && state.alpha > 0.01);
  }

  private redraw(): void {
    this.graphics.clear();

    const states = Array.from(this.panelStates.values()).filter((state) => state.descriptor).sort((left, right) => {
      if (left.order === right.order) {
        return Number(left.targetActive) - Number(right.targetActive);
      }

      return left.order - right.order;
    });

    for (const state of states) {
      const descriptor = state.descriptor;
      if (!descriptor) {
        continue;
      }

      const bounds = this.getDisplayedBounds(state);
      const visible = state.alpha > 0.01;
      const accentColor =
        descriptor.accentColor ?? (state.order === 0 ? ROOT_ACCENT : CHILD_ACCENT);

      if (visible) {
        this.drawPanelShell(bounds, state.alpha, state.order === 0 ? 44 : 40, state.order === 0 ? 18 : 16, accentColor);

        if (descriptor.kind === 'list') {
          this.drawEntries(bounds, descriptor, state.alpha, state.order === 0);
        }
      }

      this.layoutPanelText(state, bounds, state.alpha, visible);
    }
  }

  private drawEntries(
    bounds: Phaser.Geom.Rectangle,
    descriptor: ActionMenuPanelDescriptor,
    alpha: number,
    isRootPanel: boolean
  ): void {
    const entries = descriptor.entries ?? [];

    for (const [index, entry] of entries.entries()) {
      const entryBounds = this.getEntryBounds(bounds, index);
      const active = entry.active ?? false;
      const fill = isRootPanel
        ? active
          ? 0x7a5233
          : entry.enabled
            ? 0x22171f
            : 0x161016
        : active
          ? 0x69402d
          : entry.enabled
            ? 0x241519
            : 0x171012;
      const strokeAlpha = active ? 0.5 : entry.enabled ? 0.18 : 0.1;
      const dotColor = isRootPanel
        ? active
          ? 0xf1d089
          : entry.enabled
            ? 0x8ad0cf
            : 0x7a6a52
        : active
          ? 0xf1d089
          : entry.enabled
            ? 0xd4b470
            : 0x7a6a52;

      this.graphics.fillStyle(fill, (active ? 0.9 : 0.72) * alpha);
      this.graphics.fillRoundedRect(entryBounds.x, entryBounds.y, entryBounds.width, entryBounds.height, 12);
      this.graphics.lineStyle(1, PANEL_STROKE, strokeAlpha * alpha);
      this.graphics.strokeRoundedRect(entryBounds.x, entryBounds.y, entryBounds.width, entryBounds.height, 12);
      this.graphics.fillStyle(dotColor, 0.95 * alpha);
      this.graphics.fillCircle(entryBounds.x + 16, entryBounds.centerY, active ? 6 : 5);
    }
  }

  private layoutPanelText(
    state: PanelState,
    bounds: Phaser.Geom.Rectangle,
    alpha: number,
    visible: boolean
  ): void {
    const descriptor = state.descriptor;
    if (!descriptor) {
      return;
    }

    const depthBase = BASE_DEPTH + 1 + state.order * 8;
    state.titleText
      .setText(descriptor.title)
      .setFontSize(this.typography.titleFontSize)
      .setPosition(bounds.x + 14, bounds.y + 12)
      .setAlpha(alpha)
      .setDepth(depthBase)
      .setVisible(visible);

    if (descriptor.kind === 'detail') {
      state.bodyText
        .setText(descriptor.body ?? '')
        .setFontSize(this.typography.bodyFontSize)
        .setWordWrapWidth(bounds.width - 28, true)
        .setPosition(bounds.x + 18, bounds.y + 52)
        .setAlpha(alpha)
        .setDepth(depthBase + 1)
        .setVisible(visible);
    } else {
      state.bodyText.setText('').setVisible(false);
    }

    const entries = descriptor.entries ?? [];
    for (const [index, text] of state.entryTexts.entries()) {
      const entry = entries[index];
      if (!entry || !visible) {
        text.setText('').setVisible(false);
        continue;
      }

      text
        .setText(`${entry.active ? '› ' : ''}${entry.label}`)
        .setColor(!entry.enabled ? '#8c7e62' : entry.active ? '#fff5cf' : '#f2e3ba')
        .setFontSize(this.typography.entryFontSize)
        .setPosition(bounds.x + 40, bounds.y + 52 + index * this.typography.rowHeight)
        .setAlpha(alpha)
        .setDepth(depthBase + 2)
        .setVisible(true);
    }
  }

  private getDisplayedBounds(state: PanelState): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      state.displayX,
      state.targetBounds.y,
      state.targetBounds.width,
      state.targetBounds.height
    );
  }

  private getEntryBounds(bounds: Phaser.Geom.Rectangle, index: number): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      bounds.x + 10,
      bounds.y + 44 + index * this.typography.rowHeight,
      bounds.width - 20,
      this.typography.rowHeight + 8
    );
  }

  private drawPanelShell(
    panel: Phaser.Geom.Rectangle,
    alpha: number,
    headerHeight: number,
    radius: number,
    accentColor: number
  ): void {
    this.graphics.fillStyle(SHADOW_COLOR, 0.32 * alpha);
    this.graphics.fillRoundedRect(panel.x + 4, panel.y + 6, panel.width, panel.height, radius);
    this.graphics.fillStyle(PANEL_OUTER_COLOR, 0.96 * alpha);
    this.graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    this.graphics.fillStyle(PANEL_INNER_COLOR, 0.96 * alpha);
    this.graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    this.graphics.fillStyle(accentColor, 0.54 * alpha);
    this.graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, Math.min(headerHeight, panel.height - 4), Math.max(8, radius - 2));
    this.graphics.fillStyle(accentColor, 0.24 * alpha);
    this.graphics.fillRoundedRect(panel.x + 6, panel.y + 10, 8, panel.height - 20, 4);
    this.graphics.fillStyle(0xf4ddb0, 0.08 * alpha);
    this.graphics.fillRoundedRect(panel.x + 18, panel.y + 9, panel.width - 36, 6, 3);
    this.graphics.lineStyle(2, PANEL_STROKE, 0.42 * alpha);
    this.graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    this.graphics.lineStyle(1, accentColor, 0.34 * alpha);
    this.graphics.strokeRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    this.graphics.lineStyle(1, accentColor, 0.24 * alpha);
    this.graphics.lineBetween(panel.x + 18, panel.y + headerHeight, panel.right - 18, panel.y + headerHeight);
  }
}
