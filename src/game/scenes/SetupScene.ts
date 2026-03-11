import Phaser from 'phaser';
import { SETUP_PLACEHOLDER_UNIT_IMAGE_KEY } from '../assets';
import { audioDirector } from '../audio/audioDirector';
import type { BattleSetup } from '../battleSetup';
import type { FactionId } from '../core/types';
import {
  getAllLevels,
  getLevel,
  getPlayerDeploymentSlots
} from '../levels';
import { getFactionProfile } from '../levels/factions';
import { getAllUnitBlueprints } from '../levels/unitBlueprints';
import type { LevelDefinition, PlayerDeploymentSlot } from '../levels/types';
import {
  BattleUiChrome,
  UI_NARROW_HEADER_TITLE_TEXT_STYLE,
  UI_PANEL_GAP,
  UI_PANEL_MINI_GAP,
  UI_PLAQUE_HEADER_HEIGHT,
  UI_SCREEN_MARGIN
} from './components/BattleUiChrome';
import { createUiGrid } from './components/UiGrid';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SURFACE,
  UI_COLOR_SUCCESS,
  UI_COLOR_TEXT_DISABLED
} from './components/UiColors';
import {
  UI_TEXT_BODY,
  UI_TEXT_LABEL,
  UI_TEXT_PANEL_SUBTITLE,
  UI_TEXT_PANEL_TITLE,
  UI_TEXT_TITLE,
  UI_TEXT_TITLE_CENTER
} from './components/UiTextStyles';

type SetupSceneData = {
  setup?: BattleSetup;
};

type LayoutMode = 'wide' | 'compact';
type AssignmentState = Record<string, string | null>;
type SelectionMenuMode = 'map' | 'unit' | null;
type PressTarget = Phaser.GameObjects.Zone | Phaser.GameObjects.Rectangle;

interface PressOptions {
  cancelOnDragDistance?: number;
  stopPropagation?: boolean;
}

interface DeploymentCardView {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  hitArea: Phaser.GameObjects.Zone;
  slotText: Phaser.GameObjects.Text;
  portrait: Phaser.GameObjects.Image;
  portraitMaskShape: Phaser.GameObjects.Graphics;
}

interface ActionButtonView {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  hitArea: Phaser.GameObjects.Zone;
  labelText: Phaser.GameObjects.Text;
  detailText: Phaser.GameObjects.Text;
}

interface SelectionItemView {
  container: Phaser.GameObjects.Container;
  backgroundImage: Phaser.GameObjects.Image;
  backgroundImageMaskShape: Phaser.GameObjects.Graphics;
  background: Phaser.GameObjects.Graphics;
  portrait: Phaser.GameObjects.Image;
  hitArea: Phaser.GameObjects.Zone;
  titleText: Phaser.GameObjects.Text;
  metaText: Phaser.GameObjects.Text;
  detailText: Phaser.GameObjects.Text;
}

interface SelectionEntry {
  id: string;
  title: string;
  meta: string;
  detail: string;
  status: string;
  disabled: boolean;
  accentColor: number;
  backgroundImageKey?: string;
  portraitImageKey?: string;
  portraitDisplayHeight?: number;
  portraitOffsetX?: number;
  portraitOffsetY?: number;
}

const MENU_ITEM_GAP = 10;
const MAP_MENU_ITEM_HEIGHT_WIDE = 124;
const MAP_MENU_ITEM_HEIGHT_COMPACT = 118;
const UNIT_MENU_ITEM_HEIGHT_WIDE = 108;
const UNIT_MENU_ITEM_HEIGHT_COMPACT = 102;
const SELECTION_ITEM_RADIUS = 18;
const SLOT_CARD_GAP_WIDE = 16;
const SLOT_CARD_GAP_COMPACT = 12;
const SLOT_CARD_WIDTH_WIDE = 116;
const SLOT_CARD_WIDTH_COMPACT = 92;
const SLOT_CARD_VERTICAL_INSET_WIDE = 6;
const SLOT_CARD_VERTICAL_INSET_COMPACT = 4;
const SLOT_CARD_PORTRAIT_BASE_Y = 6;
const SLOT_CARD_PORTRAIT_EXTRA_Y = 10;
const REVEAL_OFFSET_Y = 34;
const CLEAR_SLOT_ENTRY_ID = '__clear-slot__';
const SLOT_MARKER_COLORS = [0xcaa56a, 0x61d7c7, 0xe8898f] as const;
const BASE_FACTION_ORDER: FactionId[] = ['the-order', 'time-travelers', 'children-of-the-prophecy', 'myrmidons'];

export class SetupScene extends Phaser.Scene {
  private readonly levels = getAllLevels();
  private readonly availableBlueprints = getAllUnitBlueprints();
  private readonly availableBlueprintById = new Map(this.availableBlueprints.map((blueprint) => [blueprint.id, blueprint]));
  private readonly maxBlueprintSpriteDisplayHeight = Math.max(
    ...this.availableBlueprints.map((blueprint) => blueprint.spriteDisplayHeight),
    1
  );
  private readonly factionOrder = [
    ...BASE_FACTION_ORDER,
    ...Array.from(new Set(this.availableBlueprints.map((blueprint) => blueprint.factionId))).filter(
      (factionId) => !BASE_FACTION_ORDER.includes(factionId)
    )
  ];
  private readonly maxSlotCount = Math.max(...this.levels.map((level) => getPlayerDeploymentSlots(level).length), 0);
  private readonly selectionItemCount = Math.max(this.levels.length, this.availableBlueprints.length + 1);

  private layoutMode: LayoutMode = 'wide';
  private selectedLevel: LevelDefinition | null = null;
  private deploymentSlots: PlayerDeploymentSlot[] = [];
  private playerAssignments: AssignmentState = {};
  private selectedSlotId: string | null = null;
  private revealProgress = 0;
  private revealTween: Phaser.Tweens.Tween | null = null;

  private selectionMenuMode: SelectionMenuMode = null;
  private selectionMenuScroll = 0;
  private selectionMenuScrollMax = 0;
  private selectionMenuPointerId: number | null = null;
  private selectionMenuPointerStartY = 0;
  private selectionMenuScrollStart = 0;

  private slotRailScroll = 0;
  private slotRailScrollMax = 0;
  private slotRailPointerId: number | null = null;
  private slotRailPointerStartX = 0;
  private slotRailScrollStart = 0;

  private backdrop!: Phaser.GameObjects.Image;
  private backdropShade!: Phaser.GameObjects.Rectangle;
  private mapPanelArt!: Phaser.GameObjects.Image;
  private mapPanelArtMask!: Phaser.GameObjects.Graphics;
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private slotRailMaskGraphics!: Phaser.GameObjects.Graphics;
  private slotRailMask!: Phaser.Display.Masks.GeometryMask;
  private menuListMaskGraphics!: Phaser.GameObjects.Graphics;
  private menuListMask!: Phaser.Display.Masks.GeometryMask;
  private titleLogo!: Phaser.GameObjects.Image;
  private subtitleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private mapPanelTitleText!: Phaser.GameObjects.Text;
  private slotsPanelTitleText!: Phaser.GameObjects.Text;
  private mapInfoText!: Phaser.GameObjects.Text;
  private mapMetaText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private mapSelectHitArea!: Phaser.GameObjects.Zone;
  private slotCardViews: DeploymentCardView[] = [];
  private startButton!: ActionButtonView;

