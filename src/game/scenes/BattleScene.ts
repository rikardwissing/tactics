import Phaser from 'phaser';
import { DEFAULT_UNIT_IMAGE_KEY, FACTION_MOTTO_AUDIO_KEYS } from '../assets';
import { audioDirector } from '../audio/audioDirector';
import { calculateDamage, pickNextActor, projectTurnOrder } from '../core/combat';
import { CombatEffectDefinition, CombatEffectId, getCombatEffectDefinition } from '../core/combatEffects';
import { getInventoryEntries, getItemDefinition, ItemId } from '../core/items';
import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from '../core/mapData';
import { buildPath, getReachableNodes, getTile, manhattanDistance, pointKey } from '../core/pathfinding';
import { AttackStyle, BattleUnit, FactionId, IdleStyle, Point, ReachNode, TerrainType, TileData, UnitAbility } from '../core/types';
import { createLevelMap, createLevelUnits, CURRENT_LEVEL, getLevel } from '../levels';
import { getFactionProfile } from '../levels/factions';
import { ChestPlacement, LevelDefinition, MapPropAssetId, MapPropPlacement } from '../levels/types';
import { ActionMenuPanelDescriptor, BattleActionMenuStack } from './components/BattleActionMenuStack';
import {
  BattleUiChrome,
  UI_INSET_RADIUS,
  UI_NARROW_HEADER_TITLE_TEXT_STYLE,
  UI_NARROW_PLAQUE_HEADER_HEIGHT,
  UI_PANEL_COMPACT_GAP,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_GAP,
  UI_PANEL_HEADER_INSET,
  UI_PANEL_MINI_GAP,
  UI_PANEL_MICRO_GAP,
  UI_PANEL_TIGHT_GAP,
  UI_PLAQUE_HEADER_HEIGHT,
  UI_SCREEN_MARGIN
} from './components/BattleUiChrome';
import { createUiGrid, createUiSubGrid } from './components/UiGrid';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_DANGER,
  UI_COLOR_OVERLAY,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SHADOW,
  UI_COLOR_PANEL_SURFACE,
  UI_COLOR_PANEL_SURFACE_ALT,
  UI_COLOR_SUCCESS,
  UI_COLOR_TEXT
} from './components/UiColors';
import {
  UI_TEXT_ACTION,
  UI_TEXT_BODY,
  UI_TEXT_BODY_CENTER,
  UI_TEXT_DAMAGE,
  UI_TEXT_DAMAGE_CRITICAL,
  UI_TEXT_DISPLAY_CENTER,
  UI_TEXT_LABEL,
  UI_TEXT_LABEL_CENTER,
  UI_TEXT_TITLE,
  UI_TEXT_TITLE_CENTER,
  UI_TEXT_WORLD_BARK,
  UI_TEXT_WORLD_LABEL
} from './components/UiTextStyles';
import { TurnOrderPanel } from './components/TurnOrderPanel';

type Phase =
  | 'intro'
  | 'player-menu'
  | 'player-abilities'
  | 'player-move'
  | 'player-action'
  | 'player-items'
  | 'player-item-action'
  | 'enemy'
  | 'animating'
  | 'complete';

type MenuAction = 'move' | 'abilities' | 'items' | 'wait';
type UiLayoutMode = 'portrait' | 'landscape' | 'wide';
type HeaderMenuAction = 'auto' | 'audio' | 'restart';
type InspectionTarget =
  | { kind: 'unit'; unitId: string }
  | { kind: 'tile'; x: number; y: number }
  | { kind: 'mission' };
type BattleIntroPhase = 'intro' | 'hud';

interface UnitView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  marker: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  hpBack: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  spriteBaseScale: number;
  spriteBaseY: number;
}

interface ChestState extends ChestPlacement {
  opened: boolean;
}

interface ChestView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  aura: Phaser.GameObjects.Ellipse;
  closedSprite: Phaser.GameObjects.Image;
  openSprite: Phaser.GameObjects.Image;
  closedBaseY: number;
  openBaseY: number;
  openBaseScale: number;
}

interface PropView {
  base: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
  shadowOverlay?: Phaser.GameObjects.Graphics;
  groundGlow?: Phaser.GameObjects.Image;
  haloGlow?: Phaser.GameObjects.Image;
  embers?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface DynamicLightSource {
  prop: MapPropPlacement;
  point: Phaser.Math.Vector2;
  radius: number;
  color: number;
  strength: number;
}

interface MenuEntry {
  action: MenuAction;
  label: string;
  enabled: boolean;
}

interface SubmenuEntry {
  label: string;
  enabled: boolean;
  abilityId?: string;
  itemId?: ItemId;
  action?: 'confirm-ability' | 'confirm-item';
}

interface DockActionEntry {
  id: string;
  label: string;
  enabled: boolean;
  active: boolean;
}

interface BattleHudViewModel {
  badgeText: string;
  metaText: string;
  titleText: string;
  bodyText: string;
  statValues: string[];
  healthRatio: number | null;
  healthColor: number;
  actionEntries: DockActionEntry[];
}

interface DetailPanelLayoutMetrics {
  contentBounds: Phaser.Geom.Rectangle;
  infoBounds: Phaser.Geom.Rectangle;
  portraitBounds: Phaser.Geom.Rectangle;
  healthBarBounds: Phaser.Geom.Rectangle;
  bodyBoxBounds: Phaser.Geom.Rectangle;
  statChipBounds: Phaser.Geom.Rectangle[];
  statPositions: Array<Phaser.Math.Vector2 | null>;
  metaY: number;
  titleY: number;
  bodyTextX: number;
  bodyTextY: number;
  requiredHeight: number;
}

type PanKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

const ROTATION_STEP_DEGREES = 90;
const DEFAULT_BOARD_ZOOM = 1;
const BASE_MIN_BOARD_ZOOM = 0.72;
const MAX_BOARD_ZOOM = 1.8;
const BOARD_ZOOM_SENSITIVITY = 0.00055;
const TOUCH_PAN_THRESHOLD = 14;
const CHEST_DISPLAY_WIDTH = 47;
const CHEST_GROUND_OFFSET_Y = TILE_HEIGHT / 2 - 15;
const UNIT_CAMERA_FOCUS_HEIGHT_FACTOR = 0.5;
const UNIT_FOLLOW_SCREEN_ANCHOR_Y = 0.34;

const BASE_UI_PANELS = {
  topLeft: new Phaser.Geom.Rectangle(20, 18, 392, 164),
  bottomLeft: new Phaser.Geom.Rectangle(20, 514, 336, 186),
  topRight: new Phaser.Geom.Rectangle(892, 18, 368, 236),
  bottomRight: new Phaser.Geom.Rectangle(904, 514, 356, 186),
  portrait: new Phaser.Geom.Rectangle(1104, 58, 136, 152)
} as const;

const BASE_ACTION_MENU_PANELS = {
  root: new Phaser.Geom.Rectangle(880, 498, 186, 188),
  sub: new Phaser.Geom.Rectangle(1038, 498, 286, 222)
} as const;

const DETAIL_PANEL_FIXED_WIDTH = 352;
const DETAIL_PANEL_MIN_WIDTH = 260;
const DETAIL_PANEL_PORTRAIT_WIDTH = 74;
const DETAIL_PANEL_PORTRAIT_HEIGHT = 90;
const DETAIL_PANEL_PORTRAIT_GAP = 10;
const DETAIL_PANEL_BODY_PADDING_X = 10;
const DETAIL_PANEL_BODY_PADDING_Y = 8;
const DETAIL_PANEL_TOP_PADDING_Y = 6;
const DETAIL_PANEL_META_GAP = 6;
const DETAIL_PANEL_TITLE_GAP = 8;
const DETAIL_PANEL_HEALTH_GAP = 8;
const DETAIL_PANEL_STAT_ROW_GAP = 8;
const DETAIL_PANEL_SECTION_GAP = 10;
const DETAIL_PANEL_CHIP_PADDING_X = 10;
const DETAIL_PANEL_CHIP_PADDING_Y = 5;

type HudControlAction = 'zoom-in' | 'zoom-out' | 'rotate-left' | 'rotate-right' | 'mute';

interface HudControl {
  action: HudControlAction;
  container: Phaser.GameObjects.Container;
}

const TERRAIN_TILE_ASSETS: Record<TerrainType, readonly string[]> = {
  grass: ['terrain-grass-a', 'terrain-grass-b'],
  moss: ['terrain-moss-a', 'terrain-moss-b'],
  stone: ['terrain-stone-a', 'terrain-stone-b'],
  sanctum: ['terrain-sanctum-a']
};

type PropRenderConfig = {
  height: number;
  minWidth: number;
  offsetX?: number;
  groundOffsetY?: number;
  baseFill: number;
  baseAlpha: number;
  rim: number;
  rimAlpha: number;
  blocksMovement: boolean;
  description: string;
  light?: {
    color: number;
    radius: number;
    intensity: number;
    sourceOffsetY: number;
    emberTint: number[];
  };
};

const PROP_RENDER_CONFIG: Record<MapPropAssetId, PropRenderConfig> = {
  'obstacle-rubble-barricade': {
    height: 132,
    minWidth: 104,
    baseFill: 0x181410,
    baseAlpha: 0.18,
    rim: 0x8c8576,
    rimAlpha: 0.12,
    blocksMovement: true,
    description: 'A towering stone outcrop claims the whole tile and blocks passage.'
  },
  'light-torch': {
    height: 88,
    minWidth: 44,
    offsetX: -3,
    groundOffsetY: 11,
    baseFill: 0x2c2118,
    baseAlpha: 0.1,
    rim: 0x7f5f32,
    rimAlpha: 0.16,
    blocksMovement: true,
    description: 'An iron torch stand throws warm light over the nearby stones.',
    light: {
      color: 0xffb45f,
      radius: 228,
      intensity: 1.8,
      sourceOffsetY: 58,
      emberTint: [0xffefb0, 0xffa24d, 0xd45a1d]
    }
  },
  'sanctum-brazier': {
    height: 80,
    minWidth: 60,
    groundOffsetY: 21,
    baseFill: 0x2f2118,
    baseAlpha: 0.12,
    rim: 0x8c6535,
    rimAlpha: 0.18,
    blocksMovement: true,
    description: 'A sanctum brazier burns bright, pushing back the dark around the altar.',
    light: {
      color: 0xffc977,
      radius: 272,
      intensity: 2.15,
      sourceOffsetY: 48,
      emberTint: [0xfff2bb, 0xffb45f, 0xc95924]
    }
  }
};

type TimeOfDayId = 'day' | 'dusk' | 'night' | 'dawn';
type DetailPortraitKind = 'unit' | 'prop' | 'chest' | 'terrain';

const TIME_OF_DAY_ORDER: readonly TimeOfDayId[] = ['day', 'dusk', 'night', 'dawn'];

const TIME_OF_DAY_CONFIG: Record<
  TimeOfDayId,
  {
    label: string;
    backdropTint: number;
    backdropAlpha: number;
    shadeColor: number;
    shadeAlpha: number;
    ambientColor: number;
    ambientAlpha: number;
    worldTint: number;
    lightBoost: number;
  }
> = {
  day: {
    label: 'Day',
    backdropTint: 0xffffff,
    backdropAlpha: 0.18,
    shadeColor: 0x12070d,
    shadeAlpha: 0.5,
    ambientColor: 0xf4e7c2,
    ambientAlpha: 0.04,
    worldTint: 0xffffff,
    lightBoost: 0.42
  },
  dusk: {
    label: 'Dusk',
    backdropTint: 0xffc49b,
    backdropAlpha: 0.18,
    shadeColor: 0x23101d,
    shadeAlpha: 0.74,
    ambientColor: 0x54243c,
    ambientAlpha: 0.32,
    worldTint: 0xd9c0b5,
    lightBoost: 1.65
  },
  night: {
    label: 'Night',
    backdropTint: 0x8ca8dc,
    backdropAlpha: 0.1,
    shadeColor: 0x050c17,
    shadeAlpha: 0.9,
    ambientColor: 0x0a1a32,
    ambientAlpha: 0.5,
    worldTint: 0x9db3d4,
    lightBoost: 2.7
  },
  dawn: {
    label: 'Dawn',
    backdropTint: 0xffdfbb,
    backdropAlpha: 0.16,
    shadeColor: 0x271520,
    shadeAlpha: 0.68,
    ambientColor: 0xa06140,
    ambientAlpha: 0.24,
    worldTint: 0xe4d0b4,
    lightBoost: 1.35
  }
};

const WORLD_EDGE_BASE_LEVEL = 1;
const UNIT_GROUND_OFFSET_Y = 6;
const UNIT_FOOTPRINT_OFFSET_Y = -4;
const SOFT_LIGHT_TEXTURE_KEY = 'soft-light';
const MAP_TITLE_INTRO_DURATION = 320;
const MAP_TITLE_INTRO_HOLD = 880;
const MAP_TITLE_OUTRO_DURATION = 360;
export class BattleScene extends Phaser.Scene {
  private level: LevelDefinition = CURRENT_LEVEL;
  private map: TileData[] = [];
  private units: BattleUnit[] = [];
  private chests: ChestState[] = [];
  private views = new Map<string, UnitView>();
  private chestViews = new Map<string, ChestView>();
  private propViews = new Map<string, PropView>();
  private backdropImage!: Phaser.GameObjects.Image;
  private backdropShade!: Phaser.GameObjects.Rectangle;
  private ambientOverlay!: Phaser.GameObjects.Rectangle;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private lightShadowGraphics!: Phaser.GameObjects.Graphics;
  private lightGroundOverlays: Phaser.GameObjects.Graphics[] = [];
  private lightShadowOverlays: Phaser.GameObjects.Graphics[] = [];
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private terrainTileImages: Phaser.GameObjects.Image[] = [];
  private wallGraphics: Phaser.GameObjects.Graphics[] = [];
  private highlightOverlays: Phaser.GameObjects.Graphics[] = [];
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private actionMenuStack!: BattleActionMenuStack;
  private turnOrderPanel!: TurnOrderPanel;
  private mapPlaqueEyebrowText!: Phaser.GameObjects.Text;
  private mapPlaqueTitleText!: Phaser.GameObjects.Text;
  private mapPlaqueMetaText!: Phaser.GameObjects.Text;
  private mapObjectiveTagText!: Phaser.GameObjects.Text;
  private mapObjectiveText!: Phaser.GameObjects.Text;
  private mapIntroEyebrowText!: Phaser.GameObjects.Text;
  private mapIntroTitleText!: Phaser.GameObjects.Text;
  private mapIntroMetaText!: Phaser.GameObjects.Text;
  private mapIntroFlavorText!: Phaser.GameObjects.Text;
  private logLabelText!: Phaser.GameObjects.Text;
  private autoBattleToggleText!: Phaser.GameObjects.Text;
  private detailMetaText!: Phaser.GameObjects.Text;
  private detailTitleText!: Phaser.GameObjects.Text;
  private detailStatTexts: Phaser.GameObjects.Text[] = [];
  private detailBodyText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private activeBadge!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private activeUnitId: string | null = null;
  private selectedAbilityId: string | null = null;
  private selectedItemId: ItemId | null = null;
  private hoverTile: TileData | null = null;
  private moveNodes = new Map<string, ReachNode>();
  private phase: Phase = 'intro';
  private busy = false;
  private isPanning = false;
  private logLines: string[] = [];
  private origin = { x: 640, y: 176 };
  private boardPivot = new Phaser.Math.Vector2(640, 176);
  private boardRotationStep = 0;
  private gridWidth = 0;
  private gridHeight = 0;
  private cameraBounds = new Phaser.Geom.Rectangle();
  private panPointerOrigin = new Phaser.Math.Vector2();
  private panCameraOrigin = new Phaser.Math.Vector2();
  private worldCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private panKeys?: PanKeys;
  private unitInventories = new Map<string, Partial<Record<ItemId, number>>>();
  private turnMoveUsed = false;
  private turnActionUsed = false;
  private autoBattleEnabled = false;
  private autoBattleRunToken = 0;
  private activeAutoBattleRunToken: number | null = null;
  private timeOfDay: TimeOfDayId = 'dusk';
  private restarting = false;
  private mapIntroAlpha = 0;
  private mapIntroOffsetY = 18;
  private mapPlaqueAlpha = 1;
  private mapPlaqueOffsetX = 0;
  private detailPanelAlpha = 0;
  private detailPanelOffsetX = 24;
  private detailPanelSelectionKey: string | null = null;
  private detailPanelTween?: Phaser.Tweens.Tween;
  private turnStartCatchPhraseText: Phaser.GameObjects.Text | null = null;
  private turnStartCatchPhraseEvent: Phaser.Time.TimerEvent | null = null;
  private factionMottoPlayed = new Set<FactionId>();
  private pendingFactionMottoId: FactionId | null = null;
  private factionMottoSound: Phaser.Sound.BaseSound | null = null;
  private mapIntroBounds = new Phaser.Geom.Rectangle();
  private mapObjectiveBoxBounds = new Phaser.Geom.Rectangle();
  private detailBodyBoxBounds = new Phaser.Geom.Rectangle();
  private detailHealthBarBounds = new Phaser.Geom.Rectangle();
  private detailStatChipBounds = Array.from({ length: 4 }, () => new Phaser.Geom.Rectangle());
  private headerRect = new Phaser.Geom.Rectangle();
  private playAreaRect = new Phaser.Geom.Rectangle();
  private dockRect = new Phaser.Geom.Rectangle();
  private turnOrderBounds = new Phaser.Geom.Rectangle();
  private autoBattleToggleBounds = new Phaser.Geom.Rectangle();
  private headerMenuButtonBounds = new Phaser.Geom.Rectangle();
  private headerMenuPanelBounds = new Phaser.Geom.Rectangle();
  private dockActionBounds = Array.from({ length: 6 }, () => new Phaser.Geom.Rectangle());
  private headerMenuOptionBounds = Array.from({ length: 4 }, () => new Phaser.Geom.Rectangle());
  private uiLayoutMode: UiLayoutMode = 'wide';
  private uiPanels = {
    topLeft: new Phaser.Geom.Rectangle(
      BASE_UI_PANELS.topLeft.x,
      BASE_UI_PANELS.topLeft.y,
      BASE_UI_PANELS.topLeft.width,
      BASE_UI_PANELS.topLeft.height
    ),
    bottomLeft: new Phaser.Geom.Rectangle(
      BASE_UI_PANELS.bottomLeft.x,
      BASE_UI_PANELS.bottomLeft.y,
      BASE_UI_PANELS.bottomLeft.width,
      BASE_UI_PANELS.bottomLeft.height
    ),
    topRight: new Phaser.Geom.Rectangle(
      BASE_UI_PANELS.topRight.x,
      BASE_UI_PANELS.topRight.y,
      BASE_UI_PANELS.topRight.width,
      BASE_UI_PANELS.topRight.height
    ),
    bottomRight: new Phaser.Geom.Rectangle(
      BASE_UI_PANELS.bottomRight.x,
      BASE_UI_PANELS.bottomRight.y,
      BASE_UI_PANELS.bottomRight.width,
      BASE_UI_PANELS.bottomRight.height
    ),
    portrait: new Phaser.Geom.Rectangle(
      BASE_UI_PANELS.portrait.x,
      BASE_UI_PANELS.portrait.y,
      BASE_UI_PANELS.portrait.width,
      BASE_UI_PANELS.portrait.height
    )
  };
  private hudControls: HudControl[] = [];
  private showHudControls = false;
  private showPortraitPanel = true;
  private showDetailPanel = true;
  private showTimelinePanel = true;
  private minimalMobileLayout = false;
  private compactLayout = false;
  private portraitLayout = false;
  private visibleTurnOrderCount = 6;
  private visibleLogLines = 3;
  private actionMenuRowHeight = 22;
  private inspectionTarget: InspectionTarget = { kind: 'mission' };
  private hudViewModel: BattleHudViewModel = {
    badgeText: 'BATTLE STATUS',
    metaText: '',
    titleText: '',
    bodyText: '',
    statValues: [],
    healthRatio: null,
    healthColor: 0x61d7c7,
    actionEntries: []
  };
  private headerMenuOpen = false;
  private battleIntroPhase: BattleIntroPhase = 'hud';
  private headerMenuTitleText!: Phaser.GameObjects.Text;
  private headerMenuOptionTexts: Phaser.GameObjects.Text[] = [];
  private dockActionTexts: Phaser.GameObjects.Text[] = [];
  private touchPointerId: number | null = null;
  private touchSecondaryPointerId: number | null = null;
  private pendingTouchTap = false;
  private touchTapOrigin = new Phaser.Math.Vector2();
  private pinchStartDistance = 0;
  private pinchStartZoom = DEFAULT_BOARD_ZOOM;
  private resultOverlayShade?: Phaser.GameObjects.Rectangle;
  private resultOverlayTitle?: Phaser.GameObjects.Text;
  private resultOverlayBody?: Phaser.GameObjects.Text;
  private rng = new Phaser.Math.RandomDataGenerator(['crimson-tactics']);

  constructor() {
    super('battle');
  }

  init(data?: { levelId?: string }): void {
    this.level = data?.levelId ? getLevel(data.levelId) : CURRENT_LEVEL;
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('battle');
    void audioDirector.unlock().catch(() => undefined);

    this.restarting = false;
    this.worldCamera = this.cameras.main;
    this.uiCamera = undefined;
    this.map = createLevelMap(this.level);
    this.units = createLevelUnits(this.level);
    this.chests = this.level.chests.map((chest) => ({ ...chest, opened: false }));
    this.views.clear();
    this.chestViews.clear();
    this.propViews.clear();
    this.terrainTileImages = [];
    this.wallGraphics = [];
    this.lightGroundOverlays = [];
    this.lightShadowOverlays = [];
    this.highlightOverlays = [];
    this.activeUnitId = null;
    this.selectedAbilityId = null;
    this.selectedItemId = null;
    this.hoverTile = null;
    this.inspectionTarget = { kind: 'mission' };
    this.headerMenuOpen = false;
    this.battleIntroPhase = 'intro';
    this.moveNodes.clear();
    this.phase = 'intro';
    this.busy = false;
    this.logLines = [];
    this.gridWidth = Math.max(...this.map.map((tile) => tile.x)) + 1;
    this.gridHeight = Math.max(...this.map.map((tile) => tile.y)) + 1;
    this.unitInventories.clear();
    for (const unit of this.units) {
      this.unitInventories.set(unit.id, {});
    }
    this.turnMoveUsed = false;
    this.turnActionUsed = false;
    this.boardRotationStep = 0;
    this.boardPivot = this.getBaseBoardPivot();
    this.touchPointerId = null;
    this.touchSecondaryPointerId = null;
    this.pendingTouchTap = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoom = DEFAULT_BOARD_ZOOM;
    this.resultOverlayShade = undefined;
    this.resultOverlayTitle = undefined;
    this.resultOverlayBody = undefined;
    this.mapIntroAlpha = 0;
    this.mapIntroOffsetY = 18;
    this.mapPlaqueAlpha = 0;
    this.mapPlaqueOffsetX = 0;
    this.detailPanelAlpha = 0;
    this.detailPanelOffsetX = 24;
    this.detailPanelSelectionKey = null;
    this.detailPanelTween?.remove();
    this.detailPanelTween = undefined;
    this.clearTurnStartCatchPhrase();
    this.factionMottoPlayed.clear();
    this.pendingFactionMottoId = null;
    this.stopFactionMottoSound();
    this.syncSceneAudioMute();

    this.input.addPointer(2);

    this.backdropImage = this.add.image(this.scale.width / 2, this.scale.height / 2, 'title-backdrop').setScrollFactor(0);
    this.backdropShade = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x12070d, 0.58).setScrollFactor(0);
    this.createLightTexture();

    this.boardGraphics = this.add.graphics();
    this.lightShadowGraphics = this.add.graphics();
    this.highlightGraphics = this.add.graphics();
    this.uiGraphics = this.add.graphics();
    this.actionMenuStack = new BattleActionMenuStack(this, {
      onCreateObject: (object) => {
        this.getWorldCamera().ignore(object);
      }
    });
    this.boardGraphics.setDepth(40);
    this.lightShadowGraphics.setDepth(45);
    this.highlightGraphics.setDepth(90);
    this.uiGraphics.setDepth(860).setScrollFactor(0);
    this.ambientOverlay = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x102746, 0)
      .setDepth(44)
      .setScrollFactor(0);

    this.drawBoard();
    this.createTerrainTiles();
    this.createProps();
    this.createChests();
    this.createUnits();
    this.applyTimeOfDay();
    this.configureCamera(true);
    this.createUi();
    this.createParticles();
    this.setupCameras();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.registerInputs();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize(this.scale.gameSize);

    this.pushLog(`${this.getFactionDisplayNameForTeam('player')} and ${this.getFactionDisplayNameForTeam('enemy')} clash on the ruined ridge.`);
    this.pushLog('Take the crest and break the enemy line before they close around the altar.');
    this.refreshUi();
    this.startMapTitleSequence();

