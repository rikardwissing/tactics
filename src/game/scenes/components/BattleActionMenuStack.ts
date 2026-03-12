import Phaser from 'phaser';
import {
  BattleUiChrome,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_HEADER_INSET,
  UI_PANEL_TIGHT_GAP,
  UI_PLAQUE_HEADER_HEIGHT
} from './BattleUiChrome';
import { UI_TEXT_ACTION, UI_TEXT_BODY, UI_TEXT_TITLE } from './UiTextStyles';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SHADOW,
  UI_COLOR_PANEL_SURFACE,
  UI_COLOR_PANEL_SURFACE_ALT,
  UI_COLOR_TEXT,
  UI_COLOR_TEXT_DISABLED,
  UI_COLOR_SUCCESS
} from './UiColors';
import { createUiSubGrid } from './UiGrid';

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
  rowHeight: number;
}

export interface ActionMenuHitResult {
  panelId: string;
  blocksWorldInput: boolean;
  entryId?: string;
}

interface BattleActionMenuButtonConfig {
  bounds: Phaser.Geom.Rectangle;
  alpha: number;
  active: boolean;
  enabled: boolean;
  isRootPanel: boolean;
  label: string;
  depth: number;
  visible: boolean;
}

class BattleActionMenuButton {
  readonly text: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    onCreateObject?: (object: Phaser.GameObjects.GameObject) => void
  ) {
    this.text = scene.add.text(0, 0, '', UI_TEXT_ACTION);
    this.text.setOrigin(0, 0.5).setScrollFactor(0).setVisible(false);
    onCreateObject?.(this.text);
  }

  layout(
    graphics: Phaser.GameObjects.Graphics,
    {
      bounds,
      alpha,
      active,
      enabled,
      isRootPanel,
      label,
      depth,
      visible
    }: BattleActionMenuButtonConfig
  ): void {
    if (!visible) {
      this.text.setText('').setVisible(false);
      return;
    }

    const fill = isRootPanel
      ? active
        ? UI_COLOR_ACCENT_WARM
        : enabled
          ? UI_COLOR_PANEL_SURFACE_ALT
          : UI_COLOR_PANEL_SHADOW
      : active
        ? UI_COLOR_ACCENT_WARM
        : enabled
          ? UI_COLOR_PANEL_SURFACE
          : UI_COLOR_PANEL_SHADOW;
    const strokeAlpha = active ? 0.5 : enabled ? 0.18 : 0.1;
    const dotColor = isRootPanel
      ? active
        ? UI_COLOR_PANEL_BORDER
        : enabled
          ? UI_COLOR_SUCCESS
          : UI_COLOR_PANEL_BORDER
      : active
        ? UI_COLOR_PANEL_BORDER
        : enabled
          ? UI_COLOR_SUCCESS
          : UI_COLOR_PANEL_BORDER;

    const rowGrid = createUiSubGrid(bounds, 8, 10, 0, 8);
    const dotColumn = rowGrid.column(0, 1, bounds.y, bounds.height);
    const labelColumn = rowGrid.column(1, 7, bounds.y, bounds.height);

    graphics.fillStyle(fill, (active ? 0.9 : 0.72) * alpha);
    graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 12);
    graphics.lineStyle(1, UI_COLOR_PANEL_BORDER, strokeAlpha * alpha);
    graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 12);
    graphics.fillStyle(dotColor, 0.95 * alpha);
    graphics.fillCircle(dotColumn.centerX, dotColumn.centerY, active ? 6 : 5);

    this.text
      .setText(label)
      .setColor(!enabled ? UI_COLOR_TEXT_DISABLED : UI_COLOR_TEXT)
      .setPosition(labelColumn.x, labelColumn.centerY)
      .setAlpha(alpha)
      .setDepth(depth)
      .setVisible(true);
  }

  destroy(): void {
    this.text.destroy();
  }
}

interface PanelState {
  descriptor: ActionMenuPanelDescriptor | null;
  graphics: Phaser.GameObjects.Graphics;
  targetBounds: Phaser.Geom.Rectangle;
  displayX: number;
  alpha: number;
  targetX: number;
  targetAlpha: number;
  order: number;
  targetActive: boolean;
  titleText: Phaser.GameObjects.Text;
  bodyText: Phaser.GameObjects.Text;
  entryButtons: BattleActionMenuButton[];
  tween?: Phaser.Tweens.Tween;
}

interface StackObjectOptions {
  onCreateObject?: (object: Phaser.GameObjects.GameObject) => void;
}

