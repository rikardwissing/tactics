import Phaser from 'phaser';
import { audioDirector } from '../audio/audioDirector';
import { calculateDamage, pickNextActor, projectTurnOrder } from '../core/combat';
import { getInventoryEntries, getItemDefinition, ItemId } from '../core/items';
import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from '../core/mapData';
import { buildPath, getReachableNodes, getTile, manhattanDistance, pointKey } from '../core/pathfinding';
import { AttackStyle, BattleUnit, IdleStyle, Point, ReachNode, TerrainType, TileData, UnitAbility } from '../core/types';
import { createLevelMap, createLevelUnits, CURRENT_LEVEL, getLevel } from '../levels';
import { ChestPlacement, LevelDefinition, MapPropAssetId, MapPropPlacement } from '../levels/types';
import { ActionMenuPanelDescriptor, BattleActionMenuStack } from './components/BattleActionMenuStack';
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

const BASE_UI_PANELS = {
  topLeft: new Phaser.Geom.Rectangle(20, 18, 392, 164),
  bottomLeft: new Phaser.Geom.Rectangle(20, 514, 336, 186),
  topRight: new Phaser.Geom.Rectangle(904, 18, 356, 218),
  bottomRight: new Phaser.Geom.Rectangle(904, 514, 356, 186),
  portrait: new Phaser.Geom.Rectangle(1098, 58, 146, 150)
} as const;

const BASE_ACTION_MENU_PANELS = {
  root: new Phaser.Geom.Rectangle(880, 498, 186, 188),
  sub: new Phaser.Geom.Rectangle(1038, 498, 286, 222)
} as const;

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
const UI_PLAQUE_HEADER_HEIGHT = 40;
const UI_PLAQUE_RADIUS = 22;
const UI_INSET_RADIUS = 12;

interface UiPlaqueShellOptions {
  accentColor: number;
  alpha?: number;
  headerHeight?: number;
  radius?: number;
  headerAlpha?: number;
  sideRuleAlpha?: number;
  shineAlpha?: number;
  dividerAlpha?: number;
}

interface UiInsetBoxOptions {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  radius?: number;
}

