import Phaser from 'phaser';
import { audioDirector } from '../audio/audioDirector';
import { calculateDamage, pickNextActor, projectTurnOrder } from '../core/combat';
import { getInventoryEntries, getItemDefinition, ItemId } from '../core/items';
import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from '../core/mapData';
import { buildPath, getReachableNodes, getTile, manhattanDistance, pointKey } from '../core/pathfinding';
import { AttackStyle, BattleUnit, IdleStyle, Point, ReachNode, TerrainType, TileData, UnitAbility } from '../core/types';
import { createLevelMap, createLevelUnits, CURRENT_LEVEL, getLevel } from '../levels';
import { ChestPlacement, LevelDefinition, MapPropAssetId, MapPropPlacement } from '../levels/types';

type Phase =
  | 'intro'
  | 'player-menu'
  | 'player-abilities'
  | 'player-move'
  | 'player-action'
  | 'player-items'
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
}

type PanKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

const ROTATION_STEP_DEGREES = 90;
const DEFAULT_BOARD_ZOOM = 1;
const MIN_BOARD_ZOOM = 0.72;
const MAX_BOARD_ZOOM = 1.8;
const BOARD_ZOOM_SENSITIVITY = 0.00055;
const CHEST_DISPLAY_WIDTH = 47;
const CHEST_GROUND_OFFSET_Y = TILE_HEIGHT / 2 - 15;

const UI_PANELS = {
  topLeft: new Phaser.Geom.Rectangle(20, 18, 336, 132),
  bottomLeft: new Phaser.Geom.Rectangle(20, 514, 336, 186),
  topRight: new Phaser.Geom.Rectangle(904, 18, 356, 218),
  bottomRight: new Phaser.Geom.Rectangle(904, 514, 356, 186),
  portrait: new Phaser.Geom.Rectangle(1098, 58, 146, 150)
} as const;