const BASE_DEPTH = 900;
export class BattleActionMenuStack {
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
    rowHeight: 28
  };
  private descriptors: ActionMenuPanelDescriptor[] = [];
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: StackObjectOptions = {}
  ) {}

  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [
      ...Array.from(this.panelStates.values()).flatMap((state) => [
        state.graphics,
        state.titleText,
        state.bodyText,
        ...state.entryButtons.map((button) => button.text)
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
      state.graphics.destroy();
      state.titleText.destroy();
      state.bodyText.destroy();
      for (const button of state.entryButtons) {
        button.destroy();
      }
    }

    this.panelStates.clear();
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
      this.ensureEntryButtons(state, descriptor.entries?.length ?? 0);
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
      graphics: this.createGraphics(),
      targetBounds: new Phaser.Geom.Rectangle(this.layout.rootX, this.getRootTop(), this.layout.rootWidth, this.layout.panelHeight),
      displayX: this.layout.rootX - (this.layout.slideDistance ?? 26),
      alpha: 0,
      targetX: this.layout.rootX - (this.layout.slideDistance ?? 26),
      targetAlpha: 0,
      order: this.panelStates.size,
      targetActive: false,
      titleText: this.createText(UI_TEXT_TITLE),
      bodyText: this.createText(UI_TEXT_BODY),
      entryButtons: []
    };

    this.panelStates.set(panelId, state);
    return state;
  }

  private createGraphics(): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics().setDepth(BASE_DEPTH).setScrollFactor(0).setVisible(false);
    this.options.onCreateObject?.(graphics);
    return graphics;
  }

  private ensureEntryButtons(state: PanelState, targetCount: number): void {
    while (state.entryButtons.length < targetCount) {
      state.entryButtons.push(new BattleActionMenuButton(this.scene, this.options.onCreateObject));
    }
  }

  private createText(style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const text = this.scene.add.text(0, 0, '', style);

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
        descriptor.accentColor ?? (state.order === 0 ? UI_COLOR_ACCENT_WARM : UI_COLOR_ACCENT_COOL);
      const depthBase = BASE_DEPTH + state.order * 8;

      state.graphics.clear().setDepth(depthBase).setVisible(visible);

      if (visible) {
        this.drawPanelShell(
          state.graphics,
          bounds,
          state.alpha,
          UI_PLAQUE_HEADER_HEIGHT,
          state.order === 0 ? 18 : 16,
          accentColor
        );

        if (descriptor.kind === 'list') {
          this.drawEntries(state, bounds, descriptor, state.alpha, state.order === 0);
        }
      }

      this.layoutPanelText(state, bounds, state.alpha, visible);
    }
  }

  private drawEntries(
    state: PanelState,
    bounds: Phaser.Geom.Rectangle,
    descriptor: ActionMenuPanelDescriptor,
    alpha: number,
    isRootPanel: boolean
  ): void {
    const entries = descriptor.entries ?? [];

    for (const [index, entry] of entries.entries()) {
      const entryBounds = this.getEntryBounds(bounds, index);
      state.entryButtons[index]?.layout(state.graphics, {
        bounds: entryBounds,
        alpha,
        active: entry.active ?? false,
        enabled: entry.enabled,
        isRootPanel,
        label: entry.label,
        depth: BASE_DEPTH + 2 + state.order * 8,
        visible: true
      });
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
    const contentBounds = BattleUiChrome.getContentBounds(bounds);
    const contentGrid = createUiSubGrid(contentBounds, 1, 0, 0, UI_PANEL_TIGHT_GAP);
    state.titleText
      .setText(descriptor.title)
      .setOrigin(0, 0.5)
      .setPosition(bounds.x + UI_PANEL_HEADER_INSET, BattleUiChrome.getHeaderCenterY(bounds))
      .setAlpha(alpha)
      .setDepth(depthBase)
      .setVisible(visible);

    if (descriptor.kind === 'detail') {
      state.bodyText
        .setText(descriptor.body ?? '')
        .setOrigin(0, 0)
        .setWordWrapWidth(contentGrid.content.width, true)
        .setPosition(contentGrid.content.x, contentGrid.content.y)
        .setAlpha(alpha)
        .setDepth(depthBase + 1)
        .setVisible(visible);
    } else {
      state.bodyText.setText('').setVisible(false);
    }

    const entries = descriptor.entries ?? [];
    for (const [index, button] of state.entryButtons.entries()) {
      const entry = entries[index];
      if (!entry || !visible) {
        button.text.setText('').setVisible(false);
        continue;
      }
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
    const contentBounds = BattleUiChrome.getContentBounds(bounds);
    const contentGrid = createUiSubGrid(contentBounds, 1, 0, 0, UI_PANEL_TIGHT_GAP);
    return contentGrid.band(contentGrid.content.y + index * this.typography.rowHeight, this.typography.rowHeight);
  }

  private drawPanelShell(
    graphics: Phaser.GameObjects.Graphics,
    panel: Phaser.Geom.Rectangle,
    alpha: number,
    headerHeight: number,
    radius: number,
    accentColor: number
  ): void {
    BattleUiChrome.drawPlaqueShell(graphics, panel, {
      accentColor,
      alpha,
      headerHeight,
      radius,
      headerAlpha: 0.54,
      sideRuleAlpha: 0.24,
      dividerAlpha: 0.24
    });
  }
}
