import Phaser from 'phaser';
import { UNIT_TURN_START_AUDIO_KEYS } from '../assets';
import { audioDirector } from '../audio/audioDirector';
import {
  DEFAULT_UNIT_GROUND_OFFSET_Y,
  type IsometricBoardLayout,
  getTileDepth,
  getTileTopPoints,
  getUnitGroundPoint,
  isoToScreenPoint
} from '../core/isometric';
import { ELEVATION_STEP } from '../core/mapData';
import type { FactionId, Point, TerrainType, UnitBlueprint } from '../core/types';
import { getFactionProfile } from '../levels/factions';
import { UNIT_BLUEPRINT_BATTLE_SCALE } from '../levels';
import {
  createEditableUnitBlueprintDraft,
  diffEditableUnitBlueprintDraft,
  getEditableAbilityFields,
  type EditableUnitAbilityDraft,
  type EditableUnitAbilityField,
  type EditableUnitBlueprintDraft,
  type EditableUnitBlueprintField,
  resolveEditableUnitBlueprint,
  sanitizeEditableUnitBlueprintDraft
} from '../levels/unitBlueprintEditor';
import { getAllUnitBlueprints } from '../levels/unitBlueprints';
import {
  BattleUiChrome,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_GAP,
  UI_PANEL_MINI_GAP
} from './components/BattleUiChrome';
import { createUiGrid } from './components/UiGrid';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SHADOW,
  UI_COLOR_PANEL_SURFACE_ALT,
  UI_COLOR_SUCCESS
} from './components/UiColors';
import {
  UI_TEXT_ACTION,
  UI_TEXT_BODY,
  UI_TEXT_LABEL,
  UI_TEXT_TITLE,
  UI_TEXT_WORLD_LABEL
} from './components/UiTextStyles';

type ButtonId =
  | 'back'
  | 'terrain-prev'
  | 'terrain-next'
  | 'height-prev'
  | 'height-next'
  | 'reset-selected'
  | 'reset-all'
  | 'copy-blueprint-file';

interface ButtonView {
  id: ButtonId;
  labelText: Phaser.GameObjects.Text;
  bounds: Phaser.Geom.Rectangle;
}

interface RosterHeaderView {
  factionId: FactionId;
  text: Phaser.GameObjects.Text;
  bounds: Phaser.Geom.Rectangle;
}

interface RosterRowView {
  blueprintId: string;
  titleText: Phaser.GameObjects.Text;
  metaText: Phaser.GameObjects.Text;
  bounds: Phaser.Geom.Rectangle;
}

type StepperTarget =
  | { kind: 'blueprint'; field: EditableUnitBlueprintField }
  | { kind: 'ability'; abilityId: string; field: EditableUnitAbilityField };

interface StepperView {
  target: StepperTarget;
  labelText: Phaser.GameObjects.Text;
  valueText: Phaser.GameObjects.Text;
  minusText: Phaser.GameObjects.Text;
  plusText: Phaser.GameObjects.Text;
  rowBounds: Phaser.Geom.Rectangle;
  minusBounds: Phaser.Geom.Rectangle;
  plusBounds: Phaser.Geom.Rectangle;
}

interface AbilityBlockView {
  abilityId: string;
  titleText: Phaser.GameObjects.Text;
  metaText: Phaser.GameObjects.Text;
  descriptionText: Phaser.GameObjects.Text;
  boxBounds: Phaser.Geom.Rectangle;
  stepperKeys: string[];
}

const FACTION_ORDER: readonly FactionId[] = [
  'the-order',
  'time-travelers',
  'children-of-the-prophecy',
  'myrmidons'
] as const;

const TERRAIN_ORDER: readonly TerrainType[] = ['grass', 'moss', 'stone', 'sanctum'];
const VISUAL_FIELDS: readonly EditableUnitBlueprintField[] = [
  'spriteDisplayHeight',
  'spriteOffsetX',
  'spriteOffsetY'
];
const STAT_FIELDS: readonly EditableUnitBlueprintField[] = [
  'maxHp',
  'move',
  'speed',
  'attack',
  'defense',
  'rangeMin',
  'rangeMax',
  'jump'
];

const TERRAIN_TILE_ASSETS: Record<TerrainType, readonly string[]> = {
  grass: ['terrain-grass-a', 'terrain-grass-b'],
  moss: ['terrain-moss-a', 'terrain-moss-b'],
  stone: ['terrain-stone-a', 'terrain-stone-b'],
  sanctum: ['terrain-sanctum-a']
};

const FIELD_LABELS: Record<EditableUnitBlueprintField, string> = {
  spriteDisplayHeight: 'Display Height',
  spriteOffsetX: 'Offset X',
  spriteOffsetY: 'Offset Y',
  maxHp: 'Max HP',
  move: 'Move',
  speed: 'Speed',
  attack: 'Attack',
  defense: 'Defense',
  rangeMin: 'Range Min',
  rangeMax: 'Range Max',
  jump: 'Jump'
};

const ABILITY_FIELD_LABELS: Record<EditableUnitAbilityField, string> = {
  rangeMin: 'Range Min',
  rangeMax: 'Range Max',
  powerModifier: 'Power Mod',
  healAmount: 'Heal Amount'
};

const FIELD_ROW_HEIGHT = 24;
const FIELD_BUTTON_WIDTH = 24;
const UNIT_FOOTPRINT_OFFSET_Y = -4;
const WORLD_EDGE_BASE_LEVEL = 1;
const ABILITY_BLOCK_GAP = 10;
const ABILITY_BLOCK_HEADER_HEIGHT = 56;
const ACTION_BUTTON_ROWS = [
  ['reset-selected', 'reset-all'],
  ['copy-blueprint-file']
] as const satisfies readonly (readonly ButtonId[])[];

export class UnitEditorScene extends Phaser.Scene {
  private readonly blueprints = getAllUnitBlueprints();
  private readonly blueprintById = new Map(this.blueprints.map((blueprint) => [blueprint.id, blueprint]));
  private readonly groupedBlueprintIds = this.buildFactionGroups();
  private readonly dirtyDrafts = new Map<string, EditableUnitBlueprintDraft>();

  private selectedBlueprintId = this.blueprints[0]?.id ?? '';
  private rosterScrollY = 0;
  private inspectorScrollY = 0;
  private rosterContentHeight = 0;
  private inspectorContentHeight = 0;
  private previewTerrain: TerrainType = 'stone';
  private previewHeight = 1;
  private statusMessage = 'Drag the preview sprite or use the steppers. Copy Blueprint File exports the current JSON.';

  private dragPointerId: number | null = null;
  private dragPointerOrigin = new Phaser.Math.Vector2();
  private dragOffsetOrigin = new Phaser.Math.Vector2();
  private stepHoldPointerId: number | null = null;
  private stepHoldTarget: StepperTarget | null = null;
  private stepHoldTimer: Phaser.Time.TimerEvent | null = null;
  private selectedCatchPhraseSound: Phaser.Sound.BaseSound | null = null;

  private backdrop!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private previewWallGraphics!: Phaser.GameObjects.Graphics;
  private previewOutlineGraphics!: Phaser.GameObjects.Graphics;
  private staticUiGraphics!: Phaser.GameObjects.Graphics;
  private rosterScrollGraphics!: Phaser.GameObjects.Graphics;
  private inspectorScrollGraphics!: Phaser.GameObjects.Graphics;
  private rosterMaskGraphics!: Phaser.GameObjects.Graphics;
  private inspectorMaskGraphics!: Phaser.GameObjects.Graphics;
  private rosterContentMask!: Phaser.Display.Masks.GeometryMask;
  private inspectorContentMask!: Phaser.Display.Masks.GeometryMask;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private rosterTitleText!: Phaser.GameObjects.Text;
  private previewTitleText!: Phaser.GameObjects.Text;
  private inspectorTitleText!: Phaser.GameObjects.Text;
  private previewTerrainText!: Phaser.GameObjects.Text;
  private previewHeightText!: Phaser.GameObjects.Text;
  private previewHintText!: Phaser.GameObjects.Text;
  private metaText!: Phaser.GameObjects.Text;
  private readOnlyNoteText!: Phaser.GameObjects.Text;
  private dirtyCountText!: Phaser.GameObjects.Text;
  private visualSectionTitle!: Phaser.GameObjects.Text;
  private statsSectionTitle!: Phaser.GameObjects.Text;
  private abilitiesSectionTitle!: Phaser.GameObjects.Text;
  private previewTerrainImage!: Phaser.GameObjects.Image;
  private previewContainer!: Phaser.GameObjects.Container;
  private previewMarker!: Phaser.GameObjects.Ellipse;
  private previewShadow!: Phaser.GameObjects.Ellipse;
  private previewSprite!: Phaser.GameObjects.Image;
  private previewHpBack!: Phaser.GameObjects.Rectangle;
  private previewHpFill!: Phaser.GameObjects.Rectangle;
  private previewLabel!: Phaser.GameObjects.Text;
  private backButton!: ButtonView;
  private previewButtons = new Map<ButtonId, ButtonView>();
  private actionButtons = new Map<ButtonId, ButtonView>();
  private rosterHeaderViews: RosterHeaderView[] = [];
  private rosterRowViews: RosterRowView[] = [];
  private blueprintStepperViews = new Map<EditableUnitBlueprintField, StepperView>();
  private abilityStepperViews = new Map<string, StepperView>();
  private abilityBlockViews: AbilityBlockView[] = [];
  private abilityInspectorSignature = '';
  private headerRect = new Phaser.Geom.Rectangle();
  private rosterPanelRect = new Phaser.Geom.Rectangle();
  private previewPanelRect = new Phaser.Geom.Rectangle();
  private inspectorPanelRect = new Phaser.Geom.Rectangle();
  private rosterViewportRect = new Phaser.Geom.Rectangle();
  private inspectorViewportRect = new Phaser.Geom.Rectangle();
  private previewStageRect = new Phaser.Geom.Rectangle();
  private previewMetaRect = new Phaser.Geom.Rectangle();
  private metaBoxRect = new Phaser.Geom.Rectangle();
  private abilitiesBoxRect = new Phaser.Geom.Rectangle();