interface UiPillOptions {
  fillColor: number;
  strokeColor: number;
  fillAlpha?: number;
  strokeAlpha?: number;
  radius?: number;
}

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
  private hoveredTurnOrderUnitId: string | null = null;
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
  private mapIntroBounds = new Phaser.Geom.Rectangle();
  private mapObjectiveBoxBounds = new Phaser.Geom.Rectangle();
  private detailBodyBoxBounds = new Phaser.Geom.Rectangle();
  private detailHealthBarBounds = new Phaser.Geom.Rectangle();
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
    this.mapPlaqueAlpha = 1;
    this.mapPlaqueOffsetX = 0;

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

    this.pushLog('Dawn Company engages the Ashen Host on the ruined ridge.');
    this.pushLog('Take the crest and cut down the enemy casters first.');
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
      if (this.phase === 'complete') {
        return;
      }

      if (pointer.wasTouch) {
        this.handleTouchPointerMove(pointer);
        return;
      }

      if (this.isPanning) {
        this.setHoveredTurnOrderUnitId(null);
        const camera = this.getWorldCamera();
        this.setBoardScroll(
          this.panCameraOrigin.x - (pointer.x - this.panPointerOrigin.x) / camera.zoom,
          this.panCameraOrigin.y - (pointer.y - this.panPointerOrigin.y) / camera.zoom
        );
        return;
      }

      this.setHoveredTurnOrderUnitId(this.turnOrderPanel.getUnitIdAt(pointer.x, pointer.y));

      if (this.isPointerOverUi(pointer.x, pointer.y)) {
        if (this.hoverTile) {
          this.hoverTile = null;
          this.drawHighlights();
          this.refreshUi();
        }
        return;
      }

      const worldPoint = pointer.positionToCamera(this.getWorldCamera()) as Phaser.Math.Vector2;
      this.hoverTile = this.pickTile(worldPoint.x, worldPoint.y);
      this.drawHighlights();
      this.refreshUi();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
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
        if (this.phase === 'complete' || this.isPointerOverUi(pointer.x, pointer.y)) {
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
      void this.handleSpaceKey();
    });
    this.input.keyboard?.on('keydown-R', (_event: KeyboardEvent) => {
      if (_event.repeat) {
        return;
      }

      this.restartBattle();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('title');
    });
    this.input.keyboard?.on('keydown-Q', () => {
      this.rotateBoard(-1);
    });
    this.input.keyboard?.on('keydown-E', () => {
      this.rotateBoard(1);
    });
    this.input.keyboard?.on('keydown-T', () => {
      this.cycleTimeOfDay();
    });
    this.input.keyboard?.on('keydown-M', () => {
      const muted = audioDirector.toggleMute();
      this.pushLog(`Audio ${muted ? 'muted' : 'enabled'}.`);
      this.refreshUi();
    });
  }

  private restartBattle(): void {
    if (this.restarting) {
      return;
    }

    this.restarting = true;
    this.busy = true;
    this.phase = 'animating';
    this.input.enabled = false;
    this.input.keyboard?.removeAllListeners();
    this.scene.restart({ levelId: this.level.id });
  }

  private handleTouchPointerDown(pointer: Phaser.Input.Pointer): void {
    this.setHoveredTurnOrderUnitId(null);

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
    this.setHoveredTurnOrderUnitId(null);

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
    this.setHoveredTurnOrderUnitId(null);

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

    if (this.phase === 'complete' || this.isPanning) {
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
      this.detailMetaText,
      this.detailTitleText,
      ...this.detailStatTexts,
      this.detailBodyText,
      this.logText,
      this.activeBadge,
      this.portrait,
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
    this.mapPlaqueEyebrowText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#d9c18a',
      letterSpacing: 2
    });

    this.mapPlaqueTitleText = this.add.text(0, 0, this.level.name, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#fff3da'
    });

    this.mapPlaqueMetaText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '13px',
      color: '#d6c4a0',
      letterSpacing: 0.6
    });

    this.mapObjectiveTagText = this.add.text(0, 0, 'OBJECTIVE', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ebd5a0',
      letterSpacing: 1.4
    });

    this.mapObjectiveText = this.add.text(0, 0, this.level.objective, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '13px',
      color: '#f2e4c2',
      lineSpacing: 3
    });

    this.mapIntroEyebrowText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#e3c98a',
      letterSpacing: 4
    }).setOrigin(0.5, 0);

    this.mapIntroTitleText = this.add.text(0, 0, this.level.name, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#fff2d6',
      align: 'center'
    }).setOrigin(0.5, 0);

    this.mapIntroMetaText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '16px',
      color: '#d8c29a',
      align: 'center',
      letterSpacing: 1
    }).setOrigin(0.5, 0);

    this.mapIntroFlavorText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '18px',
      color: '#f1dfb7',
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5, 0);

    this.logLabelText = this.add.text(0, 0, 'BATTLE LOG', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#d9c18a',
      letterSpacing: 2
    });

    this.autoBattleToggleText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f7ebc8',
      letterSpacing: 0.5
    });
    this.autoBattleToggleText.setOrigin(1, 0.5);

    this.turnOrderPanel = new TurnOrderPanel(
      this,
      6,
      undefined,
      (unitId) => {
        void this.panToUnitFromTurnOrder(unitId);
      },
      (unitId) => {
        this.setHoveredTurnOrderUnitId(unitId);
      }
    );

    this.activeBadge = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fff3da',
      letterSpacing: 1
    });
    this.activeBadge.setOrigin(0, 0.5);

    this.portrait = this.add
      .image(0, 0, 'holy-knight')
      .setVisible(false)
      .setScale(0.24);

    this.detailMetaText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '13px',
      color: '#cfbc92',
      letterSpacing: 0.5
    });

    this.detailTitleText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#fff3da'
    });

    this.detailStatTexts = Array.from({ length: 4 }, () =>
      this.add.text(0, 0, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff1cd'
      })
    );

    this.detailBodyText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '14px',
      color: '#d9c6a4',
      lineSpacing: 5
    });

    this.logText = this.add.text(0, 0, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '14px',
      color: '#efe4ca',
      lineSpacing: 5
    });

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
      this.activeBadge,
      this.portrait,
      this.detailMetaText,
      this.detailTitleText,
      ...this.detailStatTexts,
      this.detailBodyText,
      this.logText,
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
      const iconText = this.add.text(-14, -1, icon, {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#fff2d2'
      }).setOrigin(0.5);
      const labelText = this.add.text(8, -1, label, {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#d8c7a4',
        letterSpacing: 1
      }).setOrigin(0.5);

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
    const margin = Math.max(10, Math.round(Math.min(width, height) * 0.018));
    const isTouchDevice = this.sys.game.device.input.touch;

    this.portraitLayout = width < height;
    this.compactLayout = width < 1180 || height < 720;
    this.minimalMobileLayout = isTouchDevice && (this.portraitLayout || width < 980 || height < 620);
    this.showHudControls = false;
    this.showDetailPanel = !this.minimalMobileLayout;
    this.showTimelinePanel = true;
    this.showPortraitPanel = this.showDetailPanel && !this.portraitLayout && width >= 900 && height >= 540;
    this.visibleTurnOrderCount = 6;
    this.visibleLogLines = this.minimalMobileLayout ? 1 : this.portraitLayout ? 2 : this.compactLayout ? 2 : 3;
    this.actionMenuRowHeight = this.portraitLayout ? 28 : this.compactLayout ? 26 : 28;
    const avatarSize = this.minimalMobileLayout ? 36 : this.portraitLayout ? 34 : this.compactLayout ? 38 : 40;
    const turnOrderGap = avatarSize + (this.minimalMobileLayout ? 12 : 14);
    const turnOrderHeight = avatarSize + Math.max(0, this.visibleTurnOrderCount - 1) * turnOrderGap;
    let actionMenuRootX = BASE_ACTION_MENU_PANELS.root.x;
    let actionMenuBottom = BASE_ACTION_MENU_PANELS.root.bottom;
    let actionMenuRootWidth = BASE_ACTION_MENU_PANELS.root.width;
    let actionMenuPanelHeight = BASE_ACTION_MENU_PANELS.sub.height;

    if (this.portraitLayout) {
      const innerWidth = width - margin * 2;
      const topHeight = this.getTargetMapPlaqueHeight(innerWidth, height);
      const detailHeight = this.showDetailPanel ? this.getTargetDetailPanelHeight(innerWidth, height) : 0;
      const timelinePanelWidth = avatarSize + 28;
      const bottomHeight = this.showTimelinePanel ? Math.max(height < 760 ? 122 : 134, turnOrderHeight + 24) : 70;
      const actionHeight = Math.max(180, this.minimalMobileLayout ? 172 : 196);
      const gapBetweenPanels = 12;
      const rootWidth = Phaser.Math.Clamp(innerWidth * 0.28, 158, 182);
      const subWidth = Math.max(220, innerWidth - timelinePanelWidth - rootWidth - gapBetweenPanels * 2);

      this.uiPanels.topLeft.setTo(margin, margin, innerWidth, topHeight);
      this.uiPanels.topRight.setTo(
        margin,
        this.uiPanels.topLeft.bottom + (this.showDetailPanel ? 10 : 0),
        innerWidth,
        detailHeight
      );
      this.uiPanels.bottomLeft.setTo(margin, height - margin - bottomHeight, timelinePanelWidth, bottomHeight);
      this.uiPanels.bottomRight.setTo(0, 0, 0, 0);
      this.uiPanels.portrait.setTo(0, 0, 0, 0);
      actionMenuRootX = this.uiPanels.bottomLeft.right + gapBetweenPanels;
      actionMenuBottom = this.uiPanels.bottomLeft.bottom;
      actionMenuRootWidth = rootWidth;
      actionMenuPanelHeight = actionHeight;
    } else {
      const leftWidth = Phaser.Math.Clamp(width * (this.compactLayout ? 0.34 : 0.31), 300, BASE_UI_PANELS.topLeft.width);
      const topHeight = this.getTargetMapPlaqueHeight(leftWidth, height);
      const timelinePanelWidth = avatarSize + 28;
      const bottomHeight = Math.max(this.compactLayout ? 166 : BASE_UI_PANELS.bottomLeft.height, turnOrderHeight + 24);
      const rightWidth = Phaser.Math.Clamp(width * (this.compactLayout ? 0.3 : 0.28), 258, BASE_UI_PANELS.topRight.width);
      const actionRootWidth = this.compactLayout ? 168 : BASE_ACTION_MENU_PANELS.root.width;
      const actionRootHeight = this.compactLayout ? 176 : BASE_ACTION_MENU_PANELS.root.height;
      const actionSubWidth = Phaser.Math.Clamp(
        width * (this.compactLayout ? 0.255 : 0.23),
        248,
        BASE_ACTION_MENU_PANELS.sub.width
      );
      const actionPanelHeight = Math.max(
        actionRootHeight,
        this.compactLayout ? 206 : BASE_ACTION_MENU_PANELS.sub.height
      );
      const bottomY = height - margin - bottomHeight;
      const gapBetweenPanels = 14;
      const portraitWidth = this.showPortraitPanel ? (this.compactLayout ? 116 : BASE_UI_PANELS.portrait.width) : 0;
      const portraitHeight = this.showPortraitPanel ? (this.compactLayout ? 120 : BASE_UI_PANELS.portrait.height) : 0;
      const rightHeight = this.getTargetDetailPanelHeight(rightWidth, height, portraitWidth, portraitHeight);

      this.uiPanels.topLeft.setTo(margin, margin, leftWidth, topHeight);
      this.uiPanels.bottomLeft.setTo(margin, bottomY, timelinePanelWidth, bottomHeight);
      this.uiPanels.topRight.setTo(width - margin - rightWidth, margin, rightWidth, rightHeight);
      this.uiPanels.bottomRight.setTo(0, 0, 0, 0);
      this.uiPanels.portrait.setTo(
        this.uiPanels.topRight.right - portraitWidth - 16,
        this.uiPanels.topRight.y + 52,
        portraitWidth,
        portraitHeight
      );

      actionMenuRootX = this.uiPanels.bottomLeft.right + gapBetweenPanels;
      actionMenuBottom = this.uiPanels.bottomLeft.bottom;
      actionMenuRootWidth = actionRootWidth;
      actionMenuPanelHeight = actionPanelHeight;
    }

    this.actionMenuStack.setLayout({
      rootX: actionMenuRootX,
      bottom: actionMenuBottom,
      rootWidth: actionMenuRootWidth,
      panelHeight: actionMenuPanelHeight,
      overlap: Math.round(actionMenuRootWidth * 0.70),
      panelWidths: {
        list: actionMenuRootWidth,
        detail: actionMenuRootWidth
      }
    });
    this.actionMenuStack.setTypography({
      titleFontSize: this.portraitLayout ? 18 : 20,
      entryFontSize: this.portraitLayout ? 13 : this.compactLayout ? 14 : 15,
      bodyFontSize: this.portraitLayout ? 11 : 12,
      rowHeight: this.actionMenuRowHeight
    });

    this.activeBadge.setVisible(this.showDetailPanel);
    this.detailMetaText.setVisible(this.showDetailPanel);
    this.detailTitleText.setVisible(this.showDetailPanel);
    this.detailBodyText.setVisible(this.showDetailPanel);
    this.portrait.setVisible(this.showDetailPanel && this.showPortraitPanel && this.portrait.visible);
    for (const text of this.detailStatTexts) {
      text.setVisible(this.showDetailPanel && text.text.length > 0);
    }

    this.logLabelText.setVisible(false);
    this.logText.setVisible(false);
    this.turnOrderPanel.setVisible(this.showTimelinePanel);

    const turnOrderStartY = this.uiPanels.bottomLeft.bottom - turnOrderHeight - 12;
    const turnOrderX = this.uiPanels.bottomLeft.x + Math.round((this.uiPanels.bottomLeft.width - avatarSize) * 0.5);

    this.layoutMapTitleSection(width, height);
    this.layoutDetailPanelSection();

    this.turnOrderPanel.setLayout({
      x: turnOrderX,
      startY: turnOrderStartY,
      gap: turnOrderGap,
      avatarSize,
      reverse: true
    });

    this.portrait
      .setPosition(this.uiPanels.portrait.centerX, this.uiPanels.portrait.centerY + 6)
      .setVisible(this.showDetailPanel && this.showPortraitPanel && this.portrait.visible);

    this.layoutHudControls(margin, width, height);
    this.actionMenuStack.layoutText();
    this.layoutResultOverlay();
  }

  private getMapPlaqueRequiredHeight(panelWidth: number): number {
    const plaqueTextWidth = Math.max(154, panelWidth - (this.minimalMobileLayout ? 30 : 138));
    const plaqueEyebrowWidth = Math.max(120, panelWidth - (this.minimalMobileLayout ? 120 : 152));
    const objectiveBoxWidth = panelWidth - (this.minimalMobileLayout ? 28 : 36);
    const objectiveTextWidth = Math.max(60, objectiveBoxWidth - 24);
    const plaqueTitleBaseSize = this.portraitLayout ? 22 : this.compactLayout ? 24 : 26;
    const plaqueContentGap = this.portraitLayout ? 8 : 10;

    this.mapPlaqueEyebrowText.setFontSize(this.portraitLayout ? 10 : 11);
    this.fitTextToSingleLine(this.mapPlaqueEyebrowText, this.portraitLayout ? 10 : 11, 8, plaqueEyebrowWidth);

    this.mapPlaqueTitleText.setFontSize(plaqueTitleBaseSize);
    this.fitTextToSingleLine(
      this.mapPlaqueTitleText,
      plaqueTitleBaseSize,
      this.portraitLayout ? 15 : 18,
      plaqueTextWidth
    );

    this.mapPlaqueMetaText
      .setFontSize(this.portraitLayout ? 12 : 13)
      .setWordWrapWidth(Math.max(80, panelWidth - 36), true);

    this.mapObjectiveTagText.setFontSize(this.portraitLayout ? 9 : 10);
    this.mapObjectiveText
      .setFontSize(this.portraitLayout ? 11 : 12)
      .setWordWrapWidth(objectiveTextWidth, true);

    const headerHeight = UI_PLAQUE_HEADER_HEIGHT;
    const mainBlockHeight =
      this.mapPlaqueTitleText.height +
      plaqueContentGap +
      this.mapPlaqueMetaText.height;
    const objectiveBlockHeight = Math.max(
      this.portraitLayout ? 46 : 50,
      12 + this.mapObjectiveTagText.height + 4 + this.mapObjectiveText.height + 10
    );
    const bodyGap = this.portraitLayout ? 10 : 12;
    const bottomPadding = this.portraitLayout ? 16 : 18;

    return Math.ceil(headerHeight + 16 + mainBlockHeight + bodyGap + objectiveBlockHeight + bottomPadding);
  }

  private getTargetMapPlaqueHeight(panelWidth: number, height: number): number {
    const baseHeight = this.portraitLayout
      ? this.minimalMobileLayout
        ? 132
        : height < 760
          ? 148
          : 156
      : this.compactLayout
        ? 152
        : 160;

    return Math.max(baseHeight, this.getMapPlaqueRequiredHeight(panelWidth));
  }

  private getDetailPanelRequiredHeight(
    panelWidth: number,
    portraitWidth = this.showPortraitPanel ? this.uiPanels.portrait.width : 0,
    portraitHeight = this.showPortraitPanel ? this.uiPanels.portrait.height : 0
  ): number {
    const textColumnWidth = Math.max(132, panelWidth - (portraitWidth > 0 ? portraitWidth + 42 : 32));
    const bodyBoxWidth = Math.max(180, panelWidth - 32);
    const titleBaseSize = this.portraitLayout ? 20 : this.compactLayout ? 22 : 24;
    const statFontSize = this.portraitLayout ? 10 : 11;
    const hasHealthBar = Boolean(this.getDetailFocusUnit());
    const statRowGap = 8;

    this.detailMetaText
      .setFontSize(this.portraitLayout ? 12 : 13)
      .setWordWrapWidth(textColumnWidth, true);
    this.detailTitleText.setFontSize(titleBaseSize);
    this.fitTextToSingleLine(
      this.detailTitleText,
      titleBaseSize,
      this.portraitLayout ? 16 : 18,
      textColumnWidth + (portraitWidth > 0 ? 0 : 8)
    );
    for (const text of this.detailStatTexts) {
      text.setFontSize(statFontSize);
    }
    this.detailBodyText
      .setFontSize(this.portraitLayout ? 13 : this.compactLayout ? 14 : 15)
      .setWordWrapWidth(bodyBoxWidth - 24, true);

    const statRowHeights: number[] = [];
    for (const [index, text] of this.detailStatTexts.entries()) {
      if (!text.text) {
        continue;
      }
      const row = Math.floor(index / 2);
      statRowHeights[row] = Math.max(statRowHeights[row] ?? 0, text.height + 8);
    }
    const statBlockHeight =
      statRowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) +
      Math.max(0, statRowHeights.length - 1) * statRowGap;

    let topTextHeight = this.detailMetaText.height + 4 + this.detailTitleText.height;
    if (hasHealthBar) {
      topTextHeight += 22;
    }
    if (statRowHeights.length > 0) {
      topTextHeight += 10 + statBlockHeight;
    }

    const topSectionHeight = Math.max(topTextHeight, portraitHeight > 0 ? portraitHeight : 0);
    const bodyBoxHeight = Math.max(this.portraitLayout ? 58 : 64, this.detailBodyText.height + 24);

    return Math.ceil(
      UI_PLAQUE_HEADER_HEIGHT +
      (this.portraitLayout ? 14 : 16) +
      topSectionHeight +
      (this.portraitLayout ? 10 : 12) +
      bodyBoxHeight +
      (this.portraitLayout ? 14 : 16)
    );
  }

  private getTargetDetailPanelHeight(
    panelWidth: number,
    height: number,
    portraitWidth = this.showPortraitPanel ? this.uiPanels.portrait.width : 0,
    portraitHeight = this.showPortraitPanel ? this.uiPanels.portrait.height : 0
  ): number {
    const baseHeight = this.portraitLayout
      ? height < 760
        ? 120
        : 132
      : this.compactLayout
        ? 190
        : BASE_UI_PANELS.topRight.height;

    return Math.max(baseHeight, this.getDetailPanelRequiredHeight(panelWidth, portraitWidth, portraitHeight));
  }

  private layoutDetailPanelSection(): void {
    if (!this.showDetailPanel) {
      this.detailBodyBoxBounds.setTo(0, 0, 0, 0);
      this.detailHealthBarBounds.setTo(0, 0, 0, 0);
      return;
    }

    const panel = this.uiPanels.topRight;
    const focusUnit = this.getDetailFocusUnit();
    const hasHealthBar = Boolean(focusUnit);
    const sideInset = 16;
    const topInset = this.portraitLayout ? 14 : 16;
    const sectionGap = this.portraitLayout ? 10 : 12;
    const bottomInset = this.portraitLayout ? 14 : 16;
    const portraitWidth = this.showPortraitPanel ? this.uiPanels.portrait.width : 0;
    const portraitHeight = this.showPortraitPanel ? this.uiPanels.portrait.height : 0;
    const textColumnWidth = Math.max(132, panel.width - (portraitWidth > 0 ? portraitWidth + 42 : 32));
    const bodyBoxWidth = Math.max(180, panel.width - 32);
    const titleBaseSize = this.portraitLayout ? 20 : this.compactLayout ? 22 : 24;
    const statFontSize = this.portraitLayout ? 10 : 11;
    const statRowGap = 8;
    const statColumnGap = 10;
    const statColumnWidth = Math.max(72, Math.floor((textColumnWidth - statColumnGap) / 2));

    this.activeBadge
      .setPosition(panel.x + 20, panel.y + UI_PLAQUE_HEADER_HEIGHT * 0.5 + 2)
      .setFontSize(this.portraitLayout ? 12 : 13);

    this.detailMetaText
      .setPosition(panel.x + sideInset, 0)
      .setFontSize(this.portraitLayout ? 12 : 13)
      .setWordWrapWidth(textColumnWidth, true);
    this.detailTitleText
      .setPosition(panel.x + sideInset, 0)
      .setFontSize(titleBaseSize);
    this.fitTextToSingleLine(
      this.detailTitleText,
      titleBaseSize,
      this.portraitLayout ? 16 : 18,
      textColumnWidth + (portraitWidth > 0 ? 0 : 8)
    );
    for (const text of this.detailStatTexts) {
      text.setFontSize(statFontSize);
    }
    this.detailBodyText
      .setFontSize(this.portraitLayout ? 13 : this.compactLayout ? 14 : 15)
      .setWordWrapWidth(bodyBoxWidth - 24, true);

    const statRowHeights: number[] = [];
    for (const [index, text] of this.detailStatTexts.entries()) {
      if (!text.text) {
        continue;
      }
      const row = Math.floor(index / 2);
      statRowHeights[row] = Math.max(statRowHeights[row] ?? 0, text.height + 8);
    }
    const statBlockHeight =
      statRowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) +
      Math.max(0, statRowHeights.length - 1) * statRowGap;

    let topTextHeight = this.detailMetaText.height + 4 + this.detailTitleText.height;
    if (hasHealthBar) {
      topTextHeight += 22;
    }
    if (statRowHeights.length > 0) {
      topTextHeight += 10 + statBlockHeight;
    }

    const topSectionHeight = Math.max(topTextHeight, portraitHeight > 0 ? portraitHeight : 0);
    const bodyBoxHeight = Math.max(this.portraitLayout ? 58 : 64, this.detailBodyText.height + 24);
    const bodyTop = panel.y + UI_PLAQUE_HEADER_HEIGHT + topInset;
    const bodyBottom = panel.bottom - bottomInset;
    const availableBodyHeight = Math.max(0, bodyBottom - bodyTop);
    const totalBodyHeight = topSectionHeight + sectionGap + bodyBoxHeight;
    const bodyStartY = bodyTop + Math.max(0, (availableBodyHeight - totalBodyHeight) * 0.5);
    const textBlockY = bodyStartY + Math.max(0, (topSectionHeight - topTextHeight) * 0.5);
    const metaY = Math.round(textBlockY);
    const titleY = Math.round(metaY + this.detailMetaText.height + 4);
    let cursorY = titleY + this.detailTitleText.height;

    this.detailMetaText.setY(metaY);
    this.detailTitleText.setY(titleY);

    if (hasHealthBar) {
      this.detailHealthBarBounds.setTo(panel.x + sideInset, Math.round(cursorY + 10), textColumnWidth, 12);
      cursorY = this.detailHealthBarBounds.bottom;
    } else {
      this.detailHealthBarBounds.setTo(0, 0, 0, 0);
    }

    if (statRowHeights.length > 0) {
      cursorY += 10;
      const rowTopPositions: number[] = [];
      let rowY = cursorY;
      for (const [row, rowHeight] of statRowHeights.entries()) {
        rowTopPositions[row] = rowY;
        rowY += rowHeight + statRowGap;
      }

      for (const [index, text] of this.detailStatTexts.entries()) {
        if (!text.text) {
          continue;
        }
        const column = index % 2;
        const row = Math.floor(index / 2);
        const rowHeight = statRowHeights[row] ?? 0;
        text.setPosition(
          panel.x + sideInset + 12 + column * (statColumnWidth + statColumnGap),
          Math.round((rowTopPositions[row] ?? cursorY) + Math.max(0, (rowHeight - text.height) * 0.5) - 1)
        );
      }
    }

    if (this.showPortraitPanel) {
      this.uiPanels.portrait.setTo(
        panel.right - portraitWidth - 16,
        Math.round(bodyStartY + Math.max(0, (topSectionHeight - portraitHeight) * 0.5)),
        portraitWidth,
        portraitHeight
      );
    }

    this.detailBodyBoxBounds.setTo(
      panel.x + sideInset,
      Math.round(bodyStartY + topSectionHeight + sectionGap),
      bodyBoxWidth,
      bodyBoxHeight
    );
    this.detailBodyText.setPosition(
      this.detailBodyBoxBounds.x + 12,
      Math.round(this.detailBodyBoxBounds.y + Math.max(10, (this.detailBodyBoxBounds.height - this.detailBodyText.height) * 0.5))
    );
  }

  private layoutMapTitleSection(width: number, height: number): void {
    const plaqueVisible = this.mapPlaqueAlpha > 0.01;
    const introVisible = this.mapIntroAlpha > 0.01;
    const plaqueHeaderHeight = UI_PLAQUE_HEADER_HEIGHT;
    const plaqueHeaderCenterY = this.uiPanels.topLeft.y + 22;
    const plaqueInsetX = this.minimalMobileLayout ? 14 : 18;
    const plaqueTextWidth = Math.max(154, this.uiPanels.topLeft.width - (this.minimalMobileLayout ? 30 : 138));
    const plaqueEyebrowWidth = Math.max(120, this.uiPanels.topLeft.width - (this.minimalMobileLayout ? 120 : 152));
    const plaqueTitleBaseSize = this.portraitLayout ? 22 : this.compactLayout ? 24 : 26;
    const plaqueBodyTop = this.uiPanels.topLeft.y + plaqueHeaderHeight + 16;
    const plaqueBodyBottom = this.uiPanels.topLeft.bottom - (this.portraitLayout ? 16 : 18);
    const plaqueBodyHeight = Math.max(0, plaqueBodyBottom - plaqueBodyTop);
    const plaqueContentGap = this.portraitLayout ? 8 : 10;
    const objectiveBoxX = this.uiPanels.topLeft.x + plaqueInsetX + this.mapPlaqueOffsetX;
    const objectiveBoxWidth = this.uiPanels.topLeft.width - (this.minimalMobileLayout ? 28 : 36);
    const introWidth = Phaser.Math.Clamp(
      width * (this.portraitLayout ? 0.84 : this.compactLayout ? 0.56 : 0.5),
      280,
      580
    );
    const introEyebrowBaseSize = this.portraitLayout ? 11 : 12;
    const introTitleBaseSize = this.portraitLayout ? 28 : this.compactLayout ? 34 : 40;
    const introHeight = this.portraitLayout
      ? this.minimalMobileLayout
        ? 164
        : 176
      : this.compactLayout
        ? 172
        : 184;
    const introY = Math.max(24, Math.round(height * (this.portraitLayout ? 0.09 : 0.11)));

    this.mapIntroBounds.setTo(
      Math.round((width - introWidth) / 2),
      introY,
      introWidth,
      introHeight
    );
    const introTop = this.mapIntroBounds.y + this.mapIntroOffsetY;

    this.mapPlaqueEyebrowText
      .setPosition(this.uiPanels.topLeft.x + plaqueInsetX + this.mapPlaqueOffsetX, this.uiPanels.topLeft.y + 15)
      .setFontSize(this.portraitLayout ? 10 : 11)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(plaqueVisible);
    this.fitTextToSingleLine(this.mapPlaqueEyebrowText, this.portraitLayout ? 10 : 11, 8, plaqueEyebrowWidth);
    this.mapPlaqueTitleText
      .setPosition(this.uiPanels.topLeft.x + plaqueInsetX + this.mapPlaqueOffsetX, 0)
      .setFontSize(plaqueTitleBaseSize)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(plaqueVisible);
    this.fitTextToSingleLine(this.mapPlaqueTitleText, plaqueTitleBaseSize, this.portraitLayout ? 15 : 18, plaqueTextWidth);
    this.mapPlaqueMetaText
      .setPosition(this.uiPanels.topLeft.x + plaqueInsetX + this.mapPlaqueOffsetX, 0)
      .setFontSize(this.portraitLayout ? 12 : 13)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(plaqueVisible)
      .setWordWrapWidth(this.uiPanels.topLeft.width - 36, true);
    this.mapObjectiveTagText
      .setPosition(objectiveBoxX + 12, 0)
      .setFontSize(this.portraitLayout ? 9 : 10)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(plaqueVisible);
    this.mapObjectiveText
      .setPosition(objectiveBoxX + 12, 0)
      .setFontSize(this.portraitLayout ? 11 : 12)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(plaqueVisible)
      .setWordWrapWidth(objectiveBoxWidth - 24, true);

    const mainBlockHeight =
      this.mapPlaqueTitleText.height +
      plaqueContentGap +
      this.mapPlaqueMetaText.height;
    const objectiveBlockHeight = Math.max(
      this.portraitLayout ? 46 : 50,
      12 + this.mapObjectiveTagText.height + 4 + this.mapObjectiveText.height + 10
    );
    const totalBodyHeight = mainBlockHeight + (this.portraitLayout ? 10 : 12) + objectiveBlockHeight;
    const bodyStartY = plaqueBodyTop + Math.max(0, (plaqueBodyHeight - totalBodyHeight) * 0.5);
    const titleY = Math.round(bodyStartY);
    const metaY = Math.round(titleY + this.mapPlaqueTitleText.height + plaqueContentGap);
    const objectiveBoxY = Math.round(metaY + this.mapPlaqueMetaText.height + (this.portraitLayout ? 10 : 12));

    this.mapPlaqueTitleText.setY(titleY);
    this.mapPlaqueMetaText.setY(metaY);
    this.mapObjectiveBoxBounds.setTo(
      objectiveBoxX,
      objectiveBoxY,
      objectiveBoxWidth,
      objectiveBlockHeight
    );
    this.mapObjectiveTagText
      .setPosition(this.mapObjectiveBoxBounds.x + 12, this.mapObjectiveBoxBounds.y + 8);
    this.mapObjectiveText
      .setPosition(
        this.mapObjectiveBoxBounds.x + 12,
        this.mapObjectiveBoxBounds.y + 8 + this.mapObjectiveTagText.height + 4
      );
    this.autoBattleToggleText
      .setPosition(this.uiPanels.topLeft.right - 22 + this.mapPlaqueOffsetX, plaqueHeaderCenterY)
      .setFontSize(this.portraitLayout ? 12 : 13)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(plaqueVisible);

    this.mapIntroEyebrowText
      .setPosition(this.mapIntroBounds.centerX, introTop + 18)
      .setFontSize(introEyebrowBaseSize)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible);
    this.fitTextToSingleLine(this.mapIntroEyebrowText, introEyebrowBaseSize, 9, this.mapIntroBounds.width - 56);
    this.mapIntroTitleText
      .setPosition(this.mapIntroBounds.centerX, introTop + 40)
      .setFontSize(introTitleBaseSize)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible);
    this.fitTextToSingleLine(
      this.mapIntroTitleText,
      introTitleBaseSize,
      this.portraitLayout ? 20 : 24,
      this.mapIntroBounds.width - 48
    );
    this.mapIntroMetaText
      .setPosition(this.mapIntroBounds.centerX, introTop + (this.portraitLayout ? 92 : 102))
      .setFontSize(this.portraitLayout ? 13 : 16)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible)
      .setWordWrapWidth(this.mapIntroBounds.width - 72, true);
    this.mapIntroFlavorText
      .setPosition(this.mapIntroBounds.centerX, introTop + (this.portraitLayout ? 122 : 132))
      .setFontSize(this.portraitLayout ? 15 : this.compactLayout ? 16 : 18)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible)
      .setWordWrapWidth(this.mapIntroBounds.width - (this.portraitLayout ? 42 : 88), true);
  }

  private fitTextToSingleLine(
    text: Phaser.GameObjects.Text,
    baseFontSize: number,
    minFontSize: number,
    maxWidth: number
  ): void {
    text.setWordWrapWidth(0, false).setFontSize(baseFontSize);

    let fontSize = baseFontSize;
    while (fontSize > minFontSize && text.width > maxWidth) {
      fontSize -= 1;
      text.setFontSize(fontSize);
    }
  }

  private startMapTitleSequence(): void {
    this.mapIntroAlpha = 0;
    this.mapIntroOffsetY = 18;
    this.mapPlaqueAlpha = 0;
    this.mapPlaqueOffsetX = -20;
    this.applyMapTitlePresentation();

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
            mapPlaqueAlpha: 1,
            mapPlaqueOffsetX: 0,
            duration: MAP_TITLE_OUTRO_DURATION,
            ease: 'Cubic.easeInOut',
            onUpdate: () => this.applyMapTitlePresentation(),
            onComplete: () => {
              this.mapIntroAlpha = 0;
              this.mapIntroOffsetY = -14;
              this.mapPlaqueAlpha = 1;
              this.mapPlaqueOffsetX = 0;
              this.applyMapTitlePresentation();
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

  private layoutHudControls(margin: number, width: number, height: number): void {
    const availableTop = this.uiPanels.topRight.bottom + 16;
    const availableBottom = Math.min(this.actionMenuStack.getRootTop(), this.uiPanels.bottomLeft.y) - 16;
    const span = Math.max(180, availableBottom - availableTop);
    const scale = this.portraitLayout ? 0.84 : this.compactLayout ? 0.86 : 0.8;
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

    this.resultOverlayShade
      .setPosition(width / 2, height / 2)
      .setSize(width, height);
    this.resultOverlayTitle
      .setPosition(width / 2, height * 0.4)
      .setFontSize(this.portraitLayout ? 46 : this.compactLayout ? 58 : 74);
    this.resultOverlayBody
      .setPosition(width / 2, height * 0.54)
      .setFontSize(this.portraitLayout ? 18 : 24)
      .setWordWrapWidth(Math.min(width - 56, 560), true);
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
    const fitWidth = Math.max(1, camera.width - 24) / fitSize.width;
    const fitHeight = Math.max(1, camera.height - 24) / fitSize.height;

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

      const hpBack = this.add.rectangle(0, sprite.y - unit.spriteDisplayHeight - 12, 60, 8, 0x12070d, 0.92);
      const hpFill = this.add.rectangle(-29, sprite.y - unit.spriteDisplayHeight - 12, 56, 4, 0x65d99e, 1).setOrigin(0, 0.5);
      const label = this.add.text(0, sprite.y - unit.spriteDisplayHeight - 28, unit.name, {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '15px',
        color: '#fff2d2',
        stroke: '#1a0910',
        strokeThickness: 4
      });
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

    if (this.hoverTile) {
      this.drawDiamond(this.hoverTile, 0xd9c06d, 0.2, 2, 0xf6e6b4, 0.7);
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

    const point = this.isoToScreen(tile);
    view.container.setPosition(point.x, point.y + UNIT_GROUND_OFFSET_Y);
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
    const basePoints = this.scaleTilePolygon(this.getTileTopPoints(tile), point, 0.98);

    view.base.clear();
    view.base.fillStyle(config.baseFill, config.baseAlpha);
    view.base.fillPoints(basePoints, true);
    view.base.lineStyle(2, config.rim, config.rimAlpha);
    view.base.strokePoints(basePoints, true, true);
    view.base.setDepth(this.getPropBaseDepth(tile));

    const imageY = point.y + TILE_HEIGHT / 2 + 2;
    view.image.setPosition(point.x, imageY);
    view.image.setDepth(this.getPropDepth(tile));
    view.shadowOverlay?.setDepth(this.getPropDepth(tile) + 0.05);

    if (view.groundGlow && view.haloGlow && config.light) {
      view.groundGlow.setPosition(point.x, point.y + TILE_HEIGHT / 2 - 2);
      view.haloGlow.setPosition(point.x, imageY - config.light.sourceOffsetY);
    }

    if (view.embers && config.light) {
      view.embers.setPosition(point.x, imageY - config.light.sourceOffsetY);
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

    return this.isoToScreen(unit);
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

  private getCameraScrollForFocus(focusX: number, focusY: number): Phaser.Math.Vector2 {
    const camera = this.getWorldCamera();
    const boardFocus = this.getBoardFocusPoint();
    const fitSize = this.getBoardFitSize();
    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;

    return this.resolveBoardScroll(
      focusX - visibleWidth / 2,
      focusY - visibleHeight / 2,
      camera,
      boardFocus,
      fitSize,
      true
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
    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;
    const maxScrollX = this.cameraBounds.right - visibleWidth;
    const maxScrollY = this.cameraBounds.bottom - visibleHeight;
    const canScrollX = maxScrollX > this.cameraBounds.x;
    const canScrollY = maxScrollY > this.cameraBounds.y;
    const resolvedScrollX =
      (lockToBoard && visibleWidth >= fitSize.width) || !canScrollX
        ? boardFocus.x - visibleWidth / 2
        : Phaser.Math.Clamp(scrollX, this.cameraBounds.x, maxScrollX);
    const resolvedScrollY =
      (lockToBoard && visibleHeight >= fitSize.height) || !canScrollY
        ? boardFocus.y - visibleHeight / 2
        : Phaser.Math.Clamp(scrollY, this.cameraBounds.y, maxScrollY);

    return new Phaser.Math.Vector2(resolvedScrollX, resolvedScrollY);
  }

  private panCameraToPoint(focusX: number, focusY: number, duration: number): Promise<void> {
    const camera = this.getWorldCamera();
    const targetScroll = this.getCameraScrollForFocus(focusX, focusY);

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
    const staticPanels = [
      this.uiPanels.topLeft,
      ...(this.showTimelinePanel ? [this.uiPanels.bottomLeft] : []),
      ...(this.showDetailPanel ? [this.uiPanels.topRight] : []),
      ...(this.showPortraitPanel ? [this.uiPanels.portrait] : []),
      ...(this.mapIntroAlpha > 0.01
        ? [new Phaser.Geom.Rectangle(
            this.mapIntroBounds.x,
            this.mapIntroBounds.y + this.mapIntroOffsetY,
            this.mapIntroBounds.width,
            this.mapIntroBounds.height
          )]
        : [])
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
        label: 'Abilities',
        enabled: !this.turnActionUsed && activeUnit.abilities.length > 0
      },
      {
        action: 'items',
        label: 'Items',
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
        target.hp += recovered;
        this.consumeItemFromUnit(activeUnit, itemId, 1);
        this.turnActionUsed = true;
        this.positionUnit(target);
        audioDirector.playHeal();
        this.pushLog(
          recovered > 0
            ? `${activeUnit.name} uses ${item.name} on ${target.name}, restoring ${recovered} HP.`
            : `${activeUnit.name} uses ${item.name} on ${target.name}, but it has no effect.`
        );
        await this.finishPlayerCommand(activeUnit, `${activeUnit.name} can still move this turn.`);
        return;
      }
      case 'ct':
        target.ct += item.effect.amount;
        this.consumeItemFromUnit(activeUnit, itemId, 1);
        this.turnActionUsed = true;
        this.positionUnit(target);
        audioDirector.playUiConfirm();
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

    const autoBattleBounds = this.autoBattleToggleText.getBounds();
    Phaser.Geom.Rectangle.Inflate(autoBattleBounds, 12, 8);

    if (autoBattleBounds.contains(pointer.x, pointer.y)) {
      await this.toggleAutoBattle();
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
    }
  }

  private async panToUnitFromTurnOrder(unitId: string): Promise<void> {
    const unit = this.units.find((entry) => entry.id === unitId && entry.alive);

    if (!unit) {
      return;
    }

    const focusPoint = this.getUnitWorldPoint(unit);
    await this.panCameraToPoint(focusPoint.x, focusPoint.y, 260);
  }

  private async handleSpaceKey(): Promise<void> {
    if (this.busy || this.phase === 'complete') {
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
      audioDirector.playUiCancel();
      this.phase = 'player-menu';
      this.selectedAbilityId = null;
      this.selectedItemId = null;
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (this.phase === 'player-item-action') {
      audioDirector.playUiCancel();
      this.phase = 'player-items';
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (this.phase === 'player-abilities') {
      audioDirector.playUiCancel();
      this.phase = 'player-menu';
      this.selectedAbilityId = null;
      this.selectedItemId = null;
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (this.phase === 'player-move') {
      audioDirector.playUiCancel();
      this.phase = 'player-menu';
      this.selectedAbilityId = null;
      this.selectedItemId = null;
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (this.phase === 'player-action') {
      audioDirector.playUiCancel();
      this.phase = 'player-abilities';
      this.selectedAbilityId = null;
      this.drawHighlights();
      this.refreshUi();
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
    this.moveNodes = getReachableNodes(this.map, actor, this.units, this.getBlockedPropPoints());
    const actorFocusPoint = this.getUnitWorldPoint(actor);
    await this.panCameraToPoint(actorFocusPoint.x, actorFocusPoint.y, 280);
    this.playTurnStartAnimation(actor);
    audioDirector.playTurnStart(actor.team);

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

        const destination = this.isoToScreen(tile);
        const startDepth = view.container.depth;
        const destinationDepth = this.getUnitDepth(tile);
        const cameraPanPromise = this.panCameraToPoint(destination.x, destination.y, 240);
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

    await this.playAttackEffect(strikeAttacker, launchPoint, impactPoint, angle);

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

    const damageText = this.registerWorldObject(this.add.text(damageTextPoint.x, damageTextPoint.y, `${damageRoll.amount}`, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: damageRoll.critical ? '38px' : '30px',
      color: damageRoll.critical ? '#ffe98f' : '#ffffff',
      fontStyle: 'bold',
      stroke: '#2b0f14',
      strokeThickness: 6
    }));
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

    this.emitSupportBurst(effectPoint.x, effectPoint.y, 0x99f0b6);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: targetView.sprite,
        tint: 0xb8ffd0,
        duration: 150,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          targetView.sprite.clearTint();
          resolve();
        }
      });
    });

    if (amount > 0) {
      target.hp += amount;
      this.positionUnit(target);
    }

    const healText = this.registerWorldObject(this.add.text(effectPoint.x, effectPoint.y, amount > 0 ? `+${amount}` : 'MISS', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '26px',
      color: '#c8ffd8',
      fontStyle: 'bold',
      stroke: '#10301b',
      strokeThickness: 5
    }));
    healText.setOrigin(0.5).setDepth(980);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: healText,
        y: effectPoint.y - 42,
        alpha: 0,
        duration: 720,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          healText.destroy();
          resolve();
        }
      });
    });

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

    this.emitSupportBurst(targetPoint.x, targetPoint.y - 56, 0xf0d27d);

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

  private async playAttackEffect(
    attacker: BattleUnit,
    launchPoint: Phaser.Math.Vector2,
    impactPoint: Phaser.Math.Vector2,
    angle: number
  ): Promise<void> {
    switch (attacker.attackStyle) {
      case 'blade-arc':
        await this.animateImpactSprite(attacker.effectKey, impactPoint, angle + 0.08, 0.14, 0.88, 220, true);
        return;
      case 'arrow-flight':
        await this.animateProjectileSprite(attacker.effectKey, launchPoint, impactPoint, angle, 0.16, 0.34, 230);
        return;
      case 'ember-burst':
        await this.animateImpactSprite(attacker.effectKey, impactPoint, 0, 0.12, 0.92, 300, true);
        return;
      case 'grave-cleave':
        await this.animateImpactSprite(attacker.effectKey, impactPoint, angle - 0.12, 0.16, 0.96, 240, false);
        return;
      case 'feather-shot':
        await this.animateProjectileSprite(attacker.effectKey, launchPoint, impactPoint, angle, 0.14, 0.3, 250, 0.55);
        return;
      case 'ash-hex':
        await this.animateImpactSprite(
          attacker.effectKey,
          new Phaser.Math.Vector2(impactPoint.x, impactPoint.y + 42),
          0.2,
          0.12,
          0.86,
          360,
          false,
          1.4
        );
        return;
      default:
        return;
    }
  }

  private async animateProjectileSprite(
    key: string,
    launchPoint: Phaser.Math.Vector2,
    impactPoint: Phaser.Math.Vector2,
    angle: number,
    startScale: number,
    endScale: number,
    duration: number,
    spin = 0
  ): Promise<void> {
    const projectile = this.registerWorldObject(this.add
      .image(launchPoint.x, launchPoint.y, key)
      .setDepth(962)
      .setScale(startScale)
      .setRotation(angle)
      .setAlpha(0.96));

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
    key: string,
    impactPoint: Phaser.Math.Vector2,
    rotation: number,
    startScale: number,
    peakScale: number,
    duration: number,
    additive: boolean,
    endScaleMultiplier = 1.15
  ): Promise<void> {
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
              effect.destroy();
              resolve();
            }
          });
        }
      });
    });
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

  private async endCurrentTurn(): Promise<void> {
    this.busy = false;
    this.phase = 'animating';
    this.activeUnitId = null;
    this.selectedAbilityId = null;
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
    this.moveNodes.clear();
    if (result === 'Victory') {
      audioDirector.playVictory();
    } else {
      audioDirector.playDefeat();
    }
    this.drawHighlights();
    this.refreshUi();

    this.resultOverlayShade = this.registerUiObject(this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x090407, 0.62)
      .setDepth(1000)
      .setScrollFactor(0));
    this.resultOverlayTitle = this.registerUiObject(this.add
      .text(0, 0, result.toUpperCase(), {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '74px',
        fontStyle: 'bold',
        color: result === 'Victory' ? '#fff0c0' : '#ffd0d0',
        stroke: '#260a11',
        strokeThickness: 9,
        letterSpacing: 10
      })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0));
    this.resultOverlayBody = this.registerUiObject(this.add
      .text(
        0,
        0,
        result === 'Victory'
          ? 'The chapel ridge is yours.\nTap or click to battle again.'
          : 'The Ashen Host holds the altar.\nTap or click to try again.',
        {
          fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
          fontSize: '24px',
          color: '#eadab2',
          align: 'center'
        }
      )
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0));
    this.layoutResultOverlay();
  }

  private refreshUi(): void {
    const timeOfDayLabel = TIME_OF_DAY_CONFIG[this.timeOfDay].label;
    this.mapPlaqueEyebrowText.setText(this.getMapPlaqueEyebrow());
    this.mapPlaqueTitleText.setText(this.level.name);
    this.mapPlaqueMetaText.setText(this.getMapPlaqueMeta(timeOfDayLabel));
    this.mapObjectiveTagText.setText('OBJECTIVE');
    this.mapObjectiveText.setText(this.level.shortObjective ?? this.level.objective);
    this.mapIntroEyebrowText.setText(this.getMapIntroEyebrow());
    this.mapIntroTitleText.setText(this.level.name);
    this.mapIntroMetaText.setText(this.getMapIntroMeta(timeOfDayLabel));
    this.mapIntroFlavorText.setText(this.level.titleFlavor ?? this.level.objective);
    this.autoBattleToggleText
      .setText(`AUTO ${this.autoBattleEnabled ? 'ON' : 'OFF'}`)
      .setColor(this.autoBattleEnabled ? '#fff1bc' : '#bca982');

    const activeUnit = this.getActiveUnit();
    const queue = activeUnit
      ? [activeUnit, ...projectTurnOrder(this.units, this.visibleTurnOrderCount - 1)]
      : projectTurnOrder(this.units, this.visibleTurnOrderCount);
    if (!this.showTimelinePanel) {
      this.hoveredTurnOrderUnitId = null;
    }
    this.turnOrderPanel.setQueue(queue, this.activeUnitId, this.visibleTurnOrderCount, this.showTimelinePanel);

    const focusUnit = this.getDetailFocusUnit();
    const hoveredChest = this.hoverTile ? this.getChestAt(this.hoverTile.x, this.hoverTile.y) : null;
    const hoveredProp = this.hoverTile ? this.getPropAt(this.hoverTile.x, this.hoverTile.y) : null;

    if (focusUnit) {
      this.showDetailPortrait(focusUnit.spriteKey, 'unit');
      this.activeBadge
        .setText(focusUnit.team === 'player' ? 'ALLY UNIT' : 'FOE UNIT')
        .setColor(focusUnit.team === 'player' ? '#ecfff6' : '#ffe0d7');
      this.detailMetaText.setText(
        `${focusUnit.team === 'player' ? 'Dawn Company' : 'Ashen Host'}  •  ${focusUnit.className}`
      );
      this.detailTitleText.setText(focusUnit.name);
      this.detailBodyText.setText(
        [
          `${focusUnit.attackName}`,
          focusUnit.attackText
        ].join('\n')
      );
      this.setDetailStatValues([
        `HP ${focusUnit.hp}/${focusUnit.maxHp}`,
        `MOVE ${focusUnit.move}`,
        `SPD ${focusUnit.speed}`,
        `RNG ${focusUnit.rangeMin}-${focusUnit.rangeMax}`
      ]);
    } else if (this.hoverTile) {
      if (hoveredChest) {
        this.showDetailPortrait('chapel-chest-closed', 'chest');
      } else if (hoveredProp) {
        this.showDetailPortrait(hoveredProp.assetId, 'prop');
      } else {
        this.showDetailPortrait(TERRAIN_TILE_ASSETS[this.hoverTile.terrain][0], 'terrain');
      }
      this.activeBadge
        .setText(hoveredChest ? 'CHEST CACHE' : hoveredProp ? 'FIELD PROP' : 'TERRAIN TILE')
        .setColor(hoveredChest ? '#fff0ba' : hoveredProp ? '#ffd9b1' : '#f7edc4');
      this.detailMetaText.setText(
        `Coords ${this.hoverTile.x}, ${this.hoverTile.y}  •  ${this.formatTerrainName(this.hoverTile.terrain)}`
      );
      this.detailTitleText.setText(
        hoveredChest
          ? 'Supply Chest'
          : hoveredProp
            ? this.getPropTitle(hoveredProp.assetId)
            : `${this.formatTerrainName(this.hoverTile.terrain)} Ground`
      );
      this.detailBodyText.setText(
        [
          `Height ${this.hoverTile.height}   Terrain ${this.hoverTile.terrain}`,
          hoveredChest
            ? `Chest: ${this.describeItemGain(hoveredChest.itemId, hoveredChest.quantity)}`
            : hoveredProp
              ? `Prop: ${this.describeProp(hoveredProp.assetId)}`
            : this.describeTerrain(this.hoverTile.terrain)
        ].join('\n')
      );
      this.setDetailStatValues([
        `HEIGHT ${this.hoverTile.height}`,
        `TERRAIN ${this.formatTerrainName(this.hoverTile.terrain).toUpperCase()}`,
        hoveredChest ? 'LOOT READY' : hoveredProp ? 'OCCUPIED' : '',
        hoveredProp && PROP_RENDER_CONFIG[hoveredProp.assetId].blocksMovement ? 'BLOCKS MOVE' : ''
      ]);
    } else {
      this.portrait.setVisible(false);
      this.activeBadge.setText('BATTLE STATUS').setColor('#f7edc4');
      this.detailMetaText.setText('Engagement overview');
      this.detailTitleText.setText(this.level.name);
      this.detailBodyText.setText('Select a unit or tile for tactical details.');
      this.setDetailStatValues([
        `ALLIES ${this.units.filter((unit) => unit.team === 'player' && unit.alive).length}`,
        `FOES ${this.units.filter((unit) => unit.team === 'enemy' && unit.alive).length}`,
        `CHESTS ${this.chests.filter((chest) => !chest.opened).length}`,
        `SCENE ${TIME_OF_DAY_CONFIG[this.timeOfDay].label.toUpperCase()}`
      ]);
    }

    const desiredTopHeight = this.getTargetMapPlaqueHeight(this.uiPanels.topLeft.width, this.scale.height);
    const desiredDetailHeight = this.showDetailPanel
      ? this.getTargetDetailPanelHeight(this.uiPanels.topRight.width, this.scale.height)
      : 0;
    if (
      desiredTopHeight !== this.uiPanels.topLeft.height ||
      (this.showDetailPanel && desiredDetailHeight !== this.uiPanels.topRight.height)
    ) {
      this.updateUiLayout(this.scale.width, this.scale.height);
    }
    this.layoutMapTitleSection(this.scale.width, this.scale.height);
    this.layoutDetailPanelSection();

    this.logText.setText(this.logLines.slice(0, this.visibleLogLines).join('\n'));
    this.actionMenuStack.setPanels(this.buildActionMenuPanels());
    this.actionMenuStack.setVisible(this.shouldShowActionMenu());
    this.drawUiPanels();
    this.actionMenuStack.draw();
  }

  private drawUiPanels(): void {
    this.uiGraphics.clear();

    this.drawMapTitlePlaque();
    this.drawMapTitleIntro();

    const focusUnit = this.getDetailFocusUnit();
    this.drawDetailPlaque(focusUnit);

    if (this.showPortraitPanel) {
      this.drawUiPanelShell(this.uiGraphics, this.uiPanels.portrait, 0.86, 28, 14, 0x4f3140);
      this.uiGraphics.fillStyle(0xf5e1b2, 0.06);
      this.uiGraphics.fillRoundedRect(
        this.uiPanels.portrait.x + 8,
        this.uiPanels.portrait.y + 8,
        this.uiPanels.portrait.width - 16,
        8,
        4
      );
    }

  }

  private drawMapTitlePlaque(): void {
    if (this.mapPlaqueAlpha <= 0.01) {
      return;
    }

    const panel = new Phaser.Geom.Rectangle(
      this.uiPanels.topLeft.x + this.mapPlaqueOffsetX,
      this.uiPanels.topLeft.y,
      this.uiPanels.topLeft.width,
      this.uiPanels.topLeft.height
    );
    const alpha = this.mapPlaqueAlpha;
    const autoTagBounds = this.autoBattleToggleText.getBounds();
    this.drawUiPlaqueShell(this.uiGraphics, panel, {
      accentColor: 0x5a2432,
      alpha,
      headerHeight: UI_PLAQUE_HEADER_HEIGHT,
      radius: UI_PLAQUE_RADIUS,
      headerAlpha: 0.78,
      sideRuleAlpha: 0.16,
      dividerAlpha: 0.46
    });
    this.drawUiInsetBox(this.uiGraphics, this.mapObjectiveBoxBounds, {
      fillAlpha: 0.92 * alpha,
      strokeAlpha: 0.28 * alpha,
      radius: UI_INSET_RADIUS
    });

    Phaser.Geom.Rectangle.Inflate(autoTagBounds, 14, 6);
    this.drawUiPill(this.uiGraphics, autoTagBounds, {
      fillColor: this.autoBattleEnabled ? 0x67502a : 0x27191a,
      strokeColor: this.autoBattleEnabled ? 0xf3d690 : 0x8f7250,
      fillAlpha: 0.9 * alpha,
      strokeAlpha: 0.56 * alpha,
      radius: 14
    });
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

    this.uiGraphics.fillStyle(0x040203, 0.32 * alpha);
    this.uiGraphics.fillRoundedRect(panel.x + 4, panel.y + 8, panel.width, panel.height, 28);
    this.uiGraphics.fillStyle(0x0a0c11, 0.95 * alpha);
    this.uiGraphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 28);
    this.uiGraphics.fillStyle(0x1a141b, 0.96 * alpha);
    this.uiGraphics.fillRoundedRect(panel.x + 3, panel.y + 3, panel.width - 6, panel.height - 6, 24);
    this.uiGraphics.fillStyle(0x4e222d, 0.68 * alpha);
    this.uiGraphics.fillRoundedRect(panel.x + 3, panel.y + 3, panel.width - 6, 28, 24);
    this.uiGraphics.fillStyle(0xf4ddb0, 0.08 * alpha);
    this.uiGraphics.fillRoundedRect(panel.x + 28, panel.y + 12, panel.width - 56, 6, 3);
    this.uiGraphics.lineStyle(2, 0xe2c27f, 0.5 * alpha);
    this.uiGraphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, 28);
    this.uiGraphics.lineStyle(1, 0x7d5141, 0.42 * alpha);
    this.uiGraphics.strokeRoundedRect(panel.x + 3, panel.y + 3, panel.width - 6, panel.height - 6, 24);
    this.uiGraphics.lineStyle(1, 0xe2c27f, 0.24 * alpha);
    this.uiGraphics.lineBetween(panel.x + 42, panel.y + 64, panel.right - 42, panel.y + 64);
    this.uiGraphics.lineBetween(panel.x + 42, panel.bottom - 28, panel.right - 42, panel.bottom - 28);
  }

  private drawDetailPlaque(focusUnit: BattleUnit | null): void {
    if (!this.showDetailPanel) {
      return;
    }

    this.drawUiPlaqueShell(this.uiGraphics, this.uiPanels.topRight, {
      accentColor: 0x6a2f47,
      headerHeight: UI_PLAQUE_HEADER_HEIGHT,
      radius: UI_PLAQUE_RADIUS,
      headerAlpha: 0.62,
      sideRuleAlpha: 0.18,
      dividerAlpha: 0.32
    });

    if (this.detailBodyBoxBounds.width > 0 && this.detailBodyBoxBounds.height > 0) {
      this.drawUiInsetBox(this.uiGraphics, this.detailBodyBoxBounds, {
        fillAlpha: 0.9,
        strokeAlpha: 0.24,
        radius: UI_INSET_RADIUS
      });
    }

    const badgeBounds = this.activeBadge.getBounds();
    Phaser.Geom.Rectangle.Inflate(badgeBounds, 12, 6);
    const badgeFill = focusUnit
      ? focusUnit.team === 'player'
        ? 0x1d4644
        : 0x5a2434
      : this.hoverTile
        ? 0x56462c
        : 0x2f3044;
    this.drawUiPill(this.uiGraphics, badgeBounds, {
      fillColor: badgeFill,
      strokeColor: 0xd5ba7a,
      fillAlpha: 0.94,
      strokeAlpha: 0.38,
      radius: 12
    });

    for (const text of this.detailStatTexts) {
      if (!text.text) {
        continue;
      }

      const chip = text.getBounds();
      const chipBounds = new Phaser.Geom.Rectangle(
        chip.x - 8,
        chip.y - 4,
        Math.max(74, chip.width + 16),
        chip.height + 8
      );
      this.drawUiInsetBox(this.uiGraphics, chipBounds, {
        fillAlpha: 0.86,
        strokeAlpha: 0.2,
        radius: 10
      });
    }

    if (focusUnit && this.detailHealthBarBounds.width > 0) {
      const barFill = focusUnit.team === 'player' ? 0x61d7c7 : 0xe8898f;
      this.drawUiInsetBox(this.uiGraphics, this.detailHealthBarBounds, {
        fillColor: 0x1a0d10,
        fillAlpha: 0.92,
        strokeAlpha: 0.2,
        radius: 6
      });
      this.uiGraphics.fillStyle(barFill, 0.95);
      this.uiGraphics.fillRoundedRect(
        this.detailHealthBarBounds.x + 2,
        this.detailHealthBarBounds.y + 2,
        Math.max(6, (this.detailHealthBarBounds.width - 4) * (focusUnit.hp / focusUnit.maxHp)),
        this.detailHealthBarBounds.height - 4,
        4
      );
    }
  }

  private drawUiPlaqueShell(
    graphics: Phaser.GameObjects.Graphics,
    panel: Phaser.Geom.Rectangle,
    {
      accentColor,
      alpha = 1,
      headerHeight = UI_PLAQUE_HEADER_HEIGHT,
      radius = UI_PLAQUE_RADIUS,
      headerAlpha = 0.54,
      sideRuleAlpha = 0.24,
      shineAlpha = 0.08,
      dividerAlpha = 0.24
    }: UiPlaqueShellOptions
  ): void {
    graphics.fillStyle(0x040203, 0.32 * alpha);
    graphics.fillRoundedRect(panel.x + 4, panel.y + 6, panel.width, panel.height, radius);
    graphics.fillStyle(0x0b1018, 0.96 * alpha);
    graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    graphics.fillStyle(0x17131d, 0.96 * alpha);
    graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    graphics.fillStyle(accentColor, headerAlpha * alpha);
    graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, Math.min(headerHeight, panel.height - 4), Math.max(8, radius - 2));
    graphics.fillStyle(accentColor, sideRuleAlpha * alpha);
    graphics.fillRoundedRect(panel.x + 6, panel.y + 10, 8, panel.height - 20, 4);
    graphics.fillStyle(0xf4ddb0, shineAlpha * alpha);
    graphics.fillRoundedRect(panel.x + 18, panel.y + 9, panel.width - 36, 6, 3);
    graphics.lineStyle(2, 0xd5ba7a, 0.42 * alpha);
    graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    graphics.lineStyle(1, accentColor, 0.34 * alpha);
    graphics.strokeRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    graphics.lineStyle(1, accentColor, dividerAlpha * alpha);
    graphics.lineBetween(panel.x + 18, panel.y + headerHeight, panel.right - 18, panel.y + headerHeight);
  }

  private drawUiInsetBox(
    graphics: Phaser.GameObjects.Graphics,
    bounds: Phaser.Geom.Rectangle,
    {
      fillColor = 0x22151a,
      fillAlpha = 0.86,
      strokeColor = 0xd5ba7a,
      strokeAlpha = 0.2,
      radius = UI_INSET_RADIUS
    }: UiInsetBoxOptions = {}
  ): void {
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    graphics.lineStyle(1, strokeColor, strokeAlpha);
    graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
  }

  private drawUiPill(
    graphics: Phaser.GameObjects.Graphics,
    bounds: Phaser.Geom.Rectangle,
    {
      fillColor,
      strokeColor,
      fillAlpha = 0.92,
      strokeAlpha = 0.4,
      radius = 12
    }: UiPillOptions
  ): void {
    graphics.fillStyle(fillColor, fillAlpha);
    graphics.fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
    graphics.lineStyle(1, strokeColor, strokeAlpha);
    graphics.strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, radius);
  }

  private drawUiPanelShell(
    graphics: Phaser.GameObjects.Graphics,
    panel: Phaser.Geom.Rectangle,
    alpha = 1,
    headerHeight = 34,
    radius = 20,
    accentColor = 0x5a3a2d
  ): void {
    graphics.fillStyle(0x040203, 0.32 * alpha);
    graphics.fillRoundedRect(panel.x + 4, panel.y + 6, panel.width, panel.height, radius);
    graphics.fillStyle(0x0b1018, 0.96 * alpha);
    graphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    graphics.fillStyle(0x17131d, 0.96 * alpha);
    graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    graphics.fillStyle(accentColor, 0.54 * alpha);
    graphics.fillRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, Math.min(headerHeight, panel.height - 4), Math.max(8, radius - 2));
    graphics.fillStyle(accentColor, 0.24 * alpha);
    graphics.fillRoundedRect(panel.x + 6, panel.y + 10, 8, panel.height - 20, 4);
    graphics.fillStyle(0xf4ddb0, 0.08 * alpha);
    graphics.fillRoundedRect(panel.x + 18, panel.y + 9, panel.width - 36, 6, 3);
    graphics.lineStyle(2, 0xd5ba7a, 0.42 * alpha);
    graphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, radius);
    graphics.lineStyle(1, accentColor, 0.34 * alpha);
    graphics.strokeRoundedRect(panel.x + 2, panel.y + 2, panel.width - 4, panel.height - 4, Math.max(8, radius - 2));
    graphics.lineStyle(1, accentColor, 0.24 * alpha);
    graphics.lineBetween(panel.x + 18, panel.y + headerHeight, panel.right - 18, panel.y + headerHeight);
  }

  private setDetailStatValues(values: string[]): void {
    for (const [index, text] of this.detailStatTexts.entries()) {
      const value = values[index] ?? '';
      text.setText(value).setVisible(this.showDetailPanel && value.length > 0);
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

  private getHoveredUnit(): BattleUnit | null {
    if (this.hoveredTurnOrderUnitId) {
      return this.units.find((unit) => unit.alive && unit.id === this.hoveredTurnOrderUnitId) ?? null;
    }

    if (!this.hoverTile) {
      return null;
    }

    return (
      this.units.find(
        (unit) => unit.alive && unit.x === this.hoverTile?.x && unit.y === this.hoverTile?.y
      ) ?? null
    );
  }

  private getDetailFocusUnit(): BattleUnit | null {
    const hoveredUnit = this.getHoveredUnit();
    if (hoveredUnit) {
      return hoveredUnit;
    }

    if (this.hoverTile) {
      return null;
    }

    return this.getActiveUnit();
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
    const maxWidth = Math.max(24, panelWidth - 24);
    const maxHeight = Math.max(24, panelHeight - 24);
    const frameWidth = Math.max(1, frame.width);
    const frameHeight = Math.max(1, frame.height);

    let widthScale = maxWidth / frameWidth;
    let heightScale = maxHeight / frameHeight;

    switch (kind) {
      case 'unit':
        heightScale = Math.max(82, panelHeight - 28) / frameHeight;
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
        widthScale *= 0.92;
        heightScale *= 0.72;
        break;
    }

    const scale = Math.max(0.01, Math.min(widthScale, heightScale));
    this.portrait
      .setOrigin(0.5, 0.5)
      .setScale(scale)
      .setVisible(this.showPortraitPanel);
  }

  private getActiveUnit(): BattleUnit | null {
    if (!this.activeUnitId) {
      return null;
    }

    return this.units.find((unit) => unit.id === this.activeUnitId && unit.alive) ?? null;
  }

  private setHoveredTurnOrderUnitId(unitId: string | null): void {
    if (this.hoveredTurnOrderUnitId === unitId) {
      return;
    }

    this.hoveredTurnOrderUnitId = unitId;
    this.refreshUi();
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