    this.time.delayedCall(MAP_TITLE_INTRO_DURATION + MAP_TITLE_INTRO_HOLD + MAP_TITLE_OUTRO_DURATION + 120, () => {
      this.beginNextTurn();
    });
  }

  private registerInputs(): void {
    this.input.removeAllListeners();
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.phase === 'complete' || this.isBattleIntroActive()) {
        if (this.hoverTile) {
          this.hoverTile = null;
          this.drawHighlights();
        }
        return;
      }

      if (pointer.wasTouch) {
        this.handleTouchPointerMove(pointer);
        return;
      }

      if (this.isPanning) {
        const camera = this.getWorldCamera();
        this.setBoardScroll(
          this.panCameraOrigin.x - (pointer.x - this.panPointerOrigin.x) / camera.zoom,
          this.panCameraOrigin.y - (pointer.y - this.panPointerOrigin.y) / camera.zoom
        );
        return;
      }

      if (this.isPointerOverUi(pointer.x, pointer.y)) {
        if (this.hoverTile) {
          this.hoverTile = null;
          this.drawHighlights();
        }
        return;
      }

      const worldPoint = pointer.positionToCamera(this.getWorldCamera()) as Phaser.Math.Vector2;
      this.hoverTile = this.pickTile(worldPoint.x, worldPoint.y);
      this.drawHighlights();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isBattleIntroActive()) {
        return;
      }

      if (pointer.wasTouch) {
        this.handleTouchPointerDown(pointer);
        return;
      }

      if (pointer.button === 1 || pointer.button === 2) {
        this.beginPan(pointer);
        return;
      }

      void this.handlePointerDown(pointer);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        void this.handleTouchPointerUp(pointer);
        return;
      }

      this.isPanning = false;
    });
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.phase === 'complete' || this.isBattleIntroActive() || this.isPointerOverUi(pointer.x, pointer.y)) {
          return;
        }

        this.zoomBoard(deltaY, pointer.x, pointer.y);
      }
    );

    this.input.keyboard?.removeAllListeners();
    this.cursorKeys = this.input.keyboard?.createCursorKeys();
    this.panKeys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    }) as PanKeys | undefined;
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      void this.handleSpaceKey();
    });
    this.input.keyboard?.on('keydown-R', (_event: KeyboardEvent) => {
      if (this.isBattleIntroActive()) {
        return;
      }
      if (_event.repeat) {
        return;
      }

      this.restartBattle();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      this.setPauseMenuOpen(!this.headerMenuOpen);
      this.refreshUi();
    });
    this.input.keyboard?.on('keydown-Q', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      this.rotateBoard(-1);
    });
    this.input.keyboard?.on('keydown-E', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      this.rotateBoard(1);
    });
    this.input.keyboard?.on('keydown-T', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      this.cycleTimeOfDay();
    });
    this.input.keyboard?.on('keydown-M', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      const muted = audioDirector.toggleMute();
      this.syncSceneAudioMute();
      this.pushLog(`Audio ${muted ? 'muted' : 'enabled'}.`);
      this.refreshUi();
    });
  }

  private restartBattle(): void {
    if (this.restarting) {
      return;
    }

    this.setPauseMenuOpen(false);
    this.clearTurnStartCatchPhrase();
    this.restarting = true;
    this.busy = true;
    this.phase = 'animating';
    this.input.enabled = false;
    this.input.keyboard?.removeAllListeners();
    this.scene.restart({ levelId: this.level.id });
  }

  private isBattleIntroActive(): boolean {
    return this.battleIntroPhase === 'intro';
  }

  private setPauseMenuOpen(open: boolean): void {
    if (this.headerMenuOpen === open) {
      return;
    }

    this.headerMenuOpen = open;
    this.time.timeScale = open ? 0 : 1;
    this.tweens.timeScale = open ? 0 : 1;
  }

  private handleTouchPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isPointerOverUi(pointer.x, pointer.y)) {
      void this.handlePointerDown(pointer);
      return;
    }

    if (this.touchPointerId !== null && this.touchPointerId !== pointer.id) {
      this.startPinchZoom(pointer.id);
      return;
    }

    this.touchPointerId = pointer.id;
    this.pendingTouchTap = true;
    this.touchTapOrigin.set(pointer.x, pointer.y);
  }

  private handleTouchPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.touchSecondaryPointerId !== null) {
      if (pointer.id === this.touchPointerId || pointer.id === this.touchSecondaryPointerId) {
        this.updatePinchZoom();
      }
      return;
    }

    if (pointer.id !== this.touchPointerId) {
      return;
    }

    if (this.isPanning) {
      const camera = this.getWorldCamera();
      this.setBoardScroll(
        this.panCameraOrigin.x - (pointer.x - this.panPointerOrigin.x) / camera.zoom,
        this.panCameraOrigin.y - (pointer.y - this.panPointerOrigin.y) / camera.zoom
      );
      return;
    }

    if (!pointer.isDown || !this.pendingTouchTap) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.touchTapOrigin.x,
      this.touchTapOrigin.y
    );

    if (distance <= TOUCH_PAN_THRESHOLD) {
      return;
    }

    this.pendingTouchTap = false;
    this.beginPan(pointer);
  }

  private async handleTouchPointerUp(pointer: Phaser.Input.Pointer): Promise<void> {
    if (this.touchSecondaryPointerId !== null) {
      if (pointer.id === this.touchPointerId || pointer.id === this.touchSecondaryPointerId) {
        const remainingPointerId =
          pointer.id === this.touchPointerId ? this.touchSecondaryPointerId : this.touchPointerId;
        this.touchPointerId =
          remainingPointerId !== null && this.isTouchPointerDown(remainingPointerId) ? remainingPointerId : null;
        this.touchSecondaryPointerId = null;
        this.pendingTouchTap = false;
        this.isPanning = false;
        this.pinchStartDistance = 0;
      }
      return;
    }

    if (pointer.id !== this.touchPointerId) {
      return;
    }

    const wasTap = this.pendingTouchTap;

    this.pendingTouchTap = false;
    this.touchPointerId = null;
    this.isPanning = false;

    if (wasTap) {
      await this.handlePointerDown(pointer);
    }
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
    this.actionMenuStack.destroy();
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.clearTurnStartCatchPhrase();
    this.pendingFactionMottoId = null;
    this.stopFactionMottoSound();
    this.isPanning = false;
    this.touchPointerId = null;
    this.touchSecondaryPointerId = null;
    this.pendingTouchTap = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoom = DEFAULT_BOARD_ZOOM;
    this.restarting = false;
  }

  private startPinchZoom(secondaryPointerId: number): void {
    if (this.touchPointerId === null) {
      return;
    }

    this.touchSecondaryPointerId = secondaryPointerId;
    this.pendingTouchTap = false;
    this.isPanning = false;
    this.pinchStartZoom = this.getWorldCamera().zoom;
    this.pinchStartDistance = this.getTouchDistance(this.touchPointerId, this.touchSecondaryPointerId);
  }

  private updatePinchZoom(): void {
    if (this.touchPointerId === null || this.touchSecondaryPointerId === null) {
      return;
    }

    const touchDistance = this.getTouchDistance(this.touchPointerId, this.touchSecondaryPointerId);
    if (touchDistance < 8) {
      return;
    }

    if (this.pinchStartDistance < 8) {
      this.pinchStartDistance = touchDistance;
      this.pinchStartZoom = this.getWorldCamera().zoom;
      return;
    }

    const primaryPointer = this.getTouchPointerById(this.touchPointerId);
    const secondaryPointer = this.getTouchPointerById(this.touchSecondaryPointerId);
    if (!primaryPointer || !secondaryPointer) {
      return;
    }

    const minimumZoom = this.getMinimumBoardZoom();
    const nextZoom = Phaser.Math.Clamp(
      this.pinchStartZoom * (touchDistance / this.pinchStartDistance),
      minimumZoom,
      MAX_BOARD_ZOOM
    );
    const centerX = (primaryPointer.x + secondaryPointer.x) / 2;
    const centerY = (primaryPointer.y + secondaryPointer.y) / 2;
    this.applyBoardZoom(nextZoom, centerX, centerY);
  }

  private getTouchDistance(pointerIdA: number, pointerIdB: number): number {
    const pointerA = this.getTouchPointerById(pointerIdA);
    const pointerB = this.getTouchPointerById(pointerIdB);
    if (!pointerA || !pointerB) {
      return 0;
    }

    return Phaser.Math.Distance.Between(pointerA.x, pointerA.y, pointerB.x, pointerB.y);
  }

  private getTouchPointerById(pointerId: number): Phaser.Input.Pointer | null {
    const pointer = this.input.manager.pointers.find((candidate: Phaser.Input.Pointer) => candidate.id === pointerId && candidate.wasTouch);
    return pointer ?? null;
  }

  private isTouchPointerDown(pointerId: number): boolean {
    const pointer = this.getTouchPointerById(pointerId);
    return pointer?.isDown ?? false;
  }

  update(time: number, delta: number): void {
    this.updateDynamicLighting(time);

    if (this.phase === 'complete' || this.isPanning || this.headerMenuOpen) {
      return;
    }

    const dx =
      (this.cursorKeys?.right.isDown || this.panKeys?.right.isDown ? 1 : 0) -
      (this.cursorKeys?.left.isDown || this.panKeys?.left.isDown ? 1 : 0);
    const dy =
      (this.cursorKeys?.down.isDown || this.panKeys?.down.isDown ? 1 : 0) -
      (this.cursorKeys?.up.isDown || this.panKeys?.up.isDown ? 1 : 0);

    if (dx === 0 && dy === 0) {
      return;
    }

    const distance = 380 * (delta / 1000);
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    this.setBoardScroll(
      this.getWorldCamera().scrollX + (dx / magnitude) * distance,
      this.getWorldCamera().scrollY + (dy / magnitude) * distance
    );
  }

  private setupCameras(): void {
    this.worldCamera = this.cameras.main;
    this.worldCamera.setRotation(0);
    this.worldCamera.setZoom(DEFAULT_BOARD_ZOOM);
    this.worldCamera.setSize(this.scale.width, this.scale.height);

    this.uiCamera?.destroy();
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setScroll(0, 0);

    const uiObjects = this.getUiObjects();
    const uiSet = new Set(uiObjects);
    const worldObjects = this.children.list.filter((child) => !uiSet.has(child));

    this.worldCamera.ignore(uiObjects);
    this.uiCamera.ignore(worldObjects);
  }

  private getUiObjects(): Phaser.GameObjects.GameObject[] {
    return [
      this.uiGraphics,
      ...this.actionMenuStack.getDisplayObjects(),
      this.mapPlaqueEyebrowText,
      this.mapPlaqueTitleText,
      this.mapPlaqueMetaText,
      this.mapObjectiveTagText,
      this.mapObjectiveText,
      this.mapIntroEyebrowText,
      this.mapIntroTitleText,
      this.mapIntroMetaText,
      this.mapIntroFlavorText,
      this.logLabelText,
      this.autoBattleToggleText,
      this.headerMenuTitleText,
      this.detailMetaText,
      this.detailTitleText,
      ...this.detailStatTexts,
      this.detailBodyText,
      this.logText,
      this.activeBadge,
      this.portrait,
      ...this.headerMenuOptionTexts,
      ...this.dockActionTexts,
      ...this.hudControls.map((control) => control.container),
      ...this.turnOrderPanel.getDisplayObjects()
    ];
  }

  private getWorldCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.worldCamera ?? this.cameras.main;
  }

  private registerWorldObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.uiCamera?.ignore(object);
    return object;
  }

  private registerUiObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.getWorldCamera().ignore(object);
    return object;
  }

  private createLightTexture(): void {
    if (this.textures.exists(SOFT_LIGHT_TEXTURE_KEY)) {
      return;
    }

    const size = 320;
    const graphics = this.add.graphics().setVisible(false);

    for (let step = 20; step >= 1; step -= 1) {
      const ratio = step / 20;
      graphics.fillStyle(0xffffff, 0.16 * ratio * ratio);
      graphics.fillCircle(size / 2, size / 2, (size / 2) * ratio);
    }

    graphics.generateTexture(SOFT_LIGHT_TEXTURE_KEY, size, size);
    graphics.destroy();
  }

  private createParticles(): void {
    this.add
      .particles(0, 0, 'spark', {
        x: { min: 180, max: 1100 },
        y: { min: 70, max: 660 },
        lifespan: 3000,
        speedY: { min: -6, max: 8 },
        speedX: { min: -4, max: 4 },
        quantity: 1,
        frequency: 190,
        alpha: { start: 0.12, end: 0 },
        scale: { start: 0.7, end: 0.05 },
        tint: [0xf6dea3, 0xc99c66, 0xfff0d5]
      })
      .setDepth(950);
  }

  private createChests(): void {
    for (const chest of this.chests) {
      const shadow = this.add.ellipse(0, -4, 36, 14, 0x060205, 0.28);
      const aura = this.add.ellipse(0, -10, 42, 20, 0xf3c86a, 0.12);
      const closedSprite = this.add.image(0, 0, 'chapel-chest-closed').setOrigin(0.5, 1);
      closedSprite.displayWidth = CHEST_DISPLAY_WIDTH;
      closedSprite.scaleY = closedSprite.scaleX;
      const openSprite = this.add.image(0, 2, 'chapel-chest-open').setOrigin(0.5, 1).setVisible(false);
      openSprite.displayWidth = CHEST_DISPLAY_WIDTH;
      openSprite.scaleY = openSprite.scaleX;
      const container = this.add.container(0, 0, [shadow, aura, closedSprite, openSprite]).setDepth(180);

      this.chestViews.set(chest.id, {
        container,
        shadow,
        aura,
        closedSprite,
        openSprite,
        closedBaseY: closedSprite.y,
        openBaseY: openSprite.y,
        openBaseScale: openSprite.scaleX
      });
      this.positionChest(chest);
      this.applyChestIdleAnimation(chest.id);
    }
  }

  private createProps(): void {
    for (const prop of this.level.props) {
      const base = this.registerWorldObject(this.add.graphics());
      const image = this.registerWorldObject(this.add.image(0, 0, prop.assetId).setOrigin(0.5, 1));
      const config = PROP_RENDER_CONFIG[prop.assetId];
      image.displayHeight = config.height;
      image.scaleX = image.scaleY;

      if (image.displayWidth < config.minWidth) {
        image.displayWidth = config.minWidth;
        image.scaleY = image.scaleX;
      }

      const view: PropView = { base, image };

      if (config.blocksMovement) {
        view.shadowOverlay = this.registerWorldObject(this.add.graphics());
      }

      if (config.light) {
        view.groundGlow = this.registerWorldObject(this.add
          .image(0, 0, SOFT_LIGHT_TEXTURE_KEY)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0));
        view.haloGlow = this.registerWorldObject(this.add
          .image(0, 0, SOFT_LIGHT_TEXTURE_KEY)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0));
        view.embers = this.registerWorldObject(this.add.particles(0, 0, 'spark', {
          lifespan: 820,
          frequency: 130,
          quantity: 1,
          speedX: { min: -8, max: 8 },
          speedY: { min: -42, max: -18 },
          alpha: { start: 0.6, end: 0 },
          scale: { start: 0.46, end: 0.04 },
          tint: config.light.emberTint
        }));
        view.embers.setDepth(214);
      }

      this.propViews.set(prop.id, view);
      this.positionProp(prop);
    }
  }

  private applyTimeOfDay(): void {
    const config = TIME_OF_DAY_CONFIG[this.timeOfDay];

    this.backdropImage.setTint(config.backdropTint).setAlpha(config.backdropAlpha);
    this.backdropShade.setFillStyle(config.shadeColor, config.shadeAlpha);
    this.ambientOverlay.setFillStyle(config.ambientColor, config.ambientAlpha);

    for (const tile of this.terrainTileImages) {
      tile.setTint(config.worldTint);
    }

    for (const view of this.views.values()) {
      view.sprite.setTint(config.worldTint);
    }

    for (const view of this.chestViews.values()) {
      view.closedSprite.setTint(config.worldTint);
      view.openSprite.setTint(config.worldTint);
      view.aura.setFillStyle(0xf3c86a, 0.1 + config.lightBoost * 0.05);
    }

    for (const [propId, view] of this.propViews.entries()) {
      const prop = this.level.props.find((entry) => entry.id === propId);

      if (!prop) {
        continue;
      }

      const propConfig = PROP_RENDER_CONFIG[prop.assetId];

      if (propConfig.light) {
        view.image.clearTint();
      } else {
        view.image.setTint(config.worldTint);
      }

      view.base.setAlpha(propConfig.baseAlpha * (this.timeOfDay === 'night' ? 0.78 : 1));
    }
  }

  private updateDynamicLighting(time: number): void {
    const timeConfig = TIME_OF_DAY_CONFIG[this.timeOfDay];
    const lightSources: DynamicLightSource[] = [];
    this.lightShadowGraphics.clear();

    for (const overlay of this.lightGroundOverlays) {
      overlay.destroy();
    }

    this.lightGroundOverlays = [];

    for (const shadow of this.lightShadowOverlays) {
      shadow.destroy();
    }

    this.lightShadowOverlays = [];

    for (const view of this.propViews.values()) {
      view.shadowOverlay?.clear();
    }

    for (const prop of this.level.props) {
      const propConfig = PROP_RENDER_CONFIG[prop.assetId];
      const light = propConfig.light;
      const view = this.propViews.get(prop.id);

      if (!light || !view?.groundGlow || !view.haloGlow) {
        continue;
      }

      const phase = (prop.x * 17 + prop.y * 31) * 0.11;
      const flicker = 0.92 + Math.sin(time * 0.011 + phase) * 0.06 + Math.sin(time * 0.019 + phase * 1.7) * 0.04;
      const strength = light.intensity * timeConfig.lightBoost * flicker;
      const tile = getTile(this.map, prop.x, prop.y);

      if (!tile) {
        continue;
      }

      const point = this.isoToScreen(tile);
      const sourceGroundPoint = new Phaser.Math.Vector2(point.x, point.y + TILE_HEIGHT / 2 - 2);
      const sourceOcclusion = this.getLightSourceOcclusion(prop, point);
      const groundOcclusion = 0.35 + sourceOcclusion * 0.65;
      this.drawLightGroundPool(tile, light.color, light.radius, strength, groundOcclusion);
      view.groundGlow
        .setPosition(sourceGroundPoint.x, sourceGroundPoint.y)
        .setDisplaySize(light.radius * 0.5, light.radius * 0.24)
        .setTint(light.color)
        .setAlpha(Math.min(0.3, 0.12 * strength) * sourceOcclusion)
        .setDepth(this.getGroundGlowDepth(tile));
      view.haloGlow
        .setPosition(point.x, point.y - light.sourceOffsetY)
        .setDisplaySize(light.radius * 0.28, light.radius * 0.28)
        .setTint(light.color)
        .setAlpha(Math.min(0.2, 0.1 * strength) * sourceOcclusion)
        .setDepth(this.getLightHaloDepth(tile));

      if (view.embers) {
        view.embers.setPosition(point.x, point.y - light.sourceOffsetY);
        view.embers.setAlpha(Math.min(1, 0.45 + timeConfig.lightBoost * 0.35));
        view.embers.setDepth(this.getPropDepth(tile) + 0.2);
      }

      lightSources.push({
        prop,
        point: sourceGroundPoint,
        radius: light.radius,
        color: light.color,
        strength
      });
      this.drawLightShadows(prop, sourceGroundPoint, light.radius * 0.9, Math.min(0.24, 0.1 * timeConfig.lightBoost));
    }

    this.applyActorLighting(lightSources, timeConfig.worldTint);
  }

  private applyActorLighting(lightSources: DynamicLightSource[], baseTint: number): void {
    for (const unit of this.units) {
      const view = this.views.get(unit.id);

      if (!view) {
        continue;
      }

      const unitPoint = this.getUnitSpritePoint(unit, 0.42);
      const lightSample = this.sampleLightAtPoint(unitPoint, lightSources);
      const litTint = this.getLitTint(baseTint, lightSample);
      view.sprite.setTint(litTint);
    }

    for (const chest of this.chests) {
      const view = this.chestViews.get(chest.id);

      if (!view) {
        continue;
      }

      const chestPoint = new Phaser.Math.Vector2(view.container.x, view.container.y - 18);
      const lightSample = this.sampleLightAtPoint(chestPoint, lightSources);
      const litTint = this.getLitTint(baseTint, lightSample);
      view.closedSprite.setTint(litTint);
      view.openSprite.setTint(litTint);
      view.aura.setAlpha(0.12 + lightSample.influence * 0.3);
    }
  }

  private sampleLightAtPoint(point: Phaser.Math.Vector2, lightSources: DynamicLightSource[]): { influence: number; color: number } {
    let bestInfluence = 0;
    let bestColor = 0xffffff;

    for (const source of lightSources) {
      const effectiveRadius = source.radius * 0.92;
      const distance = Phaser.Math.Distance.BetweenPoints(source.point, point);

      if (distance > effectiveRadius) {
        continue;
      }

      const falloff = 1 - distance / effectiveRadius;
      const visibility = this.getLightPathVisibility(source.prop, source.point, point);
      const influence = Math.min(1.15, source.strength * 0.82) * falloff * falloff * visibility;

      if (influence > bestInfluence) {
        bestInfluence = influence;
        bestColor = source.color;
      }
    }

    return { influence: bestInfluence, color: bestColor };
  }

  private getLightPathVisibility(
    sourceProp: MapPropPlacement,
    sourcePoint: Phaser.Math.Vector2,
    targetPoint: Phaser.Math.Vector2
  ): number {
    let visibility = 1;
    const ray = new Phaser.Math.Vector2(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y);
    const rayLengthSq = ray.lengthSq();

    if (rayLengthSq <= 1) {
      return visibility;
    }

    for (const prop of this.level.props) {
      if (prop.id === sourceProp.id || !PROP_RENDER_CONFIG[prop.assetId].blocksMovement) {
        continue;
      }

      const tile = getTile(this.map, prop.x, prop.y);
      const view = this.propViews.get(prop.id);

      if (!tile || !view) {
        continue;
      }

      const blockerPoint = this.isoToScreen(tile);
      const blockerVector = new Phaser.Math.Vector2(blockerPoint.x - sourcePoint.x, blockerPoint.y - sourcePoint.y);
      const projection = Phaser.Math.Clamp(blockerVector.dot(ray) / rayLengthSq, 0, 1);

      if (projection <= 0.08 || projection >= 0.98) {
        continue;
      }

      const closestPoint = new Phaser.Math.Vector2(
        sourcePoint.x + ray.x * projection,
        sourcePoint.y + ray.y * projection
      );
      const corridor = Math.max(TILE_WIDTH * 0.18, view.image.displayWidth * 0.16);
      const blockerDistance = Phaser.Math.Distance.Between(blockerPoint.x, blockerPoint.y, closestPoint.x, closestPoint.y);

      if (blockerDistance <= corridor) {
        visibility = Math.min(visibility, 0.18);
      }
    }

    return visibility;
  }

  private getLitTint(baseTint: number, lightSample: { influence: number; color: number }): number {
    if (lightSample.influence <= 0.01) {
      return baseTint;
    }

    const lightWhite = this.mixColors(0xffffff, lightSample.color, 0.4);
    const tintStrength = Phaser.Math.Clamp(lightSample.influence * 1.08, 0, 0.88);
    return this.mixColors(baseTint, lightWhite, tintStrength);
  }

  private mixColors(start: number, end: number, amount: number): number {
    const clampedAmount = Phaser.Math.Clamp(amount, 0, 1);
    const startColor = Phaser.Display.Color.IntegerToColor(start);
    const endColor = Phaser.Display.Color.IntegerToColor(end);

    return Phaser.Display.Color.GetColor(
      Phaser.Math.Linear(startColor.red, endColor.red, clampedAmount),
      Phaser.Math.Linear(startColor.green, endColor.green, clampedAmount),
      Phaser.Math.Linear(startColor.blue, endColor.blue, clampedAmount)
    );
  }

  private getLightSourceOcclusion(lightProp: MapPropPlacement, sourcePoint: Phaser.Math.Vector2): number {
    let occlusion = 1;

    for (const prop of this.level.props) {
      if (prop.id === lightProp.id || !PROP_RENDER_CONFIG[prop.assetId].blocksMovement) {
        continue;
      }

      const view = this.propViews.get(prop.id);
      const tile = getTile(this.map, prop.x, prop.y);

      if (!view || !tile) {
        continue;
      }

      const blockerPoint = this.isoToScreen(tile);
      const dx = Math.abs(blockerPoint.x - sourcePoint.x);
      const dy = blockerPoint.y - sourcePoint.y;

      if (dy <= TILE_HEIGHT * 0.15 || dy > TILE_HEIGHT * 2.2) {
        continue;
      }

      if (dx > view.image.displayWidth * 0.42) {
        continue;
      }

      occlusion = Math.min(occlusion, 0.2);
    }

    return occlusion;
  }

  private drawLightGroundPool(
    sourceTile: TileData,
    color: number,
    lightRadius: number,
    strength: number,
    groundOcclusion: number
  ): void {
    const sourcePoint = this.isoToScreen(sourceTile);
    const effectiveRadius = lightRadius * 0.96;

    for (const tile of this.map) {
      const gridDistance = manhattanDistance(sourceTile, tile);

      if (gridDistance > 4) {
        continue;
      }

      const tilePoint = this.isoToScreen(tile);
      const screenDistance = Phaser.Math.Distance.Between(
        sourcePoint.x,
        sourcePoint.y,
        tilePoint.x,
        tilePoint.y
      );

      if (screenDistance > effectiveRadius) {
        continue;
      }

      const falloff = 1 - screenDistance / effectiveRadius;
      const alpha = Math.min(0.4, 0.18 * strength) * falloff * falloff * groundOcclusion;

      if (alpha <= 0.01) {
        continue;
      }

      const center = this.isoToScreen(tile);
      const outer = this.scaleTilePolygon(this.getTileTopPoints(tile), center, 0.94);
      const inner = this.scaleTilePolygon(this.getTileTopPoints(tile), center, 0.7);
      const overlay = this.registerWorldObject(this.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
      overlay.fillStyle(color, alpha);
      overlay.fillPoints(outer, true);
      overlay.fillStyle(color, alpha * 0.68);
      overlay.fillPoints(inner, true);
      overlay.setDepth(this.getGroundLightDepth(tile));
      this.lightGroundOverlays.push(overlay);
    }
  }

  private drawLightShadows(
    lightProp: MapPropPlacement,
    sourceGroundPoint: Phaser.Math.Vector2,
    lightRadius: number,
    baseAlpha: number
  ): void {
    const blockers: Array<{ tile: TileData; size: number }> = [];

    for (const prop of this.level.props) {
      if (prop.id === lightProp.id || !PROP_RENDER_CONFIG[prop.assetId].blocksMovement) {
        continue;
      }

      const tile = getTile(this.map, prop.x, prop.y);

      if (tile) {
        blockers.push({ tile, size: 1 });
      }
    }

    for (const chest of this.chests) {
      if (chest.opened) {
        continue;
      }

      const tile = getTile(this.map, chest.x, chest.y);

      if (tile) {
        blockers.push({ tile, size: 0.7 });
      }
    }

    for (const unit of this.units) {
      if (!unit.alive) {
        continue;
      }

      const tile = getTile(this.map, unit.x, unit.y);

      if (tile) {
        blockers.push({ tile, size: 0.8 });
      }
    }

    for (const blocker of blockers) {
      const blockerGroundPoint = new Phaser.Math.Vector2(
        this.isoToScreen(blocker.tile).x,
        this.isoToScreen(blocker.tile).y + TILE_HEIGHT / 2
      );
      const distance = Phaser.Math.Distance.BetweenPoints(sourceGroundPoint, blockerGroundPoint);

      if (distance < 10 || distance > lightRadius) {
        continue;
      }

      const direction = new Phaser.Math.Vector2(
        blockerGroundPoint.x - sourceGroundPoint.x,
        blockerGroundPoint.y - sourceGroundPoint.y
      ).normalize();
      const shadowLength = Phaser.Math.Linear(lightRadius * 0.58, lightRadius * 0.18, distance / lightRadius) * blocker.size;
      const points = this.scaleTilePolygon(this.getTileTopPoints(blocker.tile), blockerGroundPoint, 0.66);
      const sorted = points
        .map((point, index) => ({
          point,
          index,
          projection:
            (point.x - blockerGroundPoint.x) * direction.x + (point.y - blockerGroundPoint.y) * direction.y
        }))
        .sort((left, right) => right.projection - left.projection);
      const edge = [sorted[0], sorted[1]].sort((left, right) => left.index - right.index);
      const pointA = edge[0].point;
      const pointB = edge[1].point;
      const extend = new Phaser.Math.Vector2(direction.x * shadowLength, direction.y * shadowLength);
      const farA = new Phaser.Math.Vector2(pointA.x + extend.x, pointA.y + extend.y);
      const farB = new Phaser.Math.Vector2(pointB.x + extend.x, pointB.y + extend.y);
      const alpha = Phaser.Math.Clamp(baseAlpha * (1 - distance / lightRadius), 0.02, baseAlpha);

      const shadow = this.registerWorldObject(this.add.graphics());
      shadow.fillStyle(0x04070d, alpha);
      shadow.fillPoints([pointA, pointB, farB, farA], true);
      shadow.setDepth(this.getLightShadowDepth(blocker.tile));
      this.lightShadowOverlays.push(shadow);

      const blockingProp = this.level.props.find((entry) => entry.x === blocker.tile.x && entry.y === blocker.tile.y);

      if (blockingProp) {
        this.drawPropSelfShadow(blockingProp, sourceGroundPoint, alpha);
      }
    }
  }

  private drawPropSelfShadow(
    prop: MapPropPlacement,
    sourceGroundPoint: Phaser.Math.Vector2,
    alpha: number
  ): void {
    const view = this.propViews.get(prop.id);

    if (!view?.shadowOverlay) {
      return;
    }

    const image = view.image;
    const baseY = image.y;
    const width = image.displayWidth;
    const height = image.displayHeight;
    const directionX = Math.sign(image.x - sourceGroundPoint.x) || 1;
    const sourceBehind = sourceGroundPoint.y < baseY - TILE_HEIGHT * 0.1;

    if (!sourceBehind) {
      return;
    }

    const lean = width * 0.08 * directionX;
    const topY = baseY - height;
    const upperMidY = baseY - height * 0.62;
    const lowerMidY = baseY - height * 0.28;

    view.shadowOverlay.fillStyle(0x06080c, Phaser.Math.Clamp(alpha * 1.25, 0.08, 0.26));
    view.shadowOverlay.fillPoints(
      [
        new Phaser.Math.Vector2(image.x - width * 0.14 + lean, topY),
        new Phaser.Math.Vector2(image.x + width * 0.14 + lean, topY),
        new Phaser.Math.Vector2(image.x + width * 0.25 + lean * 0.35, upperMidY),
        new Phaser.Math.Vector2(image.x + width * 0.31, lowerMidY),
        new Phaser.Math.Vector2(image.x + width * 0.32, baseY),
        new Phaser.Math.Vector2(image.x - width * 0.32, baseY),
        new Phaser.Math.Vector2(image.x - width * 0.31, lowerMidY),
        new Phaser.Math.Vector2(image.x - width * 0.25 + lean * 0.35, upperMidY)
      ],
      true
    );
  }

  private cycleTimeOfDay(): void {
    const currentIndex = TIME_OF_DAY_ORDER.indexOf(this.timeOfDay);
    this.timeOfDay = TIME_OF_DAY_ORDER[(currentIndex + 1) % TIME_OF_DAY_ORDER.length];
    this.applyTimeOfDay();
    this.pushLog(`Scene shifts to ${TIME_OF_DAY_CONFIG[this.timeOfDay].label.toLowerCase()}.`);
    this.refreshUi();
  }

  private createUi(): void {
    this.mapPlaqueEyebrowText = this.add.text(0, 0, '', UI_TEXT_LABEL);

    this.mapPlaqueTitleText = this.add.text(0, 0, this.level.name, UI_NARROW_HEADER_TITLE_TEXT_STYLE);

    this.mapPlaqueMetaText = this.add.text(0, 0, '', UI_TEXT_TITLE);

    this.mapObjectiveTagText = this.add.text(0, 0, 'OBJECTIVE', UI_TEXT_LABEL);

    this.mapObjectiveText = this.add.text(0, 0, this.level.objective, UI_TEXT_BODY);

    this.mapIntroEyebrowText = this.add.text(0, 0, '', UI_TEXT_LABEL_CENTER).setOrigin(0.5, 0);

    this.mapIntroTitleText = this.add.text(0, 0, this.level.name, UI_TEXT_TITLE_CENTER).setOrigin(0.5, 0);

    this.mapIntroMetaText = this.add.text(0, 0, '', UI_TEXT_BODY_CENTER).setOrigin(0.5, 0);

    this.mapIntroFlavorText = this.add.text(0, 0, '', UI_TEXT_BODY_CENTER).setOrigin(0.5, 0);

    this.logLabelText = this.add.text(0, 0, 'BATTLE LOG', UI_TEXT_LABEL);

    this.autoBattleToggleText = this.add.text(0, 0, '', UI_TEXT_ACTION);
    this.autoBattleToggleText.setOrigin(1, 0.5);

    this.headerMenuTitleText = this.add.text(0, 0, 'SYSTEM', UI_NARROW_HEADER_TITLE_TEXT_STYLE)
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.turnOrderPanel = new TurnOrderPanel(
      this,
      6,
      undefined,
      undefined
    );

    this.activeBadge = this.add.text(0, 0, '', UI_NARROW_HEADER_TITLE_TEXT_STYLE);
    this.activeBadge.setOrigin(0, 0.5);

    this.portrait = this.add
      .image(0, 0, DEFAULT_UNIT_IMAGE_KEY)
      .setVisible(false)
      .setScale(0.24);

    this.detailMetaText = this.add.text(0, 0, '', UI_TEXT_BODY);

    this.detailTitleText = this.add.text(0, 0, '', UI_TEXT_TITLE);

    this.detailStatTexts = Array.from({ length: 4 }, () =>
      this.add.text(0, 0, '', UI_TEXT_LABEL)
    );

    this.detailBodyText = this.add.text(0, 0, '', UI_TEXT_BODY);

    this.logText = this.add.text(0, 0, '', UI_TEXT_BODY);

    this.headerMenuOptionTexts = Array.from({ length: 3 }, () =>
      this.add.text(0, 0, '', UI_TEXT_ACTION).setVisible(false)
    );

    this.dockActionTexts = Array.from({ length: 6 }, () =>
      this.add.text(0, 0, '', UI_TEXT_ACTION).setOrigin(0.5).setVisible(false)
    );

    this.createHudControls();

    const uiElements = [
      this.mapPlaqueEyebrowText,
      this.mapPlaqueTitleText,
      this.mapPlaqueMetaText,
      this.mapObjectiveTagText,
      this.mapObjectiveText,
      this.mapIntroEyebrowText,
      this.mapIntroTitleText,
      this.mapIntroMetaText,
      this.mapIntroFlavorText,
      this.logLabelText,
      this.autoBattleToggleText,
      this.headerMenuTitleText,
      this.activeBadge,
      this.portrait,
      this.detailMetaText,
      this.detailTitleText,
      ...this.detailStatTexts,
      this.detailBodyText,
      this.logText,
      ...this.headerMenuOptionTexts,
      ...this.dockActionTexts,
      ...this.hudControls.map((control) => control.container),
      ...this.turnOrderPanel.getDisplayObjects()
    ];

    for (const [index, element] of uiElements.entries()) {
      element.setDepth(870 + index).setScrollFactor(0);
    }
    this.updateUiLayout(this.scale.width, this.scale.height);
  }

  private createHudControls(): void {
    const configs: Array<{ action: HudControlAction; icon: string; label: string }> = [
      { action: 'zoom-in', icon: '+', label: 'Zoom' },
      { action: 'zoom-out', icon: '-', label: 'Out' },
      { action: 'rotate-left', icon: 'Q', label: 'Left' },
      { action: 'rotate-right', icon: 'E', label: 'Right' },
      { action: 'mute', icon: 'M', label: 'Audio' }
    ];

    this.hudControls = configs.map(({ action, icon, label }) => {
      const shadow = this.add.rectangle(2, 3, 60, 46, 0x050203, 0.28).setOrigin(0.5);
      const backing = this.add.rectangle(0, 0, 60, 46, 0x180c11, 0.94)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xd5ba7a, 0.34);
      const sheen = this.add.rectangle(0, -10, 52, 10, 0xf4ddb0, 0.08).setOrigin(0.5);
      const iconText = this.add.text(-14, -1, icon, UI_TEXT_TITLE).setOrigin(0.5);
      const labelText = this.add.text(8, -1, label, UI_TEXT_LABEL).setOrigin(0.5);

      const container = this.add.container(0, 0, [shadow, backing, sheen, iconText, labelText]).setSize(60, 46);

      return { action, container };
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;

    this.backdropImage
      .setPosition(width / 2, height / 2)
      .setDisplaySize(width * 1.18, height * 1.18);
    this.backdropShade
      .setPosition(width / 2, height / 2)
      .setSize(width * 1.22, height * 1.22);
    this.ambientOverlay
      .setPosition(width / 2, height / 2)
      .setSize(width * 1.22, height * 1.22);

    this.getWorldCamera().setSize(width, height);
    this.uiCamera?.setViewport(0, 0, width, height).setSize(width, height);

    this.updateUiLayout(width, height);
    this.configureCamera(false);
    this.drawHighlights();
    this.layoutResultOverlay();
    this.refreshUi();
  }

  private updateUiLayout(width: number, height: number): void {
    const grid = createUiGrid(width, height);
    const margin = grid.margin;
    this.uiLayoutMode = width < height ? 'portrait' : width < 1180 ? 'landscape' : 'wide';
    this.portraitLayout = false;
    this.compactLayout = false;
    this.minimalMobileLayout = true;
    this.showHudControls = false;
    this.showDetailPanel = this.getResolvedInspectionTarget().kind !== 'mission';
    this.showTimelinePanel = true;
    this.showPortraitPanel = true;
    this.visibleTurnOrderCount = 6;
    this.visibleLogLines = 2;
    this.actionMenuRowHeight = 28;

    const contentGap = UI_PANEL_GAP;
    const avatarSize = 38;
    const turnOrderGap = avatarSize + 12;
    const turnOrderHeight = avatarSize + Math.max(0, this.visibleTurnOrderCount - 1) * turnOrderGap;
    const turnOrderWidth = avatarSize + 28;

    const stackedTopPanels = grid.columns < 12;
    const headerColumnSpan = stackedTopPanels ? grid.columns : 7;
    const detailPanelWidth = this.getResolvedDetailPanelWidth(width);
    const headerWidth = grid.column(0, headerColumnSpan, 0, 0).width;
    const plaqueHeight = this.getTargetMapPlaqueHeight(headerWidth, height);

    {
      const headerRect = grid.column(0, headerColumnSpan, margin, plaqueHeight);
      this.headerRect.setTo(headerRect.x, headerRect.y, headerRect.width, headerRect.height);
    }
    this.uiPanels.topLeft.setTo(this.headerRect.x, this.headerRect.y, this.headerRect.width, this.headerRect.height);
    const detailHeight = this.getTargetDetailPanelHeight(detailPanelWidth, height);
    const detailRect = new Phaser.Geom.Rectangle(
      width - margin - detailPanelWidth,
      stackedTopPanels ? this.headerRect.bottom + contentGap : margin,
      detailPanelWidth,
      detailHeight
    );
    const detailY = detailRect.y;
    const topContentBottom = stackedTopPanels
      ? detailY + detailHeight
      : Math.max(this.headerRect.bottom, detailY + detailHeight);
    this.dockRect.setTo(0, 0, 0, 0);
    this.playAreaRect.setTo(
      grid.content.x,
      topContentBottom + contentGap,
      grid.content.width,
      Math.max(48, grid.content.bottom - (topContentBottom + contentGap))
    );
    this.uiPanels.topRight.setTo(detailRect.x, detailRect.y, detailRect.width, detailRect.height);
    this.uiPanels.bottomLeft.setTo(margin, height - margin - UI_PANEL_COMPACT_GAP, 0, 0);
    this.uiPanels.bottomRight.setTo(0, 0, 0, 0);
    const detailContentBounds = BattleUiChrome.getContentBounds(this.uiPanels.topRight, 'narrow');
    this.uiPanels.portrait.setTo(
      detailContentBounds.right - DETAIL_PANEL_PORTRAIT_WIDTH,
      detailContentBounds.y,
      DETAIL_PANEL_PORTRAIT_WIDTH,
      DETAIL_PANEL_PORTRAIT_HEIGHT
    );

    const playAreaGrid = createUiSubGrid(this.playAreaRect, 12, 0, 0, UI_PANEL_GAP);
    const turnOrderColumn = playAreaGrid.column(0, 1, playAreaGrid.content.y, turnOrderHeight + UI_PANEL_GAP);
    const turnOrderBand = playAreaGrid.band(
      Math.max(playAreaGrid.content.y, playAreaGrid.content.bottom - turnOrderHeight - UI_PANEL_COMPACT_GAP),
      turnOrderHeight + UI_PANEL_GAP
    );
    this.turnOrderBounds.setTo(turnOrderColumn.x, turnOrderBand.y, turnOrderColumn.width, turnOrderBand.height);

    this.turnOrderPanel.setVisible(true);
    this.turnOrderPanel.setLayout({
      x: this.turnOrderBounds.x,
      startY: this.turnOrderBounds.y + UI_PANEL_MICRO_GAP,
      gap: turnOrderGap,
      avatarSize,
      reverse: true
    });

    this.mapObjectiveTagText.setVisible(false);
    this.mapObjectiveText.setVisible(false);
    this.logLabelText.setVisible(false);
    this.logText.setVisible(false);
    this.portrait.setVisible(false);
    for (const control of this.hudControls) {
      control.container.setVisible(false);
    }
    for (const text of this.dockActionTexts) {
      text.setVisible(false);
    }

    const actionMenuRootWidth = 172;
    const actionMenuPanelHeight = 188;
    const actionMenuRootX = Math.min(
      grid.content.right - actionMenuRootWidth,
      this.turnOrderBounds.x + avatarSize + UI_PANEL_GAP
    );
    const actionMenuBottom = Math.max(grid.content.bottom, this.headerRect.bottom + actionMenuPanelHeight + UI_PANEL_GAP);

    this.actionMenuStack.setLayout({
      rootX: actionMenuRootX,
      bottom: actionMenuBottom,
      rootWidth: actionMenuRootWidth,
      panelHeight: actionMenuPanelHeight,
      overlap: Math.round(actionMenuRootWidth * 0.7),
      panelWidths: {
        list: actionMenuRootWidth,
        detail: actionMenuRootWidth
      }
    });
    this.actionMenuStack.setTypography({
      rowHeight: 26
    });

    this.layoutMapTitleSection(width, height);
    this.layoutDetailPanelSection();
    this.actionMenuStack.layoutText();
    this.layoutResultOverlay();
  }

  private syncDynamicDetailPanelHeight(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const margin = UI_SCREEN_MARGIN;
    const contentGap = UI_PANEL_GAP;
    const detailPanelWidth = this.getResolvedDetailPanelWidth(width);
    const stackedTopPanels = width < height;
    const detailHeight = this.getTargetDetailPanelHeight(detailPanelWidth, height);
    const detailY = stackedTopPanels ? this.headerRect.bottom + contentGap : margin;

    this.uiPanels.topRight.setTo(
      width - margin - detailPanelWidth,
      detailY,
      detailPanelWidth,
      detailHeight
    );

    const topContentBottom = stackedTopPanels
      ? this.uiPanels.topRight.bottom
      : Math.max(this.headerRect.bottom, this.uiPanels.topRight.bottom);

    this.playAreaRect.setTo(
      margin,
      topContentBottom + contentGap,
      Math.max(48, width - margin * 2),
      Math.max(48, height - margin - (topContentBottom + contentGap))
    );

    const avatarSize = 38;
    const turnOrderGap = avatarSize + 12;
    const turnOrderHeight = avatarSize + Math.max(0, this.visibleTurnOrderCount - 1) * turnOrderGap;
    const playAreaGrid = createUiSubGrid(this.playAreaRect, 12, 0, 0, UI_PANEL_GAP);
    const turnOrderColumn = playAreaGrid.column(0, 1, playAreaGrid.content.y, turnOrderHeight + UI_PANEL_GAP);
    const turnOrderBand = playAreaGrid.band(
      Math.max(playAreaGrid.content.y, playAreaGrid.content.bottom - turnOrderHeight - UI_PANEL_COMPACT_GAP),
      turnOrderHeight + UI_PANEL_GAP
    );
    this.turnOrderBounds.setTo(turnOrderColumn.x, turnOrderBand.y, turnOrderColumn.width, turnOrderBand.height);
    this.turnOrderPanel.setLayout({
      x: this.turnOrderBounds.x,
      startY: this.turnOrderBounds.y + UI_PANEL_MICRO_GAP,
      gap: turnOrderGap,
      avatarSize,
      reverse: true
    });
  }

  private getMapPlaqueRequiredHeight(panelWidth: number): number {
    const plaqueContentGap = UI_PANEL_MINI_GAP;

    this.mapPlaqueMetaText
      .setWordWrapWidth(Math.max(80, panelWidth - 28), true);

    this.mapObjectiveText
      .setWordWrapWidth(Math.max(100, panelWidth - 28), true);

    const headerHeight = UI_NARROW_PLAQUE_HEADER_HEIGHT;
    const mainBlockHeight =
      this.mapPlaqueMetaText.height +
      plaqueContentGap +
      this.mapObjectiveText.height;
    const bottomPadding = UI_PANEL_COMPACT_INSET;

    return Math.ceil(headerHeight + UI_PANEL_COMPACT_GAP + mainBlockHeight + bottomPadding);
  }

  private getTargetMapPlaqueHeight(panelWidth: number, height: number): number {
    const baseHeight = 96;

    return Math.max(baseHeight, this.getMapPlaqueRequiredHeight(panelWidth));
  }

  private getResolvedDetailPanelWidth(viewportWidth: number): number {
    const maxWidth = Math.max(DETAIL_PANEL_MIN_WIDTH, viewportWidth - UI_SCREEN_MARGIN * 2);
    return Math.round(Phaser.Math.Clamp(DETAIL_PANEL_FIXED_WIDTH, DETAIL_PANEL_MIN_WIDTH, maxWidth));
  }

  private measureDetailPanelLayout(
    panel: Phaser.Geom.Rectangle,
    portraitVisible = this.showPortraitPanel && this.showDetailPanel,
    hasHealthBar = Boolean(this.getDetailFocusUnit())
  ): DetailPanelLayoutMetrics {
    const contentBounds = BattleUiChrome.getContentBounds(panel, 'narrow');
    const portraitWidth = portraitVisible ? DETAIL_PANEL_PORTRAIT_WIDTH : 0;
    const portraitHeight = portraitVisible ? DETAIL_PANEL_PORTRAIT_HEIGHT : 0;
    const portraitGap = portraitVisible ? DETAIL_PANEL_PORTRAIT_GAP : 0;
    const infoWidth = Math.max(132, contentBounds.width - portraitWidth - portraitGap);
    const infoBounds = new Phaser.Geom.Rectangle(contentBounds.x, contentBounds.y, infoWidth, contentBounds.height);
    const portraitBounds = portraitVisible
      ? new Phaser.Geom.Rectangle(
          contentBounds.right - portraitWidth,
          contentBounds.y,
          portraitWidth,
          portraitHeight
        )
      : new Phaser.Geom.Rectangle(0, 0, 0, 0);
    const statColumnGap = UI_PANEL_GAP;
    const statColumnWidth = Math.max(72, Math.floor((infoBounds.width - statColumnGap) / 2));
    const bodyBoxWidth = Math.max(180, contentBounds.width);
    const bodyTextWidth = Math.max(144, bodyBoxWidth - DETAIL_PANEL_BODY_PADDING_X * 2);

    this.detailMetaText.setWordWrapWidth(infoBounds.width, true);
    this.detailTitleText.setWordWrapWidth(infoBounds.width, true);
    this.detailBodyText.setWordWrapWidth(bodyTextWidth, true);

    const metaY = Math.round(contentBounds.y + DETAIL_PANEL_TOP_PADDING_Y);
    const titleY = Math.round(metaY + this.detailMetaText.height + DETAIL_PANEL_META_GAP);
    let cursorY = titleY + this.detailTitleText.height + DETAIL_PANEL_TITLE_GAP;
    const healthBarBounds = hasHealthBar
      ? new Phaser.Geom.Rectangle(infoBounds.x, Math.round(cursorY), infoBounds.width, 10)
      : new Phaser.Geom.Rectangle(0, 0, 0, 0);

    if (hasHealthBar) {
      cursorY = healthBarBounds.bottom + DETAIL_PANEL_HEALTH_GAP;
    }

    const statRowHeights: number[] = [];
    for (const [index, text] of this.detailStatTexts.entries()) {
      if (!text.text) {
        continue;
      }
      const row = Math.floor(index / 2);
      statRowHeights[row] = Math.max(statRowHeights[row] ?? 0, text.height + DETAIL_PANEL_CHIP_PADDING_Y * 2);
    }

    const statPositions: Array<Phaser.Math.Vector2 | null> = this.detailStatTexts.map(() => null);
    const statChipBounds: Phaser.Geom.Rectangle[] = this.detailStatTexts.map(() => new Phaser.Geom.Rectangle(0, 0, 0, 0));
    if (statRowHeights.length > 0) {
      for (const [index, text] of this.detailStatTexts.entries()) {
        if (!text.text) {
          continue;
        }
        const column = index % 2;
        const row = Math.floor(index / 2);
        const rowHeight = statRowHeights[row] ?? text.height;
        const rowTop = cursorY + statRowHeights.slice(0, row).reduce((sum, height) => sum + height + DETAIL_PANEL_STAT_ROW_GAP, 0);
        const chipX = infoBounds.x + column * (statColumnWidth + statColumnGap);
        const chipY = Math.round(rowTop);
        const chipWidth = statColumnWidth;
        statPositions[index] = new Phaser.Math.Vector2(
          chipX + DETAIL_PANEL_CHIP_PADDING_X,
          Math.round(chipY + Math.max(0, (rowHeight - text.height) * 0.5) - 1)
        );
        statChipBounds[index].setTo(chipX, chipY, chipWidth, rowHeight);
      }
      cursorY += statRowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, statRowHeights.length - 1) * DETAIL_PANEL_STAT_ROW_GAP;
    }

    const topSectionHeight = Math.max(cursorY - contentBounds.y, portraitHeight);
    const portraitY = portraitVisible
      ? Math.round(contentBounds.y + Math.max(0, (topSectionHeight - portraitHeight) * 0.5))
      : 0;
    const bodyBoxBounds = new Phaser.Geom.Rectangle(
      contentBounds.x,
      Math.round(contentBounds.y + topSectionHeight + DETAIL_PANEL_SECTION_GAP),
      bodyBoxWidth,
      Math.max(52, this.detailBodyText.height + DETAIL_PANEL_BODY_PADDING_Y * 2)
    );
    const topOffset = 2 + UI_NARROW_PLAQUE_HEADER_HEIGHT + UI_PANEL_CONTENT_GAP;
    const requiredHeight = Math.ceil(
      topOffset +
      topSectionHeight +
      DETAIL_PANEL_SECTION_GAP +
      bodyBoxBounds.height +
      UI_PANEL_CONTENT_INSET
    );

    return {
      contentBounds,
      infoBounds,
      portraitBounds: portraitVisible
        ? new Phaser.Geom.Rectangle(portraitBounds.x, portraitY, portraitBounds.width, portraitBounds.height)
        : portraitBounds,
      healthBarBounds,
      bodyBoxBounds,
      statChipBounds,
      statPositions,
      metaY,
      titleY,
      bodyTextX: bodyBoxBounds.x + DETAIL_PANEL_BODY_PADDING_X,
      bodyTextY: Math.round(bodyBoxBounds.y + DETAIL_PANEL_BODY_PADDING_Y),
      requiredHeight
    };
  }

  private getDetailPanelRequiredHeight(
    panelWidth: number
  ): number {
    const probePanel = new Phaser.Geom.Rectangle(0, 0, panelWidth, 320);
    return this.measureDetailPanelLayout(probePanel).requiredHeight;
  }

  private getTargetDetailPanelHeight(
    panelWidth: number,
    height: number
  ): number {
    const maxHeight = Math.max(0, height - this.headerRect.bottom - 24);
    const requiredHeight = this.getDetailPanelRequiredHeight(panelWidth);

    return Phaser.Math.Clamp(requiredHeight, 184, maxHeight);
  }

  private layoutDetailPanelSection(): void {
    if (!this.showDetailPanel || this.isBattleIntroActive()) {
      this.detailBodyBoxBounds.setTo(0, 0, 0, 0);
      this.detailHealthBarBounds.setTo(0, 0, 0, 0);
      for (const bounds of this.detailStatChipBounds) {
        bounds.setTo(0, 0, 0, 0);
      }
      this.activeBadge.setVisible(false).setAlpha(0);
      this.detailMetaText.setVisible(false).setAlpha(0);
      this.detailTitleText.setVisible(false).setAlpha(0);
      this.detailBodyText.setVisible(false).setAlpha(0);
      this.portrait.setVisible(false).setAlpha(0);
      for (const text of this.detailStatTexts) {
        text.setVisible(false).setAlpha(0);
      }
      for (const bounds of this.dockActionBounds) {
        bounds.setTo(0, 0, 0, 0);
      }
      for (const text of this.dockActionTexts) {
        text.setVisible(false);
      }
      return;
    }

    const alpha = this.detailPanelAlpha;
    const visible = alpha > 0.01;
    const panel = new Phaser.Geom.Rectangle(
      this.uiPanels.topRight.x + this.detailPanelOffsetX,
      this.uiPanels.topRight.y,
      this.uiPanels.topRight.width,
      this.uiPanels.topRight.height
    );
    const focusUnit = this.getDetailFocusUnit();
    const portraitVisible = this.showPortraitPanel && this.showDetailPanel;
    const metrics = this.measureDetailPanelLayout(panel, portraitVisible, Boolean(focusUnit));

    BattleUiChrome.layoutHeaderTitle(this.activeBadge, panel, 'narrow');
    this.activeBadge
      .setAlpha(alpha)
      .setVisible(visible);

    this.detailMetaText
      .setPosition(metrics.infoBounds.x, 0)
      .setAlpha(alpha)
      .setVisible(visible);
    this.detailTitleText
      .setPosition(metrics.infoBounds.x, 0)
      .setAlpha(alpha)
      .setVisible(visible);
    for (const text of this.detailStatTexts) {
      text
        .setAlpha(alpha)
        .setVisible(visible && text.text.length > 0);
    }
    this.detailBodyText
      .setAlpha(alpha)
      .setVisible(visible);

    this.detailMetaText.setY(metrics.metaY);
    this.detailTitleText.setY(metrics.titleY);
    this.detailHealthBarBounds.setTo(
      metrics.healthBarBounds.x,
      metrics.healthBarBounds.y,
      metrics.healthBarBounds.width,
      metrics.healthBarBounds.height
    );

    for (const [index, text] of this.detailStatTexts.entries()) {
      const position = metrics.statPositions[index];
      const chipBounds = metrics.statChipBounds[index];
      this.detailStatChipBounds[index].setTo(chipBounds.x, chipBounds.y, chipBounds.width, chipBounds.height);
      if (!position || !text.text) {
        this.detailStatChipBounds[index].setTo(0, 0, 0, 0);
        continue;
      }
      text.setPosition(position.x, position.y);
    }

    this.uiPanels.portrait.setTo(
      metrics.portraitBounds.x,
      metrics.portraitBounds.y,
      metrics.portraitBounds.width,
      metrics.portraitBounds.height
    );
    this.detailBodyBoxBounds.setTo(
      metrics.bodyBoxBounds.x,
      metrics.bodyBoxBounds.y,
      metrics.bodyBoxBounds.width,
      metrics.bodyBoxBounds.height
    );
    this.detailBodyText.setPosition(metrics.bodyTextX, metrics.bodyTextY);
    this.portrait
      .setPosition(this.uiPanels.portrait.centerX, this.uiPanels.portrait.centerY)
      .setAlpha(alpha)
      .setVisible(visible && portraitVisible);

    for (const bounds of this.dockActionBounds) {
      bounds.setTo(0, 0, 0, 0);
    }
    for (const text of this.dockActionTexts) {
      text.setVisible(false);
    }
  }

  private layoutMapTitleSection(width: number, height: number): void {
    const introVisible = this.mapIntroAlpha > 0.01;
    const hudVisible = this.battleIntroPhase === 'hud';
    const controlPaddingX = 12;
    const controlPaddingY = 6;
    const introMargin = UI_SCREEN_MARGIN;
    const introMaxWidth = width <= 640 ? width - introMargin * 2 : 460;
    const introWidth = Phaser.Math.Clamp(width - introMargin * 2, 280, introMaxWidth);
    const introInnerWidth = Math.max(180, introWidth - UI_PANEL_CONTENT_INSET * 2 - UI_PANEL_GAP);
    const introY = Math.max(22, Math.round(height * 0.1));

    this.mapIntroMetaText.setWordWrapWidth(introInnerWidth, true);
    this.mapIntroFlavorText.setWordWrapWidth(introInnerWidth, true);

    const introHeight = Math.ceil(
      UI_PLAQUE_HEADER_HEIGHT +
      UI_PANEL_CONTENT_INSET +
      this.mapIntroEyebrowText.height +
      UI_PANEL_MICRO_GAP +
      this.mapIntroTitleText.height +
      UI_PANEL_GAP +
      this.mapIntroMetaText.height +
      UI_PANEL_COMPACT_GAP +
      this.mapIntroFlavorText.height +
      UI_PANEL_CONTENT_INSET
    );

    this.mapIntroBounds.setTo(
      Math.round((width - introWidth) / 2),
      Math.max(introY, this.playAreaRect.y + 18),
      introWidth,
      introHeight
    );
    const introTop = this.mapIntroBounds.y + this.mapIntroOffsetY;
    const introGrid = createUiSubGrid(
      new Phaser.Geom.Rectangle(this.mapIntroBounds.x, introTop, this.mapIntroBounds.width, this.mapIntroBounds.height),
      1,
      UI_PANEL_CONTENT_INSET + UI_PANEL_MINI_GAP,
      UI_PANEL_CONTENT_INSET,
      UI_PANEL_GAP
    );
    const headerPanel = new Phaser.Geom.Rectangle(
      this.headerRect.x + this.mapPlaqueOffsetX,
      this.headerRect.y,
      this.headerRect.width,
      this.headerRect.height
    );
    const plaqueContentBounds = BattleUiChrome.getContentBounds(headerPanel, 'narrow');
    const plaqueGrid = createUiSubGrid(plaqueContentBounds, 1, 0, 0, UI_PANEL_MINI_GAP);

    this.mapPlaqueEyebrowText
      .setPosition(plaqueContentBounds.x, plaqueContentBounds.y)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(false);
    BattleUiChrome.layoutHeaderTitle(this.mapPlaqueTitleText, headerPanel, 'narrow');
    this.mapPlaqueTitleText
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    this.mapPlaqueMetaText
      .setPosition(plaqueGrid.content.x, plaqueGrid.content.y)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    this.mapObjectiveText
      .setPosition(plaqueGrid.content.x, this.mapPlaqueMetaText.y + this.mapPlaqueMetaText.height + plaqueGrid.gutter)
      .setWordWrapWidth(plaqueGrid.content.width, true)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    this.mapObjectiveTagText.setVisible(false);
    this.mapObjectiveBoxBounds.setTo(0, 0, 0, 0);
    this.autoBattleToggleText
      .setPosition(headerPanel.right - UI_PANEL_HEADER_INSET, BattleUiChrome.getHeaderCenterY(headerPanel, 'narrow'))
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    const menuTextBounds = this.autoBattleToggleText.getBounds();
    this.headerMenuButtonBounds.setTo(
      hudVisible ? menuTextBounds.x - controlPaddingX : 0,
      hudVisible ? menuTextBounds.y - controlPaddingY : 0,
      hudVisible ? menuTextBounds.width + controlPaddingX * 2 : 0,
      hudVisible ? menuTextBounds.height + controlPaddingY * 2 : 0
    );
    this.autoBattleToggleBounds.setTo(
      this.headerMenuButtonBounds.x,
      this.headerMenuButtonBounds.y,
      this.headerMenuButtonBounds.width,
      this.headerMenuButtonBounds.height
    );
    const menuPanelWidth = 248;
    const optionRowHeight = 30;
    const optionGap = UI_PANEL_COMPACT_GAP;
    const menuContentHeight = this.headerMenuOptionTexts.length * optionRowHeight + Math.max(0, this.headerMenuOptionTexts.length - 1) * optionGap;
    const menuPanelHeight = UI_NARROW_PLAQUE_HEADER_HEIGHT + UI_PANEL_CONTENT_GAP + menuContentHeight + UI_PANEL_CONTENT_INSET;
    this.headerMenuPanelBounds.setTo(
      Math.round((width - menuPanelWidth) * 0.5),
      Math.round((height - menuPanelHeight) * 0.5),
      menuPanelWidth,
      menuPanelHeight
    );
    const menuContentBounds = BattleUiChrome.getContentBounds(this.headerMenuPanelBounds, 'narrow');
    const menuGrid = createUiSubGrid(menuContentBounds, 1, 0, 0, optionGap);
    BattleUiChrome.layoutHeaderTitle(this.headerMenuTitleText, this.headerMenuPanelBounds, 'narrow').setVisible(hudVisible && this.headerMenuOpen);

    for (const [index, text] of this.headerMenuOptionTexts.entries()) {
      const optionBounds = this.headerMenuOptionBounds[index];
      const rowBounds = menuGrid.band(menuGrid.content.y + index * (optionRowHeight + menuGrid.gutter), optionRowHeight);
      optionBounds.setTo(rowBounds.x, rowBounds.y, rowBounds.width, rowBounds.height);
      text
        .setPosition(optionBounds.x + UI_PANEL_COMPACT_INSET, optionBounds.centerY)
        .setOrigin(0, 0.5)
        .setVisible(hudVisible && this.headerMenuOpen);
    }

    const introEyebrowBand = introGrid.band(introGrid.content.y, this.mapIntroEyebrowText.height);
    const introTitleBand = introGrid.band(introEyebrowBand.bottom + UI_PANEL_MICRO_GAP, this.mapIntroTitleText.height);
    const introMetaBand = introGrid.band(introTitleBand.bottom + UI_PANEL_GAP, this.mapIntroMetaText.height);
    const introFlavorBand = introGrid.band(introMetaBand.bottom + UI_PANEL_COMPACT_GAP, this.mapIntroFlavorText.height);

    this.mapIntroEyebrowText
      .setPosition(introEyebrowBand.centerX, introEyebrowBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible);
    this.mapIntroTitleText
      .setPosition(introTitleBand.centerX, introTitleBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible);
    this.mapIntroMetaText
      .setPosition(introMetaBand.centerX, introMetaBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible)
      .setWordWrapWidth(introGrid.content.width - UI_PANEL_GAP, true);
    this.mapIntroFlavorText
      .setPosition(introFlavorBand.centerX, introFlavorBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible)
      .setWordWrapWidth(introGrid.content.width - UI_PANEL_CONTENT_INSET, true);
  }

  private startMapTitleSequence(): void {
    this.battleIntroPhase = 'intro';
    this.mapIntroAlpha = 0;
    this.mapIntroOffsetY = 18;
    this.mapPlaqueAlpha = 0;
    this.mapPlaqueOffsetX = -20;
    this.applyMapTitlePresentation();
    this.time.delayedCall(MAP_TITLE_INTRO_DURATION + 120, () => {
      this.playFactionMottoForTeam('player');
    });

    this.tweens.add({
      targets: this,
      mapIntroAlpha: 1,
      mapIntroOffsetY: 0,
      duration: MAP_TITLE_INTRO_DURATION,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.applyMapTitlePresentation(),
      onComplete: () => {
        this.time.delayedCall(MAP_TITLE_INTRO_HOLD, () => {
          this.tweens.add({
            targets: this,
            mapIntroAlpha: 0,
            mapIntroOffsetY: -14,
            mapPlaqueAlpha: 0,
            mapPlaqueOffsetX: -20,
            duration: MAP_TITLE_OUTRO_DURATION,
            ease: 'Cubic.easeInOut',
            onUpdate: () => this.applyMapTitlePresentation(),
            onComplete: () => {
              this.mapIntroAlpha = 0;
              this.mapIntroOffsetY = -14;
              this.battleIntroPhase = 'hud';
              this.tweens.add({
                targets: this,
                mapPlaqueAlpha: 1,
                mapPlaqueOffsetX: 0,
                duration: 220,
                ease: 'Cubic.easeOut',
                onUpdate: () => this.applyMapTitlePresentation(),
                onComplete: () => {
                  this.mapPlaqueAlpha = 1;
                  this.mapPlaqueOffsetX = 0;
                  this.applyMapTitlePresentation();
                }
              });
            }
          });
        });
      }
    });
  }

  private applyMapTitlePresentation(): void {
    this.layoutMapTitleSection(this.scale.width, this.scale.height);
    this.drawUiPanels();
  }

  private getMapPlaqueEyebrow(): string {
    const parts = [this.level.titlePrefix, this.level.region]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toUpperCase());

    return parts.length > 0 ? parts.join('  •  ') : 'FIELD ENGAGEMENT';
  }

  private getMapPlaqueHeaderTitle(): string {
    const prefix = this.level.titlePrefix ?? 'Mission';
    const region = this.level.region ?? this.level.name;
    return `${prefix} - ${region}`.toUpperCase();
  }

  private getMapPlaqueMeta(timeOfDayLabel: string): string {
    const parts = [timeOfDayLabel, this.level.encounterType].filter((value): value is string => Boolean(value));
    return parts.join('  •  ');
  }

  private getMapIntroEyebrow(): string {
    return (this.level.titlePrefix ?? this.level.encounterType ?? 'Battle Report').toUpperCase();
  }

  private getMapIntroMeta(timeOfDayLabel: string): string {
    const parts = [this.level.region, timeOfDayLabel, this.level.encounterType]
      .filter((value): value is string => Boolean(value));
    return parts.join('  •  ');
  }

  private getMapIntroSummary(): string {
    const shortObjective = this.level.shortObjective ?? this.level.objective;
    const flavor = this.level.titleFlavor?.trim() ?? '';
    if (!flavor) {
      return shortObjective;
    }

    return flavor.length <= shortObjective.length ? flavor : shortObjective;
  }

  private layoutHudControls(margin: number, width: number, height: number): void {
    const availableTop = this.uiPanels.topRight.bottom + 16;
    const availableBottom = Math.min(this.actionMenuStack.getRootTop(), this.uiPanels.bottomLeft.y) - 16;
    const span = Math.max(180, availableBottom - availableTop);
    const scale = 0.84;
    const gap = 10;
    const totalHeight = this.hudControls.length * 46 * scale + (this.hudControls.length - 1) * gap;
    const startY = Phaser.Math.Clamp(
      availableTop + (span - totalHeight) / 2,
      availableTop,
      Math.max(availableTop, availableBottom - totalHeight)
    );
    const x = width - margin - 30 * scale;

    for (const [index, control] of this.hudControls.entries()) {
      control.container
        .setPosition(x, startY + index * (46 * scale + gap))
        .setScale(scale)
        .setVisible(this.showHudControls);
    }
  }

  private layoutResultOverlay(): void {
    if (!this.resultOverlayShade || !this.resultOverlayTitle || !this.resultOverlayBody) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const grid = createUiGrid(width, height);
    const resultBand = createUiSubGrid(
      new Phaser.Geom.Rectangle(grid.content.x, grid.content.y + Math.round(grid.content.height * 0.3), grid.content.width, 180),
      1,
      0,
      0,
      UI_PANEL_GAP
    );

    this.resultOverlayShade
      .setPosition(width / 2, height / 2)
      .setSize(width, height);
    this.resultOverlayTitle
      .setPosition(resultBand.content.centerX, resultBand.content.y);
    this.resultOverlayBody
      .setPosition(resultBand.content.centerX, resultBand.content.y + 50)
      .setWordWrapWidth(Math.min(resultBand.content.width, 560), true);
  }

  private configureCamera(centerOnBoard = false): void {
    const camera = this.getWorldCamera();
    const boardBounds = this.getBoardBounds();
    const boardFocus = this.getBoardFocusPoint();
    const paddingX = 360;
    const paddingY = 240;
    this.cameraBounds.setTo(
      boardBounds.x - paddingX,
      boardBounds.y - paddingY,
      boardBounds.width + paddingX * 2,
      boardBounds.height + paddingY * 2
    );

    camera.setBounds(
      this.cameraBounds.x,
      this.cameraBounds.y,
      this.cameraBounds.width,
      this.cameraBounds.height
    );

    if (centerOnBoard || camera.zoom <= this.getMinimumBoardZoom() + 0.001) {
      const centeredScroll = this.getCameraScrollForFocus(boardFocus.x, boardFocus.y);
      camera.setScroll(centeredScroll.x, centeredScroll.y);
      return;
    }

    this.setBoardScroll(camera.scrollX, camera.scrollY);
  }

  private getMinimumBoardZoom(): number {
    const camera = this.getWorldCamera();
    const fitSize = this.getBoardFitSize();
    const playArea = this.playAreaRect.width > 0 && this.playAreaRect.height > 0
      ? this.playAreaRect
      : new Phaser.Geom.Rectangle(0, 0, camera.width, camera.height);
    const fitWidth = Math.max(1, playArea.width - 24) / fitSize.width;
    const fitHeight = Math.max(1, playArea.height - 24) / fitSize.height;

    return Math.min(BASE_MIN_BOARD_ZOOM, fitWidth, fitHeight);
  }

  private getBoardFocusPoint(): Phaser.Math.Vector2 {
    return this.boardPivot;
  }

  private getBoardFitSize(): { width: number; height: number } {
    const boardBounds = this.getBoardPlaneBounds();
    const boardFocus = this.getBoardFocusPoint();

    return {
      width: Math.max(
        boardBounds.width,
        Math.max(boardFocus.x - boardBounds.left, boardBounds.right - boardFocus.x) * 2
      ),
      height: Math.max(
        boardBounds.height,
        Math.max(boardFocus.y - boardBounds.top, boardBounds.bottom - boardFocus.y) * 2
      )
    };
  }

  private createUnits(): void {
    for (const unit of this.units) {
      const marker = this.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 62, 26, unit.accentColor, 0);
      const shadow = this.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 50, 18, 0x060205, 0.42);
      const sprite = this.add.image(0, 0, unit.spriteKey).setOrigin(0.5, 1);
      sprite.displayHeight = unit.spriteDisplayHeight;
      sprite.scaleX = sprite.scaleY;
      sprite.setPosition(unit.spriteOffsetX ?? 0, unit.spriteOffsetY ?? 0);

      const hpBack = this.add.rectangle(0, sprite.y - unit.spriteDisplayHeight - 12, 60, 8, 0x12070d, 0.92);
      const hpFill = this.add.rectangle(-29, sprite.y - unit.spriteDisplayHeight - 12, 56, 4, 0x65d99e, 1).setOrigin(0, 0.5);
      const label = this.add.text(0, sprite.y - unit.spriteDisplayHeight - 28, unit.name, UI_TEXT_WORLD_LABEL);
      label.setOrigin(0.5);

      const container = this.add.container(0, 0, [marker, shadow, sprite, hpBack, hpFill, label]);
      const view: UnitView = {
        container,
        shadow,
        marker,
        sprite,
        hpBack,
        hpFill,
        label,
        spriteBaseScale: sprite.scaleX,
        spriteBaseY: sprite.y
      };

      this.views.set(unit.id, view);
      this.applyIdleAnimation(unit, view);
      this.positionUnit(unit);
    }
  }

  private applyChestIdleAnimation(chestId: string): void {
    const view = this.chestViews.get(chestId);

    if (!view) {
      return;
    }

    const delay = this.rng.between(0, 260);

    this.tweens.add({
      targets: view.closedSprite,
      y: view.closedBaseY - 5,
      angle: -1.2,
      duration: 1450,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });

    this.tweens.add({
      targets: view.shadow,
      alpha: 0.18,
      scaleX: 0.82,
      scaleY: 0.78,
      duration: 1450,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });

    this.tweens.add({
      targets: view.aura,
      alpha: 0.24,
      scaleX: 1.16,
      scaleY: 1.2,
      duration: 1100,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });
  }

  private applyIdleAnimation(unit: BattleUnit, view: UnitView): void {
    const delay = (unit.x + unit.y) * 110;
    const profile = this.getIdleProfile(unit.idleStyle);

    this.tweens.add({
      targets: view.sprite,
      y: view.spriteBaseY - profile.spriteLift,
      angle: profile.spriteTilt,
      duration: profile.duration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });

    this.tweens.add({
      targets: view.shadow,
      scaleX: profile.shadowScaleX,
      scaleY: profile.shadowScaleY,
      alpha: profile.shadowAlpha,
      duration: profile.duration,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });

    if (profile.markerScale > 1) {
      this.tweens.add({
        targets: view.marker,
        scaleX: profile.markerScale,
        scaleY: profile.markerScale,
        duration: profile.duration * 0.7,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
        delay
      });
    }
  }

  private getIdleProfile(idleStyle: IdleStyle): {
    duration: number;
    spriteLift: number;
    spriteTilt: number;
    shadowScaleX: number;
    shadowScaleY: number;
    shadowAlpha: number;
    markerScale: number;
  } {
    switch (idleStyle) {
      case 'knight':
        return {
          duration: 1500,
          spriteLift: 0,
          spriteTilt: -0.8,
          shadowScaleX: 0.97,
          shadowScaleY: 0.95,
          shadowAlpha: 0.34,
          markerScale: 1
        };
      case 'archer':
        return {
          duration: 1350,
          spriteLift: 0,
          spriteTilt: -1.1,
          shadowScaleX: 0.96,
          shadowScaleY: 0.94,
          shadowAlpha: 0.32,
          markerScale: 1
        };
      case 'mage':
        return {
          duration: 1650,
          spriteLift: 0,
          spriteTilt: 0.9,
          shadowScaleX: 0.95,
          shadowScaleY: 0.93,
          shadowAlpha: 0.3,
          markerScale: 1
        };
      case 'warden':
        return {
          duration: 1180,
          spriteLift: 0,
          spriteTilt: -0.6,
          shadowScaleX: 0.98,
          shadowScaleY: 0.96,
          shadowAlpha: 0.35,
          markerScale: 1
        };
      case 'ranger':
        return {
          duration: 1280,
          spriteLift: 0,
          spriteTilt: -1,
          shadowScaleX: 0.96,
          shadowScaleY: 0.94,
          shadowAlpha: 0.31,
          markerScale: 1
        };
      case 'priest':
        return {
          duration: 1760,
          spriteLift: 0,
          spriteTilt: 0.7,
          shadowScaleX: 0.95,
          shadowScaleY: 0.93,
          shadowAlpha: 0.29,
          markerScale: 1
        };
      default:
        return {
          duration: 1500,
          spriteLift: 0,
          spriteTilt: -0.8,
          shadowScaleX: 0.97,
          shadowScaleY: 0.95,
          shadowAlpha: 0.33,
          markerScale: 1
        };
    }
  }

  private drawBoard(): void {
    this.boardGraphics.clear();

    for (const wall of this.wallGraphics) {
      wall.destroy();
    }

    this.wallGraphics = [];

    const tiles = [...this.map].sort((left, right) => this.getTileDepth(left) - this.getTileDepth(right));
    const visibleNeighborDirections = this.getVisibleNeighborDirections();

    for (const tile of tiles) {
      const corners = this.getTileTopPoints(tile);
      const right = corners[1];
      const bottom = corners[2];
      const left = corners[3];
      const color = this.getTerrainPalette(tile.terrain);
      const rightNeighborHeight =
        getTile(this.map, tile.x + visibleNeighborDirections.right.x, tile.y + visibleNeighborDirections.right.y)?.height ??
        -WORLD_EDGE_BASE_LEVEL;
      const leftNeighborHeight =
        getTile(this.map, tile.x + visibleNeighborDirections.left.x, tile.y + visibleNeighborDirections.left.y)?.height ??
        -WORLD_EDGE_BASE_LEVEL;
      const rightDrop = Math.max(0, tile.height - rightNeighborHeight) * ELEVATION_STEP;
      const leftDrop = Math.max(0, tile.height - leftNeighborHeight) * ELEVATION_STEP;

      if (rightDrop > 0 || leftDrop > 0) {
        const wall = this.registerWorldObject(this.add.graphics());

        if (rightDrop > 0) {
          const rightFace = [
            right,
            bottom,
            new Phaser.Math.Vector2(bottom.x, bottom.y + rightDrop),
            new Phaser.Math.Vector2(right.x, right.y + rightDrop)
          ];
          wall.fillStyle(color.sideRight, 1);
          wall.fillPoints(rightFace, true);
          wall.lineStyle(2, color.outline, 0.88);
          wall.strokePoints(rightFace, true, true);
        }

        if (leftDrop > 0) {
          const leftFace = [
            left,
            bottom,
            new Phaser.Math.Vector2(bottom.x, bottom.y + leftDrop),
            new Phaser.Math.Vector2(left.x, left.y + leftDrop)
          ];
          wall.fillStyle(color.sideLeft, 1);
          wall.fillPoints(leftFace, true);
          wall.lineStyle(2, color.outline, 0.88);
          wall.strokePoints(leftFace, true, true);
        }

        wall.setDepth(this.getWallDepth(tile));
        this.wallGraphics.push(wall);
      }
    }
  }

  private createTerrainTiles(): void {
    for (const image of this.terrainTileImages) {
      image.destroy();
    }

    this.terrainTileImages = [];

    const tiles = [...this.map].sort((left, right) => this.getTileDepth(left) - this.getTileDepth(right));

    for (const tile of tiles) {
      const point = this.isoToScreen(tile);
      const assetKeys = TERRAIN_TILE_ASSETS[tile.terrain];
      const assetKey = assetKeys[(tile.x * 17 + tile.y * 31 + tile.height * 7) % assetKeys.length];
      const image = this.registerWorldObject(this.add
        .image(point.x, point.y, assetKey)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(TILE_WIDTH, TILE_WIDTH)
        .setDepth(this.getTileDepth(tile)));
      this.terrainTileImages.push(image);
    }
  }

  private drawHighlights(): void {
    this.highlightGraphics.clear();

    for (const overlay of this.highlightOverlays) {
      overlay.destroy();
    }

    this.highlightOverlays = [];
    const activeUnit = this.getActiveUnit();

    if (activeUnit && this.phase !== 'animating') {
      const activeTile = getTile(this.map, activeUnit.x, activeUnit.y);

      if (activeTile) {
        this.drawActiveMarker(activeTile);
      }
    }

    const inspectionHighlightTile = this.getInspectionHighlightTile();
    if (inspectionHighlightTile) {
      this.drawDiamond(inspectionHighlightTile, 0xd9c06d, 0.2, 2, 0xf6e6b4, 0.7);
    }

    if (!activeUnit) {
      this.refreshMarkers();
      return;
    }

    if (this.phase === 'player-move') {
      for (const node of this.moveNodes.values()) {
        const tile = getTile(this.map, node.x, node.y);

        if (tile) {
          this.drawDiamond(tile, 0x4ebec3, 0.22, 2, 0x88f1f7, 0.84);
        }
      }
    }

    if (this.phase === 'player-action') {
      const selectedAbility = this.getSelectedAbility();

      if (!selectedAbility) {
        this.refreshMarkers();
        return;
      }

      for (const target of this.getTargetableUnitsForAbility(activeUnit, selectedAbility)) {
        const tile = getTile(this.map, target.x, target.y);

        if (tile) {
          const isEnemyTarget = selectedAbility.target === 'enemy';
          this.drawDiamond(
            tile,
            isEnemyTarget ? 0xb14646 : 0x4aa46f,
            0.3,
            3,
            isEnemyTarget ? 0xffa3a3 : 0xb6ffd0,
            0.95
          );
        }
      }
    }

    if (this.phase === 'player-item-action') {
      const selectedItemId = this.selectedItemId;

      if (!selectedItemId) {
        this.refreshMarkers();
        return;
      }

      for (const target of this.getTargetableUnitsForItem(activeUnit, selectedItemId)) {
        const tile = getTile(this.map, target.x, target.y);

        if (tile) {
          this.drawDiamond(tile, 0x4aa46f, 0.3, 3, 0xb6ffd0, 0.95);
        }
      }
    }

    this.refreshMarkers();
  }

  private drawDiamond(
    tile: TileData,
    fill: number,
    fillAlpha: number,
    lineWidth: number,
    stroke: number,
    strokeAlpha: number
  ): void {
    const points = this.getTileTopPoints(tile);

    const overlay = this.registerWorldObject(this.add.graphics());
    overlay.fillStyle(fill, fillAlpha);
    overlay.fillPoints(points, true);
    overlay.lineStyle(lineWidth, stroke, strokeAlpha);
    overlay.strokePoints(points, true, true);
    overlay.setDepth(this.getHighlightDepth(tile));
    this.highlightOverlays.push(overlay);
  }

  private drawActiveMarker(tile: TileData): void {
    const center = this.isoToScreen(tile);
    const tilePoints = this.getTileTopPoints(tile);
    const outer = this.scaleTilePolygon(tilePoints, center, 0.98);
    const mid = this.scaleTilePolygon(tilePoints, center, 0.82);
    const inner = this.scaleTilePolygon(tilePoints, center, 0.62);

    const glow = this.registerWorldObject(this.add.graphics().setBlendMode(Phaser.BlendModes.ADD));
    glow.fillStyle(0xffd36b, 0.12);
    glow.fillPoints(this.scaleTilePolygon(tilePoints, center, 1.16), true);
    glow.fillStyle(0xffc24f, 0.16);
    glow.fillPoints(this.scaleTilePolygon(tilePoints, center, 1.02), true);
    glow.setDepth(this.getHighlightDepth(tile));
    this.highlightOverlays.push(glow);

    const overlay = this.registerWorldObject(this.add.graphics());
    overlay.fillStyle(0x6f4a18, 0.18);
    overlay.fillPoints(outer, true);
    overlay.fillStyle(0xe4a93d, 0.2);
    overlay.fillPoints(mid, true);
    overlay.fillStyle(0xffefb2, 0.16);
    overlay.fillPoints(inner, true);
    overlay.lineStyle(3, 0xfff3c6, 0.95);
    overlay.strokePoints(outer, true, true);
    overlay.lineStyle(2, 0xffca62, 0.85);
    overlay.strokePoints(mid, true, true);
    overlay.lineStyle(1, 0x8c5d1b, 0.8);
    overlay.strokePoints(inner, true, true);
    overlay.lineStyle(3, 0xffefb2, 0.9);
    for (const point of tilePoints) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      overlay.lineBetween(
        center.x + dx * 0.24,
        center.y + dy * 0.24,
        center.x + dx * 0.44,
        center.y + dy * 0.44
      );
    }
    overlay.fillStyle(0xfff5cb, 0.85);
    overlay.fillCircle(center.x, center.y, 3.2);
    overlay.setDepth(this.getHighlightDepth(tile) + 0.1);
    this.highlightOverlays.push(overlay);
  }

  private scaleTilePolygon(
    points: Phaser.Math.Vector2[],
    center: Phaser.Math.Vector2,
    scale: number
  ): Phaser.Math.Vector2[] {
    return points.map(
      (point) =>
        new Phaser.Math.Vector2(
          center.x + (point.x - center.x) * scale,
          center.y + (point.y - center.y) * scale
        )
    );
  }

  private refreshMarkers(): void {
    for (const unit of this.units) {
      const view = this.views.get(unit.id);

      if (!view) {
        continue;
      }

      view.marker.setFillStyle(unit.accentColor, 0);
      view.marker.setAlpha(0);
    }
  }

  private positionUnit(unit: BattleUnit): void {
    const view = this.views.get(unit.id);

    if (!view) {
      return;
    }

    const tile = getTile(this.map, unit.x, unit.y);

    if (!tile) {
      return;
    }

    const point = this.getUnitGroundPoint(tile);
    view.container.setPosition(point.x, point.y);
    view.container.setDepth(this.getUnitDepth(tile));
    view.container.setVisible(unit.alive);
    view.container.setAlpha(unit.alive ? 1 : 0);
    view.hpFill.width = Math.max(0, 56 * (unit.hp / unit.maxHp));
    view.hpFill.setFillStyle(unit.team === 'player' ? 0x67d9a0 : 0xe88787, 1);
    view.label.setText(unit.name);
  }

  private positionChest(chest: ChestState): void {
    const view = this.chestViews.get(chest.id);
    const tile = getTile(this.map, chest.x, chest.y);

    if (!view || !tile) {
      return;
    }

    const point = this.isoToScreen(tile);
    view.container.setPosition(point.x, point.y + CHEST_GROUND_OFFSET_Y);
    view.container.setDepth(this.getChestDepth(tile));
    view.container.setVisible(true);
  }

  private positionProp(prop: MapPropPlacement): void {
    const view = this.propViews.get(prop.id);
    const tile = getTile(this.map, prop.x, prop.y);

    if (!view || !tile) {
      return;
    }

    const point = this.isoToScreen(tile);
    const config = PROP_RENDER_CONFIG[prop.assetId];
    const imageX = point.x + (config.offsetX ?? 0);
    const groundOffsetY = config.groundOffsetY ?? (TILE_HEIGHT / 2 + 2);
    const basePoints = this.scaleTilePolygon(this.getTileTopPoints(tile), point, 0.98);

    view.base.clear();
    view.base.fillStyle(config.baseFill, config.baseAlpha);
    view.base.fillPoints(basePoints, true);
    view.base.lineStyle(2, config.rim, config.rimAlpha);
    view.base.strokePoints(basePoints, true, true);
    view.base.setDepth(this.getPropBaseDepth(tile));

    const imageY = point.y + groundOffsetY;
    view.image.setPosition(imageX, imageY);
    view.image.setDepth(this.getPropDepth(tile));
    view.shadowOverlay?.setDepth(this.getPropDepth(tile) + 0.05);

    if (view.groundGlow && view.haloGlow && config.light) {
      view.groundGlow.setPosition(point.x, point.y + groundOffsetY - 2);
      view.haloGlow.setPosition(imageX, imageY - config.light.sourceOffsetY);
    }

    if (view.embers && config.light) {
      view.embers.setPosition(imageX, imageY - config.light.sourceOffsetY);
    }
  }

  private getChestAt(x: number, y: number): ChestState | null {
    return this.chests.find((chest) => !chest.opened && chest.x === x && chest.y === y) ?? null;
  }

  private getPropAt(x: number, y: number): MapPropPlacement | null {
    return this.level.props.find((prop) => prop.x === x && prop.y === y) ?? null;
  }

  private async collectChestAt(unit: BattleUnit): Promise<boolean> {
    if (unit.team !== 'player') {
      return false;
    }

    const chest = this.getChestAt(unit.x, unit.y);

    if (!chest) {
      return false;
    }

    chest.opened = true;
    this.addItemToUnit(unit, chest.itemId, chest.quantity);
    audioDirector.playChest();
    this.pushLog(`${unit.name} opens a chest and finds ${this.describeItemGain(chest.itemId, chest.quantity)}.`);
    await this.animateChestPickup(chest);
    return true;
  }

  private async animateChestPickup(chest: ChestState): Promise<void> {
    const view = this.chestViews.get(chest.id);

    if (!view) {
      return;
    }

    this.tweens.killTweensOf(view.closedSprite);
    this.tweens.killTweensOf(view.openSprite);
    this.tweens.killTweensOf(view.shadow);
    this.tweens.killTweensOf(view.aura);

    view.closedSprite.setVisible(false);
    view.openSprite.setVisible(true).setAlpha(1).setY(view.openBaseY).setScale(view.openBaseScale);
    view.aura.setAlpha(0.34).setScale(1, 1);
    view.shadow.setAlpha(0.3).setScale(1, 1);

    const burst = this.registerWorldObject(this.add.particles(view.container.x, view.container.y - 22, 'spark', {
      speed: { min: 28, max: 96 },
      angle: { min: 220, max: 320 },
      lifespan: 420,
      quantity: 18,
      scale: { start: 1.05, end: 0.06 },
      alpha: { start: 0.86, end: 0 },
      tint: [0xf7d27d, 0xfff0b5, 0xc99c66],
      gravityY: 80
    }));
    burst.explode(18, view.container.x, view.container.y - 22);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.openSprite,
        y: view.openBaseY - 5,
        scaleX: view.openBaseScale * 1.03,
        scaleY: view.openBaseScale * 1.03,
        duration: 170,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: [view.container, view.shadow, view.aura],
            alpha: 0,
            y: '-=8',
            duration: 260,
            ease: 'Quad.easeIn',
            onComplete: () => {
              burst.destroy();
              view.container.setVisible(false);
              resolve();
            }
          });
        }
      });
    });
  }

  private getUnitInventory(unit: BattleUnit | string): Partial<Record<ItemId, number>> {
    const unitId = typeof unit === 'string' ? unit : unit.id;
    const inventory = this.unitInventories.get(unitId);

    if (inventory) {
      return inventory;
    }

    const nextInventory: Partial<Record<ItemId, number>> = {};
    this.unitInventories.set(unitId, nextInventory);
    return nextInventory;
  }

  private addItemToUnit(unit: BattleUnit | string, itemId: ItemId, quantity = 1): void {
    const inventory = this.getUnitInventory(unit);
    inventory[itemId] = (inventory[itemId] ?? 0) + quantity;
  }

  private consumeItemFromUnit(unit: BattleUnit | string, itemId: ItemId, quantity = 1): void {
    const inventory = this.getUnitInventory(unit);
    const remaining = Math.max(0, (inventory[itemId] ?? 0) - quantity);

    if (remaining === 0) {
      delete inventory[itemId];
      return;
    }

    inventory[itemId] = remaining;
  }

  private describeItemGain(itemId: ItemId, quantity: number): string {
    const item = getItemDefinition(itemId);
    return quantity > 1 ? `${quantity}x ${item.name}` : item.name;
  }

  private getUnitWorldPoint(unit: BattleUnit): Phaser.Math.Vector2 {
    const view = this.views.get(unit.id);

    if (view) {
      return new Phaser.Math.Vector2(view.container.x, view.container.y);
    }

    return this.getUnitGroundPoint(unit);
  }

  private getUnitGroundPoint(tile: Point & { height?: number }): Phaser.Math.Vector2 {
    const point = this.isoToScreen(tile);
    return new Phaser.Math.Vector2(point.x, point.y + UNIT_GROUND_OFFSET_Y);
  }

  private getUnitCameraFocusPoint(
    unit: BattleUnit,
    groundPoint: Phaser.Math.Vector2 = this.getUnitWorldPoint(unit)
  ): Phaser.Math.Vector2 {
    const view = this.views.get(unit.id);
    const spriteOffsetX = view?.sprite.x ?? 0;
    const spriteOffsetY = view?.sprite.y ?? 0;

    return new Phaser.Math.Vector2(
      groundPoint.x + spriteOffsetX,
      groundPoint.y + spriteOffsetY - unit.spriteDisplayHeight * UNIT_CAMERA_FOCUS_HEIGHT_FACTOR
    );
  }

  private getUnitSpritePoint(unit: BattleUnit, heightFactor: number): Phaser.Math.Vector2 {
    const view = this.views.get(unit.id);
    const groundPoint = this.getUnitWorldPoint(unit);
    const spriteOffsetX = view?.sprite.x ?? 0;
    const spriteOffsetY = view?.sprite.y ?? -18;

    return new Phaser.Math.Vector2(
      groundPoint.x + spriteOffsetX,
      groundPoint.y + spriteOffsetY - unit.spriteDisplayHeight * heightFactor
    );
  }

  private getBoardBounds(): Phaser.Geom.Rectangle {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const maxSpriteHeight = Math.max(...this.units.map((unit) => unit.spriteDisplayHeight));

    for (const tile of this.map) {
      const center = this.isoToScreen(tile);
      minX = Math.min(minX, center.x - TILE_WIDTH / 2);
      maxX = Math.max(maxX, center.x + TILE_WIDTH / 2);
      minY = Math.min(minY, center.y - TILE_WIDTH / 2 - maxSpriteHeight - 36);
      maxY = Math.max(
        maxY,
        center.y + TILE_WIDTH / 2 + (tile.height + WORLD_EDGE_BASE_LEVEL) * ELEVATION_STEP + 32
      );
    }

    return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  private getBoardPlaneBounds(): Phaser.Geom.Rectangle {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const tile of this.map) {
      const center = this.getBasePlanePoint(tile);
      minX = Math.min(minX, center.x - TILE_WIDTH / 2);
      maxX = Math.max(maxX, center.x + TILE_WIDTH / 2);
      minY = Math.min(minY, center.y - TILE_HEIGHT / 2);
      maxY = Math.max(maxY, center.y + TILE_HEIGHT / 2);
    }

    return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  private getPreviewOrigin(unit: BattleUnit): Point | null {
    if (
      this.hoverTile &&
      this.moveNodes.has(pointKey(this.hoverTile))
    ) {
      return { x: this.hoverTile.x, y: this.hoverTile.y };
    }

    return getTile(this.map, unit.x, unit.y)
      ? { x: unit.x, y: unit.y }
      : null;
  }

  private getAttackPreviewTiles(unit: BattleUnit, origin: Point): TileData[] {
    return this.map.filter((tile) => {
      const distance = manhattanDistance(origin, tile);
      return distance >= unit.rangeMin && distance <= unit.rangeMax;
    });
  }

  private getAttackPreviewTargets(unit: BattleUnit, origin: Point): BattleUnit[] {
    return this.units.filter((target) => {
      if (!target.alive || target.team === unit.team) {
        return false;
      }

      const distance = manhattanDistance(origin, target);
      return distance >= unit.rangeMin && distance <= unit.rangeMax;
    });
  }

  private getBasePlanePoint(tile: Point): Phaser.Math.Vector2 {
    const visualPoint = this.getRotatedGridPoint(tile);
    const boardX = (visualPoint.x - visualPoint.y) * (TILE_WIDTH / 2);
    const boardY = (visualPoint.x + visualPoint.y) * (TILE_HEIGHT / 2);

    return new Phaser.Math.Vector2(this.origin.x + boardX, this.origin.y + boardY);
  }

  private getRotatedGridPoint(tile: Point): Point {
    switch (this.boardRotationStep % 4) {
      case 1:
        return { x: this.gridHeight - 1 - tile.y, y: tile.x };
      case 2:
        return { x: this.gridWidth - 1 - tile.x, y: this.gridHeight - 1 - tile.y };
      case 3:
        return { x: tile.y, y: this.gridWidth - 1 - tile.x };
      default:
        return { x: tile.x, y: tile.y };
    }
  }

  private getFacingAdjustedDirection(direction: Point): Point {
    let dx = direction.x;
    let dy = direction.y;

    for (let index = 0; index < this.boardRotationStep % 4; index += 1) {
      const nextX = dy;
      const nextY = -dx;
      dx = nextX;
      dy = nextY;
    }

    return { x: dx, y: dy };
  }

  private isoToScreen(tile: Point & { height?: number }): Phaser.Math.Vector2 {
    const tileHeight = tile.height ?? getTile(this.map, tile.x, tile.y)?.height ?? 0;
    const point = this.getBasePlanePoint(tile);

    return new Phaser.Math.Vector2(
      point.x,
      point.y - tileHeight * ELEVATION_STEP
    );
  }

  private getTileTopPoints(tile: Point & { height?: number }): Phaser.Math.Vector2[] {
    const center = this.isoToScreen(tile);
    return [
      new Phaser.Math.Vector2(center.x, center.y - TILE_HEIGHT / 2),
      new Phaser.Math.Vector2(center.x + TILE_WIDTH / 2, center.y),
      new Phaser.Math.Vector2(center.x, center.y + TILE_HEIGHT / 2),
      new Phaser.Math.Vector2(center.x - TILE_WIDTH / 2, center.y)
    ];
  }

  private getTileDepth(tile: Point & { height?: number }): number {
    const tileHeight = tile.height ?? getTile(this.map, tile.x, tile.y)?.height ?? 0;
    return this.isoToScreen({ ...tile, height: tileHeight }).y + tileHeight * ELEVATION_STEP;
  }

  private getHighlightDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 2;
  }

  private getChestDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 6;
  }

  private getPropDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 7;
  }

  private getPropBaseDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 4;
  }

  private getLightShadowDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 5;
  }

  private getGroundGlowDepth(tile: TileData): number {
    return this.getPropBaseDepth(tile) - 0.15;
  }

  private getGroundLightDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 1.25;
  }

  private getLightHaloDepth(tile: TileData): number {
    return this.getPropDepth(tile) - 0.1;
  }

  private getUnitDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 8;
  }

  private getWallDepth(tile: TileData): number {
    return this.getTileDepth(tile) + TILE_HEIGHT / 2 + 1;
  }

  private pickTile(screenX: number, screenY: number): TileData | null {
    const tiles = [...this.map].sort((left, right) => {
      const leftPoint = this.isoToScreen(left);
      const rightPoint = this.isoToScreen(right);
      return rightPoint.y - leftPoint.y;
    });

    for (const tile of tiles) {
      const polygon = new Phaser.Geom.Polygon(this.getTileTopPoints(tile).map((point) => ({ x: point.x, y: point.y })));

      if (Phaser.Geom.Polygon.Contains(polygon, screenX, screenY)) {
        return tile;
      }
    }

    return null;
  }

  private beginPan(pointer: Phaser.Input.Pointer): void {
    this.isPanning = true;
    this.panPointerOrigin.set(pointer.x, pointer.y);
    const camera = this.getWorldCamera();
    this.panCameraOrigin.set(camera.scrollX, camera.scrollY);
    this.hoverTile = null;
    this.drawHighlights();
    this.refreshUi();
  }

  private rotateBoard(stepDelta: number): void {
    if (this.phase === 'complete' || this.busy || this.isPanning) {
      return;
    }

    this.boardRotationStep = Phaser.Math.Wrap(this.boardRotationStep + stepDelta, 0, 4);
    this.boardPivot = this.getBaseBoardPivot();
    this.hoverTile = null;
    this.getWorldCamera().setRotation(0);
    this.drawBoard();
    this.createTerrainTiles();
    this.applyTimeOfDay();

    for (const prop of this.level.props) {
      this.positionProp(prop);
    }

    for (const chest of this.chests) {
      this.positionChest(chest);
    }

    for (const unit of this.units) {
      this.positionUnit(unit);
    }

    this.configureCamera(false);
    this.drawHighlights();
    this.refreshUi();
  }

  private getBaseBoardPivot(): Phaser.Math.Vector2 {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const tile of this.map) {
      const center = this.getBasePlanePoint(tile);
      minX = Math.min(minX, center.x - TILE_WIDTH / 2);
      maxX = Math.max(maxX, center.x + TILE_WIDTH / 2);
      minY = Math.min(minY, center.y - TILE_HEIGHT / 2);
      maxY = Math.max(maxY, center.y + TILE_HEIGHT / 2);
    }

    return new Phaser.Math.Vector2((minX + maxX) / 2, (minY + maxY) / 2);
  }

  private getVisibleNeighborDirections(): { right: Point; left: Point } {
    return {
      right: this.getOriginalDirectionForVisualDirection({ x: 1, y: 0 }),
      left: this.getOriginalDirectionForVisualDirection({ x: 0, y: 1 })
    };
  }

  private getOriginalDirectionForVisualDirection(direction: Point): Point {
    let dx = direction.x;
    let dy = direction.y;

    for (let index = 0; index < this.boardRotationStep % 4; index += 1) {
      const nextX = dy;
      const nextY = -dx;
      dx = nextX;
      dy = nextY;
    }

    return { x: dx, y: dy };
  }

  private setBoardScroll(scrollX: number, scrollY: number): void {
    const camera = this.getWorldCamera();
    const boardFocus = this.getBoardFocusPoint();
    const fitSize = this.getBoardFitSize();
    const resolved = this.resolveBoardScroll(scrollX, scrollY, camera, boardFocus, fitSize, false);

    camera.setScroll(resolved.x, resolved.y);
  }

  private getCameraScrollForFocus(
    focusX: number,
    focusY: number,
    anchorPoint: Phaser.Math.Vector2 = this.getCameraCenterAnchorPoint(this.getWorldCamera())
  ): Phaser.Math.Vector2 {
    const camera = this.getWorldCamera();
    const boardFocus = this.getBoardFocusPoint();
    const fitSize = this.getBoardFitSize();
    const targetScroll = this.getScrollForScreenAnchor(
      focusX,
      focusY,
      anchorPoint.x,
      anchorPoint.y,
      camera
    );

    return this.resolveBoardScroll(
      targetScroll.x,
      targetScroll.y,
      camera,
      boardFocus,
      fitSize,
      true
    );
  }

  private getCameraPlayArea(camera: Phaser.Cameras.Scene2D.Camera): Phaser.Geom.Rectangle {
    return this.playAreaRect.width > 0 && this.playAreaRect.height > 0
      ? this.playAreaRect
      : new Phaser.Geom.Rectangle(0, 0, camera.width, camera.height);
  }

  private getCameraCenterAnchorPoint(camera: Phaser.Cameras.Scene2D.Camera): Phaser.Math.Vector2 {
    const playArea = this.getCameraPlayArea(camera);
    return new Phaser.Math.Vector2(playArea.centerX, playArea.centerY);
  }

  private getUnitFollowAnchorPoint(camera: Phaser.Cameras.Scene2D.Camera): Phaser.Math.Vector2 {
    const playArea = this.getCameraPlayArea(camera);

    return new Phaser.Math.Vector2(
      playArea.centerX,
      playArea.y + playArea.height * UNIT_FOLLOW_SCREEN_ANCHOR_Y
    );
  }

  private getScrollForScreenAnchor(
    worldX: number,
    worldY: number,
    screenX: number,
    screenY: number,
    camera: Phaser.Cameras.Scene2D.Camera
  ): Phaser.Math.Vector2 {
    const currentWorldPoint = camera.getWorldPoint(screenX, screenY);

    return new Phaser.Math.Vector2(
      camera.scrollX + (worldX - currentWorldPoint.x),
      camera.scrollY + (worldY - currentWorldPoint.y)
    );
  }

  private resolveBoardScroll(
    scrollX: number,
    scrollY: number,
    camera: Phaser.Cameras.Scene2D.Camera,
    boardFocus: Phaser.Math.Vector2,
    fitSize: { width: number; height: number },
    lockToBoard: boolean
  ): Phaser.Math.Vector2 {
    const playArea = this.getCameraPlayArea(camera);
    const playAreaTopLeft = camera.getWorldPoint(playArea.x, playArea.y);
    const playAreaBottomRight = camera.getWorldPoint(playArea.right, playArea.bottom);
    const visibleWidth = playAreaBottomRight.x - playAreaTopLeft.x;
    const visibleHeight = playAreaBottomRight.y - playAreaTopLeft.y;
    const minScrollX = this.cameraBounds.x + (camera.scrollX - playAreaTopLeft.x);
    const minScrollY = this.cameraBounds.y + (camera.scrollY - playAreaTopLeft.y);
    const maxScrollX = this.cameraBounds.right + (camera.scrollX - playAreaBottomRight.x);
    const maxScrollY = this.cameraBounds.bottom + (camera.scrollY - playAreaBottomRight.y);
    const canScrollX = maxScrollX > minScrollX;
    const canScrollY = maxScrollY > minScrollY;
    const centerAnchorPoint = this.getCameraCenterAnchorPoint(camera);
    const centeredScroll = this.getScrollForScreenAnchor(
      boardFocus.x,
      boardFocus.y,
      centerAnchorPoint.x,
      centerAnchorPoint.y,
      camera
    );
    const resolvedScrollX =
      (lockToBoard && visibleWidth >= fitSize.width) || !canScrollX
        ? centeredScroll.x
        : Phaser.Math.Clamp(scrollX, minScrollX, maxScrollX);
    const resolvedScrollY =
      (lockToBoard && visibleHeight >= fitSize.height) || !canScrollY
        ? centeredScroll.y
        : Phaser.Math.Clamp(scrollY, minScrollY, maxScrollY);

    return new Phaser.Math.Vector2(resolvedScrollX, resolvedScrollY);
  }

  private panCameraToPoint(focusX: number, focusY: number, duration: number): Promise<void> {
    const camera = this.getWorldCamera();
    const targetScroll = this.getCameraScrollForFocus(
      focusX,
      focusY,
      this.getUnitFollowAnchorPoint(camera)
    );

    if (
      Phaser.Math.Distance.Between(
        camera.scrollX,
        camera.scrollY,
        targetScroll.x,
        targetScroll.y
      ) < 0.5
    ) {
      this.setBoardScroll(targetScroll.x, targetScroll.y);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: camera,
        scrollX: targetScroll.x,
        scrollY: targetScroll.y,
        duration,
        ease: 'Sine.easeOut',
        onUpdate: () => {
          this.setBoardScroll(camera.scrollX, camera.scrollY);
        },
        onComplete: () => {
          this.setBoardScroll(targetScroll.x, targetScroll.y);
          resolve();
        }
      });
    });
  }

  private zoomBoard(deltaY: number, screenX: number, screenY: number): void {
    if (deltaY === 0) {
      return;
    }

    const camera = this.getWorldCamera();
    const zoomFactor = Math.exp(-deltaY * BOARD_ZOOM_SENSITIVITY);
    const minimumZoom = this.getMinimumBoardZoom();
    const nextZoom = Phaser.Math.Clamp(
      camera.zoom * zoomFactor,
      minimumZoom,
      MAX_BOARD_ZOOM
    );

    this.applyBoardZoom(nextZoom, screenX, screenY);
  }

  private stepBoardZoom(step: number): void {
    const camera = this.getWorldCamera();
    const minimumZoom = this.getMinimumBoardZoom();
    const nextZoom = Phaser.Math.Clamp(
      camera.zoom * (step > 0 ? 1.16 : 1 / 1.16),
      minimumZoom,
      MAX_BOARD_ZOOM
    );

    this.applyBoardZoom(nextZoom, this.scale.width / 2, this.scale.height / 2);
  }

  private applyBoardZoom(nextZoom: number, screenX: number, screenY: number): void {
    const camera = this.getWorldCamera();
    const minimumZoom = this.getMinimumBoardZoom();

    if (Math.abs(nextZoom - camera.zoom) < 0.001) {
      return;
    }

    const worldPointBefore = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(nextZoom);
    const worldPointAfter = camera.getWorldPoint(screenX, screenY);

    if (nextZoom <= minimumZoom + 0.001) {
      const boardFocus = this.getBoardFocusPoint();
      const centeredScroll = this.getCameraScrollForFocus(boardFocus.x, boardFocus.y);
      camera.setScroll(centeredScroll.x, centeredScroll.y);
    } else {
      this.setBoardScroll(
        camera.scrollX + (worldPointBefore.x - worldPointAfter.x),
        camera.scrollY + (worldPointBefore.y - worldPointAfter.y)
      );
    }

    const anchoredWorldPoint = camera.getWorldPoint(screenX, screenY);
    this.hoverTile = this.pickTile(anchoredWorldPoint.x, anchoredWorldPoint.y);
    this.drawHighlights();
    this.refreshUi();
  }

  private isPointerOverUi(x: number, y: number): boolean {
    const staticPanels = this.isBattleIntroActive()
      ? (this.mapIntroAlpha > 0.01
          ? [new Phaser.Geom.Rectangle(
              this.mapIntroBounds.x,
              this.mapIntroBounds.y + this.mapIntroOffsetY,
              this.mapIntroBounds.width,
              this.mapIntroBounds.height
            )]
          : [new Phaser.Geom.Rectangle(0, 0, this.scale.width, this.scale.height)])
      : [
          this.headerRect,
          ...(this.showDetailPanel ? [this.uiPanels.topRight] : []),
          ...(this.showDetailPanel && this.showPortraitPanel && this.portrait.visible ? [this.uiPanels.portrait] : []),
          ...(this.headerMenuOpen ? [this.headerMenuPanelBounds] : [])
        ];

    if (staticPanels.some((panel) => panel.contains(x, y))) {
      return true;
    }

    if (this.showHudControls && this.hudControls.some((control) => control.container.visible && control.container.getBounds().contains(x, y))) {
      return true;
    }

    return this.actionMenuStack.containsPoint(x, y);
  }

  private getMenuEntries(): MenuEntry[] {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit || activeUnit.team !== 'player') {
      return [];
    }

    const inventoryEntries = getInventoryEntries(this.getUnitInventory(activeUnit));

    return [
      {
        action: 'move',
        label: this.turnMoveUsed ? 'Move [Done]' : 'Move',
        enabled: !this.turnMoveUsed
      },
      {
        action: 'abilities',
        label: this.turnActionUsed ? 'Abilities [Done]' : 'Abilities',
        enabled: !this.turnActionUsed && activeUnit.abilities.length > 0
      },
      {
        action: 'items',
        label: this.turnActionUsed ? 'Items [Done]' : 'Items',
        enabled: !this.turnActionUsed && inventoryEntries.length > 0
      },
      {
        action: 'wait',
        label: 'Wait',
        enabled: true
      }
    ];
  }

  private getBlockedPropPoints(): Point[] {
    return this.level.props
      .filter((prop) => PROP_RENDER_CONFIG[prop.assetId].blocksMovement)
      .map((prop) => ({ x: prop.x, y: prop.y }));
  }

  private isPlayerTurnPhase(phase = this.phase): boolean {
    return (
      phase === 'player-menu' ||
      phase === 'player-abilities' ||
      phase === 'player-move' ||
      phase === 'player-action' ||
      phase === 'player-items' ||
      phase === 'player-item-action'
    );
  }

  private shouldShowActionMenu(): boolean {
    if (this.isBattleIntroActive()) {
      return false;
    }

    const activeUnit = this.getActiveUnit();
    return !!activeUnit && activeUnit.team === 'player' && this.isPlayerTurnPhase();
  }

  private getTargetableUnitsForItem(unit: BattleUnit, itemId: ItemId): BattleUnit[] {
    return this.units.filter((target) => {
      if (!target.alive) {
        return false;
      }

      if (manhattanDistance(unit, target) > 1) {
        return false;
      }

      return true;
    });
  }

  private buildActionMenuPanels(): ActionMenuPanelDescriptor[] {
    const activeUnit = this.getActiveUnit();
    if (!activeUnit || activeUnit.team !== 'player') {
      return [];
    }

    const rootPanel: ActionMenuPanelDescriptor = {
      id: 'command-list',
      kind: 'list',
      title: this.getMenuTitle(),
      blocksWorldInput: true,
      entries: this.getMenuEntries().map((entry) => ({
        id: entry.action,
        label: entry.label,
        enabled: entry.enabled,
        active: this.getCurrentMenuAction() === entry.action
      }))
    };

    switch (this.phase) {
      case 'player-menu':
        return [rootPanel];
      case 'player-move':
        return [rootPanel, this.buildMoveDetailPanel(activeUnit)];
      case 'player-abilities':
        return [rootPanel, this.buildAbilityListPanel()];
      case 'player-action': {
        const abilityDetail = this.buildAbilityDetailPanel();
        return abilityDetail ? [rootPanel, this.buildAbilityListPanel(), abilityDetail] : [rootPanel, this.buildAbilityListPanel()];
      }
      case 'player-items':
        return [rootPanel, this.buildItemListPanel()];
      case 'player-item-action': {
        const itemDetail = this.buildItemDetailPanel(activeUnit);
        return itemDetail ? [rootPanel, this.buildItemListPanel(), itemDetail] : [rootPanel, this.buildItemListPanel()];
      }
      default:
        return [];
    }
  }

  private buildMoveDetailPanel(activeUnit: BattleUnit): ActionMenuPanelDescriptor {
    return {
      id: 'move-detail',
      kind: 'detail',
      title: 'Move',
      blocksWorldInput: true,
      body: [
        `Stride up to ${activeUnit.move} tiles across open ground.`,
        this.turnMoveUsed ? 'Movement is already spent this turn.' : 'Select a reachable tile on the map.'
      ].join('\n')
    };
  }

  private buildAbilityListPanel(): ActionMenuPanelDescriptor {
    return {
      id: 'ability-list',
      kind: 'list',
      title: 'Abilities',
      blocksWorldInput: true,
      entries: this.getSubmenuEntries().map((entry) => ({
        id: entry.abilityId ?? '',
        label: entry.label,
        enabled: entry.enabled,
        active: entry.abilityId === this.selectedAbilityId
      }))
    };
  }

  private buildAbilityDetailPanel(): ActionMenuPanelDescriptor | null {
    const ability = this.getSelectedAbility();
    if (!ability) {
      return null;
    }

    return {
      id: 'ability-detail',
      kind: 'detail',
      title: ability.name,
      blocksWorldInput: true,
      body: [
        ability.description,
        `Range ${ability.rangeMin}-${ability.rangeMax}  •  ${ability.target === 'ally' ? 'Allies' : 'Enemies'}`
      ].join('\n')
    };
  }

  private buildItemListPanel(): ActionMenuPanelDescriptor {
    return {
      id: 'item-list',
      kind: 'list',
      title: 'Items',
      blocksWorldInput: true,
      entries: this.getSubmenuEntries().map((entry) => ({
        id: entry.itemId ?? '',
        label: entry.label,
        enabled: entry.enabled,
        active: entry.itemId === this.selectedItemId
      }))
    };
  }

  private buildItemDetailPanel(activeUnit: BattleUnit): ActionMenuPanelDescriptor | null {
    if (!this.selectedItemId) {
      return null;
    }

    const item = getItemDefinition(this.selectedItemId);
    const count = this.getUnitInventory(activeUnit)[this.selectedItemId] ?? 0;

    return {
      id: 'item-detail',
      kind: 'detail',
      title: item.name,
      blocksWorldInput: true,
      body: [
        item.description,
        `Range 1  •  Stock ${count}`,
        'Targets any adjacent unit.',
        'Select an adjacent target on the map.'
      ].join('\n')
    };
  }

  private handleHudControlPointer(x: number, y: number): boolean {
    if (!this.showHudControls) {
      return false;
    }

    for (const control of this.hudControls) {
      if (!control.container.visible || !control.container.getBounds().contains(x, y)) {
        continue;
      }

      switch (control.action) {
        case 'zoom-in':
          this.stepBoardZoom(1);
          return true;
        case 'zoom-out':
          this.stepBoardZoom(-1);
          return true;
        case 'rotate-left':
          this.rotateBoard(-1);
          return true;
        case 'rotate-right':
          this.rotateBoard(1);
          return true;
        case 'mute': {
          const muted = audioDirector.toggleMute();
          this.syncSceneAudioMute();
          this.pushLog(`Audio ${muted ? 'muted' : 'enabled'}.`);
          this.refreshUi();
          return true;
        }
        default:
          return false;
      }
    }

    return false;
  }

  private async handleHeaderMenuPointer(x: number, y: number): Promise<boolean> {
    if (this.headerMenuButtonBounds.contains(x, y)) {
      this.setPauseMenuOpen(!this.headerMenuOpen);
      this.refreshUi();
      return true;
    }

    if (!this.headerMenuOpen) {
      return false;
    }

    if (!this.headerMenuPanelBounds.contains(x, y)) {
      this.setPauseMenuOpen(false);
      this.refreshUi();
      return true;
    }

    const actions: HeaderMenuAction[] = ['auto', 'audio', 'restart'];
    for (const [index, bounds] of this.headerMenuOptionBounds.entries()) {
      if (bounds.contains(x, y)) {
        await this.executeHeaderMenuAction(actions[index]);
        return true;
      }
    }

    return true;
  }

  private async executeHeaderMenuAction(action: HeaderMenuAction): Promise<void> {
    this.setPauseMenuOpen(false);

    switch (action) {
      case 'auto':
        await this.toggleAutoBattle();
        return;
      case 'audio': {
        const muted = audioDirector.toggleMute();
        this.syncSceneAudioMute();
        this.pushLog(`Audio ${muted ? 'muted' : 'enabled'}.`);
        this.refreshUi();
        return;
      }
      case 'restart':
        this.restartBattle();
        return;
      default:
        return;
    }
  }

  private async handleDockPointer(x: number, y: number): Promise<boolean> {
    void x;
    void y;
    return false;
  }

  private async handleDockActionEntry(action: DockActionEntry): Promise<void> {
    if (action.id === 'back') {
      this.cancelPlayerSelectionPhase();
      return;
    }

    if (this.phase === 'player-abilities' || this.phase === 'player-action' || this.phase === 'player-items' || this.phase === 'player-item-action') {
      const entry = this.getSubmenuEntries().find(
        (candidate) => candidate.abilityId === action.id || candidate.itemId === action.id
      );
      if (entry?.enabled) {
        await this.activateSubmenuEntry(entry);
      }
      return;
    }

    const entry = this.getMenuEntries().find((candidate) => candidate.action === action.id);
    if (entry?.enabled) {
      await this.activateMenuEntry(entry);
    }
  }

  private cancelPlayerSelectionPhase(): void {
    switch (this.phase) {
      case 'player-items':
        audioDirector.playUiCancel();
        this.phase = 'player-menu';
        this.selectedAbilityId = null;
        this.selectedItemId = null;
        break;
      case 'player-item-action':
        audioDirector.playUiCancel();
        this.phase = 'player-items';
        break;
      case 'player-abilities':
        audioDirector.playUiCancel();
        this.phase = 'player-menu';
        this.selectedAbilityId = null;
        this.selectedItemId = null;
        break;
      case 'player-action':
        audioDirector.playUiCancel();
        this.phase = 'player-abilities';
        this.selectedAbilityId = null;
        break;
      case 'player-move':
        audioDirector.playUiCancel();
        this.phase = 'player-menu';
        this.selectedAbilityId = null;
        this.selectedItemId = null;
        break;
      default:
        return;
    }

    this.drawHighlights();
    this.refreshUi();
  }

  private getSubmenuEntries(): SubmenuEntry[] {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit || activeUnit.team !== 'player') {
      return [];
    }

    if (this.phase === 'player-abilities' || this.phase === 'player-action') {
      return activeUnit.abilities.map((ability) => ({
        label: ability.name,
        enabled: this.getTargetableUnitsForAbility(activeUnit, ability).length > 0,
        abilityId: ability.id
      }));
    }

    if (this.phase === 'player-items' || this.phase === 'player-item-action') {
      return getInventoryEntries(this.getUnitInventory(activeUnit)).map((entry) => ({
        label: `${getItemDefinition(entry.itemId).name} x${entry.count}`,
        enabled: this.getTargetableUnitsForItem(activeUnit, entry.itemId).length > 0,
        itemId: entry.itemId
      }));
    }

    return [];
  }

  private getBasicAttackAbility(unit: BattleUnit): UnitAbility {
    return (
      unit.abilities.find((ability) => ability.id === 'attack') ??
      unit.abilities.find((ability) => ability.kind === 'attack') ??
      unit.abilities[0]
    );
  }

  private getSelectedAbility(): UnitAbility | null {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit || !this.selectedAbilityId) {
      return null;
    }

    return activeUnit.abilities.find((ability) => ability.id === this.selectedAbilityId) ?? null;
  }

  private getTargetableUnitsForAbility(unit: BattleUnit, ability: UnitAbility): BattleUnit[] {
    return this.units.filter((target) => {
      if (!target.alive) {
        return false;
      }

      if (ability.target === 'enemy' && target.team === unit.team) {
        return false;
      }

      if (ability.target === 'ally' && target.team !== unit.team) {
        return false;
      }

      if (ability.kind === 'steal' && !target.dropItemId) {
        return false;
      }

      const distance = manhattanDistance(unit, target);
      return distance >= ability.rangeMin && distance <= ability.rangeMax;
    });
  }

  private async handleMenuPointer(x: number, y: number): Promise<boolean> {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit || activeUnit.team !== 'player') {
      return false;
    }

    const hit = this.actionMenuStack.hitTest(x, y);
    if (!hit) {
      return false;
    }

    if (!hit.entryId) {
      return hit.blocksWorldInput;
    }

    if (hit.panelId === 'command-list') {
      const entry = this.getMenuEntries().find((candidate) => candidate.action === hit.entryId);
      if (entry?.enabled) {
        await this.activateMenuEntry(entry);
      }
      return true;
    }

    if (hit.panelId === 'ability-list' || hit.panelId === 'item-list') {
      const entry = this.getSubmenuEntries().find(
        (candidate) => candidate.abilityId === hit.entryId || candidate.itemId === hit.entryId
      );
      if (entry?.enabled) {
        await this.activateSubmenuEntry(entry);
      }
      return true;
    }

    return hit.blocksWorldInput;
  }

  private async activateMenuEntry(entry: MenuEntry): Promise<void> {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit) {
      return;
    }

    switch (entry.action) {
      case 'move':
        audioDirector.playUiConfirm();
        this.selectedAbilityId = null;
        this.selectedItemId = null;
        this.phase = 'player-move';
        this.pushLog(`Choose a tile for ${activeUnit.name}.`);
        this.drawHighlights();
        this.refreshUi();
        return;
      case 'abilities':
        audioDirector.playUiConfirm();
        this.phase = 'player-abilities';
        this.selectedAbilityId = null;
        this.selectedItemId = null;
        this.pushLog(`Choose an ability for ${activeUnit.name}.`);
        this.drawHighlights();
        this.refreshUi();
        return;
      case 'items':
        audioDirector.playUiConfirm();
        this.phase = 'player-items';
        this.selectedAbilityId = null;
        this.selectedItemId = null;
        this.pushLog(`Choose an item for ${activeUnit.name}.`);
        this.drawHighlights();
        this.refreshUi();
        return;
      case 'wait':
        audioDirector.playUiConfirm();
        this.pushLog(`${activeUnit.name} waits and watches the ridge.`);
        await this.endCurrentTurn();
        return;
      default:
        return;
    }
  }

  private async activateSubmenuEntry(entry: SubmenuEntry): Promise<void> {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit) {
      return;
    }

    if (entry.itemId) {
      const item = getItemDefinition(entry.itemId);
      audioDirector.playUiConfirm();
      this.selectedItemId = entry.itemId;
      this.phase = 'player-item-action';
      this.pushLog(`Choose a target for ${item.name}.`);
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (entry.abilityId) {
      const ability = activeUnit.abilities.find((candidate) => candidate.id === entry.abilityId);

      if (!ability) {
        return;
      }

      this.selectedAbilityId = ability.id;
      this.selectedItemId = null;
      audioDirector.playUiConfirm();
      this.phase = 'player-action';
      this.pushLog(`Choose a target for ${ability.name}.`);
      this.drawHighlights();
      this.refreshUi();
    }
  }

  private async useItem(itemId: ItemId, targetUnit?: BattleUnit): Promise<void> {
    const activeUnit = this.getActiveUnit();
    const item = getItemDefinition(itemId);
    const count = activeUnit ? this.getUnitInventory(activeUnit)[itemId] ?? 0 : 0;
    const target = targetUnit ?? activeUnit;

    if (!activeUnit || !target || count <= 0) {
      return;
    }

    const targetable = this.getTargetableUnitsForItem(activeUnit, itemId).some((unit) => unit.id === target.id);
    if (!targetable) {
      audioDirector.playUiCancel();
      this.pushLog(`${item.name} cannot reach that target.`);
      this.refreshUi();
      return;
    }

    switch (item.effect.kind) {
      case 'heal': {
        const recovered = Math.min(item.effect.amount, target.maxHp - target.hp);
        audioDirector.playHeal();
        await this.playCombatEffect(item.effectKey, activeUnit, target);
        target.hp += recovered;
        this.consumeItemFromUnit(activeUnit, itemId, 1);
        this.turnActionUsed = true;
        this.positionUnit(target);
        await this.flashUnitSprite(target, 0xb8ffd0);
        await this.showFloatingCombatText(
          this.getUnitSpritePoint(target, 0.72),
          recovered > 0 ? `+${recovered}` : 'MISS',
          UI_TEXT_DAMAGE,
          42,
          720
        );
        this.pushLog(
          recovered > 0
            ? `${activeUnit.name} uses ${item.name} on ${target.name}, restoring ${recovered} HP.`
            : `${activeUnit.name} uses ${item.name} on ${target.name}, but it has no effect.`
        );
        await this.finishPlayerCommand(activeUnit, `${activeUnit.name} can still move this turn.`);
        return;
      }
      case 'ct':
        audioDirector.playUiConfirm();
        await this.playCombatEffect(item.effectKey, activeUnit, target);
        target.ct += item.effect.amount;
        this.consumeItemFromUnit(activeUnit, itemId, 1);
        this.turnActionUsed = true;
        this.positionUnit(target);
        await this.flashUnitSprite(target, 0xf4dd91);
        await this.showFloatingCombatText(
          this.getUnitSpritePoint(target, 0.72),
          `+${item.effect.amount} CT`,
          UI_TEXT_DAMAGE,
          40,
          720
        );
        this.pushLog(`${activeUnit.name} uses ${item.name} on ${target.name}, granting ${item.effect.amount} CT.`);
        await this.finishPlayerCommand(activeUnit, `${activeUnit.name} can still move this turn.`);
        return;
      default:
        return;
    }
  }

  private async handlePointerDown(pointer: Phaser.Input.Pointer): Promise<void> {
    if (this.phase === 'complete') {
      this.restartBattle();
      return;
    }

    if (await this.handleHeaderMenuPointer(pointer.x, pointer.y)) {
      return;
    }

    if (this.busy) {
      return;
    }

    if (this.handleHudControlPointer(pointer.x, pointer.y)) {
      return;
    }

    if (await this.handleMenuPointer(pointer.x, pointer.y)) {
      return;
    }

    const turnOrderUnitId = this.turnOrderPanel.getUnitIdAt(pointer.x, pointer.y);
    if (turnOrderUnitId) {
      await this.panToUnitFromTurnOrder(turnOrderUnitId);
      return;
    }

    if (await this.handleDockPointer(pointer.x, pointer.y)) {
      return;
    }

    if (this.isPointerOverUi(pointer.x, pointer.y)) {
      return;
    }

    const worldPoint = pointer.positionToCamera(this.getWorldCamera()) as Phaser.Math.Vector2;
    const tile = this.pickTile(worldPoint.x, worldPoint.y);

    if (!tile) {
      return;
    }

    if (this.phase === 'player-move') {
      const node = this.moveNodes.get(pointKey(tile));

      if (!node) {
        return;
      }

      await this.handlePlayerMove(tile);
      return;
    }

    if (this.phase === 'player-action') {
      const target = this.units.find(
        (unit) => unit.alive && unit.x === tile.x && unit.y === tile.y
      );

      if (!target) {
        return;
      }

      const activeUnit = this.getActiveUnit();
      const selectedAbility = this.getSelectedAbility();

      if (!activeUnit || !selectedAbility) {
        return;
      }

      const targetable = this.getTargetableUnitsForAbility(activeUnit, selectedAbility).some((unit) => unit.id === target.id);

      if (!targetable) {
        return;
      }

      await this.performAbility(activeUnit, target, selectedAbility);
      return;
    }

    if (this.phase === 'player-item-action') {
      const target = this.units.find(
        (unit) => unit.alive && unit.x === tile.x && unit.y === tile.y
      );

      if (!target) {
        return;
      }

      const activeUnit = this.getActiveUnit();
      const selectedItemId = this.selectedItemId;

      if (!activeUnit || !selectedItemId) {
        return;
      }

      const targetable = this.getTargetableUnitsForItem(activeUnit, selectedItemId).some((unit) => unit.id === target.id);
      if (!targetable) {
        return;
      }

      await this.useItem(selectedItemId, target);
      return;
    }

    this.inspectTile(tile);
  }

  private async panToUnitFromTurnOrder(unitId: string): Promise<void> {
    const unit = this.units.find((entry) => entry.id === unitId && entry.alive);
    const currentTarget = this.getResolvedInspectionTarget();

    if (!unit) {
      return;
    }

    if (currentTarget.kind === 'unit' && currentTarget.unitId === unitId) {
      return;
    }

    const target = this.setInspectionTarget({ kind: 'unit', unitId }, false);
    if (target.kind !== 'unit') {
      this.drawHighlights();
      this.refreshUi();
      return;
    }
    const focusPoint = this.getUnitCameraFocusPoint(unit);
    await this.panCameraToPoint(focusPoint.x, focusPoint.y, 260);
    this.drawHighlights();
    this.refreshUi();
  }

  private async handleSpaceKey(): Promise<void> {
    if (this.busy || this.phase === 'complete' || this.headerMenuOpen) {
      return;
    }

    const activeUnit = this.getActiveUnit();

    if (!activeUnit) {
      return;
    }

    if (this.phase === 'player-menu') {
      audioDirector.playUiConfirm();
      this.pushLog(`${activeUnit.name} waits and watches the ridge.`);
      await this.endCurrentTurn();
      return;
    }

    if (this.phase === 'player-items') {
      this.cancelPlayerSelectionPhase();
      return;
    }

    if (this.phase === 'player-item-action') {
      this.cancelPlayerSelectionPhase();
      return;
    }

    if (this.phase === 'player-abilities') {
      this.cancelPlayerSelectionPhase();
      return;
    }

    if (this.phase === 'player-move') {
      this.cancelPlayerSelectionPhase();
      return;
    }

    if (this.phase === 'player-action') {
      this.cancelPlayerSelectionPhase();
      return;
    }
  }

  private async handlePlayerMove(tile: TileData): Promise<void> {
    const activeUnit = this.getActiveUnit();

    if (!activeUnit) {
      return;
    }

    this.busy = true;
    this.phase = 'animating';
    this.drawHighlights();
    this.refreshUi();

    const path = buildPath(this.moveNodes, tile);

    if (path.length > 1) {
      await this.animateMovement(activeUnit, path.slice(1));
    }

    activeUnit.x = tile.x;
    activeUnit.y = tile.y;
    this.positionUnit(activeUnit);

    this.turnMoveUsed = true;
    await this.collectChestAt(activeUnit);
    await this.finishPlayerCommand(activeUnit, `${activeUnit.name} is in position. Choose the next command.`);
  }

  private async beginNextTurn(): Promise<void> {
    if (this.phase === 'complete') {
      return;
    }

    const livingPlayers = this.units.filter((unit) => unit.alive && unit.team === 'player');
    const livingEnemies = this.units.filter((unit) => unit.alive && unit.team === 'enemy');

    if (livingPlayers.length === 0 || livingEnemies.length === 0) {
      this.endBattle(livingEnemies.length === 0 ? 'Victory' : 'Defeat');
      return;
    }

    const actor = pickNextActor(this.units);
    this.activeUnitId = actor.id;
    this.setInspectionTarget({ kind: 'mission' }, false);
    this.moveNodes = getReachableNodes(this.map, actor, this.units, this.getBlockedPropPoints());
    const actorFocusPoint = this.getUnitCameraFocusPoint(actor);
    await this.panCameraToPoint(actorFocusPoint.x, actorFocusPoint.y, 280);
    this.playTurnStartAnimation(actor);
    audioDirector.playTurnStart(actor.team);
    this.queueTurnStartCatchPhrase(actor);
    this.playFactionMotto(actor.factionId);

    if (actor.team === 'player') {
      this.phase = 'player-menu';
      this.turnMoveUsed = false;
      this.turnActionUsed = false;
      this.pushLog(
        this.autoBattleEnabled
          ? `${actor.name} is ready. Auto-battle takes the reins.`
          : `${actor.name} is ready. Choose a command.`
      );
      this.drawHighlights();
      this.refreshUi();

      if (this.autoBattleEnabled) {
        this.time.delayedCall(320, () => {
          if (this.phase === 'player-menu' && this.getActiveUnit()?.id === actor.id && !this.busy) {
            this.tryStartAutoBattle(actor);
          }
        });
      }

      return;
    }

    this.phase = 'enemy';
    this.drawHighlights();
    this.refreshUi();

    this.time.delayedCall(620, () => {
      void this.executeAiTurn(actor);
    });
  }

  private async executeAiTurn(actor: BattleUnit): Promise<void> {
    if (!actor.alive || this.phase === 'complete') {
      return;
    }

    this.busy = true;
    this.phase = 'animating';
    this.drawHighlights();
    this.refreshUi();

    const reachable = getReachableNodes(this.map, actor, this.units, this.getBlockedPropPoints());
    const enemies = this.units.filter((unit) => unit.alive && unit.team !== actor.team);

    let bestPlan:
      | {
          moveTile: TileData;
          target: BattleUnit;
          score: number;
        }
      | null = null;

    for (const node of reachable.values()) {
      const tile = getTile(this.map, node.x, node.y);

      if (!tile) {
        continue;
      }

      for (const target of enemies) {
        const distance = manhattanDistance(node, target);

        if (distance < actor.rangeMin || distance > actor.rangeMax) {
          continue;
        }

        const score =
          (target.maxHp - target.hp) * 2 +
          Math.max(0, tile.height - (getTile(this.map, target.x, target.y)?.height ?? 0)) * 8 +
          (target.hp <= actor.attack ? 40 : 0) -
          distance * 3;

        if (!bestPlan || score > bestPlan.score) {
          bestPlan = { moveTile: tile, target, score };
        }
      }
    }

    if (bestPlan) {
      const path = buildPath(reachable, bestPlan.moveTile);

      if (path.length > 1) {
        await this.animateMovement(actor, path.slice(1));
      }

      actor.x = bestPlan.moveTile.x;
      actor.y = bestPlan.moveTile.y;
      this.positionUnit(actor);
      await this.collectChestAt(actor);
      await this.performAttack(actor, bestPlan.target);
      return;
    }

    let bestApproach:
      | {
          tile: TileData;
          score: number;
        }
      | null = null;

    for (const node of reachable.values()) {
      const tile = getTile(this.map, node.x, node.y);

      if (!tile) {
        continue;
      }

      const nearestDistance = Math.min(
        ...enemies.map((enemy) => manhattanDistance(node, enemy))
      );
      const score = nearestDistance * 20 - tile.height * 4;

      if (!bestApproach || score < bestApproach.score) {
        bestApproach = { tile, score };
      }
    }

    if (bestApproach) {
      const path = buildPath(reachable, bestApproach.tile);

      if (path.length > 1) {
        await this.animateMovement(actor, path.slice(1));
      }

      actor.x = bestApproach.tile.x;
      actor.y = bestApproach.tile.y;
      this.positionUnit(actor);
      await this.collectChestAt(actor);
    }

    this.pushLog(`${actor.name} repositions and watches for a weakness.`);
    await this.endCurrentTurn();
  }

  private canContinueAutoBattle(actor: BattleUnit, runToken: number): boolean {
    return (
      this.autoBattleEnabled &&
      this.activeAutoBattleRunToken === runToken &&
      this.autoBattleRunToken === runToken &&
      actor.alive &&
      actor.team === 'player' &&
      this.phase !== 'complete' &&
      this.getActiveUnit()?.id === actor.id &&
      this.isPlayerTurnPhase()
    );
  }

  private tryStartAutoBattle(actor: BattleUnit | null): void {
    if (
      !actor ||
      actor.team !== 'player' ||
      !this.autoBattleEnabled ||
      this.phase !== 'player-menu' ||
      this.busy ||
      this.getActiveUnit()?.id !== actor.id ||
      this.activeAutoBattleRunToken !== null
    ) {
      return;
    }

    const runToken = ++this.autoBattleRunToken;
    this.activeAutoBattleRunToken = runToken;

    void this.executeAutoBattleTurn(actor, runToken).finally(() => {
      const wasCanceled = this.autoBattleRunToken !== runToken;

      if (this.activeAutoBattleRunToken === runToken) {
        this.activeAutoBattleRunToken = null;
      }

      if (!wasCanceled || !this.autoBattleEnabled) {
        return;
      }

      const activeUnit = this.getActiveUnit();

      if (activeUnit?.id === actor.id) {
        this.tryStartAutoBattle(activeUnit);
      }
    });
  }

  private async executeAutoBattleTurn(actor: BattleUnit, runToken: number): Promise<void> {
    if (!this.canContinueAutoBattle(actor, runToken)) {
      return;
    }

    let safety = 0;

    while (safety < 3 && this.canContinueAutoBattle(actor, runToken)) {
      safety += 1;

      if (!this.turnActionUsed) {
        const plannedItem = this.chooseAutoBattleItem(actor);

        if (plannedItem) {
          await this.useItem(plannedItem, actor);
          continue;
        }

        const actionPlan = this.chooseAutoBattleActionPlan(actor);

        if (actionPlan) {
          if (!this.turnMoveUsed && (actionPlan.moveTile.x !== actor.x || actionPlan.moveTile.y !== actor.y)) {
            const moveTile = getTile(this.map, actionPlan.moveTile.x, actionPlan.moveTile.y);

            if (moveTile) {
              await this.handlePlayerMove(moveTile);

              if (!this.canContinueAutoBattle(actor, runToken)) {
                return;
              }
            }
          }

          await this.performAbility(actor, actionPlan.target, actionPlan.ability);
          continue;
        }
      }

      if (!this.turnMoveUsed) {
        const moveTile = this.chooseAutoBattleMoveTile(actor);

        if (moveTile && (moveTile.x !== actor.x || moveTile.y !== actor.y)) {
          await this.handlePlayerMove(moveTile);
          continue;
        }
      }

      this.pushLog(`${actor.name} waits and watches the ridge.`);
      await this.endCurrentTurn();
      return;
    }
  }

  private async toggleAutoBattle(): Promise<void> {
    this.autoBattleEnabled = !this.autoBattleEnabled;

    if (!this.autoBattleEnabled) {
      this.autoBattleRunToken += 1;
    }

    audioDirector.playUiConfirm();
    this.pushLog(`Auto-Battle ${this.autoBattleEnabled ? 'enabled' : 'disabled'}.`);
    this.refreshUi();
    this.tryStartAutoBattle(this.getActiveUnit());
  }

  private chooseAutoBattleItem(actor: BattleUnit): ItemId | null {
    const entries = getInventoryEntries(this.getUnitInventory(actor));

    for (const entry of entries) {
      const item = getItemDefinition(entry.itemId);

      if (item.effect.kind === 'heal' && actor.hp <= Math.floor(actor.maxHp * 0.55) && actor.hp < actor.maxHp) {
        return entry.itemId;
      }
    }

    return null;
  }

  private chooseAutoBattleActionPlan(
    actor: BattleUnit
  ): { moveTile: TileData; ability: UnitAbility; target: BattleUnit; score: number } | null {
    const reachable = this.turnMoveUsed
      ? new Map<string, ReachNode>([[pointKey(actor), { x: actor.x, y: actor.y, cost: 0, previousKey: null }]])
      : getReachableNodes(this.map, actor, this.units, this.getBlockedPropPoints());
    const allies = this.units.filter((unit) => unit.alive && unit.team === actor.team && unit.id !== actor.id);
    const enemies = this.units.filter((unit) => unit.alive && unit.team !== actor.team);
    let bestPlan: { moveTile: TileData; ability: UnitAbility; target: BattleUnit; score: number } | null = null;

    for (const node of reachable.values()) {
      const tile = getTile(this.map, node.x, node.y);

      if (!tile) {
        continue;
      }

      const simulatedActor = { ...actor, x: tile.x, y: tile.y };

      for (const ability of actor.abilities) {
        const targets = ability.target === 'ally' ? allies : enemies;

        for (const target of targets) {
          if (ability.kind === 'steal' && !target.dropItemId) {
            continue;
          }

          const distance = manhattanDistance(simulatedActor, target);

          if (distance < ability.rangeMin || distance > ability.rangeMax) {
            continue;
          }

          let score = 0;

          switch (ability.kind) {
            case 'attack':
              score =
                (target.maxHp - target.hp) * 2 +
                Math.max(0, tile.height - (getTile(this.map, target.x, target.y)?.height ?? 0)) * 8 +
                (target.hp <= actor.attack ? 40 : 0) -
                distance * 3;
              break;
            case 'heal': {
              const missingHp = target.maxHp - target.hp;

              if (missingHp <= 0) {
                continue;
              }

              score = missingHp * 2 + (target.hp <= Math.floor(target.maxHp * 0.4) ? 30 : 0) - distance * 2;
              break;
            }
            case 'steal':
              score = 55 - distance * 2 + ((target.dropQuantity ?? 1) - 1) * 6;
              break;
            default:
              break;
          }

          if (!bestPlan || score > bestPlan.score) {
            bestPlan = { moveTile: tile, ability, target, score };
          }
        }
      }
    }

    return bestPlan;
  }

  private chooseAutoBattleMoveTile(actor: BattleUnit): TileData | null {
    const reachable = getReachableNodes(this.map, actor, this.units, this.getBlockedPropPoints());
    const enemies = this.units.filter((unit) => unit.alive && unit.team !== actor.team);
    let bestApproach: { tile: TileData; score: number } | null = null;

    for (const node of reachable.values()) {
      const tile = getTile(this.map, node.x, node.y);

      if (!tile) {
        continue;
      }

      const nearestDistance = Math.min(...enemies.map((enemy) => manhattanDistance(node, enemy)));
      const score = nearestDistance * 20 - tile.height * 4;

      if (!bestApproach || score < bestApproach.score) {
        bestApproach = { tile, score };
      }
    }

    return bestApproach?.tile ?? null;
  }

  private async animateMovement(unit: BattleUnit, path: Point[]): Promise<void> {
    const view = this.views.get(unit.id);

    if (!view) {
      return;
    }

    const camera = this.getWorldCamera();

    try {
      for (const step of path) {
        const tile = getTile(this.map, step.x, step.y);

        if (!tile) {
          continue;
        }

        const destination = this.getUnitGroundPoint(tile);
        const startDepth = view.container.depth;
        const destinationDepth = this.getUnitDepth(tile);
        const cameraFocusPoint = this.getUnitCameraFocusPoint(unit, destination);
        const cameraPanPromise = this.panCameraToPoint(cameraFocusPoint.x, cameraFocusPoint.y, 240);
        audioDirector.playStep();

        const movementPromise = new Promise<void>((resolve) => {
          this.tweens.add({
            targets: view.container,
            x: destination.x,
            y: destination.y - 10,
            duration: 150,
            ease: 'Quad.easeOut',
            onUpdate: (_tween, target) => {
              const progress = Phaser.Math.Easing.Quadratic.Out(_tween.progress);
              target.setDepth(Phaser.Math.Linear(startDepth, destinationDepth, progress));
            },
            onComplete: () => {
              view.container.setDepth(destinationDepth);
              this.tweens.add({
                targets: view.container,
                y: destination.y,
                duration: 90,
                ease: 'Quad.easeIn',
                onUpdate: () => {
                  view.container.setDepth(destinationDepth);
                },
                onComplete: () => {
                  view.container.setDepth(destinationDepth);
                  resolve();
                }
              });
            }
          });
        });

        await Promise.all([movementPromise, cameraPanPromise]);
      }
    } finally {
      this.setBoardScroll(camera.scrollX, camera.scrollY);
    }
  }

  private async performAttack(
    attacker: BattleUnit,
    target: BattleUnit,
    queueNextTurn = true
  ): Promise<void> {
    await this.performAbility(attacker, target, this.getBasicAttackAbility(attacker), queueNextTurn);
  }

  private isAbilityInRange(attacker: BattleUnit, target: BattleUnit, ability: UnitAbility): boolean {
    const distance = manhattanDistance(attacker, target);
    return distance >= ability.rangeMin && distance <= ability.rangeMax;
  }

  private async performAbility(
    attacker: BattleUnit,
    target: BattleUnit,
    ability: UnitAbility,
    queueNextTurn = true
  ): Promise<void> {
    this.busy = true;
    this.phase = 'animating';
    this.turnActionUsed = true;
    this.selectedAbilityId = ability.id;
    this.drawHighlights();
    this.refreshUi();

    switch (ability.kind) {
      case 'attack': {
        this.pushLog(`${attacker.name} uses ${ability.name} on ${target.name}.`);
        await this.resolveStrike(attacker, target, ability);

        const counterAbility = this.getBasicAttackAbility(target);

        if (
          target.alive &&
          attacker.alive &&
          this.isAbilityInRange(target, attacker, counterAbility)
        ) {
          this.pushLog(`${target.name} returns fire with ${counterAbility.name}.`);
          await this.resolveStrike(target, attacker, counterAbility);
        }

        break;
      }
      case 'heal':
        this.pushLog(`${attacker.name} uses ${ability.name} on ${target.name}.`);
        await this.resolveHealing(attacker, target, ability);
        break;
      case 'steal':
        this.pushLog(`${attacker.name} uses ${ability.name} on ${target.name}.`);
        await this.resolveSteal(attacker, target, ability);
        break;
      default:
        break;
    }

    if (queueNextTurn) {
      await this.finishPlayerCommand(attacker, `${attacker.name} can still reposition.`);
    }
  }

  private async finishPlayerCommand(activeUnit: BattleUnit, pendingMoveMessage: string): Promise<void> {
    if (activeUnit.team !== 'player') {
      await this.endCurrentTurn();
      return;
    }

    if (!activeUnit.alive) {
      await this.endCurrentTurn();
      return;
    }

    if (this.turnMoveUsed && this.turnActionUsed) {
      await this.endCurrentTurn();
      return;
    }

    this.busy = false;
    this.selectedAbilityId = null;
    this.selectedItemId = null;

    if (!this.turnMoveUsed) {
      this.moveNodes = getReachableNodes(this.map, activeUnit, this.units, this.getBlockedPropPoints());
    }

    this.phase = 'player-menu';
    this.pushLog(pendingMoveMessage);
    this.drawHighlights();
    this.refreshUi();
    this.tryStartAutoBattle(activeUnit);
  }

  private async resolveStrike(
    attacker: BattleUnit,
    target: BattleUnit,
    ability: UnitAbility
  ): Promise<{ amount: number; critical: boolean }> {
    const attackerView = this.views.get(attacker.id);
    const targetView = this.views.get(target.id);

    if (!attackerView || !targetView || !attacker.alive || !target.alive) {
      return { amount: 0, critical: false };
    }

    const strikeAttacker: BattleUnit = {
      ...attacker,
      attack: attacker.attack + (ability.powerModifier ?? 0),
      rangeMin: ability.rangeMin,
      rangeMax: ability.rangeMax,
      attackStyle: ability.attackStyle ?? attacker.attackStyle,
      effectKey: ability.effectKey ?? attacker.effectKey,
      attackName: ability.name
    };

    const attackerPoint = this.getUnitWorldPoint(attacker);
    const targetPoint = this.getUnitWorldPoint(target);
    const angle = Phaser.Math.Angle.Between(
      attackerPoint.x,
      attackerPoint.y,
      targetPoint.x,
      targetPoint.y
    );
    const dashDistance = ability.rangeMax === 1 ? 18 : 8;
    const launchPoint = this.getUnitSpritePoint(attacker, 0.55);
    const impactPoint = this.getUnitSpritePoint(target, 0.54);
    const damageTextPoint = this.getUnitSpritePoint(target, 0.9);
    audioDirector.playAttack(strikeAttacker.attackStyle);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: attackerView.container,
        x: attackerPoint.x + Math.cos(angle) * dashDistance,
        y: attackerPoint.y + Math.sin(angle) * dashDistance,
        duration: 110,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve()
      });
    });

    await this.playCombatEffect(strikeAttacker.effectKey, attacker, target, {
      launchPoint,
      impactPoint,
      angle
    });

    const damageRoll = calculateDamage(strikeAttacker, target, this.map, this.rng.frac());
    target.hp = Math.max(0, target.hp - damageRoll.amount);
    audioDirector.playHit(damageRoll.critical);
    targetView.sprite.setTintFill(0xffead0);
    this.getWorldCamera().shake(strikeAttacker.attackStyle === 'grave-cleave' ? 95 : 70, 0.0016);

    await Promise.all([
      new Promise<void>((resolve) => {
        this.tweens.add({
          targets: targetView.sprite,
          alpha: 0.45,
          duration: 90,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            targetView.sprite.clearTint();
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        this.tweens.add({
          targets: targetView.container,
          x: targetView.container.x + Math.cos(angle) * 8,
          y: targetView.container.y + Math.sin(angle) * 5,
          duration: 80,
          ease: 'Sine.easeOut',
          yoyo: true,
          repeat: 1,
          onComplete: () => resolve()
        });
      })
    ]);

    const damageText = this.registerWorldObject(
      this.add.text(
        damageTextPoint.x,
        damageTextPoint.y,
        `${damageRoll.amount}`,
        damageRoll.critical ? UI_TEXT_DAMAGE_CRITICAL : UI_TEXT_DAMAGE
      )
    );
    damageText.setOrigin(0.5).setDepth(980);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: damageText,
        y: damageTextPoint.y - 46,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          damageText.destroy();
          resolve();
        }
      });
    });

    this.positionUnit(target);

    if (damageRoll.critical) {
      this.pushLog('Critical hit from the elevated angle.');
    }

    if (target.hp <= 0) {
      target.alive = false;
      this.pushLog(`${target.name} falls on the ridge.`);

      if (target.team === 'enemy' && target.dropItemId) {
        const quantity = target.dropQuantity ?? 1;
        this.addItemToUnit(attacker, target.dropItemId, quantity);
        this.pushLog(`${target.name} drops ${this.describeItemGain(target.dropItemId, quantity)} for ${attacker.name}.`);
      }

      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: targetView.container,
          alpha: 0,
          y: targetView.container.y + 24,
          duration: 420,
          ease: 'Quad.easeIn',
          onComplete: () => {
            targetView.container.setVisible(false);
            resolve();
          }
        });
      });
    }

    return damageRoll;
  }

  private async resolveHealing(attacker: BattleUnit, target: BattleUnit, ability: UnitAbility): Promise<void> {
    const targetView = this.views.get(target.id);

    if (!targetView || !attacker.alive || !target.alive) {
      return;
    }

    const amount = Math.min(ability.healAmount ?? 0, target.maxHp - target.hp);
    const effectPoint = this.getUnitSpritePoint(target, 0.72);
    audioDirector.playHeal();

    await this.playCombatEffect(ability.effectKey ?? attacker.effectKey, attacker, target);
    await this.flashUnitSprite(target, 0xb8ffd0);

    if (amount > 0) {
      target.hp += amount;
      this.positionUnit(target);
    }

    await this.showFloatingCombatText(effectPoint, amount > 0 ? `+${amount}` : 'MISS', UI_TEXT_DAMAGE, 42, 720);

    this.pushLog(amount > 0 ? `${target.name} recovers ${amount} HP.` : `${target.name} needs no healing.`);
  }

  private async resolveSteal(attacker: BattleUnit, target: BattleUnit, _ability: UnitAbility): Promise<void> {
    const attackerView = this.views.get(attacker.id);
    const targetView = this.views.get(target.id);

    if (!attackerView || !targetView || !attacker.alive || !target.alive) {
      return;
    }

    const attackerPoint = this.getUnitWorldPoint(attacker);
    const targetPoint = this.getUnitWorldPoint(target);
    const angle = Phaser.Math.Angle.Between(attackerPoint.x, attackerPoint.y, targetPoint.x, targetPoint.y);
    audioDirector.playSteal();

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: attackerView.container,
        x: attackerPoint.x + Math.cos(angle) * 14,
        y: attackerPoint.y + Math.sin(angle) * 10,
        duration: 120,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve()
      });
    });

    await this.playCombatEffect(_ability.effectKey ?? attacker.effectKey, attacker, target);

    if (target.dropItemId) {
      const quantity = target.dropQuantity ?? 1;
      this.addItemToUnit(attacker, target.dropItemId, quantity);
      this.pushLog(`${attacker.name} steals ${this.describeItemGain(target.dropItemId, quantity)} from ${target.name}.`);
      target.dropItemId = undefined;
      target.dropQuantity = undefined;
    } else {
      this.pushLog(`${attacker.name} finds nothing to steal from ${target.name}.`);
    }
  }

  private playTurnStartAnimation(unit: BattleUnit): void {
    const view = this.views.get(unit.id);

    if (!view || !unit.alive) {
      return;
    }

    const pulse = this.registerWorldObject(this.add
      .ellipse(view.container.x, view.container.y - 12, 62, 26, 0xf4d98c, 0.42)
      .setDepth(view.container.depth - 1));

    this.tweens.add({
      targets: pulse,
      scaleX: 1.85,
      scaleY: 1.85,
      alpha: 0,
      duration: 460,
      ease: 'Quad.easeOut',
      onComplete: () => pulse.destroy()
    });

    this.tweens.add({
      targets: view.sprite,
      scaleX: view.spriteBaseScale * 1.08,
      scaleY: view.spriteBaseScale * 1.08,
      duration: 180,
      ease: 'Back.easeOut',
      yoyo: true
    });
  }

  private async playCombatEffect(
    effectId: CombatEffectId,
    source: BattleUnit,
    target: BattleUnit,
    overrides?: {
      launchPoint?: Phaser.Math.Vector2;
      impactPoint?: Phaser.Math.Vector2;
      angle?: number;
    }
  ): Promise<void> {
    const effect = getCombatEffectDefinition(effectId);
    const launchPoint =
      overrides?.launchPoint ??
      this.getUnitSpritePoint(source, effect.launchAnchor ?? effect.impactAnchor ?? 0.55);
    const impactBase =
      overrides?.impactPoint ??
      this.getUnitSpritePoint(target, effect.impactAnchor ?? effect.launchAnchor ?? 0.56);
    const impactPoint = new Phaser.Math.Vector2(
      impactBase.x,
      impactBase.y + (effect.impactOffsetY ?? 0)
    );
    const sourcePoint = new Phaser.Math.Vector2(
      launchPoint.x,
      launchPoint.y + (effect.sourceOffsetY ?? 0)
    );
    const angle =
      overrides?.angle ??
      Phaser.Math.Angle.Between(sourcePoint.x, sourcePoint.y, impactPoint.x, impactPoint.y);

    switch (effect.motion) {
      case 'projectile':
        await this.animateProjectileSprite(
          effect.assetKey,
          sourcePoint,
          impactPoint,
          angle,
          effect.startScale,
          effect.peakScale,
          effect.duration,
          effect.spin ?? 0,
          effect.additive ?? false
        );
        if (effect.burstTint !== undefined) {
          this.emitSupportBurst(impactPoint.x, impactPoint.y, effect.burstTint);
        }
        break;
      case 'impact-arc':
      case 'impact-burst':
      case 'ground-sigil':
      case 'support-bloom':
        await this.animateImpactSprite(
          effect.assetKey,
          impactPoint,
          angle + (effect.rotationOffset ?? 0),
          effect.startScale,
          effect.peakScale,
          effect.duration,
          effect.additive ?? false,
          effect.endScaleMultiplier ?? 1.15,
          effect.burstTint
        );
        break;
      case 'transfer': {
        const transferFrom = effect.travelFromTarget ? impactPoint : sourcePoint;
        const transferTo = effect.travelFromTarget ? sourcePoint : impactPoint;
        await this.animateTransferEffect(effect, transferFrom, transferTo);
        break;
      }
      case 'ct-surge':
        await this.animateCtSurgeEffect(effect, impactPoint);
        break;
      default:
        break;
    }
  }

  private async animateProjectileSprite(
    key: string | null,
    launchPoint: Phaser.Math.Vector2,
    impactPoint: Phaser.Math.Vector2,
    angle: number,
    startScale: number,
    endScale: number,
    duration: number,
    spin = 0,
    additive = false
  ): Promise<void> {
    if (!key) {
      return;
    }

    const projectile = this.registerWorldObject(this.add
      .image(launchPoint.x, launchPoint.y, key)
      .setDepth(962)
      .setScale(startScale)
      .setRotation(angle)
      .setAlpha(0.96));

    if (additive) {
      projectile.setBlendMode(Phaser.BlendModes.ADD);
    }

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: projectile,
        x: impactPoint.x,
        y: impactPoint.y,
        scaleX: endScale,
        scaleY: endScale,
        rotation: angle + spin,
        duration,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          projectile.destroy();
          resolve();
        }
      });
    });
  }

  private async animateImpactSprite(
    key: string | null,
    impactPoint: Phaser.Math.Vector2,
    rotation: number,
    startScale: number,
    peakScale: number,
    duration: number,
    additive: boolean,
    endScaleMultiplier = 1.15,
    burstTint?: number
  ): Promise<void> {
    if (!key) {
      if (burstTint !== undefined) {
        this.emitSupportBurst(impactPoint.x, impactPoint.y, burstTint);
      }
      await this.wait(duration * 0.85);
      return;
    }

    const effect = this.registerWorldObject(this.add
      .image(impactPoint.x, impactPoint.y, key)
      .setDepth(962)
      .setScale(startScale)
      .setRotation(rotation)
      .setAlpha(0));

    if (additive) {
      effect.setBlendMode(Phaser.BlendModes.ADD);
    }

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: effect,
        alpha: 0.95,
        scaleX: peakScale,
        scaleY: peakScale,
        duration: duration * 0.45,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: effect,
            alpha: 0,
            scaleX: peakScale * endScaleMultiplier,
            scaleY: peakScale * endScaleMultiplier,
            rotation: rotation + 0.25,
            duration: duration * 0.55,
            ease: 'Quad.easeOut',
            onComplete: () => {
              if (burstTint !== undefined) {
                this.emitSupportBurst(impactPoint.x, impactPoint.y, burstTint);
              }
              effect.destroy();
              resolve();
            }
          });
        }
      });
    });
  }

  private async animateTransferEffect(
    effect: CombatEffectDefinition,
    launchPoint: Phaser.Math.Vector2,
    impactPoint: Phaser.Math.Vector2
  ): Promise<void> {
    const angle = Phaser.Math.Angle.Between(launchPoint.x, launchPoint.y, impactPoint.x, impactPoint.y);

    if (effect.assetKey) {
      await this.animateProjectileSprite(
        effect.assetKey,
        launchPoint,
        impactPoint,
        angle,
        effect.startScale,
        effect.peakScale,
        effect.duration,
        effect.spin ?? 0,
        effect.additive ?? false
      );
    } else {
      this.emitSupportBurst(launchPoint.x, launchPoint.y, effect.burstTint ?? 0xf0d27d);
      await this.wait(effect.duration * 0.45);
      this.emitSupportBurst(impactPoint.x, impactPoint.y, effect.burstTint ?? 0xf0d27d);
      await this.wait(effect.duration * 0.3);
    }
  }

  private async animateCtSurgeEffect(
    effect: CombatEffectDefinition,
    impactPoint: Phaser.Math.Vector2
  ): Promise<void> {
    if (effect.assetKey) {
      await this.animateImpactSprite(
        effect.assetKey,
        impactPoint,
        effect.rotationOffset ?? 0,
        effect.startScale,
        effect.peakScale,
        effect.duration,
        effect.additive ?? false,
        effect.endScaleMultiplier ?? 1.2,
        effect.burstTint
      );
      return;
    }

    this.emitSupportBurst(impactPoint.x - 10, impactPoint.y + 6, 0x6bd7c8);
    await this.wait(effect.duration * 0.18);
    this.emitSupportBurst(impactPoint.x + 12, impactPoint.y - 10, effect.burstTint ?? 0xdcbf70);
    await this.wait(effect.duration * 0.5);
  }

  private emitSupportBurst(x: number, y: number, tint: number): void {
    const particles = this.registerWorldObject(this.add.particles(x, y, 'spark', {
      speed: { min: 18, max: 110 },
      lifespan: 460,
      quantity: 16,
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: [tint, 0xf8f0c8, 0xffffff],
      blendMode: 'ADD',
      emitting: false
    }));

    particles.setDepth(961);
    particles.explode(16, x, y);
    this.time.delayedCall(500, () => particles.destroy());
  }

  private async flashUnitSprite(target: BattleUnit, tint: number): Promise<void> {
    const targetView = this.views.get(target.id);

    if (!targetView) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: targetView.sprite,
        tint,
        duration: 150,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          targetView.sprite.clearTint();
          resolve();
        }
      });
    });
  }

  private async showFloatingCombatText(
    point: Phaser.Math.Vector2,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    riseAmount: number,
    duration: number
  ): Promise<void> {
    const floatingText = this.registerWorldObject(this.add.text(point.x, point.y, text, style));
    floatingText.setOrigin(0.5).setDepth(980);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: floatingText,
        y: point.y - riseAmount,
        alpha: 0,
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          floatingText.destroy();
          resolve();
        }
      });
    });
  }

  private wait(duration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.time.delayedCall(duration, () => resolve());
    });
  }

  private async endCurrentTurn(): Promise<void> {
    this.busy = false;
    this.phase = 'animating';
    this.activeUnitId = null;
    this.selectedAbilityId = null;
    this.selectedItemId = null;
    this.setInspectionTarget({ kind: 'mission' }, false);
    this.moveNodes.clear();
    this.turnMoveUsed = false;
    this.turnActionUsed = false;
    this.drawHighlights();
    this.refreshUi();

    this.time.delayedCall(520, () => {
      void this.beginNextTurn();
    });
  }

  private endBattle(result: 'Victory' | 'Defeat'): void {
    this.phase = 'complete';
    this.busy = true;
    this.activeUnitId = null;
    this.setInspectionTarget({ kind: 'mission' }, false);
    this.moveNodes.clear();
    this.clearTurnStartCatchPhrase();
    if (result === 'Victory') {
      audioDirector.playVictory();
    } else {
      audioDirector.playDefeat();
    }
    this.drawHighlights();
    this.refreshUi();

    this.resultOverlayShade = this.registerUiObject(this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, UI_COLOR_OVERLAY, 0.62)
      .setDepth(1000)
      .setScrollFactor(0));
    this.resultOverlayTitle = this.registerUiObject(this.add
      .text(0, 0, result.toUpperCase(), UI_TEXT_DISPLAY_CENTER)
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0));
    this.resultOverlayBody = this.registerUiObject(this.add
      .text(
        0,
        0,
        result === 'Victory'
          ? 'The chapel ridge is yours.\nTap or click to battle again.'
          : `The altar falls to ${this.getFactionDisplayNameForTeam('enemy')}.\nTap or click to try again.`,
        UI_TEXT_BODY_CENTER
      )
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0));
    this.layoutResultOverlay();
  }

  private refreshUi(): void {
    const hudVisible = this.battleIntroPhase === 'hud';
    const timeOfDayLabel = TIME_OF_DAY_CONFIG[this.timeOfDay].label;
    this.mapPlaqueEyebrowText.setText(this.getMapPlaqueEyebrow());
    this.mapPlaqueTitleText.setText(this.getMapPlaqueHeaderTitle());
    this.mapPlaqueMetaText.setText(this.level.name);
    this.mapObjectiveTagText.setText('OBJECTIVE').setVisible(false);
    this.mapObjectiveText.setText(this.level.shortObjective ?? this.level.objective).setVisible(false);
    this.mapIntroEyebrowText.setText(this.getMapIntroEyebrow());
    this.mapIntroTitleText.setText(this.level.name);
    this.mapIntroMetaText.setText(this.getMapIntroMeta(timeOfDayLabel));
    this.mapIntroFlavorText.setText(this.getMapIntroSummary());
    this.headerMenuTitleText.setText('PAUSED');
    this.autoBattleToggleText.setText('MENU');
    this.headerMenuOptionTexts[0]?.setText(`AUTO ${this.autoBattleEnabled ? 'ON' : 'OFF'}`);
    this.headerMenuOptionTexts[1]?.setText(`AUDIO ${audioDirector.isMuted() ? 'OFF' : 'ON'}`);
    this.headerMenuOptionTexts[2]?.setText('RESTART');

    const activeUnit = this.getActiveUnit();
    const queue = activeUnit
      ? [activeUnit, ...projectTurnOrder(this.units, this.visibleTurnOrderCount - 1)]
      : projectTurnOrder(this.units, this.visibleTurnOrderCount);
    this.turnOrderPanel.setQueue(queue, this.activeUnitId, this.visibleTurnOrderCount, true);
    this.turnOrderPanel.setVisible(hudVisible && this.showTimelinePanel);

    this.hudViewModel = this.buildHudViewModel();
    const focusUnit = this.getDetailFocusUnit();
    const inspectionTarget = this.getResolvedInspectionTarget();
    const inspectionTile = this.getInspectionTile();
    if (inspectionTarget.kind !== 'mission') {
      let portraitTextureKey: string | null = null;
      let portraitKind: DetailPortraitKind = 'terrain';

      if (focusUnit) {
        portraitTextureKey = focusUnit.spriteKey;
        portraitKind = 'unit';
      } else if (inspectionTile) {
        const chest = this.getChestAt(inspectionTile.x, inspectionTile.y);
        const prop = this.getPropAt(inspectionTile.x, inspectionTile.y);
        if (chest) {
          portraitTextureKey = chest.opened ? 'chapel-chest-open' : 'chapel-chest-closed';
          portraitKind = 'chest';
        } else if (prop) {
          portraitTextureKey = prop.assetId;
          portraitKind = 'prop';
        } else {
          portraitTextureKey = TERRAIN_TILE_ASSETS[inspectionTile.terrain][0];
          portraitKind = 'terrain';
        }
      }

      if (portraitTextureKey) {
        this.showDetailPortrait(portraitTextureKey, portraitKind);
      } else {
        this.portrait.setVisible(false);
      }
      this.activeBadge.setText(this.hudViewModel.badgeText);
      this.detailMetaText.setText(this.hudViewModel.metaText);
      this.detailTitleText.setText(this.hudViewModel.titleText);
      this.detailBodyText.setText(this.hudViewModel.bodyText);
      this.setDetailStatValues(this.hudViewModel.statValues);
    } else {
      this.portrait.setVisible(false);
      this.activeBadge.setText('');
      this.detailMetaText.setText('');
      this.detailTitleText.setText('');
      this.detailBodyText.setText('');
      this.setDetailStatValues([]);
    }
    this.updateDetailPanelForSelection(inspectionTarget);
    this.syncDynamicDetailPanelHeight();

    this.layoutMapTitleSection(this.scale.width, this.scale.height);
    this.layoutDetailPanelSection();
    this.logText.setText(this.logLines.slice(0, this.visibleLogLines).join('\n')).setVisible(false);
    this.actionMenuStack.setPanels(this.buildActionMenuPanels());
    this.actionMenuStack.setVisible(hudVisible && this.shouldShowActionMenu());
    this.drawUiPanels();
    this.actionMenuStack.draw();
  }

  private drawUiPanels(): void {
    this.uiGraphics.clear();

    this.drawMapTitlePlaque();
    this.drawMapTitleIntro();
    const focusUnit = this.getDetailFocusUnit();
    this.drawDetailPlaque(focusUnit);

    if (!this.isBattleIntroActive() && this.showDetailPanel && this.showPortraitPanel && this.detailPanelAlpha > 0.01) {
      BattleUiChrome.drawPanelShell(
        this.uiGraphics,
        this.uiPanels.portrait,
        this.detailPanelAlpha * 0.86,
        UI_PLAQUE_HEADER_HEIGHT,
        14,
        UI_COLOR_ACCENT_NEUTRAL
      );
      this.uiGraphics.fillStyle(UI_COLOR_PANEL_BORDER, 0.08 * this.detailPanelAlpha);
      this.uiGraphics.fillRoundedRect(
        this.uiPanels.portrait.x + 10,
        this.uiPanels.portrait.y + 10,
        this.uiPanels.portrait.width - 20,
        10,
        4
      );
    }
  }

  private drawMapTitlePlaque(): void {
    if (this.battleIntroPhase !== 'hud' || this.mapPlaqueAlpha <= 0.01) {
      return;
    }

    const panel = new Phaser.Geom.Rectangle(
      this.headerRect.x + this.mapPlaqueOffsetX,
      this.headerRect.y,
      this.headerRect.width,
      this.headerRect.height
    );
    BattleUiChrome.drawPlaqueShell(this.uiGraphics, panel, {
      accentColor: UI_COLOR_ACCENT_WARM,
      alpha: this.mapPlaqueAlpha,
      headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
      radius: 24,
      headerAlpha: 0.74,
      sideRuleAlpha: 0.14,
      dividerAlpha: 0.22
    });

    if (this.headerMenuButtonBounds.width > 0) {
      BattleUiChrome.drawPill(this.uiGraphics, this.headerMenuButtonBounds, {
        fillColor: this.headerMenuOpen ? UI_COLOR_ACCENT_WARM : UI_COLOR_PANEL_SURFACE_ALT,
        strokeColor: UI_COLOR_PANEL_BORDER,
        fillAlpha: 0.92 * this.mapPlaqueAlpha,
        strokeAlpha: 0.38 * this.mapPlaqueAlpha,
        radius: 14
      });
    }

    if (this.headerMenuOpen) {
      this.uiGraphics.fillStyle(UI_COLOR_OVERLAY, 0.56);
      this.uiGraphics.fillRect(0, 0, this.scale.width, this.scale.height);

      BattleUiChrome.drawPlaqueShell(this.uiGraphics, this.headerMenuPanelBounds, {
        accentColor: UI_COLOR_ACCENT_WARM,
        alpha: 1,
        headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
        radius: 18,
        headerAlpha: 0.56,
        sideRuleAlpha: 0.12,
        dividerAlpha: 0.14
      });

      for (const bounds of this.headerMenuOptionBounds) {
        if (bounds.width <= 0) {
          continue;
        }

        BattleUiChrome.drawInsetBox(this.uiGraphics, bounds, {
          fillColor: UI_COLOR_PANEL_SURFACE_ALT,
          fillAlpha: 0.88,
          strokeAlpha: 0.18,
          radius: 10
        });
      }
    }
  }

  private drawMapTitleIntro(): void {
    if (this.mapIntroAlpha <= 0.01) {
      return;
    }

    const panel = new Phaser.Geom.Rectangle(
      this.mapIntroBounds.x,
      this.mapIntroBounds.y + this.mapIntroOffsetY,
      this.mapIntroBounds.width,
      this.mapIntroBounds.height
    );
    const alpha = this.mapIntroAlpha;

    BattleUiChrome.drawPlaqueShell(this.uiGraphics, panel, {
      accentColor: UI_COLOR_ACCENT_WARM,
      alpha,
      headerHeight: UI_PLAQUE_HEADER_HEIGHT,
      radius: 28,
      headerAlpha: 0.68,
      sideRuleAlpha: 0.12,
      dividerAlpha: 0.2,
      shineAlpha: 0.08
    });
  }

  private drawDetailPlaque(focusUnit: BattleUnit | null): void {
    if (this.isBattleIntroActive() || !this.showDetailPanel || this.detailPanelAlpha <= 0.01) {
      return;
    }

    const alpha = this.detailPanelAlpha;
    const panel = new Phaser.Geom.Rectangle(
      this.uiPanels.topRight.x + this.detailPanelOffsetX,
      this.uiPanels.topRight.y,
      this.uiPanels.topRight.width,
      this.uiPanels.topRight.height
    );

    const accentColor = focusUnit
      ? focusUnit.team === 'player'
        ? UI_COLOR_ACCENT_COOL
        : UI_COLOR_ACCENT_DANGER
      : this.getInspectionTile()
        ? UI_COLOR_ACCENT_WARM
        : UI_COLOR_ACCENT_NEUTRAL;

    BattleUiChrome.drawPlaqueShell(this.uiGraphics, panel, {
      accentColor,
      alpha,
      headerHeight: UI_NARROW_PLAQUE_HEADER_HEIGHT,
      radius: 24,
      headerAlpha: 0.62,
      sideRuleAlpha: 0.18,
      dividerAlpha: 0.32
    });

    if (this.detailBodyBoxBounds.width > 0 && this.detailBodyBoxBounds.height > 0) {
      BattleUiChrome.drawInsetBox(this.uiGraphics, this.detailBodyBoxBounds, {
        fillAlpha: 0.92 * alpha,
        strokeAlpha: 0.28 * alpha,
        radius: UI_INSET_RADIUS
      });
    }

    for (const [index, text] of this.detailStatTexts.entries()) {
      const chipBounds = this.detailStatChipBounds[index];
      if (!text.text || chipBounds.width <= 0 || chipBounds.height <= 0) {
        continue;
      }

      BattleUiChrome.drawInsetBox(this.uiGraphics, chipBounds, {
        fillAlpha: 0.86 * alpha,
        strokeAlpha: 0.2 * alpha,
        radius: 10
      });
    }

    if (focusUnit && this.detailHealthBarBounds.width > 0) {
      const barFill = focusUnit.team === 'player' ? UI_COLOR_SUCCESS : UI_COLOR_DANGER;
      BattleUiChrome.drawInsetBox(this.uiGraphics, this.detailHealthBarBounds, {
        fillColor: UI_COLOR_PANEL_SHADOW,
        fillAlpha: 0.92 * alpha,
        strokeAlpha: 0.2 * alpha,
        radius: 6
      });
      this.uiGraphics.fillStyle(barFill, 0.95 * alpha);
      this.uiGraphics.fillRoundedRect(
        this.detailHealthBarBounds.x + 2,
        this.detailHealthBarBounds.y + 2,
        Math.max(6, (this.detailHealthBarBounds.width - 4) * (focusUnit.hp / focusUnit.maxHp)),
        this.detailHealthBarBounds.height - 4,
        4
      );
    }
  }

  private setDetailStatValues(values: string[]): void {
    for (const [index, text] of this.detailStatTexts.entries()) {
      const value = values[index] ?? '';
      text.setText(value).setVisible(value.length > 0);
    }
  }

  private formatTerrainName(terrain: TerrainType): string {
    switch (terrain) {
      case 'grass':
        return 'Grass';
      case 'moss':
        return 'Moss';
      case 'stone':
        return 'Stone';
      case 'sanctum':
        return 'Sanctum';
      default:
        return terrain;
    }
  }

  private getPropTitle(assetId: MapPropAssetId): string {
    switch (assetId) {
      case 'obstacle-rubble-barricade':
        return 'Stone Monolith';
      case 'light-torch':
        return 'Torch Stand';
      case 'sanctum-brazier':
        return 'Sanctum Brazier';
      default:
        return 'Map Prop';
    }
  }

  private getCurrentMenuAction(): MenuAction | null {
    switch (this.phase) {
      case 'player-abilities':
      case 'player-action':
        return 'abilities';
      case 'player-items':
      case 'player-item-action':
        return 'items';
      case 'player-move':
        return 'move';
      default:
        return null;
    }
  }

  private getMenuTitle(): string {
    const active = this.getActiveUnit();
    return active ? active.name : 'Command';
  }

  private buildHudViewModel(): BattleHudViewModel {
    const inspectionTarget = this.getResolvedInspectionTarget();
    const activeUnit = this.getActiveUnit();
    const inspectionUnit = this.getInspectionUnit();
    const inspectionTile = this.getInspectionTile();
    const commandFocusUnit =
      inspectionUnit && activeUnit && inspectionUnit.id === activeUnit.id && activeUnit.team === 'player' && this.isPlayerTurnPhase()
        ? activeUnit
        : null;

    if (inspectionUnit) {
      return {
        badgeText: inspectionUnit.team === 'player' ? 'ALLY UNIT' : 'FOE UNIT',
        metaText: `${getFactionProfile(inspectionUnit.factionId).displayName}  •  ${inspectionUnit.className}`,
        titleText: inspectionUnit.name,
        bodyText: this.getInspectionUnitBodyText(inspectionUnit, commandFocusUnit?.id === inspectionUnit.id),
        statValues: [
          `HP ${inspectionUnit.hp}/${inspectionUnit.maxHp}`,
          `MOVE ${inspectionUnit.move}`,
          `SPD ${inspectionUnit.speed}`,
          `RNG ${inspectionUnit.rangeMin}-${inspectionUnit.rangeMax}`
        ],
        healthRatio: inspectionUnit.hp / inspectionUnit.maxHp,
        healthColor: inspectionUnit.team === 'player' ? UI_COLOR_SUCCESS : UI_COLOR_DANGER,
        actionEntries: []
      };
    }

    if (inspectionTile) {
      const chest = this.getChestAt(inspectionTile.x, inspectionTile.y);
      const prop = this.getPropAt(inspectionTile.x, inspectionTile.y);
      const terrainName = this.formatTerrainName(inspectionTile.terrain);
      return {
        badgeText: chest ? 'CHEST CACHE' : prop ? 'FIELD PROP' : 'TERRAIN TILE',
        metaText: `${terrainName}  •  ${inspectionTile.x}, ${inspectionTile.y}`,
        titleText: chest
          ? 'Supply Chest'
          : prop
            ? this.getPropTitle(prop.assetId)
            : `${terrainName} Ground`,
        bodyText: [
          `Height ${inspectionTile.height}  •  ${terrainName}`,
          chest
            ? `Contains ${this.describeItemGain(chest.itemId, chest.quantity)}.`
            : prop
              ? this.describeProp(prop.assetId)
              : this.describeTerrain(inspectionTile.terrain)
        ].join('\n'),
        statValues: [
          `HEIGHT ${inspectionTile.height}`,
          terrainName.toUpperCase(),
          chest ? 'LOOT READY' : prop ? 'OCCUPIED' : '',
          prop && PROP_RENDER_CONFIG[prop.assetId].blocksMovement ? 'BLOCKS MOVE' : ''
        ],
        healthRatio: null,
        healthColor: UI_COLOR_SUCCESS,
        actionEntries: []
      };
    }

    const livingPlayers = this.units.filter((unit) => unit.team === 'player' && unit.alive).length;
    const livingEnemies = this.units.filter((unit) => unit.team === 'enemy' && unit.alive).length;
    return {
      badgeText: 'BATTLE STATUS',
      metaText: `${TIME_OF_DAY_CONFIG[this.timeOfDay].label}  •  ${this.level.encounterType ?? 'Engagement'}`,
      titleText: this.level.name,
      bodyText: `${this.level.shortObjective ?? this.level.objective}\nInspect a unit or tile for details.`,
      statValues: [
        `ALLIES ${livingPlayers}`,
        `FOES ${livingEnemies}`,
        `CHESTS ${this.chests.filter((chest) => !chest.opened).length}`,
        `SCENE ${TIME_OF_DAY_CONFIG[this.timeOfDay].label.toUpperCase()}`
      ],
      healthRatio: null,
      healthColor: UI_COLOR_SUCCESS,
      actionEntries: []
    };
  }

  private buildDockActionEntries(): DockActionEntry[] {
    switch (this.phase) {
      case 'player-abilities':
      case 'player-action':
        return [
          { id: 'back', label: 'Back', enabled: true, active: false },
          ...this.getSubmenuEntries().map((entry) => ({
            id: entry.abilityId ?? '',
            label: entry.label,
            enabled: entry.enabled,
            active: entry.abilityId === this.selectedAbilityId
          }))
        ];
      case 'player-items':
      case 'player-item-action':
        return [
          { id: 'back', label: 'Back', enabled: true, active: false },
          ...this.getSubmenuEntries().map((entry) => ({
            id: entry.itemId ?? '',
            label: entry.label,
            enabled: entry.enabled,
            active: entry.itemId === this.selectedItemId
          }))
        ];
      case 'player-menu':
      case 'player-move':
        return this.getMenuEntries().map((entry) => ({
          id: entry.action,
          label: entry.label,
          enabled: entry.enabled,
          active: this.getCurrentMenuAction() === entry.action
        }));
      default:
        return [];
    }
  }

  private getInspectionUnitBodyText(unit: BattleUnit, isCommandFocus: boolean): string {
    if (!isCommandFocus) {
      return [unit.attackName, unit.attackText].join('\n');
    }

    if (this.phase === 'player-move') {
      return [
        `Stride up to ${unit.move} tiles across open ground.`,
        this.turnMoveUsed ? 'Movement is already spent this turn.' : 'Select a reachable tile on the field.'
      ].join('\n');
    }

    if (this.phase === 'player-items' || this.phase === 'player-item-action') {
      if (this.selectedItemId) {
        const item = getItemDefinition(this.selectedItemId);
        const count = this.getUnitInventory(unit)[this.selectedItemId] ?? 0;
        return [
          item.description,
          `Range 1  •  Stock ${count}`,
          this.phase === 'player-item-action' ? 'Select an adjacent target.' : 'Choose an item below.'
        ].join('\n');
      }

      return 'Choose an item below.';
    }

    if (this.phase === 'player-abilities' || this.phase === 'player-action') {
      const selectedAbility = this.getSelectedAbility();
      if (selectedAbility) {
        return [
          selectedAbility.description,
          `Range ${selectedAbility.rangeMin}-${selectedAbility.rangeMax}  •  ${selectedAbility.target === 'ally' ? 'Allies' : 'Enemies'}`,
          this.phase === 'player-action' ? 'Select a valid target.' : 'Choose an ability below.'
        ].join('\n');
      }

      return 'Choose an ability below.';
    }

    return [unit.attackName, unit.attackText].join('\n');
  }

  private getFactionDisplayNameForTeam(team: BattleUnit['team']): string {
    const unit = this.units.find((candidate) => candidate.team === team);
    return unit ? getFactionProfile(unit.factionId).displayName : team === 'player' ? 'Allied Forces' : 'Hostile Forces';
  }

  private queueTurnStartCatchPhrase(unit: BattleUnit): void {
    this.clearTurnStartCatchPhrase();
    this.turnStartCatchPhraseEvent = this.time.delayedCall(120, () => {
      this.turnStartCatchPhraseEvent = null;
      this.showTurnStartCatchPhrase(unit);
    });
  }

  private showTurnStartCatchPhrase(unit: BattleUnit): void {
    const view = this.views.get(unit.id);

    if (!view || !unit.alive || this.phase === 'complete') {
      return;
    }

    this.clearTurnStartCatchPhrase();

    const barkPoint = this.getUnitSpritePoint(unit, 1.06);
    const barkText = this.registerWorldObject(
      this.add.text(barkPoint.x, barkPoint.y, unit.turnStartCatchPhrase, UI_TEXT_WORLD_BARK)
    );

    barkText
      .setOrigin(0.5)
      .setDepth(984)
      .setAlpha(0);

    this.turnStartCatchPhraseText = barkText;

    this.tweens.add({
      targets: barkText,
      y: barkPoint.y - 18,
      alpha: 1,
      duration: 120,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: 460,
      onComplete: () => {
        if (this.turnStartCatchPhraseText === barkText) {
          this.turnStartCatchPhraseText = null;
        }
        barkText.destroy();
      }
    });
  }

  private getFactionIdForTeam(team: BattleUnit['team']): FactionId | null {
    return this.units.find((candidate) => candidate.team === team)?.factionId ?? null;
  }

  private syncSceneAudioMute(): void {
    this.sound.mute = audioDirector.isMuted();
  }

  private playFactionMottoForTeam(team: BattleUnit['team']): void {
    const factionId = this.getFactionIdForTeam(team);

    if (!factionId) {
      return;
    }

    this.playFactionMotto(factionId);
  }

  private playFactionMotto(factionId: FactionId): void {
    if (this.factionMottoPlayed.has(factionId) || audioDirector.isMuted()) {
      return;
    }

    if (this.sound.locked) {
      if (this.pendingFactionMottoId) {
        return;
      }

      this.pendingFactionMottoId = factionId;
      this.sound.once('unlocked', () => {
        const pendingFactionId = this.pendingFactionMottoId;
        this.pendingFactionMottoId = null;

        if (pendingFactionId) {
          this.playFactionMotto(pendingFactionId);
        }
      });
      return;
    }

    this.stopFactionMottoSound();

    const sound = this.sound.add(FACTION_MOTTO_AUDIO_KEYS[factionId], { volume: 0.92 });
    const played = sound.play();

    if (!played) {
      sound.destroy();
      return;
    }

    this.factionMottoSound = sound;
    this.factionMottoPlayed.add(factionId);

    const profile = getFactionProfile(factionId);
    this.pushLog(`${profile.displayName}: "${profile.motto}"`);

    sound.once('complete', () => {
      if (this.factionMottoSound === sound) {
        this.factionMottoSound = null;
      }
      sound.destroy();
    });
  }

  private stopFactionMottoSound(): void {
    if (!this.factionMottoSound) {
      return;
    }

    this.factionMottoSound.stop();
    this.factionMottoSound.destroy();
    this.factionMottoSound = null;
  }

  private clearTurnStartCatchPhrase(): void {
    this.turnStartCatchPhraseEvent?.remove(false);
    this.turnStartCatchPhraseEvent = null;

    if (!this.turnStartCatchPhraseText) {
      return;
    }

    this.tweens.killTweensOf(this.turnStartCatchPhraseText);
    this.turnStartCatchPhraseText.destroy();
    this.turnStartCatchPhraseText = null;
  }

  private getInspectionUnit(): BattleUnit | null {
    const target = this.getResolvedInspectionTarget();
    if (target.kind !== 'unit') {
      return null;
    }

    return this.units.find((unit) => unit.alive && unit.id === target.unitId) ?? null;
  }

  private getInspectionTile(): TileData | null {
    const target = this.getResolvedInspectionTarget();
    if (target.kind !== 'tile') {
      return null;
    }

    return getTile(this.map, target.x, target.y);
  }

  private getResolvedInspectionTarget(): InspectionTarget {
    const inspectionTarget = this.inspectionTarget;

    if (inspectionTarget.kind === 'unit') {
      const unit = this.units.find((candidate) => candidate.alive && candidate.id === inspectionTarget.unitId);
      if (unit) {
        return inspectionTarget;
      }
    }

    if (inspectionTarget.kind === 'tile') {
      if (getTile(this.map, inspectionTarget.x, inspectionTarget.y)) {
        return inspectionTarget;
      }
    }

    return { kind: 'mission' };
  }

  private setInspectionTarget(target: InspectionTarget, refresh = true, toggleIfSame = false): InspectionTarget {
    const current = this.getResolvedInspectionTarget();
    const unchanged =
      current.kind === target.kind &&
      (current.kind === 'mission' ||
        (current.kind === 'unit' && target.kind === 'unit' && current.unitId === target.unitId) ||
        (current.kind === 'tile' && target.kind === 'tile' && current.x === target.x && current.y === target.y));

    if (toggleIfSame && unchanged && target.kind !== 'mission') {
      this.inspectionTarget = { kind: 'mission' };
      this.syncInspectionHover();
      if (refresh) {
        this.refreshUi();
      }
      return this.getResolvedInspectionTarget();
    }

    this.inspectionTarget = target;
    this.syncInspectionHover();
    if (refresh && !unchanged) {
      this.refreshUi();
    }
    return this.getResolvedInspectionTarget();
  }

  private syncInspectionHover(): void {
    const target = this.getResolvedInspectionTarget();
    if (target.kind === 'unit') {
      const unit = this.units.find((candidate) => candidate.alive && candidate.id === target.unitId);
      this.hoverTile = unit ? getTile(this.map, unit.x, unit.y) : this.hoverTile;
      return;
    }

    if (target.kind === 'tile') {
      this.hoverTile = getTile(this.map, target.x, target.y);
      return;
    }

    this.hoverTile = null;
  }

  private getInspectionHighlightTile(): TileData | null {
    if (this.hoverTile) {
      return this.hoverTile;
    }

    const target = this.getResolvedInspectionTarget();
    if (target.kind === 'tile') {
      return getTile(this.map, target.x, target.y);
    }

    if (target.kind === 'unit') {
      const unit = this.units.find((candidate) => candidate.alive && candidate.id === target.unitId);
      return unit ? getTile(this.map, unit.x, unit.y) : null;
    }

    return null;
  }

  private inspectTile(tile: TileData): void {
    const unit = this.units.find((candidate) => candidate.alive && candidate.x === tile.x && candidate.y === tile.y);
    if (unit) {
      this.setInspectionTarget({ kind: 'unit', unitId: unit.id }, false, true);
      this.drawHighlights();
      this.refreshUi();
      return;
    } else {
      this.setInspectionTarget({ kind: 'tile', x: tile.x, y: tile.y }, false, true);
    }

    this.drawHighlights();
    this.refreshUi();
  }

  private getHoveredUnit(): BattleUnit | null {
    return this.getInspectionUnit();
  }

  private getDetailFocusUnit(): BattleUnit | null {
    return this.getInspectionUnit();
  }

  private updateDetailPanelForSelection(target: InspectionTarget): void {
    if (target.kind === 'mission') {
      this.detailPanelTween?.remove();
      this.detailPanelTween = undefined;
      this.showDetailPanel = false;
      this.detailPanelAlpha = 0;
      this.detailPanelOffsetX = 24;
      this.detailPanelSelectionKey = null;
      return;
    }

    this.showDetailPanel = true;
    const nextSelectionKey = this.getDetailPanelSelectionKey(target);
    const shouldAnimate = this.detailPanelSelectionKey !== nextSelectionKey || this.detailPanelAlpha <= 0.01;
    this.detailPanelSelectionKey = nextSelectionKey;

    if (!shouldAnimate) {
      this.detailPanelAlpha = 1;
      this.detailPanelOffsetX = 0;
      return;
    }

    this.detailPanelTween?.remove();
    this.detailPanelAlpha = 0;
    this.detailPanelOffsetX = 24;
    this.detailPanelTween = this.tweens.add({
      targets: this,
      detailPanelAlpha: 1,
      detailPanelOffsetX: 0,
      duration: 180,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.layoutDetailPanelSection();
        this.drawUiPanels();
      },
      onComplete: () => {
        this.detailPanelTween = undefined;
      }
    });
  }

  private getDetailPanelSelectionKey(target: InspectionTarget): string | null {
    switch (target.kind) {
      case 'unit':
        return `unit:${target.unitId}`;
      case 'tile':
        return `tile:${target.x},${target.y}`;
      case 'mission':
      default:
        return null;
    }
  }

  private showDetailPortrait(textureKey: string, kind: DetailPortraitKind): void {
    this.portrait.setTexture(textureKey);

    const frame = this.portrait.frame;
    if (!frame) {
      this.portrait.setVisible(false);
      return;
    }

    const panelWidth = this.uiPanels.portrait.width;
    const panelHeight = this.uiPanels.portrait.height;
    const maxWidth = Math.max(24, panelWidth - 20);
    const maxHeight = Math.max(24, panelHeight - 20);
    const frameWidth = Math.max(1, frame.width);
    const frameHeight = Math.max(1, frame.height);

    let widthScale = maxWidth / frameWidth;
    let heightScale = maxHeight / frameHeight;

    switch (kind) {
      case 'unit':
        heightScale = Math.max(72, panelHeight - 12) / frameHeight;
        widthScale = heightScale;
        break;
      case 'prop':
        widthScale *= 0.88;
        heightScale *= 0.88;
        break;
      case 'chest':
        widthScale *= 0.84;
        heightScale *= 0.84;
        break;
      case 'terrain':
        widthScale *= 0.88;
        heightScale *= 0.66;
        break;
    }

    const scale = Math.max(0.01, Math.min(widthScale, heightScale));
    this.portrait
      .setOrigin(0.5, 0.5)
      .setScale(scale)
      .setAlpha(1)
      .setVisible(this.showPortraitPanel);
  }

  private getActiveUnit(): BattleUnit | null {
    if (!this.activeUnitId) {
      return null;
    }

    return this.units.find((unit) => unit.id === this.activeUnitId && unit.alive) ?? null;
  }

  private pushLog(message: string): void {
    this.logLines.unshift(message);
    this.logLines = this.logLines.slice(0, 5);
    this.logText?.setText(this.logLines.slice(0, 3).join('\n'));
  }

  private describeTerrain(terrain: TerrainType): string {
    switch (terrain) {
      case 'grass':
        return 'Open footing with clean routes for melee pressure.';
      case 'moss':
        return 'Uneven, muted stone that favors careful flanks.';
      case 'stone':
        return 'Broken chapel stone grants slight protection.';
      case 'sanctum':
        return 'The altar crest hardens defenders against direct blows.';
      default:
        return '';
    }
  }

  private describeProp(assetId: MapPropAssetId): string {
    return PROP_RENDER_CONFIG[assetId].description;
  }

  private getTerrainPalette(terrain: TerrainType): {
    top: number;
    sideLeft: number;
    sideRight: number;
    outline: number;
    detail: number;
  } {
    switch (terrain) {
      case 'grass':
        return {
          top: 0x486d40,
          sideLeft: 0x334e2c,
          sideRight: 0x24371f,
          outline: 0x182012,
          detail: 0xb9c97b
        };
      case 'moss':
        return {
          top: 0x5a6247,
          sideLeft: 0x444933,
          sideRight: 0x2d3024,
          outline: 0x1b1f15,
          detail: 0x9ba36a
        };
      case 'stone':
        return {
          top: 0x77736f,
          sideLeft: 0x57514f,
          sideRight: 0x403d3b,
          outline: 0x1e1a1a,
          detail: 0xc8b991
        };
      case 'sanctum':
        return {
          top: 0x8f7a66,
          sideLeft: 0x6d5947,
          sideRight: 0x4d3e34,
          outline: 0x241713,
          detail: 0xf8dea0
        };
      default:
        return {
          top: 0x666666,
          sideLeft: 0x4a4a4a,
          sideRight: 0x343434,
          outline: 0x111111,
          detail: 0xffffff
        };
    }
  }
}