  constructor() {
    super('unit-editor');
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('title');
    void audioDirector.unlock().catch(() => undefined);

    this.backdrop = this.add.image(0, 0, 'renations-global-backdrop').setOrigin(0.5).setDepth(0);
    this.shade = this.add.rectangle(0, 0, 0, 0, 0x070409, 0.78).setOrigin(0).setDepth(1);
    this.previewWallGraphics = this.add.graphics().setDepth(20);
    this.previewTerrainImage = this.add.image(0, 0, 'terrain-stone-a').setOrigin(0.5, 0.5).setDepth(21);
    this.previewOutlineGraphics = this.add.graphics().setDepth(22);
    this.staticUiGraphics = this.add.graphics().setDepth(200);
    this.rosterScrollGraphics = this.add.graphics().setDepth(201);
    this.inspectorScrollGraphics = this.add.graphics().setDepth(201);
    this.rosterMaskGraphics = this.add.graphics().setVisible(false);
    this.inspectorMaskGraphics = this.add.graphics().setVisible(false);
    this.rosterContentMask = this.rosterMaskGraphics.createGeometryMask();
    this.inspectorContentMask = this.inspectorMaskGraphics.createGeometryMask();
    this.rosterScrollGraphics.setMask(this.rosterContentMask);
    this.inspectorScrollGraphics.setMask(this.inspectorContentMask);

    this.titleText = this.add.text(0, 0, 'UNIT BLUEPRINT EDITOR', UI_TEXT_TITLE).setDepth(210);
    this.subtitleText = this.add
      .text(0, 0, 'Shared blueprint tuning with battle-style preview and full JSON export.', UI_TEXT_BODY)
      .setDepth(210);
    this.statusText = this.add.text(0, 0, '', UI_TEXT_BODY).setDepth(210);

    this.rosterTitleText = this.add.text(0, 0, 'ROSTER', UI_TEXT_LABEL).setDepth(210);
    this.previewTitleText = this.add.text(0, 0, 'PREVIEW', UI_TEXT_LABEL).setDepth(210);
    this.inspectorTitleText = this.add.text(0, 0, 'INSPECTOR', UI_TEXT_LABEL).setDepth(210);
    this.previewTerrainText = this.add.text(0, 0, '', UI_TEXT_LABEL).setDepth(210);
    this.previewHeightText = this.add.text(0, 0, '', UI_TEXT_LABEL).setDepth(210);
    this.previewHintText = this.add.text(0, 0, '', UI_TEXT_BODY).setDepth(210);
    this.metaText = this.add.text(0, 0, '', UI_TEXT_BODY).setDepth(210);
    this.readOnlyNoteText = this.add
      .text(0, 0, 'Reference only below. Editable here: visuals, core stats, and ability numbers.', UI_TEXT_LABEL)
      .setDepth(210);
    this.dirtyCountText = this.add.text(0, 0, '', UI_TEXT_LABEL).setDepth(210);
    this.visualSectionTitle = this.add.text(0, 0, 'VISUAL', UI_TEXT_LABEL).setDepth(210);
    this.statsSectionTitle = this.add.text(0, 0, 'GAMEPLAY', UI_TEXT_LABEL).setDepth(210);
    this.abilitiesSectionTitle = this.add.text(0, 0, 'ABILITIES', UI_TEXT_LABEL).setDepth(210);

    for (const [id, label] of [
      ['back', 'BACK TO TITLE'],
      ['terrain-prev', '<'],
      ['terrain-next', '>'],
      ['height-prev', '<'],
      ['height-next', '>'],
      ['reset-selected', 'Reset Selected'],
      ['reset-all', 'Reset All'],
      ['copy-blueprint-file', 'Copy Blueprint File']
    ] as const satisfies readonly [ButtonId, string][]) {
      const labelText = this.add
        .text(0, 0, label, id === 'back' ? UI_TEXT_ACTION : UI_TEXT_LABEL)
        .setOrigin(0.5)
        .setDepth(210);
      const button: ButtonView = {
        id,
        labelText,
        bounds: new Phaser.Geom.Rectangle()
      };

      if (id === 'back') {
        this.backButton = button;
      } else if (id.startsWith('terrain') || id.startsWith('height')) {
        this.previewButtons.set(id, button);
      } else {
        this.applyInspectorMask(labelText);
        this.actionButtons.set(id, button);
      }
    }

    for (const factionId of this.groupedBlueprintIds.keys()) {
      this.rosterHeaderViews.push({
        factionId,
        text: this.applyRosterMask(
          this.add.text(0, 0, getFactionProfile(factionId).displayName.toUpperCase(), UI_TEXT_LABEL).setDepth(210)
        ),
        bounds: new Phaser.Geom.Rectangle()
      });
    }

    for (const blueprint of this.blueprints) {
      this.rosterRowViews.push({
        blueprintId: blueprint.id,
        titleText: this.applyRosterMask(this.add.text(0, 0, blueprint.name, UI_TEXT_ACTION).setDepth(210)),
        metaText: this.applyRosterMask(this.add.text(0, 0, '', UI_TEXT_BODY).setDepth(210)),
        bounds: new Phaser.Geom.Rectangle()
      });
    }

    for (const field of [...VISUAL_FIELDS, ...STAT_FIELDS]) {
      const labelText = this.applyInspectorMask(this.add.text(0, 0, FIELD_LABELS[field], UI_TEXT_LABEL).setDepth(210));
      const valueText = this.applyInspectorMask(this.add.text(0, 0, '0', UI_TEXT_ACTION).setDepth(210));
      const minusText = this.applyInspectorMask(this.add.text(0, 0, '-', UI_TEXT_ACTION).setOrigin(0.5).setDepth(210));
      const plusText = this.applyInspectorMask(this.add.text(0, 0, '+', UI_TEXT_ACTION).setOrigin(0.5).setDepth(210));

      this.blueprintStepperViews.set(field, {
        target: { kind: 'blueprint', field },
        labelText,
        valueText,
        minusText,
        plusText,
        rowBounds: new Phaser.Geom.Rectangle(),
        minusBounds: new Phaser.Geom.Rectangle(),
        plusBounds: new Phaser.Geom.Rectangle()
      });
    }

    this.previewMarker = this.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 62, 26, 0xffffff, 0.14);
    this.previewShadow = this.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 50, 18, 0x060205, 0.42);
    this.previewSprite = this.add.image(0, 0, this.getSelectedBlueprint().spriteKey).setOrigin(0.5, 1);
    this.previewHpBack = this.add.rectangle(0, 0, 60, 8, 0x12070d, 0.92);
    this.previewHpFill = this.add.rectangle(-29, 0, 56, 4, UI_COLOR_SUCCESS, 1).setOrigin(0, 0.5);
    this.previewLabel = this.add.text(0, 0, this.getSelectedBlueprint().name, UI_TEXT_WORLD_LABEL).setOrigin(0.5);
    this.previewContainer = this.add
      .container(0, 0, [
        this.previewMarker,
        this.previewShadow,
        this.previewSprite,
        this.previewHpBack,
        this.previewHpFill,
        this.previewLabel
      ])
      .setDepth(28);

    this.metaText.setWordWrapWidth(280, true);
    this.previewHintText.setWordWrapWidth(300, true);
    this.statusText.setWordWrapWidth(780, true);
    this.applyInspectorMask(this.readOnlyNoteText);
    this.applyInspectorMask(this.dirtyCountText);
    this.applyInspectorMask(this.metaText);
    this.applyInspectorMask(this.visualSectionTitle);
    this.applyInspectorMask(this.statsSectionTitle);
    this.applyInspectorMask(this.abilitiesSectionTitle);

    this.registerInputHandlers();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.ensureAbilityInspectorViews();

    this.cameras.main.fadeIn(250, 8, 4, 6);
    this.handleResize();
    this.refreshScene();
  }

  private buildFactionGroups(): Map<FactionId, string[]> {
    const grouped = new Map<FactionId, string[]>();

    for (const factionId of FACTION_ORDER) {
      grouped.set(factionId, []);
    }

    for (const blueprint of this.blueprints) {
      const entries = grouped.get(blueprint.factionId);

      if (entries) {
        entries.push(blueprint.id);
        continue;
      }

      grouped.set(blueprint.factionId, [blueprint.id]);
    }

    for (const [factionId, entries] of [...grouped.entries()]) {
      if (entries.length === 0) {
        grouped.delete(factionId);
      }
    }

    return grouped;
  }

  private registerInputHandlers(): void {
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);

    this.input.keyboard?.on('keydown-ESC', this.returnToTitle, this);
    this.input.keyboard?.on('keydown-R', (_event: KeyboardEvent) => {
      if (_event.repeat) {
        return;
      }

      this.resetSelectedDraft();
    });
  }

  private handleShutdown(): void {
    this.clearStepHold();
    this.stopSelectedCatchPhraseSound();
    this.rosterScrollGraphics.clearMask();
    this.inspectorScrollGraphics.clearMask();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
  }

  private handleResize(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const grid = createUiGrid(width, height, 12);
    const headerHeight = 48;
    const footerHeight = 20;
    const panelTop = grid.content.y + headerHeight;
    const panelHeight = Math.max(0, grid.content.height - headerHeight - footerHeight - UI_PANEL_GAP);

    this.headerRect.setTo(grid.content.x, grid.content.y, grid.content.width, headerHeight);
    const rosterRect = grid.column(0, 3, panelTop, panelHeight);
    const previewRect = grid.column(3, 5, panelTop, panelHeight);
    const inspectorRect = grid.column(8, 4, panelTop, panelHeight);

    this.rosterPanelRect.setTo(rosterRect.x, rosterRect.y, rosterRect.width, rosterRect.height);
    this.previewPanelRect.setTo(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
    this.inspectorPanelRect.setTo(inspectorRect.x, inspectorRect.y, inspectorRect.width, inspectorRect.height);

    this.fitBackdrop(this.backdrop, width, height, 1.08);
    this.shade.setSize(width, height);
    this.shade.setPosition(0, 0);

    this.titleText.setPosition(grid.content.x, grid.content.y - 2);
    this.subtitleText.setPosition(grid.content.x, grid.content.y + 22);
    this.subtitleText.setWordWrapWidth(Math.max(240, grid.content.width - 220), true);

    this.backButton.bounds.setTo(grid.content.right - 154, grid.content.y - 2, 154, 28);
    this.backButton.labelText.setPosition(this.backButton.bounds.centerX, this.backButton.bounds.centerY);

    this.statusText.setPosition(grid.content.x, grid.content.bottom - footerHeight + 1);

    BattleUiChrome.layoutHeaderTitle(this.rosterTitleText, this.rosterPanelRect, 'narrow');
    BattleUiChrome.layoutHeaderTitle(this.previewTitleText, this.previewPanelRect, 'narrow');
    BattleUiChrome.layoutHeaderTitle(this.inspectorTitleText, this.inspectorPanelRect, 'narrow');

    this.layoutRosterPanel();
    this.layoutPreviewPanel();
    this.layoutInspectorPanel();
    this.updateScrollMasks();
    this.refreshScene();
  }

  private applyRosterMask<T extends Phaser.GameObjects.GameObject & {
    setMask(mask: Phaser.Display.Masks.BitmapMask | Phaser.Display.Masks.GeometryMask | null): T;
  }>(gameObject: T): T {
    gameObject.setMask(this.rosterContentMask);
    return gameObject;
  }

  private applyInspectorMask<T extends Phaser.GameObjects.GameObject & {
    setMask(mask: Phaser.Display.Masks.BitmapMask | Phaser.Display.Masks.GeometryMask | null): T;
  }>(gameObject: T): T {
    gameObject.setMask(this.inspectorContentMask);
    return gameObject;
  }

  private updateScrollMasks(): void {
    this.rosterMaskGraphics.clear();
    this.rosterMaskGraphics.fillStyle(0xffffff, 1);
    this.rosterMaskGraphics.fillRect(
      this.rosterViewportRect.x,
      this.rosterViewportRect.y,
      this.rosterViewportRect.width,
      this.rosterViewportRect.height
    );

    this.inspectorMaskGraphics.clear();
    this.inspectorMaskGraphics.fillStyle(0xffffff, 1);
    this.inspectorMaskGraphics.fillRect(
      this.inspectorViewportRect.x,
      this.inspectorViewportRect.y,
      this.inspectorViewportRect.width,
      this.inspectorViewportRect.height
    );
  }

  private layoutRosterPanel(): void {
    const content = BattleUiChrome.getContentBounds(this.rosterPanelRect, 'narrow');
    let totalHeight = 0;

    for (const header of this.rosterHeaderViews) {
      const entries = this.groupedBlueprintIds.get(header.factionId) ?? [];
      totalHeight += 20 + entries.length * 48 + 4;
    }

    this.rosterContentHeight = totalHeight;
    this.rosterViewportRect.setTo(content.x, content.y, content.width, content.height);
    this.rosterScrollY = Phaser.Math.Clamp(this.rosterScrollY, 0, Math.max(0, totalHeight - content.height));

    let cursorY = content.y - this.rosterScrollY;

    for (const header of this.rosterHeaderViews) {
      const entries = this.groupedBlueprintIds.get(header.factionId) ?? [];
      header.bounds.setTo(content.x, cursorY, content.width, 16);
      header.text.setPosition(content.x, cursorY);
      header.text.setVisible(this.isRectVisible(header.bounds, this.rosterViewportRect));
      cursorY += 20;

      for (const blueprintId of entries) {
        const row = this.rosterRowViews.find((entry) => entry.blueprintId === blueprintId);

        if (!row) {
          continue;
        }

        row.bounds.setTo(content.x, cursorY, content.width, 42);
        row.titleText.setPosition(content.x + 12, cursorY + 8);
        row.metaText.setPosition(content.x + 12, cursorY + 24);
        row.metaText.setWordWrapWidth(Math.max(180, content.width - 24), true);
        const visible = this.isRectVisible(row.bounds, this.rosterViewportRect);
        row.titleText.setVisible(visible);
        row.metaText.setVisible(visible);
        cursorY += 48;
      }

      cursorY += 4;
    }
  }

  private layoutPreviewPanel(): void {
    const content = BattleUiChrome.getContentBounds(this.previewPanelRect, 'narrow');
    const controlY = content.y;
    const buttonSize = 24;
    const controlGap = 8;
    const terrainPrevButton = this.previewButtons.get('terrain-prev');
    const terrainNextButton = this.previewButtons.get('terrain-next');
    const heightPrevButton = this.previewButtons.get('height-prev');
    const heightNextButton = this.previewButtons.get('height-next');

    terrainPrevButton?.bounds.setTo(content.x + 136, controlY, buttonSize, buttonSize);
    terrainNextButton?.bounds.setTo(content.x + 136 + buttonSize + controlGap, controlY, buttonSize, buttonSize);
    this.previewTerrainText.setOrigin(0, 0).setPosition(content.x, controlY + 5);

    if (heightNextButton && heightPrevButton) {
      heightNextButton.bounds.setTo(content.right - buttonSize, controlY, buttonSize, buttonSize);
      heightPrevButton.bounds.setTo(heightNextButton.bounds.x - controlGap - buttonSize, controlY, buttonSize, buttonSize);
      this.previewHeightText
        .setOrigin(1, 0)
        .setPosition(heightPrevButton.bounds.x - 12, controlY + 5);
    }

    for (const button of this.previewButtons.values()) {
      button.labelText.setPosition(button.bounds.centerX, button.bounds.centerY);
    }

    this.previewMetaRect.setTo(content.x, controlY + 34, content.width, 18);
    this.previewStageRect.setTo(
      content.x,
      this.previewMetaRect.bottom + UI_PANEL_CONTENT_GAP,
      content.width,
      Math.max(160, content.height - 108)
    );
    this.previewHintText.setPosition(content.x, this.previewStageRect.bottom + UI_PANEL_MINI_GAP);
    this.previewHintText.setWordWrapWidth(content.width, true);
  }

  private layoutInspectorPanel(): void {
    const content = BattleUiChrome.getContentBounds(this.inspectorPanelRect, 'narrow');
    const buttonWidth = Math.floor((content.width - UI_PANEL_GAP) / 2);
    const buttonHeight = 28;
    const totalHeight = this.measureInspectorContentHeight(ACTION_BUTTON_ROWS.length, buttonHeight);

    this.inspectorContentHeight = totalHeight;
    this.inspectorViewportRect.setTo(content.x, content.y, content.width, content.height);
    this.inspectorScrollY = Phaser.Math.Clamp(this.inspectorScrollY, 0, Math.max(0, totalHeight - content.height));

    let cursorY = content.y - this.inspectorScrollY;

    this.dirtyCountText.setPosition(content.x, cursorY);
    this.dirtyCountText.setVisible(this.isScrollableTextVisible(this.dirtyCountText, this.inspectorViewportRect));
    cursorY += 18;

    for (const [rowIndex, row] of ACTION_BUTTON_ROWS.entries()) {
      const rowButtonWidth = row.length === 1 ? content.width : buttonWidth;

      for (const [columnIndex, id] of row.entries()) {
        const button = this.actionButtons.get(id);

        if (!button) {
          continue;
        }

        button.bounds.setTo(
          content.x + columnIndex * (rowButtonWidth + UI_PANEL_GAP),
          cursorY + rowIndex * (buttonHeight + UI_PANEL_MINI_GAP),
          rowButtonWidth,
          buttonHeight
        );
        button.labelText.setPosition(button.bounds.centerX, button.bounds.centerY);
        button.labelText.setVisible(this.isRectVisible(button.bounds, this.inspectorViewportRect));
      }
    }

    cursorY += ACTION_BUTTON_ROWS.length * (buttonHeight + UI_PANEL_MINI_GAP) + 4;
    this.readOnlyNoteText.setPosition(content.x, cursorY);
    this.readOnlyNoteText.setWordWrapWidth(content.width, true);
    this.readOnlyNoteText.setVisible(this.isScrollableTextVisible(this.readOnlyNoteText, this.inspectorViewportRect));
    cursorY += 34;

    this.metaBoxRect.setTo(content.x, cursorY, content.width, 126);
    this.metaText.setPosition(this.metaBoxRect.x + 10, this.metaBoxRect.y + 8);
    this.metaText.setWordWrapWidth(this.metaBoxRect.width - 20, true);
    this.metaText.setVisible(this.isRectVisible(this.metaBoxRect, this.inspectorViewportRect));
    cursorY = this.metaBoxRect.bottom + 10;

    this.visualSectionTitle.setPosition(content.x, cursorY);
    this.visualSectionTitle.setVisible(this.isScrollableTextVisible(this.visualSectionTitle, this.inspectorViewportRect));
    cursorY += 18;
    cursorY = this.layoutFieldSection(VISUAL_FIELDS, content.x, content.width, cursorY);

    this.statsSectionTitle.setPosition(content.x, cursorY + 4);
    this.statsSectionTitle.setVisible(this.isScrollableTextVisible(this.statsSectionTitle, this.inspectorViewportRect));
    cursorY += 22;
    cursorY = this.layoutFieldSection(STAT_FIELDS, content.x, content.width, cursorY);

    this.abilitiesSectionTitle.setPosition(content.x, cursorY + 4);
    this.abilitiesSectionTitle.setVisible(this.isScrollableTextVisible(this.abilitiesSectionTitle, this.inspectorViewportRect));
    cursorY += 22;
    this.layoutAbilitySection(content.x, content.width, cursorY);
  }

  private layoutFieldSection(
    fields: readonly EditableUnitBlueprintField[],
    x: number,
    width: number,
    startY: number
  ): number {
    let cursorY = startY;

    for (const field of fields) {
      const view = this.blueprintStepperViews.get(field);

      if (!view) {
        continue;
      }

      this.layoutStepperView(view, x, width, cursorY);
      this.setStepperVisibility(view, this.inspectorViewportRect);
      cursorY += FIELD_ROW_HEIGHT + 6;
    }

    return cursorY;
  }

  private layoutAbilitySection(x: number, width: number, startY: number): void {
    let cursorY = startY;
    let sectionBottom = startY;

    for (const block of this.abilityBlockViews) {
      const stepperViews = block.stepperKeys
        .map((key) => this.abilityStepperViews.get(key))
        .filter((view): view is StepperView => Boolean(view));
      const blockHeight = ABILITY_BLOCK_HEADER_HEIGHT + stepperViews.length * (FIELD_ROW_HEIGHT + 6) + 18;

      block.boxBounds.setTo(x, cursorY, width, blockHeight);
      block.titleText.setPosition(x + 10, cursorY + 8);
      block.metaText.setPosition(x + 10, cursorY + 25);
      block.descriptionText.setPosition(x + 10, cursorY + 42);
      block.descriptionText.setWordWrapWidth(width - 20, true);
      const blockVisible = this.isRectVisible(block.boxBounds, this.inspectorViewportRect);
      block.titleText.setVisible(blockVisible);
      block.metaText.setVisible(blockVisible);
      block.descriptionText.setVisible(blockVisible);

      let stepperY = cursorY + ABILITY_BLOCK_HEADER_HEIGHT;
      for (const view of stepperViews) {
        this.layoutStepperView(view, x + 10, width - 20, stepperY);
        this.setStepperVisibility(view, this.inspectorViewportRect);
        stepperY += FIELD_ROW_HEIGHT + 6;
      }

      cursorY += blockHeight + ABILITY_BLOCK_GAP;
      sectionBottom = block.boxBounds.bottom;
    }

    this.abilitiesBoxRect.setTo(x, startY, width, Math.max(80, sectionBottom - startY));
  }

  private layoutStepperView(view: StepperView, x: number, width: number, y: number): void {
    view.rowBounds.setTo(x, y, width, FIELD_ROW_HEIGHT);
    view.minusBounds.setTo(view.rowBounds.right - FIELD_BUTTON_WIDTH * 2 - 8, y, FIELD_BUTTON_WIDTH, FIELD_ROW_HEIGHT);
    view.plusBounds.setTo(view.rowBounds.right - FIELD_BUTTON_WIDTH, y, FIELD_BUTTON_WIDTH, FIELD_ROW_HEIGHT);

    view.labelText.setPosition(view.rowBounds.x + 10, y + 5);
    view.valueText.setPosition(view.minusBounds.x - 12, y + 3);
    view.valueText.setOrigin(1, 0);
    view.minusText.setPosition(view.minusBounds.centerX, view.minusBounds.centerY);
    view.plusText.setPosition(view.plusBounds.centerX, view.plusBounds.centerY);
  }

  private measureInspectorContentHeight(actionRowCount: number, buttonHeight: number): number {
    return 18
      + actionRowCount * (buttonHeight + UI_PANEL_MINI_GAP)
      + 4
      + 34
      + 126
      + 10
      + 18
      + this.measureFieldSectionHeight(VISUAL_FIELDS)
      + 22
      + this.measureFieldSectionHeight(STAT_FIELDS)
      + 22
      + this.measureAbilitySectionHeight();
  }

  private measureFieldSectionHeight(fields: readonly EditableUnitBlueprintField[]): number {
    return fields.length * (FIELD_ROW_HEIGHT + 6);
  }

  private measureAbilitySectionHeight(): number {
    if (this.abilityBlockViews.length === 0) {
      return 80;
    }

    return this.abilityBlockViews.reduce((total, block, index) => {
      const stepperCount = block.stepperKeys.length;
      const blockHeight = ABILITY_BLOCK_HEADER_HEIGHT + stepperCount * (FIELD_ROW_HEIGHT + 6) + 18;
      return total + blockHeight + (index < this.abilityBlockViews.length - 1 ? ABILITY_BLOCK_GAP : 0);
    }, 0);
  }

  private isRectVisible(rect: Phaser.Geom.Rectangle, viewport: Phaser.Geom.Rectangle): boolean {
    return rect.bottom >= viewport.y && rect.y <= viewport.bottom;
  }

  private isScrollableTextVisible(text: Phaser.GameObjects.Text, viewport: Phaser.Geom.Rectangle): boolean {
    return text.y + text.height >= viewport.y && text.y <= viewport.bottom;
  }

  private setStepperVisibility(view: StepperView, viewport: Phaser.Geom.Rectangle): void {
    const visible = this.isRectVisible(view.rowBounds, viewport);
    view.labelText.setVisible(visible);
    view.valueText.setVisible(visible);
    view.minusText.setVisible(visible);
    view.plusText.setVisible(visible);
  }

  private refreshScene(): void {
    this.ensureAbilityInspectorViews();
    this.drawUi();
    this.refreshTexts();
    this.refreshPreview();
  }

  private drawUi(): void {
    this.staticUiGraphics.clear();
    this.rosterScrollGraphics.clear();
    this.inspectorScrollGraphics.clear();
    BattleUiChrome.drawPanelShell(this.staticUiGraphics, this.rosterPanelRect, 1, 32, 20, UI_COLOR_ACCENT_NEUTRAL);
    BattleUiChrome.drawPanelShell(this.staticUiGraphics, this.previewPanelRect, 1, 32, 20, UI_COLOR_ACCENT_WARM);
    BattleUiChrome.drawPanelShell(this.staticUiGraphics, this.inspectorPanelRect, 1, 32, 20, UI_COLOR_ACCENT_COOL);
    BattleUiChrome.drawInsetBox(this.staticUiGraphics, this.previewStageRect, {
      fillColor: UI_COLOR_PANEL_SHADOW,
      fillAlpha: 0.34,
      strokeAlpha: 0.16
    });
    BattleUiChrome.drawInsetBox(this.inspectorScrollGraphics, this.metaBoxRect, {
      fillColor: UI_COLOR_PANEL_SURFACE_ALT,
      fillAlpha: 0.92
    });

    this.drawButton(this.staticUiGraphics, this.backButton, UI_COLOR_ACCENT_COOL, true);

    for (const row of this.rosterRowViews) {
      const sourceBlueprint = this.blueprintById.get(row.blueprintId);

      if (!sourceBlueprint || !row.titleText.visible) {
        continue;
      }

      const selected = row.blueprintId === this.selectedBlueprintId;
      const dirty = this.dirtyDrafts.has(row.blueprintId);
      const accent = selected ? sourceBlueprint.accentColor : UI_COLOR_ACCENT_NEUTRAL;
      const fillAlpha = selected ? 0.58 : dirty ? 0.28 : 0.18;

      BattleUiChrome.drawInsetBox(this.rosterScrollGraphics, row.bounds, {
        fillColor: accent,
        fillAlpha,
        strokeColor: selected ? UI_COLOR_PANEL_BORDER : accent,
        strokeAlpha: selected ? 0.6 : 0.22,
        radius: 12
      });

      if (dirty) {
        const badgeRect = new Phaser.Geom.Rectangle(row.bounds.right - 70, row.bounds.y + 8, 58, 14);
        BattleUiChrome.drawPill(this.rosterScrollGraphics, badgeRect, {
          fillColor: UI_COLOR_SUCCESS,
          strokeColor: UI_COLOR_PANEL_BORDER,
          fillAlpha: 0.2,
          strokeAlpha: 0.3,
          radius: 7
        });
      }
    }

    for (const button of this.previewButtons.values()) {
      this.drawButton(this.staticUiGraphics, button, UI_COLOR_ACCENT_WARM, true);
    }

    const selectedDirty = this.dirtyDrafts.has(this.selectedBlueprintId);
    const dirtyCount = this.dirtyDrafts.size;
    this.drawButton(this.inspectorScrollGraphics, this.actionButtons.get('reset-selected'), UI_COLOR_ACCENT_DANGER, selectedDirty);
    this.drawButton(this.inspectorScrollGraphics, this.actionButtons.get('reset-all'), UI_COLOR_ACCENT_DANGER, dirtyCount > 0);
    this.drawButton(this.inspectorScrollGraphics, this.actionButtons.get('copy-blueprint-file'), UI_COLOR_ACCENT_COOL, true);

    for (const view of this.blueprintStepperViews.values()) {
      this.drawStepper(this.inspectorScrollGraphics, view);
    }

    for (const block of this.abilityBlockViews) {
      if (!block.titleText.visible) {
        continue;
      }

      BattleUiChrome.drawInsetBox(this.inspectorScrollGraphics, block.boxBounds, {
        fillColor: UI_COLOR_PANEL_SURFACE_ALT,
        fillAlpha: 0.9,
        strokeAlpha: 0.18,
        radius: 12
      });
    }

    for (const view of this.abilityStepperViews.values()) {
      this.drawStepper(this.inspectorScrollGraphics, view);
    }

    this.drawScrollIndicator(
      this.staticUiGraphics,
      this.rosterViewportRect,
      this.rosterContentHeight,
      this.rosterScrollY,
      UI_COLOR_ACCENT_NEUTRAL
    );
    this.drawScrollIndicator(
      this.staticUiGraphics,
      this.inspectorViewportRect,
      this.inspectorContentHeight,
      this.inspectorScrollY,
      UI_COLOR_ACCENT_COOL
    );
  }

  private drawStepper(graphics: Phaser.GameObjects.Graphics, view: StepperView): void {
    if (!view.labelText.visible) {
      return;
    }

    BattleUiChrome.drawInsetBox(graphics, view.rowBounds, {
      fillColor: UI_COLOR_PANEL_SURFACE_ALT,
      fillAlpha: 0.82,
      strokeAlpha: 0.16,
      radius: 12
    });
    BattleUiChrome.drawInsetBox(graphics, view.minusBounds, {
      fillColor: UI_COLOR_ACCENT_NEUTRAL,
      fillAlpha: 0.9,
      strokeAlpha: 0.22,
      radius: 10
    });
    BattleUiChrome.drawInsetBox(graphics, view.plusBounds, {
      fillColor: UI_COLOR_ACCENT_NEUTRAL,
      fillAlpha: 0.9,
      strokeAlpha: 0.22,
      radius: 10
    });
  }

  private drawButton(
    graphics: Phaser.GameObjects.Graphics,
    button: ButtonView | undefined,
    accentColor: number,
    enabled: boolean
  ): void {
    if (!button || !button.labelText.visible) {
      return;
    }

    BattleUiChrome.drawInsetBox(graphics, button.bounds, {
      fillColor: accentColor,
      fillAlpha: enabled ? 0.92 : 0.24,
      strokeColor: enabled ? UI_COLOR_PANEL_BORDER : accentColor,
      strokeAlpha: enabled ? 0.32 : 0.12,
      radius: 12
    });
    button.labelText.setAlpha(enabled ? 1 : 0.42);
  }

  private drawScrollIndicator(
    graphics: Phaser.GameObjects.Graphics,
    viewport: Phaser.Geom.Rectangle,
    contentHeight: number,
    scrollY: number,
    accentColor: number
  ): void {
    if (contentHeight <= viewport.height) {
      return;
    }

    const trackRect = new Phaser.Geom.Rectangle(viewport.right - 6, viewport.y + 2, 4, viewport.height - 4);
    const thumbHeight = Math.max(28, (viewport.height / contentHeight) * trackRect.height);
    const maxThumbOffset = Math.max(0, trackRect.height - thumbHeight);
    const maxScroll = Math.max(1, contentHeight - viewport.height);
    const thumbY = trackRect.y + (scrollY / maxScroll) * maxThumbOffset;
    const thumbRect = new Phaser.Geom.Rectangle(trackRect.x, thumbY, trackRect.width, thumbHeight);

    BattleUiChrome.drawInsetBox(graphics, trackRect, {
      fillColor: UI_COLOR_PANEL_SHADOW,
      fillAlpha: 0.35,
      strokeAlpha: 0,
      radius: 4
    });
    BattleUiChrome.drawInsetBox(graphics, thumbRect, {
      fillColor: accentColor,
      fillAlpha: 0.72,
      strokeAlpha: 0,
      radius: 4
    });
  }

  private refreshTexts(): void {
    const resolvedBlueprint = this.getResolvedSelectedBlueprint();
    const draft = this.getSelectedDraft();
    const dirtyCount = this.dirtyDrafts.size;

    for (const row of this.rosterRowViews) {
      const sourceBlueprint = this.blueprintById.get(row.blueprintId);

      if (!sourceBlueprint) {
        continue;
      }

      const dirty = this.dirtyDrafts.has(row.blueprintId);
      row.titleText.setText(`${sourceBlueprint.name}${dirty ? ' *' : ''}`);
      row.metaText.setText(sourceBlueprint.className);
      row.titleText.setAlpha(row.blueprintId === this.selectedBlueprintId ? 1 : 0.92);
      row.metaText.setAlpha(row.blueprintId === this.selectedBlueprintId ? 0.94 : 0.78);
    }

    this.previewTerrainText.setText(`Terrain: ${this.formatTerrainLabel(this.previewTerrain)}`);
    this.previewHeightText.setText(`Height: ${this.previewHeight}`);
    this.previewHintText.setText(
      'Battle preview only.\nDrag the sprite to tune offsets. Copy Blueprint File exports the current full JSON state.'
    );

    this.dirtyCountText.setText(
      `Edited blueprints: ${dirtyCount}  |  Copy Blueprint File exports the full current JSON.`
    );

    this.metaText.setText([
      `Faction: ${getFactionProfile(resolvedBlueprint.factionId).displayName}`,
      `Basic attack: ${resolvedBlueprint.attackName}`,
      `Attack note: ${resolvedBlueprint.attackText}`,
      `Catchphrase: "${resolvedBlueprint.turnStartCatchPhrase}"`,
      `Drops: ${
        resolvedBlueprint.dropItemId
          ? `${resolvedBlueprint.dropItemId}${resolvedBlueprint.dropQuantity ? ` x${resolvedBlueprint.dropQuantity}` : ''}`
          : 'none'
      }`
    ].join('\n'));

    this.statusText.setText(this.statusMessage);
    this.statusText.setColor(this.statusMessage.includes('failed') || this.statusMessage.includes('unavailable')
      ? '#e8898f'
      : this.statusMessage.includes('copied') || this.statusMessage.includes('downloaded')
        ? '#61d7c7'
        : '#f7edd9');

    for (const [field, view] of this.blueprintStepperViews.entries()) {
      view.valueText.setText(`${draft[field]}`);
    }

    for (const block of this.abilityBlockViews) {
      const ability = resolvedBlueprint.abilities.find((entry) => entry.id === block.abilityId);
      const abilityDraft = draft.abilities.find((entry) => entry.id === block.abilityId);

      if (!ability || !abilityDraft) {
        continue;
      }

      block.titleText.setText(ability.name);
      block.metaText.setText(`${ability.kind.toUpperCase()}  |  ${ability.target.toUpperCase()}`);
      block.descriptionText.setText(ability.description);

      for (const field of getEditableAbilityFields(abilityDraft)) {
        const view = this.abilityStepperViews.get(this.getAbilityStepperKey(abilityDraft.id, field));

        if (!view) {
          continue;
        }

        view.valueText.setText(`${abilityDraft[field] ?? 0}`);
      }
    }
  }

  private refreshPreview(): void {
    const resolvedBlueprint = this.getResolvedSelectedBlueprint();
    const layout = this.getPreviewLayout();
    const tile = { x: 0, y: 0, height: this.previewHeight };
    const topPoints = getTileTopPoints(tile, layout, tile.height);
    const center = isoToScreenPoint(tile, layout, tile.height);
    const tileDepth = getTileDepth(tile, layout, tile.height);
    const groundPoint = getUnitGroundPoint(tile, layout, tile.height, DEFAULT_UNIT_GROUND_OFFSET_Y);
    const wallDrop = Math.max(0, this.previewHeight - -WORLD_EDGE_BASE_LEVEL) * ELEVATION_STEP;
    const terrainPalette = this.getTerrainPalette(this.previewTerrain);
    const assetKey = TERRAIN_TILE_ASSETS[this.previewTerrain][0];
    const previewDisplayHeight = Math.round(resolvedBlueprint.spriteDisplayHeight * UNIT_BLUEPRINT_BATTLE_SCALE);
    const previewOffsetX = Math.round((resolvedBlueprint.spriteOffsetX ?? 0) * UNIT_BLUEPRINT_BATTLE_SCALE);
    const previewOffsetY = Math.round((resolvedBlueprint.spriteOffsetY ?? 0) * UNIT_BLUEPRINT_BATTLE_SCALE);

    this.previewWallGraphics.clear();
    this.previewOutlineGraphics.clear();

    const rightFace = [
      topPoints[1],
      topPoints[2],
      { x: topPoints[2].x, y: topPoints[2].y + wallDrop },
      { x: topPoints[1].x, y: topPoints[1].y + wallDrop }
    ];
    const leftFace = [
      topPoints[3],
      topPoints[2],
      { x: topPoints[2].x, y: topPoints[2].y + wallDrop },
      { x: topPoints[3].x, y: topPoints[3].y + wallDrop }
    ];

    this.previewWallGraphics.fillStyle(terrainPalette.sideRight, 1);
    this.previewWallGraphics.fillPoints(rightFace, true);
    this.previewWallGraphics.lineStyle(2, terrainPalette.outline, 0.88);
    this.previewWallGraphics.strokePoints(rightFace, true, true);
    this.previewWallGraphics.fillStyle(terrainPalette.sideLeft, 1);
    this.previewWallGraphics.fillPoints(leftFace, true);
    this.previewWallGraphics.lineStyle(2, terrainPalette.outline, 0.88);
    this.previewWallGraphics.strokePoints(leftFace, true, true);
    this.previewWallGraphics.setDepth(tileDepth + 0.5);

    this.previewTerrainImage
      .setTexture(assetKey)
      .setDisplaySize(96, 96)
      .setPosition(center.x, center.y)
      .setDepth(tileDepth + 1);
    this.previewOutlineGraphics.lineStyle(2, terrainPalette.detail, 0.38);
    this.previewOutlineGraphics.strokePoints(topPoints, true, true);
    this.previewOutlineGraphics.setDepth(tileDepth + 1.1);

    this.previewContainer.setPosition(groundPoint.x, groundPoint.y).setDepth(tileDepth + 8);
    this.previewMarker.setFillStyle(resolvedBlueprint.accentColor, 0.18);
    this.previewShadow.setFillStyle(0x060205, 0.42);
    this.previewSprite
      .setTexture(resolvedBlueprint.spriteKey)
      .setPosition(previewOffsetX, previewOffsetY);
    this.previewSprite.displayHeight = previewDisplayHeight;
    this.previewSprite.scaleX = this.previewSprite.scaleY;
    this.previewHpBack.setPosition(0, this.previewSprite.y - previewDisplayHeight - 12);
    this.previewHpFill.setPosition(-29, this.previewSprite.y - previewDisplayHeight - 12);
    this.previewHpFill.width = 56;
    this.previewHpFill.setFillStyle(UI_COLOR_SUCCESS, 1);
    this.previewLabel.setText(resolvedBlueprint.name);
    this.previewLabel.setPosition(0, this.previewSprite.y - previewDisplayHeight - 28);
  }

  private getSelectedBlueprint(): UnitBlueprint {
    const blueprint = this.blueprintById.get(this.selectedBlueprintId);

    if (!blueprint) {
      throw new Error(`Missing unit blueprint: ${this.selectedBlueprintId}`);
    }

    return blueprint;
  }

  private getSelectedDraft(): EditableUnitBlueprintDraft {
    return this.getDraftForBlueprint(this.selectedBlueprintId);
  }

  private getDraftForBlueprint(blueprintId: string): EditableUnitBlueprintDraft {
    const dirtyDraft = this.dirtyDrafts.get(blueprintId);

    if (dirtyDraft) {
      return dirtyDraft;
    }

    const blueprint = this.blueprintById.get(blueprintId);

    if (!blueprint) {
      throw new Error(`Missing unit blueprint: ${blueprintId}`);
    }

    return createEditableUnitBlueprintDraft(blueprint);
  }

  private getResolvedSelectedBlueprint(): UnitBlueprint {
    const blueprint = this.getSelectedBlueprint();
    return resolveEditableUnitBlueprint(blueprint, this.getSelectedDraft());
  }

  private ensureAbilityInspectorViews(): void {
    const signature = this.getSelectedDraft().abilities
      .map((ability) => `${ability.id}:${getEditableAbilityFields(ability).join(',')}`)
      .join('|');

    if (signature === this.abilityInspectorSignature) {
      return;
    }

    for (const block of this.abilityBlockViews) {
      block.titleText.destroy();
      block.metaText.destroy();
      block.descriptionText.destroy();
    }

    for (const view of this.abilityStepperViews.values()) {
      view.labelText.destroy();
      view.valueText.destroy();
      view.minusText.destroy();
      view.plusText.destroy();
    }

    this.abilityBlockViews = [];
    this.abilityStepperViews.clear();

    for (const ability of this.getSelectedDraft().abilities) {
      const block: AbilityBlockView = {
        abilityId: ability.id,
        titleText: this.applyInspectorMask(this.add.text(0, 0, ability.name, UI_TEXT_ACTION).setDepth(210)),
        metaText: this.applyInspectorMask(this.add.text(0, 0, '', UI_TEXT_LABEL).setDepth(210)),
        descriptionText: this.applyInspectorMask(this.add.text(0, 0, ability.description, UI_TEXT_BODY).setDepth(210)),
        boxBounds: new Phaser.Geom.Rectangle(),
        stepperKeys: []
      };

      block.descriptionText.setWordWrapWidth(280, true);
      this.abilityBlockViews.push(block);

      for (const field of getEditableAbilityFields(ability)) {
        const key = this.getAbilityStepperKey(ability.id, field);
        const labelText = this.applyInspectorMask(this.add.text(0, 0, ABILITY_FIELD_LABELS[field], UI_TEXT_LABEL).setDepth(210));
        const valueText = this.applyInspectorMask(this.add.text(0, 0, '0', UI_TEXT_ACTION).setDepth(210));
        const minusText = this.applyInspectorMask(this.add.text(0, 0, '-', UI_TEXT_ACTION).setOrigin(0.5).setDepth(210));
        const plusText = this.applyInspectorMask(this.add.text(0, 0, '+', UI_TEXT_ACTION).setOrigin(0.5).setDepth(210));

        this.abilityStepperViews.set(key, {
          target: { kind: 'ability', abilityId: ability.id, field },
          labelText,
          valueText,
          minusText,
          plusText,
          rowBounds: new Phaser.Geom.Rectangle(),
          minusBounds: new Phaser.Geom.Rectangle(),
          plusBounds: new Phaser.Geom.Rectangle()
        });
        block.stepperKeys.push(key);
      }
    }

    this.abilityInspectorSignature = signature;

    if (this.inspectorPanelRect.width > 0 && this.inspectorPanelRect.height > 0) {
      this.layoutInspectorPanel();
    }
  }

  private getPreviewLayout(): IsometricBoardLayout {
    return {
      origin: {
        x: this.previewStageRect.centerX,
        y: Math.round(this.previewStageRect.y + this.previewStageRect.height * 0.7)
      },
      gridWidth: 1,
      gridHeight: 1,
      rotationStep: 0
    };
  }

  private setSelectedBlueprint(blueprintId: string): void {
    if (this.selectedBlueprintId === blueprintId) {
      return;
    }

    this.selectedBlueprintId = blueprintId;
    this.ensureAbilityInspectorViews();
    audioDirector.playUiMove();
    this.playSelectedCatchPhraseVoice();
    this.statusMessage = `Inspecting ${this.getSelectedBlueprint().name}.`;
    this.refreshScene();
  }

  private playSelectedCatchPhraseVoice(): void {
    const blueprint = this.getSelectedBlueprint();
    const audioKey = UNIT_TURN_START_AUDIO_KEYS[blueprint.id];

    if (!audioKey || audioDirector.isMuted() || this.sound.locked) {
      return;
    }

    this.stopSelectedCatchPhraseSound();

    const sound = this.sound.add(audioKey, { volume: 0.9 });
    const played = sound.play();

    if (!played) {
      sound.destroy();
      return;
    }

    this.selectedCatchPhraseSound = sound;
    sound.once('complete', () => {
      if (this.selectedCatchPhraseSound === sound) {
        this.selectedCatchPhraseSound = null;
      }
      sound.destroy();
    });
  }

  private stopSelectedCatchPhraseSound(): void {
    if (!this.selectedCatchPhraseSound) {
      return;
    }

    this.selectedCatchPhraseSound.stop();
    this.selectedCatchPhraseSound.destroy();
    this.selectedCatchPhraseSound = null;
  }

  private getPrimaryAttackAbilityId(blueprint: UnitBlueprint = this.getSelectedBlueprint()): string | null {
    const attackAbility = blueprint.abilities.find((ability) => ability.id === 'attack')
      ?? blueprint.abilities.find((ability) => ability.kind === 'attack');

    return attackAbility?.id ?? null;
  }

  private commitSelectedDraft(nextDraft: EditableUnitBlueprintDraft): EditableUnitBlueprintDraft {
    const blueprint = this.getSelectedBlueprint();
    const sanitizedDraft = sanitizeEditableUnitBlueprintDraft(nextDraft);

    if (diffEditableUnitBlueprintDraft(blueprint, sanitizedDraft)) {
      this.dirtyDrafts.set(blueprint.id, sanitizedDraft);
    } else {
      this.dirtyDrafts.delete(blueprint.id);
    }

    return sanitizedDraft;
  }

  private syncPrimaryAttackRangeFromBlueprint(draft: EditableUnitBlueprintDraft): EditableUnitBlueprintDraft {
    const primaryAttackId = this.getPrimaryAttackAbilityId();

    if (!primaryAttackId) {
      return draft;
    }

    return {
      ...draft,
      abilities: draft.abilities.map((ability) => (
        ability.id === primaryAttackId
          ? {
              ...ability,
              rangeMin: draft.rangeMin,
              rangeMax: draft.rangeMax
            }
          : ability
      ))
    };
  }

  private syncBlueprintRangeFromAbility(
    draft: EditableUnitBlueprintDraft,
    abilityId: string
  ): EditableUnitBlueprintDraft {
    if (abilityId !== this.getPrimaryAttackAbilityId()) {
      return draft;
    }

    const ability = draft.abilities.find((entry) => entry.id === abilityId);

    if (!ability) {
      return draft;
    }

    return {
      ...draft,
      rangeMin: ability.rangeMin,
      rangeMax: Math.max(ability.rangeMin, ability.rangeMax)
    };
  }

  private setDraftField(field: EditableUnitBlueprintField, nextValue: number): void {
    let nextDraft: EditableUnitBlueprintDraft = {
      ...this.getSelectedDraft(),
      [field]: nextValue
    };

    if (field === 'rangeMin' || field === 'rangeMax') {
      nextDraft = this.syncPrimaryAttackRangeFromBlueprint(nextDraft);
    }

    const committedDraft = this.commitSelectedDraft(nextDraft);
    const blueprint = this.getSelectedBlueprint();

    this.statusMessage = `${FIELD_LABELS[field]} set to ${committedDraft[field]} for ${blueprint.name}.`;
    this.refreshScene();
  }

  private setAbilityDraftField(abilityId: string, field: EditableUnitAbilityField, nextValue: number): void {
    let nextDraft: EditableUnitBlueprintDraft = {
      ...this.getSelectedDraft(),
      abilities: this.getSelectedDraft().abilities.map((ability) => (
        ability.id === abilityId
          ? { ...ability, [field]: nextValue }
          : ability
      ))
    };

    if (field === 'rangeMin' || field === 'rangeMax') {
      nextDraft = this.syncBlueprintRangeFromAbility(nextDraft, abilityId);
    }

    const committedDraft = this.commitSelectedDraft(nextDraft);
    const nextAbility = committedDraft.abilities.find((ability) => ability.id === abilityId);

    if (!nextAbility) {
      return;
    }

    this.statusMessage = `${nextAbility.name} ${ABILITY_FIELD_LABELS[field]} set to ${nextAbility[field] ?? 0}.`;
    this.refreshScene();
  }

  private adjustDraftField(field: EditableUnitBlueprintField, delta: number, playSound = true): void {
    const currentDraft = this.getSelectedDraft();
    if (playSound) {
      audioDirector.playUiMove();
    }
    this.setDraftField(field, currentDraft[field] + delta);
  }

  private adjustAbilityDraftField(
    abilityId: string,
    field: EditableUnitAbilityField,
    delta: number,
    playSound = true
  ): void {
    const currentAbility = this.getSelectedDraft().abilities.find((ability) => ability.id === abilityId);

    if (!currentAbility) {
      return;
    }

    if (playSound) {
      audioDirector.playUiMove();
    }

    this.setAbilityDraftField(abilityId, field, (currentAbility[field] ?? 0) + delta);
  }

  private adjustStepperTarget(target: StepperTarget, delta: number, playSound = true): void {
    if (target.kind === 'blueprint') {
      this.adjustDraftField(target.field, delta, playSound);
      return;
    }

    this.adjustAbilityDraftField(target.abilityId, target.field, delta, playSound);
  }

  private cycleTerrain(step: number): void {
    const currentIndex = TERRAIN_ORDER.indexOf(this.previewTerrain);
    const nextIndex = (currentIndex + step + TERRAIN_ORDER.length) % TERRAIN_ORDER.length;
    this.previewTerrain = TERRAIN_ORDER[nextIndex];
    audioDirector.playUiMove();
    this.statusMessage = `Preview terrain changed to ${this.formatTerrainLabel(this.previewTerrain)}.`;
    this.refreshScene();
  }

  private cycleHeight(step: number): void {
    const nextHeight = Phaser.Math.Clamp(this.previewHeight + step, 0, 4);

    if (nextHeight === this.previewHeight) {
      return;
    }

    this.previewHeight = nextHeight;
    audioDirector.playUiMove();
    this.statusMessage = `Preview elevation changed to ${this.previewHeight}.`;
    this.refreshScene();
  }

  private resetSelectedDraft(): void {
    if (!this.dirtyDrafts.has(this.selectedBlueprintId)) {
      this.statusMessage = `${this.getSelectedBlueprint().name} is already at source values.`;
      this.refreshScene();
      return;
    }

    this.dirtyDrafts.delete(this.selectedBlueprintId);
    audioDirector.playUiCancel();
    this.statusMessage = `Reset ${this.getSelectedBlueprint().name} to source values.`;
    this.refreshScene();
  }

  private resetAllDrafts(): void {
    if (this.dirtyDrafts.size === 0) {
      this.statusMessage = 'No blueprint edits to reset.';
      this.refreshScene();
      return;
    }

    this.dirtyDrafts.clear();
    audioDirector.playUiCancel();
    this.statusMessage = 'Cleared all blueprint drafts.';
    this.refreshScene();
  }

  private buildBlueprintFileContents(): string {
    const resolvedBlueprints = Object.fromEntries(
      this.blueprints.map((blueprint) => {
        const dirtyDraft = this.dirtyDrafts.get(blueprint.id);
        return [blueprint.id, dirtyDraft ? resolveEditableUnitBlueprint(blueprint, dirtyDraft) : blueprint];
      })
    );

    return `${JSON.stringify(resolvedBlueprints, null, 2)}\n`;
  }

  private async copyBlueprintFile(): Promise<void> {
    if (!window.navigator.clipboard?.writeText) {
      this.statusMessage = 'Clipboard unavailable in this browser.';
      this.refreshScene();
      return;
    }

    try {
      await window.navigator.clipboard.writeText(this.buildBlueprintFileContents());
      audioDirector.playUiConfirm();
      this.statusMessage = 'Full blueprint file copied. Paste it into unitBlueprints.json in your editor.';
      this.refreshScene();
    } catch {
      this.statusMessage = 'Blueprint file copy failed.';
      this.refreshScene();
    }
  }

  private returnToTitle(): void {
    this.clearStepHold();
    audioDirector.playUiConfirm();
    this.input.enabled = false;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('title');
    });
    this.cameras.main.fadeOut(220, 12, 6, 10);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.clearStepHold();

    if (this.backButton.bounds.contains(pointer.x, pointer.y)) {
      this.returnToTitle();
      return;
    }

    for (const row of this.rosterRowViews) {
      if (row.titleText.visible && row.bounds.contains(pointer.x, pointer.y)) {
        this.setSelectedBlueprint(row.blueprintId);
        return;
      }
    }

    for (const [id, button] of this.previewButtons.entries()) {
      if (!button.bounds.contains(pointer.x, pointer.y)) {
        continue;
      }

      switch (id) {
        case 'terrain-prev':
          this.cycleTerrain(-1);
          return;
        case 'terrain-next':
          this.cycleTerrain(1);
          return;
        case 'height-prev':
          this.cycleHeight(-1);
          return;
        case 'height-next':
          this.cycleHeight(1);
          return;
        default:
          break;
      }
    }

    for (const [id, button] of this.actionButtons.entries()) {
      if (!button.labelText.visible || !button.bounds.contains(pointer.x, pointer.y)) {
        continue;
      }

      switch (id) {
        case 'reset-selected':
          this.resetSelectedDraft();
          return;
        case 'reset-all':
          this.resetAllDrafts();
          return;
        case 'copy-blueprint-file':
          void this.copyBlueprintFile();
          return;
        default:
          break;
      }
    }

    for (const view of this.blueprintStepperViews.values()) {
      if (view.labelText.visible && view.minusBounds.contains(pointer.x, pointer.y)) {
        const delta = this.getStepDelta(pointer, -1);
        this.adjustStepperTarget(view.target, delta);
        this.startStepHold(pointer.id, view.target, delta);
        return;
      }

      if (view.labelText.visible && view.plusBounds.contains(pointer.x, pointer.y)) {
        const delta = this.getStepDelta(pointer, 1);
        this.adjustStepperTarget(view.target, delta);
        this.startStepHold(pointer.id, view.target, delta);
        return;
      }
    }

    for (const view of this.abilityStepperViews.values()) {
      if (view.labelText.visible && view.minusBounds.contains(pointer.x, pointer.y)) {
        const delta = this.getStepDelta(pointer, -1);
        this.adjustStepperTarget(view.target, delta);
        this.startStepHold(pointer.id, view.target, delta);
        return;
      }

      if (view.labelText.visible && view.plusBounds.contains(pointer.x, pointer.y)) {
        const delta = this.getStepDelta(pointer, 1);
        this.adjustStepperTarget(view.target, delta);
        this.startStepHold(pointer.id, view.target, delta);
        return;
      }
    }

    if (this.previewSprite.getBounds().contains(pointer.x, pointer.y)) {
      this.dragPointerId = pointer.id;
      this.dragPointerOrigin.set(pointer.x, pointer.y);
      const draft = this.getSelectedDraft();
      this.dragOffsetOrigin.set(draft.spriteOffsetX, draft.spriteOffsetY);
      this.statusMessage = 'Dragging preview sprite. Release to keep the new offsets.';
      this.refreshScene();
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragPointerId !== pointer.id || !pointer.isDown) {
      return;
    }

    const nextOffsetX = this.dragOffsetOrigin.x + (pointer.x - this.dragPointerOrigin.x) / UNIT_BLUEPRINT_BATTLE_SCALE;
    const nextOffsetY = this.dragOffsetOrigin.y + (pointer.y - this.dragPointerOrigin.y) / UNIT_BLUEPRINT_BATTLE_SCALE;
    const nextDraft = this.commitSelectedDraft({
      ...this.getSelectedDraft(),
      spriteOffsetX: nextOffsetX,
      spriteOffsetY: nextOffsetY
    });
    const blueprint = this.getSelectedBlueprint();

    this.statusMessage = `Dragging ${blueprint.name}: offset (${nextDraft.spriteOffsetX}, ${nextDraft.spriteOffsetY}).`;
    this.refreshScene();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.stepHoldPointerId === pointer.id) {
      this.clearStepHold();
    }

    if (this.dragPointerId !== pointer.id) {
      return;
    }

    this.dragPointerId = null;
    audioDirector.playUiConfirm();
    this.statusMessage = `${this.getSelectedBlueprint().name} offsets updated.`;
    this.refreshScene();
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    if (this.rosterViewportRect.contains(pointer.x, pointer.y)) {
      this.scrollRoster(deltaY);
      return;
    }

    if (this.inspectorViewportRect.contains(pointer.x, pointer.y)) {
      this.scrollInspector(deltaY);
    }
  }

  private formatTerrainLabel(terrain: TerrainType): string {
    return terrain.charAt(0).toUpperCase() + terrain.slice(1);
  }

  private getStepDelta(pointer: Phaser.Input.Pointer, baseDelta: number): number {
    return baseDelta * (this.isShiftPressed(pointer) ? 5 : 1);
  }

  private scrollRoster(deltaY: number): void {
    const nextScrollY = Phaser.Math.Clamp(
      this.rosterScrollY + deltaY,
      0,
      Math.max(0, this.rosterContentHeight - this.rosterViewportRect.height)
    );

    if (nextScrollY === this.rosterScrollY) {
      return;
    }

    this.rosterScrollY = nextScrollY;
    this.layoutRosterPanel();
    this.refreshScene();
  }

  private scrollInspector(deltaY: number): void {
    const nextScrollY = Phaser.Math.Clamp(
      this.inspectorScrollY + deltaY,
      0,
      Math.max(0, this.inspectorContentHeight - this.inspectorViewportRect.height)
    );

    if (nextScrollY === this.inspectorScrollY) {
      return;
    }

    this.inspectorScrollY = nextScrollY;
    this.layoutInspectorPanel();
    this.refreshScene();
  }

  private isShiftPressed(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event;

    if (event && 'shiftKey' in event && typeof event.shiftKey === 'boolean') {
      return event.shiftKey;
    }

    return false;
  }

  private startStepHold(pointerId: number, target: StepperTarget, delta: number): void {
    this.clearStepHold();
    this.stepHoldPointerId = pointerId;
    this.stepHoldTarget = target;
    this.stepHoldTimer = this.time.delayedCall(320, () => {
      if (this.stepHoldPointerId !== pointerId || !this.isSameStepperTarget(this.stepHoldTarget, target)) {
        return;
      }

      this.adjustStepperTarget(target, delta, false);
      this.stepHoldTimer = this.time.addEvent({
        delay: 75,
        loop: true,
        callback: () => {
          if (this.stepHoldPointerId !== pointerId || !this.isSameStepperTarget(this.stepHoldTarget, target)) {
            return;
          }

          this.adjustStepperTarget(target, delta, false);
        }
      });
    });
  }

  private clearStepHold(): void {
    this.stepHoldTimer?.remove(false);
    this.stepHoldTimer = null;
    this.stepHoldPointerId = null;
    this.stepHoldTarget = null;
  }

  private getAbilityStepperKey(abilityId: string, field: EditableUnitAbilityField): string {
    return `${abilityId}:${field}`;
  }

  private isSameStepperTarget(left: StepperTarget | null, right: StepperTarget): boolean {
    if (!left || left.kind !== right.kind) {
      return false;
    }

    if (left.kind === 'blueprint') {
      return left.field === right.field;
    }

    return right.kind === 'ability' && left.abilityId === right.abilityId && left.field === right.field;
  }

  private fitBackdrop(image: Phaser.GameObjects.Image, width: number, height: number, overscan = 1): void {
    const textureSource = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const textureWidth = textureSource.width || 1;
    const textureHeight = textureSource.height || 1;
    const scale = Math.max(width / textureWidth, height / textureHeight) * overscan;

    image.setPosition(width * 0.5, height * 0.5);
    image.setScale(scale);
  }

  private getTerrainPalette(terrain: TerrainType): {
    sideLeft: number;
    sideRight: number;
    outline: number;
    detail: number;
  } {
    switch (terrain) {
      case 'grass':
        return {
          sideLeft: 0x334e2c,
          sideRight: 0x24371f,
          outline: 0x182012,
          detail: 0xb9c97b
        };
      case 'moss':
        return {
          sideLeft: 0x444933,
          sideRight: 0x2d3024,
          outline: 0x1b1f15,
          detail: 0x9ba36a
        };
      case 'stone':
        return {
          sideLeft: 0x57514f,
          sideRight: 0x403d3b,
          outline: 0x1e1a1a,
          detail: 0xc8b991
        };
      case 'sanctum':
        return {
          sideLeft: 0x6d5947,
          sideRight: 0x4d3e34,
          outline: 0x241713,
          detail: 0xf8dea0
        };
      default:
        return {
          sideLeft: 0x4a4a4a,
          sideRight: 0x343434,
          outline: 0x111111,
          detail: 0xffffff
        };
    }
  }
}