  private menuShade!: Phaser.GameObjects.Rectangle;
  private menuPanelBlocker!: Phaser.GameObjects.Zone;
  private menuGraphics!: Phaser.GameObjects.Graphics;
  private menuTitleText!: Phaser.GameObjects.Text;
  private menuSubtitleText!: Phaser.GameObjects.Text;
  private menuHintText!: Phaser.GameObjects.Text;
  private selectionItemViews: SelectionItemView[] = [];

  private mapPanelBounds = new Phaser.Geom.Rectangle();
  private slotsPanelBounds = new Phaser.Geom.Rectangle();
  private slotRailBounds = new Phaser.Geom.Rectangle();
  private slotActionBounds = new Phaser.Geom.Rectangle();
  private startButtonBounds = new Phaser.Geom.Rectangle();
  private menuPanelBounds = new Phaser.Geom.Rectangle();
  private menuListBounds = new Phaser.Geom.Rectangle();

  constructor() {
    super('setup');
  }

  private getLevelBackdropImageKey(level: LevelDefinition | null): string {
    return level?.backdropAssetId ?? 'title-backdrop';
  }

  init(data?: SetupSceneData): void {
    this.selectionMenuMode = null;
    this.selectionMenuScroll = 0;
    this.slotRailScroll = 0;
    this.slotRailPointerId = null;
    this.selectionMenuPointerId = null;

    if (data?.setup?.levelId) {
      const level = getLevel(data.setup.levelId);
      this.applySelectedLevel(level, data.setup.playerAssignments ?? null, {
        revealImmediately: true,
        initialSelectedSlotId: this.findInitialSelectedSlotId(level, data.setup.playerAssignments ?? null)
      });
      return;
    }

    this.clearLevelSelection();
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('title');
    void audioDirector.unlock().catch(() => undefined);

    this.backdrop = this.add.image(0, 0, 'renations-global-backdrop').setOrigin(0.5);
    this.backdropShade = this.add.rectangle(0, 0, 0, 0, 0x080407, 0.7).setOrigin(0);
    this.mapPanelArt = this.add.image(0, 0, this.getLevelBackdropImageKey(this.selectedLevel)).setOrigin(0.5).setVisible(false);
    this.mapPanelArtMask = this.add.graphics().setVisible(false).setScrollFactor(0);
    this.mapPanelArt.setMask(this.mapPanelArtMask.createGeometryMask());
    this.uiGraphics = this.add.graphics();
    this.slotRailMaskGraphics = this.add.graphics().setVisible(false);
    this.slotRailMask = new Phaser.Display.Masks.GeometryMask(this, this.slotRailMaskGraphics);
    this.menuListMaskGraphics = this.add.graphics().setVisible(false);
    this.menuListMask = new Phaser.Display.Masks.GeometryMask(this, this.menuListMaskGraphics);

    this.titleLogo = this.add.image(0, 0, 'renations-tactics-logo').setOrigin(0, 0);
    this.subtitleText = this.add.text(0, 0, '', UI_TEXT_BODY).setVisible(false);
    this.statusText = this.add.text(0, 0, '', UI_TEXT_BODY).setVisible(false);
    this.mapPanelTitleText = this.add.text(0, 0, 'BATTLEFIELD', UI_NARROW_HEADER_TITLE_TEXT_STYLE);
    this.slotsPanelTitleText = this.add.text(0, 0, 'DEPLOYMENT', UI_NARROW_HEADER_TITLE_TEXT_STYLE);
    this.mapInfoText = this.add.text(0, 0, '', UI_TEXT_PANEL_TITLE);
    this.mapMetaText = this.add.text(0, 0, '', UI_TEXT_PANEL_SUBTITLE);
    this.objectiveText = this.add.text(0, 0, '', UI_TEXT_BODY);

    this.mapSelectHitArea = this.createInteractiveZone();
    this.bindPress(this.mapSelectHitArea, () => {
      audioDirector.playUiMove();
      this.openSelectionMenu('map');
    });

    this.slotCardViews = Array.from({ length: this.maxSlotCount }, () => this.createDeploymentCard());
    for (const view of this.slotCardViews) {
      view.container.setMask(this.slotRailMask);
    }

    this.startButton = this.createActionButton('START BATTLE', '');
    this.bindPress(this.startButton.hitArea, () => {
      if (!this.canStartBattle()) {
        audioDirector.playUiCancel();
        return;
      }

      audioDirector.playUiConfirm();
      this.scene.start('battle', { setup: this.buildBattleSetup() });
    });

    this.menuShade = this.add.rectangle(0, 0, 0, 0, 0x080407, 0.84).setOrigin(0);
    this.menuShade.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1, 1), Phaser.Geom.Rectangle.Contains);
    if (this.menuShade.input) {
      this.menuShade.input.cursor = 'pointer';
    }
    this.bindPress(
      this.menuShade,
      () => {
        if (!this.selectionMenuMode) {
          return;
        }

        if (!this.canDismissSelectionMenu()) {
          return;
        }

        audioDirector.playUiCancel();
        this.closeSelectionMenu();
      },
      { stopPropagation: true }
    );

    this.menuPanelBlocker = this.createInteractiveZone();
    this.menuPanelBlocker.on('pointerdown', () => undefined);
    this.menuGraphics = this.add.graphics();
    this.menuTitleText = this.add.text(0, 0, '', UI_NARROW_HEADER_TITLE_TEXT_STYLE);
    this.menuSubtitleText = this.add.text(0, 0, '', UI_TEXT_BODY);
    this.menuHintText = this.add.text(0, 0, '', UI_TEXT_LABEL);
    this.selectionItemViews = Array.from({ length: this.selectionItemCount }, (_, index) => this.createSelectionItem(index));
    for (const item of this.selectionItemViews) {
      item.container.setMask(this.menuListMask);
    }

    this.menuShade.setDepth(60);
    this.menuPanelBlocker.setDepth(61);
    this.menuGraphics.setDepth(62);
    this.menuListMaskGraphics.setDepth(62);
    this.menuTitleText.setDepth(63);
    this.menuSubtitleText.setDepth(63);
    this.menuHintText.setDepth(63);
    for (const item of this.selectionItemViews) {
      item.container.setDepth(64);
    }

    this.input.on('wheel', this.handleWheel, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.input.keyboard?.on('keydown-ESC', this.handleEscapeKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', this.handleWheel, this);
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.off('pointerup', this.handlePointerUp, this);
      this.input.off('pointerupoutside', this.handlePointerUp, this);
      this.input.keyboard?.off('keydown-ESC', this.handleEscapeKey, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.revealTween?.stop();
      this.revealTween = null;
    });

    this.refreshUi();
  }

  private handleResize(): void {
    this.refreshUi();
  }

  private handleEscapeKey(): void {
    if (!this.selectionMenuMode) {
      return;
    }

    if (!this.canDismissSelectionMenu()) {
      return;
    }

    audioDirector.playUiCancel();
    this.closeSelectionMenu();
  }

  private createDeploymentCard(): DeploymentCardView {
    const container = this.add.container(0, 0);
    const background = this.add.graphics();
    const hitArea = this.createInteractiveZone();
    const slotText = this.add.text(0, 0, '', UI_TEXT_LABEL).setOrigin(0.5);
    const portrait = this.add.image(0, 0, SETUP_PLACEHOLDER_UNIT_IMAGE_KEY);
    const portraitMaskShape = this.add.graphics().setVisible(false);
    portrait.setMask(portraitMaskShape.createGeometryMask());

    this.bindPress(hitArea, () => {
      const slotId = hitArea.getData('slotId') as string | undefined;
      if (!slotId) {
        return;
      }

      this.selectedSlotId = slotId;
      audioDirector.playUiMove();
      this.openSelectionMenu('unit', slotId);
    }, { cancelOnDragDistance: 18 });

    container.add([background, portrait, slotText, hitArea]);
    return {
      container,
      background,
      hitArea,
      slotText,
      portrait,
      portraitMaskShape
    };
  }

  private createSelectionItem(index: number): SelectionItemView {
    const container = this.add.container(0, 0).setVisible(false);
    const backgroundImage = this.add.image(0, 0, 'title-backdrop').setOrigin(0.5).setVisible(false);
    const backgroundImageMaskShape = this.add.graphics().setVisible(false);
    backgroundImage.setMask(backgroundImageMaskShape.createGeometryMask());
    const background = this.add.graphics();
    const portrait = this.add.image(0, 0, SETUP_PLACEHOLDER_UNIT_IMAGE_KEY).setOrigin(0.5, 1).setVisible(false);
    const hitArea = this.createInteractiveZone();
    const titleText = this.add.text(0, 0, '', UI_TEXT_TITLE);
    const metaText = this.add.text(0, 0, '', UI_TEXT_LABEL);
    const detailText = this.add.text(0, 0, '', UI_TEXT_BODY);

    this.bindPress(hitArea, () => {
      const entryIndex = hitArea.getData('entryIndex') as number | undefined;
      if (typeof entryIndex !== 'number') {
        return;
      }

      const entry = this.getSelectionEntries()[entryIndex];
      if (!entry) {
        return;
      }

      if (entry.disabled) {
        audioDirector.playUiCancel();
        return;
      }

      audioDirector.playUiConfirm();
      this.activateSelectionEntry(entry);
    }, { cancelOnDragDistance: 12 });

    container.add([backgroundImage, background, portrait, titleText, metaText, detailText, hitArea]);
    hitArea.setData('entryIndex', index);

    return {
      container,
      backgroundImage,
      backgroundImageMaskShape,
      background,
      portrait,
      hitArea,
      titleText,
      metaText,
      detailText
    };
  }

  private createActionButton(label: string, detail: string): ActionButtonView {
    const container = this.add.container(0, 0);
    const background = this.add.graphics();
    const hitArea = this.createInteractiveZone();
    const labelText = this.add.text(0, 0, label, UI_TEXT_TITLE_CENTER).setOrigin(0.5);
    const detailText = this.add.text(0, 0, detail, UI_TEXT_BODY).setOrigin(0.5);
    container.add([background, labelText, detailText, hitArea]);
    return { container, background, hitArea, labelText, detailText };
  }

  private refreshUi(): void {
    this.layoutMode = this.scale.width >= 1180 && this.scale.height >= 720 ? 'wide' : 'compact';
    this.refreshTexts();
    this.layoutScene();
    this.drawPanels();
    this.refreshSlotCards();
    this.refreshStartButton();
    this.refreshSelectionMenu();
  }

  private refreshTexts(): void {
    if (this.selectedLevel) {
      this.mapInfoText.setText(this.selectedLevel.name);
      this.mapMetaText.setText(`${this.selectedLevel.region ?? 'Unknown region'}  •  ${this.selectedLevel.encounterType ?? 'Field engagement'}`);
      this.objectiveText.setText(`Objective: ${this.selectedLevel.objective}`);
      this.statusText.setText(`${this.countAssignedSlots()} / ${this.deploymentSlots.length} ready`);
    } else {
      this.mapInfoText.setText('');
      this.mapMetaText.setText('');
      this.objectiveText.setText('');
      this.statusText.setText('');
    }

    this.slotsPanelTitleText.setAlpha(this.revealProgress);
  }

  private layoutScene(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const grid = createUiGrid(width, height, this.layoutMode === 'wide' ? 12 : 6);
    const topY = 8;

    this.layoutBackdropCover(width, height);
    this.backdropShade.setSize(width, height);

    const titleLogoMaxWidth = width - 4;
    const titleLogoMaxHeight = this.layoutMode === 'wide' ? 380 : 280;
    const titleLogoScale = Math.min(
      titleLogoMaxWidth / Math.max(1, this.titleLogo.width),
      titleLogoMaxHeight / Math.max(1, this.titleLogo.height)
    );
    this.titleLogo.setPosition(width / 2, topY).setOrigin(0.5, 0).setScale(titleLogoScale);
    this.subtitleText
      .setPosition(-9999, -9999)
      .setWordWrapWidth(0, true);
    this.statusText.setPosition(-9999, -9999).setOrigin(1, 0);

    const contentTop = this.titleLogo.y + this.titleLogo.displayHeight - 32;

    if (this.layoutMode === 'wide') {
      const heroBounds = grid.column(0, 12, contentTop + 8, Math.min(300, height - contentTop - UI_SCREEN_MARGIN));
      const targetMapBounds = grid.column(0, 12, contentTop, 216);
      const targetSlotsBounds = grid.column(
        0,
        12,
        targetMapBounds.bottom + UI_PANEL_GAP,
        Math.max(280, height - targetMapBounds.bottom - UI_PANEL_GAP - UI_SCREEN_MARGIN)
      );

      this.lerpRect(this.mapPanelBounds, heroBounds, targetMapBounds, this.revealProgress);
      this.setRect(
        this.slotsPanelBounds,
        new Phaser.Geom.Rectangle(
          targetSlotsBounds.x,
          targetSlotsBounds.y + (1 - this.revealProgress) * (REVEAL_OFFSET_Y + 10),
          targetSlotsBounds.width,
          targetSlotsBounds.height
        )
      );
    } else {
      const heroBounds = grid.column(0, 6, contentTop + 8, Math.min(260, height - contentTop - UI_SCREEN_MARGIN));
      const targetMapBounds = grid.column(0, 6, contentTop, 186);
      const targetSlotsBounds = grid.column(
        0,
        6,
        targetMapBounds.bottom + UI_PANEL_GAP,
        Math.max(238, height - targetMapBounds.bottom - UI_PANEL_GAP - UI_SCREEN_MARGIN)
      );

      this.lerpRect(this.mapPanelBounds, heroBounds, targetMapBounds, this.revealProgress);
      this.setRect(
        this.slotsPanelBounds,
        new Phaser.Geom.Rectangle(
          targetSlotsBounds.x,
          targetSlotsBounds.y + (1 - this.revealProgress) * (REVEAL_OFFSET_Y + 10),
          targetSlotsBounds.width,
          targetSlotsBounds.height
        )
      );
    }

    BattleUiChrome.layoutHeaderTitle(this.mapPanelTitleText, this.mapPanelBounds);
    BattleUiChrome.layoutHeaderTitle(this.slotsPanelTitleText, this.slotsPanelBounds);

    this.mapPanelTitleText
      .setVisible(Boolean(this.selectedLevel))
      .setAlpha(this.selectedLevel ? this.revealProgress : 0);
    this.slotsPanelTitleText.setVisible(this.revealProgress > 0.01);

    this.mapSelectHitArea.setPosition(this.mapPanelBounds.x, this.mapPanelBounds.y);
    this.resizeInteractiveZone(this.mapSelectHitArea, this.mapPanelBounds.width, this.mapPanelBounds.height);
    if (this.mapSelectHitArea.input) {
      this.mapSelectHitArea.input.enabled = Boolean(this.selectedLevel);
    }

    const mapContent = BattleUiChrome.getContentBounds(this.mapPanelBounds);
    if (this.selectedLevel) {
      this.mapInfoText
        .setVisible(true)
        .setOrigin(0, 0)
        .setAlign('left')
        .setPosition(mapContent.x, mapContent.y)
        .setWordWrapWidth(mapContent.width, true)
        .setColor('#f7edd9')
        .setAlpha(this.revealProgress);
      this.mapMetaText
        .setVisible(true)
        .setOrigin(0, 0)
        .setAlign('left')
        .setPosition(mapContent.x, this.mapInfoText.y + this.mapInfoText.height + 4)
        .setWordWrapWidth(mapContent.width, true)
        .setColor('#dbc6a1')
        .setAlpha(this.revealProgress);
      this.objectiveText
        .setVisible(true)
        .setPosition(mapContent.x, this.mapMetaText.y + this.mapMetaText.height + UI_PANEL_MINI_GAP)
        .setWordWrapWidth(mapContent.width, true)
        .setAlpha(this.revealProgress);
    } else {
      this.mapInfoText.setVisible(false).setPosition(-9999, -9999);
      this.mapMetaText.setVisible(false).setPosition(-9999, -9999);
      this.objectiveText.setVisible(false).setPosition(-9999, -9999);
    }

    const slotsContent = BattleUiChrome.getContentBounds(this.slotsPanelBounds);
    const actionHeight = this.layoutMode === 'wide' ? 84 : 80;
    this.slotRailBounds.setTo(
      slotsContent.x,
      slotsContent.y,
      slotsContent.width,
      Math.max(0, slotsContent.height - actionHeight - UI_PANEL_GAP)
    );
    this.slotActionBounds.setTo(
      slotsContent.x,
      this.slotRailBounds.bottom + UI_PANEL_GAP,
      slotsContent.width,
      actionHeight
    );

    this.slotRailMaskGraphics.clear();
    if (this.revealProgress > 0.01) {
      this.slotRailMaskGraphics.fillStyle(0xffffff, 1);
      this.slotRailMaskGraphics.fillRect(
        this.slotRailBounds.x,
        this.slotRailBounds.y,
        this.slotRailBounds.width,
        this.slotRailBounds.height
      );
    }
  }

  private layoutBackdropCover(width: number, height: number): void {
    const frame = this.backdrop.frame;
    if (!frame) {
      this.backdrop.setPosition(width / 2, height / 2);
      return;
    }

    const coverScale = Math.max(width / Math.max(1, frame.width), height / Math.max(1, frame.height));
    this.backdrop
      .setPosition(width / 2, height / 2)
      .setDisplaySize(frame.width * coverScale, frame.height * coverScale)
      .setCrop(0, 0, frame.width, frame.height);
  }

  private drawPanels(): void {
    this.uiGraphics.clear();

    if (this.selectedLevel) {
      const panelAlpha = Phaser.Math.Clamp(this.revealProgress, 0, 1);
      this.mapPanelArt.setTexture(this.getLevelBackdropImageKey(this.selectedLevel));
      BattleUiChrome.applyPanelBackgroundImage(this.mapPanelArt, this.mapPanelArtMask, this.mapPanelBounds, {
        alpha: 0.9 * panelAlpha,
        radius: 24,
        inset: 2,
        visible: panelAlpha > 0.01
      });
      BattleUiChrome.drawPlaqueShell(this.uiGraphics, this.mapPanelBounds, {
        accentColor: UI_COLOR_ACCENT_COOL,
        headerHeight: UI_PLAQUE_HEADER_HEIGHT,
        radius: 24,
        surfaceAlpha: 0.34,
        innerSurfaceAlpha: 0.34,
        headerAlpha: 0.74,
        sideRuleAlpha: 0.14,
        shineAlpha: 0.12,
        dividerAlpha: 0.2,
        alpha: panelAlpha
      });
    } else {
      this.mapPanelArt.setVisible(false);
      this.mapPanelArtMask.clear();
    }

    if (this.revealProgress > 0.01) {
      BattleUiChrome.drawPlaqueShell(this.uiGraphics, this.slotsPanelBounds, {
        accentColor: UI_COLOR_ACCENT_DANGER,
        headerHeight: UI_PLAQUE_HEADER_HEIGHT,
        alpha: this.revealProgress
      });
    }
  }

  private refreshSlotCards(): void {
    const hasLevel = Boolean(this.selectedLevel);
    const cardGap = this.layoutMode === 'wide' ? SLOT_CARD_GAP_WIDE : SLOT_CARD_GAP_COMPACT;
    const cardWidth = this.layoutMode === 'wide' ? SLOT_CARD_WIDTH_WIDE : SLOT_CARD_WIDTH_COMPACT;
    const cardVerticalInset = this.layoutMode === 'wide' ? SLOT_CARD_VERTICAL_INSET_WIDE : SLOT_CARD_VERTICAL_INSET_COMPACT;
    const cardHeight = Math.max(1, this.slotRailBounds.height - cardVerticalInset * 2);
    const totalWidth = this.deploymentSlots.length * cardWidth + Math.max(0, this.deploymentSlots.length - 1) * cardGap;
    this.slotRailScrollMax = Math.max(0, totalWidth - this.slotRailBounds.width);
    this.slotRailScroll = Phaser.Math.Clamp(this.slotRailScroll, 0, this.slotRailScrollMax);

    const railXOffset = this.slotRailScrollMax > 0 ? 0 : Math.max(0, Math.floor((this.slotRailBounds.width - totalWidth) / 2));
    const railY = this.slotRailBounds.y + cardVerticalInset;
    const revealVisible = hasLevel && this.revealProgress > 0.01;

    for (const [index, view] of this.slotCardViews.entries()) {
      const slot = this.deploymentSlots[index];
      const visible = Boolean(slot) && revealVisible;
      view.container.setVisible(visible);
      view.container.setAlpha(this.revealProgress);
      if (view.hitArea.input) {
        view.hitArea.input.enabled = visible;
      }

      if (!slot || !visible) {
        view.portraitMaskShape.clear();
        continue;
      }

      const blueprintId = this.playerAssignments[slot.id];
      const blueprint = blueprintId ? this.availableBlueprintById.get(blueprintId) ?? null : null;
      const accentColor = blueprint?.accentColor ?? SLOT_MARKER_COLORS[index % SLOT_MARKER_COLORS.length];
      const selected = slot.id === this.selectedSlotId;
      const cardX = this.slotRailBounds.x + railXOffset + index * (cardWidth + cardGap) - this.slotRailScroll;

      view.container.setPosition(cardX, railY);
      this.resizeInteractiveZone(view.hitArea, cardWidth, cardHeight);

      view.background.clear();
      view.portraitMaskShape.clear();
      view.portraitMaskShape.fillStyle(0xffffff, 1);
      view.portraitMaskShape.fillRoundedRect(cardX + 1, railY + 1, cardWidth - 2, cardHeight - 2, 16);
      BattleUiChrome.drawInsetBox(view.background, new Phaser.Geom.Rectangle(0, 0, cardWidth, cardHeight), {
        fillColor: selected ? accentColor : UI_COLOR_PANEL_SURFACE,
        fillAlpha: selected ? 0.28 : 0.9,
        strokeColor: accentColor,
        strokeAlpha: selected ? 0.52 : 0.24
      });
      if (selected) {
        view.background.lineStyle(2, UI_COLOR_PANEL_BORDER, 0.7);
        view.background.strokeRoundedRect(1, 1, cardWidth - 2, cardHeight - 2, 16);
      }

      const badgeWidth = this.layoutMode === 'wide' ? 30 : 26;
      const badgeHeight = this.layoutMode === 'wide' ? 22 : 20;
      view.background.fillStyle(accentColor, selected ? 0.34 : 0.18);
      view.background.fillRoundedRect(10, 10, badgeWidth, badgeHeight, 8);
      view.background.lineStyle(1, accentColor, selected ? 0.72 : 0.42);
      view.background.strokeRoundedRect(10, 10, badgeWidth, badgeHeight, 8);

      if (blueprint) {
        view.portrait.setTexture(blueprint.spriteKey).setVisible(true).setAlpha(1);
      } else {
        view.portrait.setTexture(SETUP_PLACEHOLDER_UNIT_IMAGE_KEY).setVisible(true).setAlpha(0.5);
      }
      const portraitMaxHeight = Math.max(1, cardHeight - 10);
      const portraitHeightScale = portraitMaxHeight / this.maxBlueprintSpriteDisplayHeight;
      const portraitDisplayHeight = (blueprint?.spriteDisplayHeight ?? this.maxBlueprintSpriteDisplayHeight) * portraitHeightScale;
      const portraitScale = portraitDisplayHeight / Math.max(1, view.portrait.height);
      const portraitOffsetX = (blueprint?.spriteOffsetX ?? 0) * portraitHeightScale;
      const portraitOffsetY =
        (blueprint?.spriteOffsetY ?? 0) * portraitHeightScale + SLOT_CARD_PORTRAIT_EXTRA_Y;
      view.portrait.setPosition(cardWidth / 2 + portraitOffsetX, cardHeight / 2 + SLOT_CARD_PORTRAIT_BASE_Y + portraitOffsetY);
      view.portrait.setScale(portraitScale);

      view.slotText
        .setPosition(10 + badgeWidth / 2, 10 + badgeHeight / 2)
        .setText(String(index + 1))
        .setColor(selected ? '#f7edd9' : '#dbc6a1');

      view.hitArea.setData('slotId', slot.id);
    }
  }

  private refreshStartButton(): void {
    const enabled = this.canStartBattle();
    const visible = this.revealProgress > 0.01;
    const detailText = this.selectedLevel
      ? `${this.countAssignedSlots()} / ${this.deploymentSlots.length} ready`
      : '';
    this.startButtonBounds.setTo(
      this.slotActionBounds.x,
      this.slotActionBounds.y,
      this.slotActionBounds.width,
      this.slotActionBounds.height
    );
    this.startButton.container.setPosition(this.startButtonBounds.x, this.startButtonBounds.y);
    this.startButton.container.setVisible(visible);
    this.startButton.container.setAlpha(this.revealProgress);
    this.resizeInteractiveZone(this.startButton.hitArea, this.startButtonBounds.width, this.startButtonBounds.height);
    if (this.startButton.hitArea.input) {
      this.startButton.hitArea.input.enabled = visible;
    }

    this.startButton.background.clear();
    BattleUiChrome.drawInsetBox(this.startButton.background, new Phaser.Geom.Rectangle(0, 0, this.startButtonBounds.width, this.startButtonBounds.height), {
      fillColor: enabled ? UI_COLOR_SUCCESS : UI_COLOR_PANEL_SURFACE,
      fillAlpha: enabled ? 0.2 : 0.9,
      strokeColor: enabled ? UI_COLOR_SUCCESS : UI_COLOR_PANEL_BORDER,
      strokeAlpha: enabled ? 0.5 : 0.22
    });
    this.startButton.labelText.setColor(enabled ? '#f7edd9' : UI_COLOR_TEXT_DISABLED);
    this.startButton.detailText
      .setText(detailText)
      .setColor(enabled ? '#f7edd9' : UI_COLOR_TEXT_DISABLED)
      .setWordWrapWidth(this.startButtonBounds.width - 24, true);

    const stackGap = detailText ? 6 : 0;
    const contentHeight = this.startButton.labelText.height + (detailText ? this.startButton.detailText.height : 0) + stackGap;
    const contentTop = Math.round((this.startButtonBounds.height - contentHeight) / 2);
    this.startButton.labelText.setPosition(
      this.startButtonBounds.width / 2,
      contentTop + this.startButton.labelText.height / 2
    );
    this.startButton.detailText
      .setVisible(Boolean(detailText))
      .setPosition(
        this.startButtonBounds.width / 2,
        contentTop + this.startButton.labelText.height + stackGap + this.startButton.detailText.height / 2
      );
  }

  private refreshSelectionMenu(): void {
    const open = this.selectionMenuMode !== null;
    const canDismiss = this.canDismissSelectionMenu();
    this.menuShade.setVisible(open);
    this.menuPanelBlocker.setVisible(open);
    this.menuGraphics.setVisible(open);
    this.menuTitleText.setVisible(open);
    this.menuSubtitleText.setVisible(false);
    this.menuHintText.setVisible(open && !canDismiss);

    if (!open) {
      this.selectionMenuPointerId = null;
      for (const item of this.selectionItemViews) {
        item.container.setVisible(false);
        item.backgroundImage.setVisible(false);
        item.backgroundImageMaskShape.clear();
        item.portrait.setVisible(false);
        if (item.hitArea.input) {
          item.hitArea.input.enabled = false;
        }
      }
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    this.resizeInteractiveRectangle(this.menuShade, width, height);

    const panelWidth = Math.min(width - UI_SCREEN_MARGIN * 2, this.layoutMode === 'wide' ? 760 : 640);
    const panelHeight = Math.min(height - UI_SCREEN_MARGIN * 2, this.layoutMode === 'wide' ? 620 : 700);
    this.menuPanelBounds.setTo(
      Math.round((width - panelWidth) / 2),
      Math.round((height - panelHeight) / 2),
      Math.round(panelWidth),
      Math.round(panelHeight)
    );
    this.menuPanelBlocker.setPosition(this.menuPanelBounds.x, this.menuPanelBounds.y);
    this.resizeInteractiveZone(this.menuPanelBlocker, this.menuPanelBounds.width, this.menuPanelBounds.height);

    this.menuGraphics.clear();
    BattleUiChrome.drawPlaqueShell(this.menuGraphics, this.menuPanelBounds, {
      accentColor: this.selectionMenuMode === 'map' ? UI_COLOR_ACCENT_COOL : UI_COLOR_ACCENT_DANGER,
      headerHeight: UI_PLAQUE_HEADER_HEIGHT
    });

    BattleUiChrome.layoutHeaderTitle(this.menuTitleText, this.menuPanelBounds);
    this.menuTitleText.setText(this.selectionMenuMode === 'map' ? 'SELECT MAP' : 'SELECT UNIT');

    const contentBounds = BattleUiChrome.getContentBounds(this.menuPanelBounds);
    this.menuSubtitleText.setText('');
    this.menuHintText
      .setText(canDismiss ? '' : 'Choose a battlefield to continue')
      .setPosition(contentBounds.x, contentBounds.y)
      .setWordWrapWidth(contentBounds.width, true)
      .setColor('#dbc6a1');

    const entries = this.getSelectionEntries();
    const itemHeight = this.getSelectionItemHeight();
    const listTop = this.menuHintText.visible
      ? this.menuHintText.y + this.menuHintText.height + UI_PANEL_MINI_GAP
      : contentBounds.y;
    this.menuListBounds.setTo(
      contentBounds.x,
      listTop,
      contentBounds.width,
      Math.max(120, contentBounds.bottom - listTop - 22)
    );
    this.menuListMaskGraphics.clear();
    this.menuListMaskGraphics.fillStyle(0xffffff, 1);
    this.menuListMaskGraphics.fillRect(
      this.menuListBounds.x,
      this.menuListBounds.y,
      this.menuListBounds.width,
      this.menuListBounds.height
    );
    const contentHeight = entries.length * itemHeight + Math.max(0, entries.length - 1) * MENU_ITEM_GAP;
    this.selectionMenuScrollMax = Math.max(0, contentHeight - this.menuListBounds.height);
    this.selectionMenuScroll = Phaser.Math.Clamp(this.selectionMenuScroll, 0, this.selectionMenuScrollMax);

    for (const [index, item] of this.selectionItemViews.entries()) {
      const entry = entries[index];
      if (!entry) {
        item.container.setVisible(false);
        item.backgroundImage.setVisible(false);
        item.backgroundImageMaskShape.clear();
        item.portrait.setVisible(false);
        if (item.hitArea.input) {
          item.hitArea.input.enabled = false;
        }
        continue;
      }

      const itemY = this.menuListBounds.y + index * (itemHeight + MENU_ITEM_GAP) - this.selectionMenuScroll;
      const visible = itemY + itemHeight >= this.menuListBounds.y && itemY <= this.menuListBounds.bottom;
      item.container.setVisible(visible);
      if (item.hitArea.input) {
        item.hitArea.input.enabled = visible;
      }
      if (!visible) {
        item.backgroundImage.setVisible(false);
        item.backgroundImageMaskShape.clear();
        item.portrait.setVisible(false);
        continue;
      }

      item.container.setPosition(this.menuListBounds.x, itemY);
      this.resizeInteractiveZone(item.hitArea, this.menuListBounds.width, itemHeight);
      item.hitArea.setData('entryIndex', index);
      this.layoutSelectionItem(item, entry, this.menuListBounds.width, itemHeight);
      this.drawSelectionItemChrome(item, entry, this.menuListBounds.width, itemHeight);
    }
  }

  private getSelectionEntries(): SelectionEntry[] {
    if (this.selectionMenuMode === 'map') {
      return this.levels.map((level) => ({
        id: level.id,
        title: level.name,
        meta: `${level.region ?? 'Unknown region'}  •  ${level.encounterType ?? 'Field engagement'}`,
        detail: level.shortObjective ?? level.objective,
        status: this.selectedLevel?.id === level.id ? 'SELECTED' : this.isLevelPlayable(level) ? 'AVAILABLE' : 'UNAVAILABLE',
        disabled: !this.isLevelPlayable(level),
        accentColor: UI_COLOR_ACCENT_COOL,
        backgroundImageKey: this.getLevelBackdropImageKey(level)
      }));
    }

    if (this.selectionMenuMode === 'unit') {
      const selectedBlueprintId = this.selectedSlotId ? this.playerAssignments[this.selectedSlotId] : null;
      return [
        {
          id: CLEAR_SLOT_ENTRY_ID,
          title: 'Empty Slot',
          meta: 'No unit assigned',
          detail: '',
          status: selectedBlueprintId ? 'AVAILABLE' : 'SELECTED',
          disabled: false,
          accentColor: UI_COLOR_ACCENT_NEUTRAL,
          backgroundImageKey: this.getLevelBackdropImageKey(this.selectedLevel),
          portraitImageKey: SETUP_PLACEHOLDER_UNIT_IMAGE_KEY,
          portraitDisplayHeight: this.maxBlueprintSpriteDisplayHeight
        },
        ...this.factionOrder.flatMap((factionId) =>
          this.availableBlueprints
            .filter((blueprint) => blueprint.factionId === factionId)
            .map((blueprint) => {
              const selectedHere = this.selectedSlotId ? this.playerAssignments[this.selectedSlotId] === blueprint.id : false;
              return {
                id: blueprint.id,
                title: blueprint.name,
                meta: `${getFactionProfile(blueprint.factionId).displayName}  •  ${blueprint.className}`,
                detail: `HP ${blueprint.maxHp}  •  MOV ${blueprint.move}  •  RNG ${blueprint.rangeMin}-${blueprint.rangeMax}`,
                status: selectedHere ? 'SELECTED' : 'AVAILABLE',
                disabled: false,
                accentColor: blueprint.accentColor,
                backgroundImageKey: this.getLevelBackdropImageKey(this.selectedLevel),
                portraitImageKey: blueprint.spriteKey,
                portraitDisplayHeight: blueprint.spriteDisplayHeight,
                portraitOffsetX: blueprint.spriteOffsetX,
                portraitOffsetY: blueprint.spriteOffsetY
              };
            })
        )
      ];
    }

    return [];
  }

  private activateSelectionEntry(entry: SelectionEntry): void {
    if (this.selectionMenuMode === 'map') {
      this.selectLevel(entry.id);
      this.closeSelectionMenu();
      return;
    }

    if (this.selectionMenuMode === 'unit') {
      if (entry.id === CLEAR_SLOT_ENTRY_ID) {
        this.clearSelectedSlot();
        this.closeSelectionMenu();
        return;
      }

      this.assignBlueprintToSelectedSlot(entry.id);
      this.closeSelectionMenu();
    }
  }

  private openSelectionMenu(mode: Exclude<SelectionMenuMode, null>, slotId?: string): void {
    if (mode === 'unit' && slotId) {
      this.selectedSlotId = slotId;
    }

    this.selectionMenuMode = mode;
    this.selectionMenuScroll = 0;
    this.selectionMenuPointerId = null;
    this.refreshUi();
  }

  private closeSelectionMenu(): void {
    if (!this.canDismissSelectionMenu()) {
      return;
    }

    this.selectionMenuMode = null;
    this.selectionMenuPointerId = null;
    this.refreshUi();
  }

  private getSelectionItemHeight(mode: SelectionMenuMode = this.selectionMenuMode): number {
    if (mode === 'map') {
      return this.layoutMode === 'wide' ? MAP_MENU_ITEM_HEIGHT_WIDE : MAP_MENU_ITEM_HEIGHT_COMPACT;
    }

    if (mode === 'unit') {
      return this.layoutMode === 'wide' ? UNIT_MENU_ITEM_HEIGHT_WIDE : UNIT_MENU_ITEM_HEIGHT_COMPACT;
    }

    return UNIT_MENU_ITEM_HEIGHT_WIDE;
  }

  private layoutSelectionItem(
    item: SelectionItemView,
    entry: SelectionEntry,
    width: number,
    height: number
  ): void {
    const primaryColor = entry.disabled ? UI_COLOR_TEXT_DISABLED : '#f7edd9';
    const secondaryColor = entry.disabled ? UI_COLOR_TEXT_DISABLED : '#dbc6a1';

    item.titleText.setText(entry.title).setColor(primaryColor);
    item.metaText.setText(entry.meta).setColor(secondaryColor);
    item.detailText.setText(entry.detail).setColor(primaryColor);

    if (entry.backgroundImageKey) {
      item.backgroundImage.setTexture(entry.backgroundImageKey);
      const frame = item.backgroundImage.frame;
      if (frame) {
        const displayScale = Math.max(width / Math.max(1, frame.width), height / Math.max(1, frame.height));
        const maskInset = 1;
        item.backgroundImage
          .setDisplaySize(frame.width * displayScale, frame.height * displayScale)
          .setPosition(width * 0.5, height * 0.5)
          .setCrop(0, 0, frame.width, frame.height)
          .setAlpha(this.selectionMenuMode === 'map' ? 0.58 : 0.24)
          .setVisible(true);
        item.backgroundImageMaskShape.clear();
        item.backgroundImageMaskShape.fillStyle(0xffffff, 1);
        item.backgroundImageMaskShape.fillRoundedRect(
          item.container.x + maskInset,
          item.container.y + maskInset,
          width - maskInset * 2,
          height - maskInset * 2,
          SELECTION_ITEM_RADIUS - maskInset
        );
      } else {
        item.backgroundImage.setVisible(false);
        item.backgroundImageMaskShape.clear();
      }
    } else {
      item.backgroundImage.setVisible(false);
      item.backgroundImageMaskShape.clear();
    }

    if (this.selectionMenuMode === 'map') {
      item.portrait.setVisible(false);
      item.titleText
        .setPosition(20, 16)
        .setWordWrapWidth(Math.max(0, width - 40), true);
      item.metaText
        .setPosition(20, 44)
        .setWordWrapWidth(Math.max(0, width - 40), true);
      item.detailText
        .setPosition(20, 72)
        .setWordWrapWidth(Math.max(0, width - 40), true);
      return;
    }

    const artBounds = new Phaser.Geom.Rectangle(16, 12, this.layoutMode === 'wide' ? 108 : 96, height - 24);
    const textLeft = artBounds.right + 18;

    item.titleText
      .setPosition(textLeft, 14)
      .setWordWrapWidth(Math.max(0, width - textLeft), true);
    item.metaText
      .setPosition(textLeft, 40)
      .setWordWrapWidth(Math.max(0, width - textLeft), true);
    item.detailText
      .setPosition(textLeft, 64)
      .setWordWrapWidth(Math.max(0, width - textLeft - 20), true);

    if (entry.portraitImageKey) {
      item.portrait.setTexture(entry.portraitImageKey).setVisible(true).setAlpha(entry.disabled ? 0.58 : 1);
      const referenceHeight = Math.max(1, entry.portraitDisplayHeight ?? this.maxBlueprintSpriteDisplayHeight);
      const portraitScale = Math.min(
        (artBounds.width - 16) / Math.max(1, item.portrait.width),
        (artBounds.height - 8) / referenceHeight
      );
      item.portrait
        .setScale(portraitScale)
        .setPosition(
          artBounds.centerX + (entry.portraitOffsetX ?? 0) * portraitScale,
          artBounds.bottom + (entry.portraitOffsetY ?? 0) * portraitScale - 4
        );
    } else {
      item.portrait.setVisible(false);
    }
  }

  private drawSelectionItemChrome(
    item: SelectionItemView,
    entry: SelectionEntry,
    width: number,
    height: number
  ): void {
    const selected = entry.status === 'SELECTED';
    const accentColor = entry.disabled ? UI_COLOR_ACCENT_DANGER : entry.accentColor;
    const mapMode = this.selectionMenuMode === 'map';

    item.background.clear();
    BattleUiChrome.drawInsetBox(item.background, new Phaser.Geom.Rectangle(0, 0, width, height), {
      fillColor: selected ? entry.accentColor : UI_COLOR_PANEL_SURFACE,
      fillAlpha: selected ? (mapMode ? 0.16 : 0.42) : mapMode ? 0.12 : 0.82,
      strokeColor: accentColor,
      strokeAlpha: selected ? 0.56 : 0.3,
      radius: SELECTION_ITEM_RADIUS
    });

    if (mapMode) {
      item.background.fillStyle(0x080407, 0.12);
      item.background.fillRoundedRect(1, 1, width - 2, 34, SELECTION_ITEM_RADIUS - 1);
      item.background.fillStyle(0x080407, 0.42);
      item.background.fillRoundedRect(1, height - 42, width - 2, 41, SELECTION_ITEM_RADIUS - 1);
    } else {
      item.background.fillStyle(0x080407, 0.24);
      item.background.fillRoundedRect(1, 1, width - 2, height - 2, SELECTION_ITEM_RADIUS - 1);
    }
    item.background.fillStyle(accentColor, selected ? 0.24 : 0.12);
    item.background.fillRoundedRect(14, 14, 8, height - 28, 4);

    if (!mapMode) {
      const artBounds = new Phaser.Geom.Rectangle(16, 12, this.layoutMode === 'wide' ? 108 : 96, height - 24);
      BattleUiChrome.drawInsetBox(item.background, artBounds, {
        fillColor: entry.accentColor,
        fillAlpha: 0.12,
        strokeColor: accentColor,
        strokeAlpha: 0.34,
        radius: 14
      });
    }

    if (selected) {
      item.background.lineStyle(2, UI_COLOR_PANEL_BORDER, 0.68);
      item.background.strokeRoundedRect(1, 1, width - 2, height - 2, SELECTION_ITEM_RADIUS - 1);
    }
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number
  ): void {
    if (this.selectionMenuMode) {
      if (!this.menuListBounds.contains(pointer.x, pointer.y)) {
        return;
      }

      this.setSelectionMenuScroll(this.selectionMenuScroll + deltaY * 0.8);
      return;
    }

    if (!this.slotRailBounds.contains(pointer.x, pointer.y) || this.revealProgress <= 0.01) {
      return;
    }

    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    this.setSlotRailScroll(this.slotRailScroll + delta * 0.8);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.selectionMenuMode) {
      if (!this.menuListBounds.contains(pointer.x, pointer.y)) {
        return;
      }

      this.selectionMenuPointerId = pointer.id;
      this.selectionMenuPointerStartY = pointer.y;
      this.selectionMenuScrollStart = this.selectionMenuScroll;
      return;
    }

    if (!this.selectedLevel || this.revealProgress <= 0.01 || !this.slotRailBounds.contains(pointer.x, pointer.y)) {
      return;
    }

    this.slotRailPointerId = pointer.id;
    this.slotRailPointerStartX = pointer.x;
    this.slotRailScrollStart = this.slotRailScroll;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.selectionMenuMode) {
      if (this.selectionMenuPointerId !== pointer.id || !pointer.isDown) {
        return;
      }

      const delta = this.selectionMenuPointerStartY - pointer.y;
      this.setSelectionMenuScroll(this.selectionMenuScrollStart + delta);
      return;
    }

    if (this.slotRailPointerId !== pointer.id || !pointer.isDown) {
      return;
    }

    const delta = this.slotRailPointerStartX - pointer.x;
    this.setSlotRailScroll(this.slotRailScrollStart + delta);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.selectionMenuPointerId) {
      this.selectionMenuPointerId = null;
    }

    if (pointer.id === this.slotRailPointerId) {
      this.slotRailPointerId = null;
    }
  }

  private setSelectionMenuScroll(nextScroll: number): void {
    this.selectionMenuScroll = Phaser.Math.Clamp(nextScroll, 0, this.selectionMenuScrollMax);
    this.refreshSelectionMenu();
  }

  private setSlotRailScroll(nextScroll: number): void {
    this.slotRailScroll = Phaser.Math.Clamp(nextScroll, 0, this.slotRailScrollMax);
    this.refreshSlotCards();
  }

  private selectLevel(levelId: string): void {
    const level = getLevel(levelId);
    const hadLevel = Boolean(this.selectedLevel);
    const carriedAssignments = hadLevel
      ? this.deploymentSlots
          .map((slot) => this.playerAssignments[slot.id])
          .filter((blueprintId): blueprintId is string => Boolean(blueprintId))
      : [];

    const nextAssignments = this.createEmptyAssignments(level);
    const nextSlots = getPlayerDeploymentSlots(level);
    for (const [index, slot] of nextSlots.entries()) {
      nextAssignments[slot.id] = carriedAssignments[index] ?? null;
    }

    this.applySelectedLevel(level, nextAssignments, {
      revealImmediately: hadLevel,
      initialSelectedSlotId: this.findInitialSelectedSlotId(level, nextAssignments)
    });

    if (!hadLevel) {
      this.startRevealAnimation();
      return;
    }

    this.refreshUi();
  }

  private applySelectedLevel(
    level: LevelDefinition,
    assignments: Record<string, string> | AssignmentState | null,
    options: {
      revealImmediately: boolean;
      initialSelectedSlotId: string | null;
    }
  ): void {
    this.selectedLevel = level;
    this.deploymentSlots = getPlayerDeploymentSlots(level);
    this.playerAssignments = this.createEmptyAssignments(level);

    if (assignments) {
      for (const slot of this.deploymentSlots) {
        const assignment = assignments[slot.id];
        if (typeof assignment === 'string' && this.isSelectableBlueprintId(assignment)) {
          this.playerAssignments[slot.id] = assignment;
        }
      }
    }

    this.selectedSlotId = options.initialSelectedSlotId;
    this.slotRailScroll = 0;
    this.slotRailPointerId = null;
    this.revealProgress = options.revealImmediately ? 1 : 0;
  }

  private clearLevelSelection(): void {
    this.selectedLevel = null;
    this.deploymentSlots = [];
    this.playerAssignments = {};
    this.selectedSlotId = null;
    this.selectionMenuMode = 'map';
    this.selectionMenuScroll = 0;
    this.selectionMenuPointerId = null;
    this.revealProgress = 0;
    this.slotRailScroll = 0;
    this.slotRailPointerId = null;
    this.revealTween?.stop();
    this.revealTween = null;
  }

  private startRevealAnimation(): void {
    this.revealTween?.stop();
    this.revealProgress = 0;
    this.refreshUi();
    this.revealTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 420,
      ease: 'Cubic.Out',
      onUpdate: (tween) => {
        this.revealProgress = tween.getValue() ?? 0;
        this.refreshUi();
      },
      onComplete: () => {
        this.revealProgress = 1;
        this.revealTween = null;
        this.refreshUi();
      }
    });
  }

  private assignBlueprintToSelectedSlot(blueprintId: string): void {
    if (!this.selectedSlotId) {
      return;
    }

    this.playerAssignments[this.selectedSlotId] = blueprintId;
    this.refreshUi();
  }

  private clearSelectedSlot(): void {
    if (!this.selectedSlotId) {
      return;
    }

    this.playerAssignments[this.selectedSlotId] = null;
    this.refreshUi();
  }

  private getFirstPlayableLevel(): LevelDefinition {
    return this.levels.find((level) => this.isLevelPlayable(level)) ?? this.levels[0];
  }

  private isLevelPlayable(level: LevelDefinition): boolean {
    return getPlayerDeploymentSlots(level).length > 0;
  }

  private isSelectableBlueprintId(blueprintId: string): boolean {
    return this.availableBlueprintById.has(blueprintId);
  }

  private canDismissSelectionMenu(): boolean {
    return !(this.selectionMenuMode === 'map' && !this.selectedLevel);
  }

  private createEmptyAssignments(level: LevelDefinition): AssignmentState {
    return Object.fromEntries(getPlayerDeploymentSlots(level).map((slot) => [slot.id, null]));
  }

  private findInitialSelectedSlotId(
    level: LevelDefinition,
    assignments: Record<string, string> | AssignmentState | null
  ): string | null {
    const slots = getPlayerDeploymentSlots(level);
    return (
      slots.find((slot) => {
        const assignment = assignments?.[slot.id];
        return typeof assignment === 'string' && this.isSelectableBlueprintId(assignment);
      })?.id ?? null
    );
  }

  private countAssignedSlots(): number {
    return this.deploymentSlots.filter((slot) => Boolean(this.playerAssignments[slot.id])).length;
  }

  private canStartBattle(): boolean {
    return (
      Boolean(this.selectedLevel) &&
      this.revealProgress >= 0.999 &&
      this.isLevelPlayable(this.selectedLevel as LevelDefinition) &&
      this.countAssignedSlots() > 0
    );
  }

  private buildBattleSetup(): BattleSetup {
    const level = this.selectedLevel ?? this.getFirstPlayableLevel();
    return {
      levelId: level.id,
      playerAssignments: Object.fromEntries(
        getPlayerDeploymentSlots(level).flatMap((slot) => {
          const assignment = this.playerAssignments[slot.id];
          return typeof assignment === 'string' ? [[slot.id, assignment]] : [];
        })
      )
    };
  }

  private createInteractiveZone(): Phaser.GameObjects.Zone {
    const zone = this.add.zone(0, 0, 1, 1).setOrigin(0);
    zone.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1, 1), Phaser.Geom.Rectangle.Contains);
    if (zone.input) {
      zone.input.cursor = 'pointer';
    }
    return zone;
  }

  private bindPress(target: PressTarget, onPress: () => void, options: PressOptions = {}): void {
    const cancelOnDragDistance = options.cancelOnDragDistance ?? 10;

    target.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        target.setData('pressPointerId', pointer.id);
        target.setData('pressStartX', pointer.x);
        target.setData('pressStartY', pointer.y);
        if (options.stopPropagation) {
          event.stopPropagation();
        }
      }
    );

    target.on(
      'pointerup',
      (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        const pressedPointerId = target.getData('pressPointerId') as number | undefined;
        target.setData('pressPointerId', null);

        if (pressedPointerId !== pointer.id) {
          return;
        }

        const pressStartX = target.getData('pressStartX') as number | undefined;
        const pressStartY = target.getData('pressStartY') as number | undefined;
        const dragDistance = Math.hypot(pointer.x - (pressStartX ?? pointer.x), pointer.y - (pressStartY ?? pointer.y));
        if (dragDistance > cancelOnDragDistance) {
          return;
        }

        if (options.stopPropagation) {
          event.stopPropagation();
        }

        onPress();
      }
    );
  }

  private setRect(target: Phaser.Geom.Rectangle, source: Phaser.Geom.Rectangle): void {
    target.setTo(source.x, source.y, source.width, source.height);
  }

  private lerpRect(
    target: Phaser.Geom.Rectangle,
    from: Phaser.Geom.Rectangle,
    to: Phaser.Geom.Rectangle,
    progress: number
  ): void {
    target.setTo(
      Phaser.Math.Linear(from.x, to.x, progress),
      Phaser.Math.Linear(from.y, to.y, progress),
      Phaser.Math.Linear(from.width, to.width, progress),
      Phaser.Math.Linear(from.height, to.height, progress)
    );
  }

  private resizeInteractiveZone(zone: Phaser.GameObjects.Zone, width: number, height: number): void {
    zone.setSize(width, height);
    const hitArea = zone.input?.hitArea;
    if (hitArea instanceof Phaser.Geom.Rectangle) {
      hitArea.setTo(0, 0, width, height);
    }
  }

  private resizeInteractiveRectangle(rectangle: Phaser.GameObjects.Rectangle, width: number, height: number): void {
    rectangle.setSize(width, height);
    const hitArea = rectangle.input?.hitArea;
    if (hitArea instanceof Phaser.Geom.Rectangle) {
      hitArea.setTo(0, 0, width, height);
    }
  }

}