const ACTION_MENU_PANELS = {
  root: new Phaser.Geom.Rectangle(904, 514, 136, 146),
  sub: new Phaser.Geom.Rectangle(1026, 514, 234, 186)
} as const;

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
  private submenuUiGraphics!: Phaser.GameObjects.Graphics;
  private turnOrderTexts: Phaser.GameObjects.Text[] = [];
  private headerText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private autoBattleToggleText!: Phaser.GameObjects.Text;
  private detailTitleText!: Phaser.GameObjects.Text;
  private detailBodyText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private activeBadge!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private menuTitleText!: Phaser.GameObjects.Text;
  private submenuTitleText!: Phaser.GameObjects.Text;
  private menuBodyText!: Phaser.GameObjects.Text;
  private menuHintText!: Phaser.GameObjects.Text;
  private actionMenuTexts: Phaser.GameObjects.Text[] = [];
  private submenuTexts: Phaser.GameObjects.Text[] = [];
  private activeUnitId: string | null = null;
  private selectedAbilityId: string | null = null;
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
  private actionMenuAlpha = 0;
  private actionMenuVisible = false;
  private actionMenuTween?: Phaser.Tweens.Tween;
  private submenuPanelX = ACTION_MENU_PANELS.sub.x - 24;
  private submenuPanelAlpha = 0;
  private submenuOpen = false;
  private submenuTween?: Phaser.Tweens.Tween;
  private autoBattleEnabled = false;
  private timeOfDay: TimeOfDayId = 'dusk';
  private restarting = false;
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

    this.backdropImage = this.add.image(640, 360, 'title-backdrop').setDisplaySize(1600, 960).setScrollFactor(0);
    this.backdropShade = this.add.rectangle(640, 360, 1600, 960, 0x12070d, 0.58).setScrollFactor(0);
    this.createLightTexture();

    this.boardGraphics = this.add.graphics();
    this.lightShadowGraphics = this.add.graphics();
    this.highlightGraphics = this.add.graphics();
    this.uiGraphics = this.add.graphics();
    this.submenuUiGraphics = this.add.graphics();
    this.boardGraphics.setDepth(40);
    this.lightShadowGraphics.setDepth(45);
    this.highlightGraphics.setDepth(90);
    this.uiGraphics.setDepth(860).setScrollFactor(0);
    this.submenuUiGraphics.setDepth(900).setScrollFactor(0);
    this.ambientOverlay = this.add
      .rectangle(640, 360, 1600, 960, 0x102746, 0)
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
    this.registerInputs();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.pushLog('Dawn Company engages the Ashen Host on the ruined ridge.');
    this.pushLog('Take the crest and cut down the enemy casters first.');
    this.refreshUi();

    this.time.delayedCall(750, () => {
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
      if (pointer.button === 1 || pointer.button === 2) {
        this.beginPan(pointer);
        return;
      }

      void this.handlePointerDown(pointer);
    });
    this.input.on('pointerup', () => {
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

  private handleShutdown(): void {
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
    this.actionMenuTween?.stop();
    this.submenuTween?.stop();
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.isPanning = false;
    this.restarting = false;
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
      this.submenuUiGraphics,
      this.headerText,
      this.objectiveText,
      this.phaseText,
      this.autoBattleToggleText,
      this.detailTitleText,
      this.detailBodyText,
      this.logText,
      this.activeBadge,
      this.portrait,
      this.menuTitleText,
      this.submenuTitleText,
      this.menuBodyText,
      this.menuHintText,
      ...this.turnOrderTexts,
      ...this.actionMenuTexts,
      ...this.submenuTexts
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
        openBaseY: openSprite.y
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
    this.headerText = this.add.text(UI_PANELS.topLeft.x + 16, UI_PANELS.topLeft.y + 12, this.level.name, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '27px',
      fontStyle: 'bold',
      color: '#fff2d2'
    });

    this.objectiveText = this.add.text(UI_PANELS.topLeft.x + 16, UI_PANELS.topLeft.y + 46, this.level.objective, {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '16px',
      color: '#d7c7a3',
      wordWrap: { width: UI_PANELS.topLeft.width - 34 }
    });

    this.phaseText = this.add.text(UI_PANELS.topLeft.x + 16, UI_PANELS.topLeft.y + 102, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '18px',
      color: '#f1d79a'
    });

    this.autoBattleToggleText = this.add.text(UI_PANELS.topLeft.right - 16, UI_PANELS.topLeft.y + 16, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#d8c8a5'
    });
    this.autoBattleToggleText.setOrigin(1, 0);

    this.turnOrderTexts = Array.from({ length: 6 }, (_, index) =>
      this.add.text(UI_PANELS.bottomLeft.x + 16, UI_PANELS.bottomLeft.y + 92 + index * 15, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '13px',
        color: '#eedfba'
      })
    );

    this.activeBadge = this.add.text(UI_PANELS.topRight.x + 16, UI_PANELS.topRight.y + 14, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f7edc4'
    });

    this.portrait = this.add
      .image(UI_PANELS.portrait.centerX, UI_PANELS.portrait.centerY + 6, 'holy-knight')
      .setVisible(false)
      .setScale(0.24);

    this.detailTitleText = this.add.text(UI_PANELS.topRight.x + 16, UI_PANELS.topRight.y + 42, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '23px',
      fontStyle: 'bold',
      color: '#fff2d2',
      wordWrap: { width: 150 }
    });

    this.detailBodyText = this.add.text(UI_PANELS.topRight.x + 16, UI_PANELS.topRight.y + 104, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '15px',
      color: '#d8c8a5',
      lineSpacing: 4,
      wordWrap: { width: 164 }
    });

    this.logText = this.add.text(UI_PANELS.bottomLeft.x + 16, UI_PANELS.bottomLeft.y + 22, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '14px',
      color: '#e8dbba',
      lineSpacing: 4,
      wordWrap: { width: UI_PANELS.bottomLeft.width - 32 }
    });

    this.menuTitleText = this.add.text(ACTION_MENU_PANELS.root.x + 12, ACTION_MENU_PANELS.root.y + 12, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fff2d2'
    });

    this.actionMenuTexts = Array.from({ length: 6 }, (_, index) =>
      this.add.text(ACTION_MENU_PANELS.root.x + 12, ACTION_MENU_PANELS.root.y + 48 + index * 22, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '14px',
        color: '#e8dbba'
      })
    );

    this.submenuTitleText = this.add.text(ACTION_MENU_PANELS.sub.x + 14, ACTION_MENU_PANELS.sub.y + 12, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fff2d2'
    });

    this.submenuTexts = Array.from({ length: 6 }, (_, index) =>
      this.add.text(ACTION_MENU_PANELS.sub.x + 18, ACTION_MENU_PANELS.sub.y + 50 + index * 22, '', {
        fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
        fontSize: '15px',
        color: '#f2e3ba'
      })
    );

    this.menuBodyText = this.add.text(ACTION_MENU_PANELS.sub.x + 14, ACTION_MENU_PANELS.sub.y + 104, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '12px',
      color: '#d8c8a5',
      lineSpacing: 3,
      wordWrap: { width: ACTION_MENU_PANELS.sub.width - 28 }
    });

    this.menuHintText = this.add.text(ACTION_MENU_PANELS.sub.x + 14, ACTION_MENU_PANELS.sub.bottom - 22, '', {
      fontFamily: '"Palatino Linotype", "Book Antiqua", serif',
      fontSize: '12px',
      color: '#cdbd95'
    });

    const uiElements = [
      this.headerText,
      this.objectiveText,
      this.phaseText,
      this.autoBattleToggleText,
      this.activeBadge,
      this.portrait,
      this.detailTitleText,
      this.detailBodyText,
      this.logText,
      this.menuTitleText,
      ...this.actionMenuTexts,
      ...this.turnOrderTexts
    ];

    for (const [index, element] of uiElements.entries()) {
      element.setDepth(870 + index).setScrollFactor(0);
    }

    const submenuElements = [
      this.submenuTitleText,
      this.menuBodyText,
      this.menuHintText,
      ...this.submenuTexts
    ];

    for (const [index, element] of submenuElements.entries()) {
      element.setDepth(910 + index).setScrollFactor(0);
    }

    this.applyActionMenuAlpha();
    this.layoutSubmenuUi();
  }

  private configureCamera(centerOnBoard = false): void {
    const camera = this.getWorldCamera();
    const boardBounds = this.getBoardBounds();
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

    if (centerOnBoard) {
      camera.centerOn(boardBounds.centerX, boardBounds.centerY + 24);
    }

    this.setBoardScroll(camera.scrollX, camera.scrollY);
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
    view.openSprite.setVisible(true).setAlpha(1).setY(view.openBaseY).setScale(1.02);
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
        scaleX: 1.06,
        scaleY: 1.06,
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
    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;
    const maxScrollX = this.cameraBounds.right - visibleWidth;
    const maxScrollY = this.cameraBounds.bottom - visibleHeight;
    const resolvedScrollX =
      maxScrollX <= this.cameraBounds.x
        ? this.cameraBounds.centerX - visibleWidth / 2
        : Phaser.Math.Clamp(scrollX, this.cameraBounds.x, maxScrollX);
    const resolvedScrollY =
      maxScrollY <= this.cameraBounds.y
        ? this.cameraBounds.centerY - visibleHeight / 2
        : Phaser.Math.Clamp(scrollY, this.cameraBounds.y, maxScrollY);

    camera.setScroll(resolvedScrollX, resolvedScrollY);
  }

  private zoomBoard(deltaY: number, screenX: number, screenY: number): void {
    if (deltaY === 0) {
      return;
    }

    const camera = this.getWorldCamera();
    const zoomFactor = Math.exp(-deltaY * BOARD_ZOOM_SENSITIVITY);
    const nextZoom = Phaser.Math.Clamp(
      camera.zoom * zoomFactor,
      MIN_BOARD_ZOOM,
      MAX_BOARD_ZOOM
    );

    if (Math.abs(nextZoom - camera.zoom) < 0.001) {
      return;
    }

    const worldPointBefore = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(nextZoom);
    const worldPointAfter = camera.getWorldPoint(screenX, screenY);

    this.setBoardScroll(
      camera.scrollX + (worldPointBefore.x - worldPointAfter.x),
      camera.scrollY + (worldPointBefore.y - worldPointAfter.y)
    );

    const anchoredWorldPoint = camera.getWorldPoint(screenX, screenY);
    this.hoverTile = this.pickTile(anchoredWorldPoint.x, anchoredWorldPoint.y);
    this.drawHighlights();
    this.refreshUi();
  }

  private isPointerOverUi(x: number, y: number): boolean {
    const staticPanels = [
      UI_PANELS.topLeft,
      UI_PANELS.bottomLeft,
      UI_PANELS.topRight,
      UI_PANELS.portrait
    ];

    if (staticPanels.some((panel) => panel.contains(x, y))) {
      return true;
    }

    if (this.actionMenuAlpha > 0.01 && ACTION_MENU_PANELS.root.contains(x, y)) {
      return true;
    }

    if (!this.isSubmenuPhase() && this.getSubmenuVisibleAlpha() <= 0.01) {
      return false;
    }

    return this.getSubmenuVisibleAlpha() > 0.01 && new Phaser.Geom.Rectangle(
      this.submenuPanelX,
      ACTION_MENU_PANELS.sub.y,
      ACTION_MENU_PANELS.sub.width,
      ACTION_MENU_PANELS.sub.height
    ).contains(x, y);
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

  private isSubmenuPhase(phase = this.phase): boolean {
    return phase === 'player-abilities' || phase === 'player-action' || phase === 'player-items';
  }

  private isPlayerTurnPhase(phase = this.phase): boolean {
    return (
      phase === 'player-menu' ||
      phase === 'player-abilities' ||
      phase === 'player-move' ||
      phase === 'player-action' ||
      phase === 'player-items'
    );
  }

  private shouldShowActionMenu(): boolean {
    const activeUnit = this.getActiveUnit();
    return !!activeUnit && activeUnit.team === 'player' && this.isPlayerTurnPhase();
  }

  private getSubmenuVisibleAlpha(): number {
    return this.submenuPanelAlpha * this.actionMenuAlpha;
  }

  private applyActionMenuAlpha(): void {
    const alpha = this.actionMenuAlpha;
    const visible = alpha > 0.01;

    this.menuTitleText.setAlpha(alpha).setVisible(visible);

    for (const text of this.actionMenuTexts) {
      text.setAlpha(alpha).setVisible(visible);
    }

    this.drawUiPanels();
    this.layoutSubmenuUi();
  }

  private syncActionMenuState(): void {
    const shouldOpen = this.shouldShowActionMenu();

    if (shouldOpen !== this.actionMenuVisible) {
      this.animateActionMenu(shouldOpen);
    } else {
      this.applyActionMenuAlpha();
    }

    this.syncSubmenuState();
  }

  private animateActionMenu(open: boolean): void {
    this.actionMenuVisible = open;
    this.actionMenuTween?.stop();

    const targetAlpha = open ? 1 : 0;

    if (!open && this.actionMenuAlpha <= 0.01) {
      this.actionMenuAlpha = 0;
      this.applyActionMenuAlpha();
      return;
    }

    this.actionMenuTween = this.tweens.add({
      targets: this,
      actionMenuAlpha: targetAlpha,
      duration: open ? 180 : 120,
      ease: open ? 'Cubic.easeOut' : 'Quad.easeIn',
      onUpdate: () => this.applyActionMenuAlpha(),
      onComplete: () => {
        if (!open) {
          this.actionMenuAlpha = 0;
        }

        this.applyActionMenuAlpha();
      }
    });
  }

  private syncSubmenuState(): void {
    const shouldOpen = this.isSubmenuPhase();

    if (shouldOpen !== this.submenuOpen) {
      this.animateSubmenu(shouldOpen);
      return;
    }

    this.layoutSubmenuUi();
  }

  private animateSubmenu(open: boolean): void {
    this.submenuOpen = open;
    this.submenuTween?.stop();

    const closedX = ACTION_MENU_PANELS.sub.x - 26;
    const targetX = open ? ACTION_MENU_PANELS.sub.x : closedX;
    const targetAlpha = open ? 1 : 0;

    if (!open && this.submenuPanelAlpha <= 0.01) {
      this.submenuPanelX = closedX;
      this.submenuPanelAlpha = 0;
      this.layoutSubmenuUi();
      return;
    }

    this.submenuTween = this.tweens.add({
      targets: this,
      submenuPanelX: targetX,
      submenuPanelAlpha: targetAlpha,
      duration: open ? 180 : 120,
      ease: open ? 'Cubic.easeOut' : 'Quad.easeIn',
      onUpdate: () => this.layoutSubmenuUi(),
      onComplete: () => {
        if (!open) {
          this.submenuPanelX = closedX;
          this.submenuPanelAlpha = 0;
        }

        this.layoutSubmenuUi();
      }
    });
  }

  private layoutSubmenuUi(): void {
    const alpha = this.getSubmenuVisibleAlpha();
    const visible = alpha > 0.01;
    const submenuEntries = this.getSubmenuEntries();
    const submenuInfoY =
      submenuEntries.length > 0
        ? ACTION_MENU_PANELS.sub.y + 56 + Math.min(submenuEntries.length, 4) * 22
        : ACTION_MENU_PANELS.sub.y + 54;

    this.submenuUiGraphics.clear();

    if (visible) {
      this.submenuUiGraphics.fillStyle(0x18100d, 0.96 * alpha);
      this.submenuUiGraphics.fillRoundedRect(
        this.submenuPanelX,
        ACTION_MENU_PANELS.sub.y,
        ACTION_MENU_PANELS.sub.width,
        ACTION_MENU_PANELS.sub.height,
        16
      );
      this.submenuUiGraphics.lineStyle(2, 0xd5ba7a, 0.34 * alpha);
      this.submenuUiGraphics.strokeRoundedRect(
        this.submenuPanelX,
        ACTION_MENU_PANELS.sub.y,
        ACTION_MENU_PANELS.sub.width,
        ACTION_MENU_PANELS.sub.height,
        16
      );
      this.submenuUiGraphics.lineStyle(1, 0xd5ba7a, 0.18 * alpha);
      this.submenuUiGraphics.lineBetween(
        this.submenuPanelX + 12,
        ACTION_MENU_PANELS.sub.y + 40,
        this.submenuPanelX + ACTION_MENU_PANELS.sub.width - 12,
        ACTION_MENU_PANELS.sub.y + 40
      );
    }

    this.submenuTitleText.setPosition(this.submenuPanelX + 14, ACTION_MENU_PANELS.sub.y + 12).setAlpha(alpha).setVisible(visible);
    this.menuBodyText.setPosition(this.submenuPanelX + 14, submenuInfoY).setAlpha(alpha).setVisible(visible);
    this.menuHintText.setPosition(this.submenuPanelX + 14, ACTION_MENU_PANELS.sub.bottom - 22).setAlpha(alpha).setVisible(visible);

    for (const [index, text] of this.submenuTexts.entries()) {
      text
        .setPosition(this.submenuPanelX + 18, ACTION_MENU_PANELS.sub.y + 50 + index * 22)
        .setAlpha(alpha)
        .setVisible(visible);
    }
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

    if (this.phase === 'player-items') {
      return getInventoryEntries(this.getUnitInventory(activeUnit)).map((entry) => ({
        label: `${getItemDefinition(entry.itemId).name} x${entry.count}`,
        enabled: true,
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

    const entries = this.getMenuEntries();
    const submenuEntries = this.getSubmenuEntries();
    const submenuBounds = new Phaser.Geom.Rectangle(
      this.submenuPanelX,
      ACTION_MENU_PANELS.sub.y,
      ACTION_MENU_PANELS.sub.width,
      ACTION_MENU_PANELS.sub.height
    );

    if (this.getSubmenuVisibleAlpha() > 0.01 && submenuBounds.contains(x, y)) {
      for (const [index, entry] of submenuEntries.entries()) {
        if (this.submenuTexts[index].getBounds().contains(x, y)) {
          if (entry.enabled) {
            await this.activateSubmenuEntry(entry);
          }

          return true;
        }
      }

      return this.isSubmenuPhase();
    }

    if (this.actionMenuAlpha > 0.01 && ACTION_MENU_PANELS.root.contains(x, y)) {
      for (const [index, entry] of entries.entries()) {
        if (this.actionMenuTexts[index].getBounds().contains(x, y)) {
          if (entry.enabled) {
            await this.activateMenuEntry(entry);
          }

          return true;
        }
      }
    }

    return false;
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
        this.phase = 'player-move';
        this.pushLog(`Choose a tile for ${activeUnit.name}.`);
        this.drawHighlights();
        this.refreshUi();
        return;
      case 'abilities':
        audioDirector.playUiConfirm();
        this.phase = 'player-abilities';
        this.selectedAbilityId = null;
        this.pushLog(`Choose an ability for ${activeUnit.name}.`);
        this.drawHighlights();
        this.refreshUi();
        return;
      case 'items':
        audioDirector.playUiConfirm();
        this.phase = 'player-items';
        this.selectedAbilityId = null;
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
      audioDirector.playUiConfirm();
      await this.useItem(entry.itemId);
      return;
    }

    if (entry.abilityId) {
      const ability = activeUnit.abilities.find((candidate) => candidate.id === entry.abilityId);

      if (!ability) {
        return;
      }

      this.selectedAbilityId = ability.id;
      audioDirector.playUiConfirm();
      this.phase = 'player-action';
      this.pushLog(`Choose a target for ${ability.name}.`);
      this.drawHighlights();
      this.refreshUi();
    }
  }

  private async useItem(itemId: ItemId): Promise<void> {
    const activeUnit = this.getActiveUnit();
    const item = getItemDefinition(itemId);
    const count = activeUnit ? this.getUnitInventory(activeUnit)[itemId] ?? 0 : 0;

    if (!activeUnit || count <= 0) {
      return;
    }

    switch (item.effect.kind) {
      case 'heal': {
        if (activeUnit.hp >= activeUnit.maxHp) {
          audioDirector.playUiCancel();
          this.pushLog(`${activeUnit.name} is already at full health.`);
          this.refreshUi();
          return;
        }

        const recovered = Math.min(item.effect.amount, activeUnit.maxHp - activeUnit.hp);
        activeUnit.hp += recovered;
        this.consumeItemFromUnit(activeUnit, itemId, 1);
        this.turnActionUsed = true;
        this.positionUnit(activeUnit);
        audioDirector.playHeal();
        this.pushLog(`${activeUnit.name} uses ${item.name} and recovers ${recovered} HP.`);
        await this.finishPlayerCommand(activeUnit, `${activeUnit.name} can still move this turn.`);
        return;
      }
      case 'ct':
        activeUnit.ct += item.effect.amount;
        this.consumeItemFromUnit(activeUnit, itemId, 1);
        this.turnActionUsed = true;
        audioDirector.playUiConfirm();
        this.pushLog(`${activeUnit.name} uses ${item.name} and gains ${item.effect.amount} CT.`);
        await this.finishPlayerCommand(activeUnit, `${activeUnit.name} can still move this turn.`);
        return;
      default:
        return;
    }
  }

  private async handlePointerDown(pointer: Phaser.Input.Pointer): Promise<void> {
    if (this.busy || this.phase === 'complete') {
      return;
    }

    if (this.autoBattleToggleText.getBounds().contains(pointer.x, pointer.y)) {
      await this.toggleAutoBattle();
      return;
    }

    if (await this.handleMenuPointer(pointer.x, pointer.y)) {
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
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (this.phase === 'player-abilities') {
      audioDirector.playUiCancel();
      this.phase = 'player-menu';
      this.selectedAbilityId = null;
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    if (this.phase === 'player-move') {
      audioDirector.playUiCancel();
      this.phase = 'player-menu';
      this.selectedAbilityId = null;
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
            void this.executeAutoBattleTurn(actor);
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

  private async executeAutoBattleTurn(actor: BattleUnit): Promise<void> {
    if (!actor.alive || actor.team !== 'player' || this.phase === 'complete') {
      return;
    }

    let safety = 0;

    while (
      safety < 3 &&
      actor.alive &&
      this.getActiveUnit()?.id === actor.id &&
      this.isPlayerTurnPhase()
    ) {
      safety += 1;

      if (!this.turnActionUsed) {
        const plannedItem = this.chooseAutoBattleItem(actor);

        if (plannedItem) {
          await this.useItem(plannedItem);
          continue;
        }

        const actionPlan = this.chooseAutoBattleActionPlan(actor);

        if (actionPlan) {
          if (!this.turnMoveUsed && (actionPlan.moveTile.x !== actor.x || actionPlan.moveTile.y !== actor.y)) {
            const moveTile = getTile(this.map, actionPlan.moveTile.x, actionPlan.moveTile.y);

            if (moveTile) {
              await this.handlePlayerMove(moveTile);

              if (this.getActiveUnit()?.id !== actor.id || !actor.alive) {
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
    audioDirector.playUiConfirm();
    this.pushLog(`Auto-Battle ${this.autoBattleEnabled ? 'enabled' : 'disabled'}.`);
    this.refreshUi();

    const activeUnit = this.getActiveUnit();

    if (
      this.autoBattleEnabled &&
      activeUnit &&
      activeUnit.team === 'player' &&
      this.phase === 'player-menu' &&
      !this.busy
    ) {
      await this.executeAutoBattleTurn(activeUnit);
    }
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

    for (const step of path) {
      const tile = getTile(this.map, step.x, step.y);

      if (!tile) {
        continue;
      }

      const destination = this.isoToScreen(tile);
      const startDepth = view.container.depth;
      const destinationDepth = this.getUnitDepth(tile);
      audioDirector.playStep();

      await new Promise<void>((resolve) => {
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

    if (!this.turnMoveUsed) {
      this.moveNodes = getReachableNodes(this.map, activeUnit, this.units, this.getBlockedPropPoints());
    }

    this.phase = 'player-menu';
    this.pushLog(pendingMoveMessage);
    this.drawHighlights();
    this.refreshUi();
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
    this.emitImpactBurst(impactPoint.x, impactPoint.y, strikeAttacker.attackStyle);

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

  private emitImpactBurst(x: number, y: number, attackStyle: AttackStyle): void {
    const tintMap: Record<AttackStyle, number[]> = {
      'blade-arc': [0xfff3b9, 0xf0cc70, 0xffdca0],
      'arrow-flight': [0xcdf6ff, 0x88f1f7, 0xffffff],
      'ember-burst': [0xfff1b3, 0xf4934f, 0xd84a2f],
      'grave-cleave': [0xe6afa5, 0xb75c5c, 0xeadac2],
      'feather-shot': [0xe4d6ff, 0xb17ebb, 0xc7c7d7],
      'ash-hex': [0xffd5a6, 0xee8c7d, 0x73605f]
    };
    const particles = this.registerWorldObject(this.add.particles(x, y, 'spark', {
      speed: { min: 34, max: 168 },
      lifespan: 360,
      quantity: attackStyle === 'ash-hex' ? 20 : 14,
      scale: { start: 1.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: tintMap[attackStyle],
      blendMode: attackStyle === 'grave-cleave' ? 'NORMAL' : 'ADD',
      emitting: false
    }));

    particles.setDepth(961);
    particles.explode(attackStyle === 'ash-hex' ? 18 : 12, x, y);
    this.time.delayedCall(420, () => particles.destroy());
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

    this.registerUiObject(this.add.rectangle(640, 360, 1280, 720, 0x090407, 0.62).setDepth(1000).setScrollFactor(0));
    this.registerUiObject(this.add
      .text(640, 280, result.toUpperCase(), {
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
    this.registerUiObject(this.add
      .text(
        640,
        376,
        result === 'Victory'
          ? 'The chapel ridge is yours. Press R to battle again or Esc for the title.'
          : 'The Ashen Host holds the altar. Press R to try again or Esc for the title.',
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
  }

  private refreshUi(): void {
    this.drawUiPanels();

    this.phaseText.setText(`${TIME_OF_DAY_CONFIG[this.timeOfDay].label} | ${this.describePhase()}`);
    this.activeBadge.setText(this.getActiveUnit() ? 'Active Unit' : 'Battleflow');
    this.autoBattleToggleText
      .setText(`Auto ${this.autoBattleEnabled ? 'ON' : 'OFF'}`)
      .setColor(this.autoBattleEnabled ? '#fff1bc' : '#bca982');

    const queue = projectTurnOrder(this.units, 6);

    for (const [index, text] of this.turnOrderTexts.entries()) {
      const unit = queue[index];

      if (!unit) {
        text.setText('');
        continue;
      }

      text.setText(`${index + 1}. ${unit.team === 'player' ? 'Ally' : 'Foe'} ${unit.name}`);
      text.setColor(unit.team === 'player' ? '#c8f0eb' : '#f1b4b4');
    }

    const focusUnit = this.getHoveredUnit() ?? this.getActiveUnit();
    const hoveredChest = this.hoverTile ? this.getChestAt(this.hoverTile.x, this.hoverTile.y) : null;
    const hoveredProp = this.hoverTile ? this.getPropAt(this.hoverTile.x, this.hoverTile.y) : null;

    if (focusUnit) {
      this.portrait.setTexture(focusUnit.spriteKey).setVisible(true);
      this.portrait.displayHeight = 100;
      this.portrait.scaleX = this.portrait.scaleY;
      this.detailTitleText.setText(`${focusUnit.name}\n${focusUnit.className}`);
      this.detailBodyText.setText(
        [
          `${focusUnit.team === 'player' ? 'Ally' : 'Enemy'}  HP ${focusUnit.hp}/${focusUnit.maxHp}`,
          `Move ${focusUnit.move}   Speed ${focusUnit.speed}`,
          `Range ${focusUnit.rangeMin}-${focusUnit.rangeMax}`,
          focusUnit.attackText
        ].join('\n')
      );
    } else if (this.hoverTile) {
      this.portrait.setVisible(false);
      this.detailTitleText.setText(`Tile (${this.hoverTile.x}, ${this.hoverTile.y})`);
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
    } else {
      this.portrait.setVisible(false);
      this.detailTitleText.setText('Battlefield Brief');
      this.detailBodyText.setText(
        [
          'Player turns begin with movement.',
          'Higher tiles boost damage and reduce return fire.',
          'Right-drag or use WASD/arrow keys to pan. Scroll zooms. Q/E rotate the field. T cycles scene lighting.'
        ].join('\n')
      );
    }

    this.logText.setText(this.logLines.slice(0, 3).join('\n'));

    const menuEntries = this.getMenuEntries();
    const currentMenuAction = this.getCurrentMenuAction();
    const selectedAbility = this.getSelectedAbility();

    for (const [index, text] of this.actionMenuTexts.entries()) {
      const entry = menuEntries[index];

      if (!entry) {
        text.setText('');
        continue;
      }

      const active = currentMenuAction === entry.action;
      text.setText(`${active ? '> ' : '  '}${entry.label}`);
      text.setColor(!entry.enabled ? '#8c7e62' : active ? '#fff5cf' : '#f2e3ba');
    }

    const submenuEntries = this.getSubmenuEntries();

    for (const [index, text] of this.submenuTexts.entries()) {
      const entry = submenuEntries[index];

      if (!entry) {
        text.setText('');
        continue;
      }

      const active = !!entry.abilityId && entry.abilityId === selectedAbility?.id;
      text.setText(`${active ? '> ' : '  '}${entry.label}`);
      text.setColor(!entry.enabled ? '#8c7e62' : active ? '#fff5cf' : '#f2e3ba');
    }

    this.menuTitleText.setText(this.getMenuTitle());
    this.submenuTitleText.setText(this.getSubmenuTitle());
    this.menuBodyText.setText(this.getMenuBodyText());
    this.menuHintText.setText(this.getMenuHintText());
    this.syncActionMenuState();
  }

  private drawUiPanels(): void {
    this.uiGraphics.clear();

    const panels = [
      UI_PANELS.topLeft,
      UI_PANELS.bottomLeft,
      UI_PANELS.topRight
    ];

    for (const panel of panels) {
      this.uiGraphics.fillStyle(0x12070d, 0.92);
      this.uiGraphics.fillRoundedRect(panel.x, panel.y, panel.width, panel.height, 20);
      this.uiGraphics.lineStyle(2, 0xd5ba7a, 0.42);
      this.uiGraphics.strokeRoundedRect(panel.x, panel.y, panel.width, panel.height, 20);
    }

    if (this.actionMenuAlpha > 0.01) {
      this.uiGraphics.fillStyle(0x12070d, 0.94 * this.actionMenuAlpha);
      this.uiGraphics.fillRoundedRect(
        ACTION_MENU_PANELS.root.x,
        ACTION_MENU_PANELS.root.y,
        ACTION_MENU_PANELS.root.width,
        ACTION_MENU_PANELS.root.height,
        16
      );
      this.uiGraphics.lineStyle(2, 0xd5ba7a, 0.42 * this.actionMenuAlpha);
      this.uiGraphics.strokeRoundedRect(
        ACTION_MENU_PANELS.root.x,
        ACTION_MENU_PANELS.root.y,
        ACTION_MENU_PANELS.root.width,
        ACTION_MENU_PANELS.root.height,
        16
      );
      this.uiGraphics.lineStyle(1, 0xd5ba7a, 0.22 * this.actionMenuAlpha);
      this.uiGraphics.lineBetween(
        ACTION_MENU_PANELS.root.x + 10,
        ACTION_MENU_PANELS.root.y + 40,
        ACTION_MENU_PANELS.root.right - 10,
        ACTION_MENU_PANELS.root.y + 40
      );
    }

    this.uiGraphics.fillStyle(0x5f2a36, 0.15);
    this.uiGraphics.fillRoundedRect(
      UI_PANELS.portrait.x,
      UI_PANELS.portrait.y,
      UI_PANELS.portrait.width,
      UI_PANELS.portrait.height,
      14
    );
    this.uiGraphics.lineStyle(1, 0xd5ba7a, 0.22);
    this.uiGraphics.strokeRoundedRect(
      UI_PANELS.portrait.x,
      UI_PANELS.portrait.y,
      UI_PANELS.portrait.width,
      UI_PANELS.portrait.height,
      14
    );
  }

  private describePhase(): string {
    const active = this.getActiveUnit();
    const selectedAbility = this.getSelectedAbility();

    switch (this.phase) {
      case 'intro':
        return 'The companies close in on the ridge.';
      case 'player-menu':
        return active ? `${active.name}: choose a command.` : 'Awaiting command.';
      case 'player-abilities':
        return active ? `${active.name}: choose an ability.` : 'Choose an ability.';
      case 'player-move':
        return active ? `${active.name}: choose a tile to reposition.` : 'Choose a unit path.';
      case 'player-action':
        return active && selectedAbility
          ? `${active.name}: choose a ${selectedAbility.target === 'ally' ? 'target ally' : 'target enemy'} for ${selectedAbility.name}.`
          : 'Select a target.';
      case 'player-items':
        return active ? `${active.name}: choose an item.` : 'Select an item.';
      case 'enemy':
        return active ? `${active.name} studies the field.` : 'Enemy turn.';
      case 'animating':
        return 'Steel rings through the chapel ruins.';
      case 'complete':
        return 'The skirmish has ended.';
      default:
        return '';
    }
  }

  private getCurrentMenuAction(): MenuAction | null {
    switch (this.phase) {
      case 'player-abilities':
      case 'player-action':
        return 'abilities';
      case 'player-items':
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

  private getSubmenuTitle(): string {
    switch (this.phase) {
      case 'player-abilities':
      case 'player-action':
        return 'Abilities';
      case 'player-items':
        return 'Items';
      default:
        return '';
    }
  }

  private getMenuBodyText(): string {
    const activeUnit = this.getActiveUnit();
    const inventoryEntries = activeUnit ? getInventoryEntries(this.getUnitInventory(activeUnit)) : [];
    const inventoryCount = inventoryEntries.reduce((total, entry) => total + entry.count, 0);
    const selectedAbility = this.getSelectedAbility();
    const abilityPreview =
      selectedAbility ??
      (this.phase === 'player-abilities' && activeUnit ? activeUnit.abilities[0] : null);
    const carriedItemsText =
      inventoryEntries.length > 0
        ? inventoryEntries.map((entry) => `${getItemDefinition(entry.itemId).name} x${entry.count}`).join(', ')
        : 'No carried items.';

    if ((this.phase === 'player-abilities' || this.phase === 'player-action') && abilityPreview) {
      return [
        abilityPreview.description,
        `Range ${abilityPreview.rangeMin}-${abilityPreview.rangeMax}  ${abilityPreview.target === 'ally' ? 'Allies' : 'Enemies'}`
      ].join('\n');
    }

    if (this.phase === 'player-items' && activeUnit) {
      return inventoryEntries.length > 0
        ? [
            getItemDefinition(inventoryEntries[0].itemId).description,
            `HP ${activeUnit.hp}/${activeUnit.maxHp}  CT ${activeUnit.ct}`
          ].join('\n')
        : 'No carried items.';
    }

    if (activeUnit && activeUnit.team === 'player') {
      return [
        `${activeUnit.attackName}`,
        activeUnit.attackText,
        `Carrying ${inventoryCount} item${inventoryCount === 1 ? '' : 's'}.`,
        this.turnMoveUsed ? 'Move spent this turn.' : 'Move available.',
        carriedItemsText
      ].join('\n');
    }

    return [
      'Items are carried by the unit that found them.',
      'Collect chest caches and enemy drops for supplies.'
    ].join('\n');
  }

  private getMenuHintText(): string {
    switch (this.phase) {
      case 'player-abilities':
        return 'Space closes.';
      case 'player-items':
      case 'player-move':
        return 'Space returns.';
      case 'player-action':
        return 'Space backs out.';
      case 'player-menu':
        return 'Click a command.';
      default:
        return 'Chests open when a player unit ends movement on them.';
    }
  }

  private getHoveredUnit(): BattleUnit | null {
    if (!this.hoverTile) {
      return null;
    }

    return (
      this.units.find(
        (unit) => unit.alive && unit.x === this.hoverTile?.x && unit.y === this.hoverTile?.y
      ) ?? null
    );
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
