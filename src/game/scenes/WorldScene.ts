import Phaser from 'phaser';
import { audioDirector } from '../audio/audioDirector';
import {
  getBasePlanePoint as getSharedBasePlanePoint,
  getTileDepth as getSharedTileDepth,
  getTileTopPoints as getSharedTileTopPoints,
  getUnitGroundPoint as getSharedUnitGroundPoint,
  getRotatedGridPoint as getSharedRotatedGridPoint,
  isoToScreenPoint
} from '../core/isometric';
import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from '../core/mapData';
import { buildPath, getTile, getTraversalNodes, manhattanDistance, pointKey } from '../core/pathfinding';
import type { BattleUnit, Point, ReachNode, SpriteFacing, TileData } from '../core/types';
import type { MapPropPlacement } from '../levels/types';
import type { WorldSceneStartData } from '../sceneSession';
import { BattleActionMenuStack, type ActionMenuPanelDescriptor } from './components/BattleActionMenuStack';
import { TurnOrderPanel } from './components/TurnOrderPanel';
import { UI_TEXT_TITLE, UI_TEXT_WORLD_LABEL } from './components/UiTextStyles';
import { UI_COLOR_ACCENT_WARM, UI_COLOR_PANEL_SURFACE, UI_COLOR_TEXT } from './components/UiColors';
import { createUiGrid } from './components/UiGrid';
import { UI_PANEL_COMPACT_GAP, UI_PANEL_GAP, UI_PANEL_MICRO_GAP } from './components/UiMetrics';
import {
  createWorldLeader,
  createWorldNpcs,
  DEFAULT_WORLD_SPAWN_ID,
  getChunkCoordinatesForWorldPosition,
  getWorldChunkAt,
  getWorldChunksForWindow,
  getWorldInterior,
  getWorldSpawn,
  getWorldStateVersion,
  persistWorldSession,
  resolveWorldSceneStart,
  resetWorldSession,
  WORLD_CHUNK_SIZE
} from '../world';
import {
  ACTIVE_TILE_HIGHLIGHT_COLORS,
  BASE_MIN_BOARD_ZOOM,
  BOARD_ZOOM_SENSITIVITY,
  DEFAULT_BOARD_ZOOM,
  MAX_BOARD_ZOOM,
  PROP_RENDER_CONFIG,
  redrawBoardWalls,
  getTerrainTileAssetKey,
  UNIT_FOOTPRINT_OFFSET_Y,
  UNIT_GROUND_OFFSET_Y,
  WORLD_EDGE_BASE_LEVEL
} from '../world/rendering';
import type {
  WorldChunkRuntime,
  WorldNpcRuntime,
  WorldSessionState,
  WorldTransitionDefinition
} from '../world/types';

type Phase = 'idle' | 'moving' | 'menu' | 'detail' | 'transition';

interface PanKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

interface ActorView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  facing: SpriteFacing;
  spriteBaseY: number;
}

interface PropView {
  base: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
}

interface LocalWorldProp extends MapPropPlacement {
  absolutePosition?: Point;
}

interface LocalWorldTransition extends WorldTransitionDefinition {
  absolutePosition?: Point;
}

const DEFAULT_FACING: SpriteFacing = 'right';
const CAMERA_PADDING_X = 320;
const CAMERA_PADDING_Y = 220;

export class WorldScene extends Phaser.Scene {
  private sessionState!: WorldSessionState;
  private phase: Phase = 'idle';
  private player!: BattleUnit;
  private npcs: WorldNpcRuntime[] = [];
  private map: TileData[] = [];
  private props: LocalWorldProp[] = [];
  private transitions: LocalWorldTransition[] = [];
  private gridWidth = 0;
  private gridHeight = 0;
  private areaName = '';
  private outdoorWindowOrigin: Point | null = null;
  private outdoorCenterChunk: Point | null = null;
  private origin = new Phaser.Math.Vector2(0, 0);
  private boardRotationStep = 0;
  private moveNodes = new Map<string, ReachNode>();
  private focusedNpcId: string | null = null;
  private selectedNpcActionId: string | null = null;
  private hoverTile: TileData | null = null;
  private busy = false;
  private restarting = false;
  private isPanning = false;
  private panPointerOrigin = new Phaser.Math.Vector2();
  private panCameraOrigin = new Phaser.Math.Vector2();
  private messages: string[] = [];

  private areaTitleText!: Phaser.GameObjects.Text;
  private actionMenuStack!: BattleActionMenuStack;
  private playerAvatarPanel!: TurnOrderPanel;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private turnOrderBounds = new Phaser.Geom.Rectangle();

  private terrainTileImages: Phaser.GameObjects.Image[] = [];
  private wallGraphics: Phaser.GameObjects.Graphics[] = [];
  private propViews = new Map<string, PropView>();
  private actorViews = new Map<string, ActorView>();
  private highlightOverlays: Phaser.GameObjects.Graphics[] = [];

  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private panKeys?: PanKeys;
  private worldCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private cameraBounds = new Phaser.Geom.Rectangle();
  private worldStateVersion = 0;

  constructor() {
    super('world');
  }

  init(data?: WorldSceneStartData): void {
    this.phase = 'idle';
    this.hoverTile = null;
    this.focusedNpcId = null;
    this.selectedNpcActionId = null;
    this.moveNodes.clear();
    this.messages = [];
    this.sessionState = resolveWorldSceneStart(data ?? { spawnId: DEFAULT_WORLD_SPAWN_ID });
    this.worldStateVersion = getWorldStateVersion();
    this.restarting = false;
    this.busy = false;
    this.outdoorWindowOrigin = null;
    this.outdoorCenterChunk = null;
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('setup');
    void audioDirector.unlock().catch(() => undefined);

    this.worldCamera = this.cameras.main;
    this.worldCamera.setZoom(DEFAULT_BOARD_ZOOM);
    this.input.addPointer(2);

    this.areaTitleText = this.registerUiObject(this.add.text(28, 22, '', UI_TEXT_TITLE).setScrollFactor(0).setDepth(950));
    this.areaTitleText.setColor(UI_COLOR_TEXT);

    this.boardGraphics = this.registerWorldObject(this.add.graphics().setDepth(40));
    this.actionMenuStack = new BattleActionMenuStack(this, {
      onCreateObject: (object) => {
        this.registerUiObject(object);
      }
    });
    this.playerAvatarPanel = new TurnOrderPanel(this, 1);

    this.rebuildArea(true);
    this.registerInputs();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize();
  }

  update(_time: number, delta: number): void {
    const worldStateVersion = getWorldStateVersion();

    if (worldStateVersion !== this.worldStateVersion) {
      this.worldStateVersion = worldStateVersion;

      if (this.sessionState.areaKind === 'outdoor') {
        this.rebuildArea(false);
        return;
      }
    }

    if (this.rebuildOutdoorAreaForCamera()) {
      return;
    }

    if (this.phase === 'transition' || this.isPanning) {
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

    const magnitude = Math.max(1, Math.hypot(dx, dy));
    const distance = 380 * (delta / 1000);
    this.setCameraScroll(
      this.worldCamera.scrollX + (dx / magnitude) * distance,
      this.worldCamera.scrollY + (dy / magnitude) * distance
    );
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
    this.actionMenuStack.destroy();
    this.uiCamera?.destroy();
  }

  private registerInputs(): void {
    this.input.removeAllListeners();
    this.input.mouse?.disableContextMenu();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        return;
      }

      if (this.isPanning) {
        this.setCameraScroll(
          this.panCameraOrigin.x - (pointer.x - this.panPointerOrigin.x) / this.worldCamera.zoom,
          this.panCameraOrigin.y - (pointer.y - this.panPointerOrigin.y) / this.worldCamera.zoom
        );
        return;
      }

      if (this.actionMenuStack.containsPoint(pointer.x, pointer.y)) {
        if (this.hoverTile) {
          this.hoverTile = null;
          this.drawHighlights();
        }
        return;
      }

      const worldPoint = pointer.positionToCamera(this.worldCamera) as Phaser.Math.Vector2;
      this.hoverTile = this.pickTile(worldPoint.x, worldPoint.y);
      this.drawHighlights();
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
        if (this.actionMenuStack.containsPoint(pointer.x, pointer.y) || this.phase === 'transition') {
          return;
        }

        this.zoomBoard(deltaY, pointer.x, pointer.y);
      }
    );

    this.cursorKeys = this.input.keyboard?.createCursorKeys();
    this.panKeys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    }) as PanKeys | undefined;

    this.input.keyboard?.removeAllListeners();
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.phase === 'transition') {
        return;
      }

      const npc = this.getInteractionNpc();

      if (!npc) {
        return;
      }

      audioDirector.playUiConfirm();
      this.focusedNpcId = npc.id;
      this.selectedNpcActionId = null;
      this.phase = 'menu';
      this.refreshUi();
      this.drawHighlights();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.phase === 'detail') {
        audioDirector.playUiCancel();
        this.selectedNpcActionId = null;
        this.phase = this.getInteractionNpc() ? 'menu' : 'idle';
        this.refreshUi();
        this.drawHighlights();
        return;
      }

      if (this.phase === 'menu') {
        audioDirector.playUiCancel();
        this.focusedNpcId = null;
        this.selectedNpcActionId = null;
        this.phase = 'idle';
        this.refreshUi();
        this.drawHighlights();
        return;
      }

      this.returnToTitle();
    });
    this.input.keyboard?.on('keydown-Q', () => this.rotateBoard(-1));
    this.input.keyboard?.on('keydown-E', () => this.rotateBoard(1));
    this.input.keyboard?.on('keydown-M', () => {
      const muted = audioDirector.toggleMute();
      this.pushMessage(`Audio ${muted ? 'muted' : 'enabled'}.`);
    });
  }

  private handleResize(): void {
    this.worldCamera.setSize(this.scale.width, this.scale.height);

    const grid = createUiGrid(this.scale.width, this.scale.height);
    const avatarSize = 38;
    const actionMenuRootWidth = 172;
    const actionMenuPanelHeight = 188;
    const turnOrderGap = avatarSize + 12;
    const turnOrderHeight = avatarSize;
    const turnOrderColumn = grid.column(0, 1, grid.content.y, turnOrderHeight + UI_PANEL_GAP);
    const turnOrderBand = grid.band(
      Math.max(grid.content.y, grid.content.bottom - turnOrderHeight - UI_PANEL_COMPACT_GAP),
      turnOrderHeight + UI_PANEL_GAP
    );
    this.turnOrderBounds.setTo(turnOrderColumn.x, turnOrderBand.y, turnOrderColumn.width, turnOrderBand.height);

    this.playerAvatarPanel.setLayout({
      x: this.turnOrderBounds.x,
      startY: this.turnOrderBounds.y + UI_PANEL_MICRO_GAP,
      gap: turnOrderGap,
      avatarSize,
      reverse: true
    });
    this.playerAvatarPanel.setVisible(true);

    this.actionMenuStack.setLayout({
      rootX: this.turnOrderBounds.x + avatarSize + UI_PANEL_GAP,
      bottom: grid.content.bottom,
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

    this.uiCamera?.setViewport(0, 0, this.scale.width, this.scale.height).setSize(this.scale.width, this.scale.height);
    this.refreshUi();
    this.configureCamera(false);
  }

  private rebuildArea(centerCamera: boolean, outdoorCenterChunkOverride?: Point, outdoorFocusPoint?: Point): void {
    this.destroyAreaObjects();

    if (this.sessionState.areaKind === 'outdoor') {
      this.buildOutdoorArea(outdoorCenterChunkOverride);
    } else {
      this.buildInteriorArea();
    }

    this.origin = new Phaser.Math.Vector2(this.gridHeight * (TILE_WIDTH / 2) + 160, 176);
    this.drawBoard();
    this.createTerrainTiles();
    this.createProps();
    this.createActors();
    this.setupCameras();
    this.configureCamera(centerCamera);

    if (this.sessionState.areaKind === 'outdoor' && outdoorFocusPoint) {
      this.centerCameraOnOutdoorPoint(outdoorFocusPoint);
    }

    this.drawHighlights();
    this.refreshUi();
  }

  private buildOutdoorArea(centerChunkOverride?: Point): void {
    const outdoorPosition = { ...this.sessionState.outdoorPosition };
    const centerChunk = centerChunkOverride ?? getChunkCoordinatesForWorldPosition(outdoorPosition);
    const loadedChunks = getWorldChunksForWindow(centerChunk.x, centerChunk.y);
    const playerChunk = getWorldChunkAt(centerChunk.x, centerChunk.y);
    const windowOrigin = {
      x: (centerChunk.x - 1) * WORLD_CHUNK_SIZE,
      y: (centerChunk.y - 1) * WORLD_CHUNK_SIZE
    };
    const localPlayerPoint = {
      x: outdoorPosition.x - windowOrigin.x,
      y: outdoorPosition.y - windowOrigin.y
    };

    this.outdoorCenterChunk = centerChunk;
    this.outdoorWindowOrigin = windowOrigin;
    this.gridWidth = WORLD_CHUNK_SIZE * 3;
    this.gridHeight = WORLD_CHUNK_SIZE * 3;
    this.map = [];
    this.props = [];
    this.transitions = [];
    const npcDefinitions = [];

    for (const chunk of loadedChunks) {
      const offsetX = (chunk.chunkX - (centerChunk.x - 1)) * WORLD_CHUNK_SIZE;
      const offsetY = (chunk.chunkY - (centerChunk.y - 1)) * WORLD_CHUNK_SIZE;

      for (let y = 0; y < chunk.height; y += 1) {
        for (let x = 0; x < chunk.width; x += 1) {
          this.map.push({
            x: offsetX + x,
            y: offsetY + y,
            height: chunk.heights[y]?.[x] ?? 0,
            terrain: chunk.terrain[y]?.[x] ?? 'grass'
          });
        }
      }

      this.props.push(
        ...chunk.props.map((prop) => ({
          ...prop,
          x: offsetX + prop.x,
          y: offsetY + prop.y,
          absolutePosition: {
            x: chunk.chunkX * WORLD_CHUNK_SIZE + prop.x,
            y: chunk.chunkY * WORLD_CHUNK_SIZE + prop.y
          }
        }))
      );
      this.transitions.push(
        ...chunk.transitions.map((transition) => ({
          ...transition,
          x: offsetX + transition.x,
          y: offsetY + transition.y,
          absolutePosition: {
            x: chunk.chunkX * WORLD_CHUNK_SIZE + transition.x,
            y: chunk.chunkY * WORLD_CHUNK_SIZE + transition.y
          }
        }))
      );
      npcDefinitions.push(
        ...chunk.npcs.map((npc) => ({
          ...npc,
          x: offsetX + npc.x,
          y: offsetY + npc.y
        }))
      );
    }

    this.player = createWorldLeader(localPlayerPoint);
    this.npcs = createWorldNpcs('outdoor', npcDefinitions);
    this.areaName = playerChunk?.name ?? 'Ruined March';
  }

  private buildInteriorArea(): void {
    const interior = getWorldInterior(this.sessionState.areaId);
    const localPlayerPoint = this.sessionState.interiorPosition ?? interior.spawnPoints[0] ?? { x: 1, y: 1 };

    this.outdoorCenterChunk = null;
    this.outdoorWindowOrigin = null;
    this.gridWidth = interior.width;
    this.gridHeight = interior.height;
    this.map = [];
    this.props = interior.props.map((prop) => ({ ...prop }));
    this.transitions = interior.transitions.map((transition) => ({ ...transition }));

    for (let y = 0; y < interior.height; y += 1) {
      for (let x = 0; x < interior.width; x += 1) {
        this.map.push({
          x,
          y,
          height: interior.heights[y]?.[x] ?? 0,
          terrain: interior.terrain[y]?.[x] ?? 'stone'
        });
      }
    }

    this.player = createWorldLeader(localPlayerPoint);
    this.npcs = createWorldNpcs(interior.id, interior.npcs);
    this.areaName = interior.name;
  }

  private rebuildOutdoorAreaForCamera(): boolean {
    if (
      this.sessionState.areaKind !== 'outdoor' ||
      !this.outdoorCenterChunk ||
      this.isPanning ||
      this.phase === 'moving' ||
      this.phase === 'transition'
    ) {
      return false;
    }

    const focusPoint = this.getOutdoorCameraCenterAbsolutePoint();

    if (!focusPoint) {
      return false;
    }

    const centerChunk = getChunkCoordinatesForWorldPosition(focusPoint);

    if (centerChunk.x === this.outdoorCenterChunk.x && centerChunk.y === this.outdoorCenterChunk.y) {
      return false;
    }

    this.rebuildArea(false, centerChunk, focusPoint);
    this.phase = 'idle';
    return true;
  }

  private destroyAreaObjects(): void {
    for (const image of this.terrainTileImages) {
      image.destroy();
    }
    this.terrainTileImages = [];

    for (const view of this.propViews.values()) {
      view.base.destroy();
      view.image.destroy();
    }
    this.propViews.clear();

    for (const view of this.actorViews.values()) {
      view.container.destroy(true);
    }
    this.actorViews.clear();

    for (const overlay of this.highlightOverlays) {
      overlay.destroy();
    }
    this.highlightOverlays = [];
  }

  private createTerrainTiles(): void {
    const tiles = [...this.map].sort((left, right) => this.getTileDepth(left) - this.getTileDepth(right));

    for (const tile of tiles) {
      const point = this.isoToScreen(tile);
      const assetKey = getTerrainTileAssetKey(tile);
      const image = this.registerWorldObject(
        this.add
          .image(point.x, point.y, assetKey)
          .setOrigin(0.5, 0.5)
          .setDisplaySize(TILE_WIDTH, TILE_WIDTH)
          .setDepth(this.getTileDepth(tile))
      );
      this.terrainTileImages.push(image);
    }
  }

  private drawBoard(): void {
    this.wallGraphics = redrawBoardWalls({
      boardGraphics: this.boardGraphics,
      wallGraphics: this.wallGraphics,
      createWallGraphics: () => this.registerWorldObject(this.add.graphics()),
      map: this.map,
      boardRotationStep: this.boardRotationStep,
      getTileDepth: (tile) => this.getTileDepth(tile),
      getTileTopPoints: (tile) => this.getTileTopPoints(tile)
    });
  }

  private createProps(): void {
    for (const prop of this.props) {
      const config = PROP_RENDER_CONFIG[prop.assetId];
      const base = this.registerWorldObject(this.add.graphics());
      const image = this.registerWorldObject(this.add.image(0, 0, prop.assetId).setOrigin(0.5, 1));
      image.displayHeight = config.height;
      image.scaleX = image.scaleY;

      if (image.displayWidth < config.minWidth) {
        image.displayWidth = config.minWidth;
        image.scaleY = image.scaleX;
      }

      this.propViews.set(prop.id, { base, image });
      this.positionProp(prop);
    }
  }

  private createActors(): void {
    this.createActor(this.player);

    for (const npc of this.npcs) {
      this.createActor(npc);
    }
  }

  private createActor(actor: BattleUnit | WorldNpcRuntime): void {
    const view = this.createActorView(actor, DEFAULT_FACING);
    this.actorViews.set(actor.id, view);
    this.applyActorFacing(actor, view, DEFAULT_FACING);
    this.positionActor(actor);
    this.applyIdleAnimation(actor, view);
  }

  private createActorView(actor: BattleUnit | WorldNpcRuntime, initialFacing: SpriteFacing): ActorView {
    const spriteFlipX = initialFacing === 'left';
    const spriteOffsetX = this.getSpriteOffsetXForFacing(actor.spriteOffsetX, initialFacing);
    const spriteOffsetY = actor.spriteOffsetY ?? 0;
    const marker = this.registerWorldObject(this.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 62, 26, actor.accentColor, 0));
    const shadow = this.registerWorldObject(this.add.ellipse(0, UNIT_FOOTPRINT_OFFSET_Y, 50, 18, 0x060205, 0.42));
    const sprite = this.registerWorldObject(this.add.image(0, 0, actor.spriteKey).setOrigin(0.5, 1));
    sprite.displayHeight = actor.spriteDisplayHeight;
    sprite.scaleX = sprite.scaleY;
    sprite.setPosition(spriteOffsetX, spriteOffsetY).setFlipX(spriteFlipX);
    const label = this.registerWorldObject(
      this.add.text(0, sprite.y - actor.spriteDisplayHeight - 24, actor.name, UI_TEXT_WORLD_LABEL)
    );
    label.setOrigin(0.5);
    const container = this.registerWorldObject(this.add.container(0, 0, [marker, shadow, sprite, label]));

    return {
      container,
      shadow,
      sprite,
      label,
      facing: initialFacing,
      spriteBaseY: sprite.y
    };
  }

  private applyIdleAnimation(actor: BattleUnit | WorldNpcRuntime, view: ActorView): void {
    const delay = (actor.x + actor.y) * 90;

    this.tweens.add({
      targets: view.sprite,
      y: view.spriteBaseY - 4,
      duration: 1320,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });

    this.tweens.add({
      targets: view.shadow,
      scaleX: 0.86,
      scaleY: 0.8,
      alpha: 0.3,
      duration: 1320,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay
    });
  }

  private applyActorFacing(actor: BattleUnit | WorldNpcRuntime, view: ActorView, facing: SpriteFacing): void {
    view.facing = facing;
    const spriteOffsetX = this.getSpriteOffsetXForFacing(actor.spriteOffsetX, facing);
    const spriteOffsetY = actor.spriteOffsetY ?? 0;
    view.sprite.setPosition(spriteOffsetX, spriteOffsetY).setFlipX(facing === 'left');
  }

  private positionActor(actor: BattleUnit | WorldNpcRuntime): void {
    const view = this.actorViews.get(actor.id);
    const tile = getTile(this.map, actor.x, actor.y);

    if (!view || !tile) {
      return;
    }

    const point = this.getUnitGroundPoint(tile);
    view.container.setPosition(point.x, point.y);
    view.container.setDepth(this.getUnitDepth(tile));
    view.label.setText(actor.name);
  }

  private positionProp(prop: LocalWorldProp): void {
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

    view.image.setPosition(imageX, point.y + groundOffsetY);
    view.image.setDepth(this.getPropDepth(tile));
  }

  private drawHighlights(): void {
    for (const overlay of this.highlightOverlays) {
      overlay.destroy();
    }
    this.highlightOverlays = [];

    const playerTile = getTile(this.map, this.player.x, this.player.y);

    if (playerTile) {
      this.drawActiveMarker(playerTile);
    }

    const interactionNpc = this.getInteractionNpc();
    if (interactionNpc) {
      const npcTile = getTile(this.map, interactionNpc.x, interactionNpc.y);
      if (npcTile) {
        this.drawDiamond(npcTile, 0x71451e, 0.2, 2, UI_COLOR_ACCENT_WARM, 0.9);
      }
    }

    if (this.hoverTile && (this.hoverTile.x !== this.player.x || this.hoverTile.y !== this.player.y)) {
      this.drawDiamond(this.hoverTile, 0x2f4f60, 0.18, 2, 0x9ad7f2, 0.8);
    }
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
    glow.fillStyle(ACTIVE_TILE_HIGHLIGHT_COLORS.glowOuter, 0.12);
    glow.fillPoints(this.scaleTilePolygon(tilePoints, center, 1.16), true);
    glow.fillStyle(ACTIVE_TILE_HIGHLIGHT_COLORS.glowInner, 0.16);
    glow.fillPoints(this.scaleTilePolygon(tilePoints, center, 1.02), true);
    glow.setDepth(this.getHighlightDepth(tile));
    this.highlightOverlays.push(glow);

    const overlay = this.registerWorldObject(this.add.graphics());
    overlay.fillStyle(ACTIVE_TILE_HIGHLIGHT_COLORS.fillDark, 0.18);
    overlay.fillPoints(outer, true);
    overlay.fillStyle(ACTIVE_TILE_HIGHLIGHT_COLORS.fillMid, 0.2);
    overlay.fillPoints(mid, true);
    overlay.fillStyle(ACTIVE_TILE_HIGHLIGHT_COLORS.fillLight, 0.16);
    overlay.fillPoints(inner, true);
    overlay.lineStyle(3, ACTIVE_TILE_HIGHLIGHT_COLORS.strokeOuter, 0.95);
    overlay.strokePoints(outer, true, true);
    overlay.lineStyle(2, ACTIVE_TILE_HIGHLIGHT_COLORS.strokeMid, 0.85);
    overlay.strokePoints(mid, true, true);
    overlay.lineStyle(1, ACTIVE_TILE_HIGHLIGHT_COLORS.strokeInner, 0.8);
    overlay.strokePoints(inner, true, true);
    overlay.fillStyle(ACTIVE_TILE_HIGHLIGHT_COLORS.center, 0.85);
    overlay.fillCircle(center.x, center.y, 3.2);
    overlay.setDepth(this.getHighlightDepth(tile) + 0.1);
    this.highlightOverlays.push(overlay);
  }

  private refreshUi(): void {
    this.areaTitleText.setText(this.areaName);
    this.playerAvatarPanel.setQueue([this.player], this.player.id, 1, true);
    this.playerAvatarPanel.setVisible(true);
    this.actionMenuStack.setPanels(this.buildActionMenuPanels());
    this.actionMenuStack.setVisible(this.shouldShowActionMenu());
    this.actionMenuStack.draw();
  }

  private buildActionMenuPanels(): ActionMenuPanelDescriptor[] {
    const npc = this.getInteractionNpc();

    if (!npc) {
      return [];
    }

    const rootPanel: ActionMenuPanelDescriptor = {
      id: 'npc-actions',
      kind: 'list',
      title: npc.name,
      blocksWorldInput: true,
      entries: npc.actions.map((action) => ({
        id: action.id,
        label: action.label,
        enabled: true,
        active: action.id === this.selectedNpcActionId
      }))
    };

    if (this.phase !== 'detail') {
      return [rootPanel];
    }

    const detailAction = npc.actions.find((action) => action.id === this.selectedNpcActionId);

    if (!detailAction) {
      return [rootPanel];
    }

    return [
      rootPanel,
      {
        id: 'npc-detail',
        kind: 'detail',
        title: detailAction.title ?? detailAction.label,
        blocksWorldInput: true,
        body: detailAction.body
      }
    ];
  }

  private shouldShowActionMenu(): boolean {
    return Boolean(this.getInteractionNpc() && (this.phase === 'menu' || this.phase === 'detail'));
  }

  private async handlePointerDown(pointer: Phaser.Input.Pointer): Promise<void> {
    if (this.busy) {
      return;
    }

    if (await this.handleMenuPointer(pointer.x, pointer.y)) {
      return;
    }

    if (this.actionMenuStack.containsPoint(pointer.x, pointer.y)) {
      return;
    }

    const worldPoint = pointer.positionToCamera(this.worldCamera) as Phaser.Math.Vector2;
    const tile = this.pickTile(worldPoint.x, worldPoint.y);

    if (!tile) {
      return;
    }

    await this.handleTileSelection(tile);
  }

  private async handleMenuPointer(x: number, y: number): Promise<boolean> {
    const hit = this.actionMenuStack.hitTest(x, y);

    if (!hit) {
      return false;
    }

    if (!hit.entryId) {
      return hit.blocksWorldInput;
    }

    const npc = this.getInteractionNpc();

    if (!npc || hit.panelId !== 'npc-actions') {
      return hit.blocksWorldInput;
    }

    const action = npc.actions.find((entry) => entry.id === hit.entryId);

    if (!action) {
      return true;
    }

    audioDirector.playUiConfirm();
    this.selectedNpcActionId = action.id;
    this.phase = 'detail';
    this.refreshUi();
    this.drawHighlights();
    return true;
  }

  private async handleTileSelection(tile: TileData): Promise<void> {
    const npc = this.getNpcAt(tile.x, tile.y);

    if (npc) {
      this.focusedNpcId = npc.id;

      if (manhattanDistance(this.player, npc) === 1) {
        this.selectedNpcActionId = null;
        this.phase = 'menu';
        this.refreshUi();
        this.drawHighlights();
        return;
      }

      const path = this.getPathToNpcAdjacency(npc);

      if (!path) {
        this.pushMessage(`${npc.name} is cut off from this route.`);
        return;
      }

      await this.movePlayer(path, npc.id);
      return;
    }

    const path = this.getPathToTarget(tile);

    if (!path) {
      return;
    }

    await this.movePlayer(path, null);
  }

  private getPathToTarget(tile: TileData): Point[] | null {
    const moveNodes = this.getMoveNodes();

    if (!moveNodes.has(pointKey(tile))) {
      return null;
    }

    this.moveNodes = moveNodes;
    return buildPath(moveNodes, tile);
  }

  private getPathToNpcAdjacency(npc: WorldNpcRuntime): Point[] | null {
    const moveNodes = this.getMoveNodes();
    const adjacentTiles = [
      getTile(this.map, npc.x + 1, npc.y),
      getTile(this.map, npc.x - 1, npc.y),
      getTile(this.map, npc.x, npc.y + 1),
      getTile(this.map, npc.x, npc.y - 1)
    ].filter((tile): tile is TileData => Boolean(tile));
    const bestTile = adjacentTiles
      .filter((tile) => moveNodes.has(pointKey(tile)))
      .sort((left, right) => {
        const leftNode = moveNodes.get(pointKey(left));
        const rightNode = moveNodes.get(pointKey(right));
        return (leftNode?.cost ?? Number.POSITIVE_INFINITY) - (rightNode?.cost ?? Number.POSITIVE_INFINITY);
      })[0];

    if (!bestTile) {
      return null;
    }

    this.moveNodes = moveNodes;
    return buildPath(moveNodes, bestTile);
  }

  private getMoveNodes(): Map<string, ReachNode> {
    return getTraversalNodes(
      this.map,
      this.player,
      Number.POSITIVE_INFINITY,
      [
        ...this.props.filter((prop) => PROP_RENDER_CONFIG[prop.assetId].blocksMovement).map((prop) => ({ x: prop.x, y: prop.y })),
        ...this.npcs.map((npc) => ({ x: npc.x, y: npc.y }))
      ]
    );
  }

  private async movePlayer(path: Point[], focusedNpcId: string | null): Promise<void> {
    if (path.length === 0) {
      return;
    }

    const view = this.actorViews.get(this.player.id);

    if (!view) {
      return;
    }

    this.busy = true;
    this.phase = 'moving';
    this.focusedNpcId = focusedNpcId;
    this.selectedNpcActionId = null;
    this.refreshUi();

    try {
      for (const step of path.slice(1)) {
        const tile = getTile(this.map, step.x, step.y);

        if (!tile) {
          continue;
        }

        const destination = this.getUnitGroundPoint(tile);
        const destinationDepth = this.getUnitDepth(tile);
        this.updateActorFacingForMovement(this.player, view, destination);
        const movementPromise = this.animateMovementStep(view, destination, destinationDepth);
        const cameraPromise = this.centerCameraOnPoint(destination.x, destination.y - 12, 180);
        audioDirector.playStep();
        await Promise.all([movementPromise, cameraPromise]);
        this.player.x = step.x;
        this.player.y = step.y;
      }
    } finally {
      this.syncSessionWithPlayerPosition();
      this.busy = false;
      if (!this.rebuildOutdoorAreaForCamera()) {
        this.phase = 'idle';
        this.refreshNpcInteraction();
        this.positionActor(this.player);
        this.drawHighlights();
        this.refreshUi();
      }
    }

    await this.checkForTransition();
  }

  private syncSessionWithPlayerPosition(): void {
    if (this.sessionState.areaKind === 'outdoor') {
      const absolutePosition = this.localToAbsoluteOutdoorPoint({ x: this.player.x, y: this.player.y });
      const playerChunk = getChunkCoordinatesForWorldPosition(absolutePosition);
      const playerChunkDefinition = getWorldChunkAt(playerChunk.x, playerChunk.y);

      this.sessionState = persistWorldSession({
        ...this.sessionState,
        areaKind: 'outdoor',
        areaId: playerChunkDefinition?.id ?? this.sessionState.areaId,
        outdoorPosition: absolutePosition,
        interiorPosition: null
      });
      return;
    }

    this.sessionState = persistWorldSession({
      ...this.sessionState,
      areaKind: 'interior',
      interiorPosition: { x: this.player.x, y: this.player.y }
    });
  }

  private async checkForTransition(): Promise<void> {
    const transition = this.getTransitionAt(this.player.x, this.player.y);

    if (!transition) {
      this.refreshNpcInteraction();
      this.positionActor(this.player);
      this.drawHighlights();
      this.refreshUi();
      return;
    }

    await this.performTransition(transition);
  }

  private async performTransition(transition: LocalWorldTransition): Promise<void> {
    this.phase = 'transition';
    this.busy = true;
    audioDirector.playUiConfirm();

    if (this.sessionState.areaKind === 'outdoor' && transition.targetKind === 'interior' && transition.targetId) {
      const spawn = getWorldSpawn(transition.targetSpawnId);
      const absolutePosition = this.localToAbsoluteOutdoorPoint({ x: this.player.x, y: this.player.y });
      this.sessionState = persistWorldSession({
        areaKind: 'interior',
        areaId: transition.targetId,
        outdoorPosition: absolutePosition,
        interiorPosition: { x: spawn.x, y: spawn.y },
        returnOutdoorPosition: absolutePosition
      });
      await this.fadeAndRebuild();
      this.pushMessage(`${this.areaName} opens before you.`);
      return;
    }

    if (transition.targetKind === 'return' && this.sessionState.returnOutdoorPosition) {
      const outdoorPosition = { ...this.sessionState.returnOutdoorPosition };
      const playerChunk = getChunkCoordinatesForWorldPosition(outdoorPosition);
      const chunk = getWorldChunkAt(playerChunk.x, playerChunk.y);
      this.sessionState = persistWorldSession({
        areaKind: 'outdoor',
        areaId: chunk?.id ?? this.sessionState.areaId,
        outdoorPosition,
        interiorPosition: null,
        returnOutdoorPosition: null
      });
      await this.fadeAndRebuild();
      this.pushMessage(`You return to ${this.areaName}.`);
      return;
    }

    if (transition.targetKind === 'spawn' && transition.targetSpawnId) {
      const spawn = getWorldSpawn(transition.targetSpawnId);
      this.sessionState = persistWorldSession(
        spawn.areaKind === 'outdoor'
          ? {
              areaKind: 'outdoor',
              areaId: spawn.areaId,
              outdoorPosition: { x: spawn.x, y: spawn.y },
              interiorPosition: null,
              returnOutdoorPosition: null
            }
          : {
              areaKind: 'interior',
              areaId: spawn.areaId,
              outdoorPosition: this.sessionState.outdoorPosition,
              interiorPosition: { x: spawn.x, y: spawn.y },
              returnOutdoorPosition: this.sessionState.returnOutdoorPosition
            }
      );
      await this.fadeAndRebuild();
      return;
    }

    this.phase = 'idle';
    this.busy = false;
    this.refreshUi();
    this.drawHighlights();
  }

  private async fadeAndRebuild(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => resolve());
      this.cameras.main.fadeOut(180, 8, 6, 10);
    });

    this.focusedNpcId = null;
    this.selectedNpcActionId = null;
    this.hoverTile = null;
    this.rebuildArea(true);
    this.cameras.main.fadeIn(180, 8, 6, 10);
    this.phase = 'idle';
    this.busy = false;
  }

  private refreshNpcInteraction(): void {
    const npc = this.getInteractionNpc();

    if (!npc) {
      this.focusedNpcId = null;
      this.selectedNpcActionId = null;
      this.phase = 'idle';
      return;
    }

    this.focusedNpcId = npc.id;

    if (this.phase === 'detail') {
      const selectedAction = npc.actions.find((action) => action.id === this.selectedNpcActionId);

      if (selectedAction) {
        return;
      }
    }

    this.selectedNpcActionId = null;
    this.phase = 'menu';
  }

  private getInteractionNpc(): WorldNpcRuntime | null {
    const adjacentNpcs = this.npcs.filter((npc) => manhattanDistance(this.player, npc) === 1);

    if (adjacentNpcs.length === 0) {
      return null;
    }

    const focusedNpc = this.focusedNpcId ? this.npcs.find((npc) => npc.id === this.focusedNpcId) : null;

    if (focusedNpc && adjacentNpcs.some((npc) => npc.id === focusedNpc.id)) {
      return focusedNpc;
    }

    return adjacentNpcs[0] ?? null;
  }

  private getNpcAt(x: number, y: number): WorldNpcRuntime | null {
    return this.npcs.find((npc) => npc.x === x && npc.y === y) ?? null;
  }

  private getTransitionAt(x: number, y: number): LocalWorldTransition | null {
    return this.transitions.find((transition) => transition.x === x && transition.y === y) ?? null;
  }

  private beginPan(pointer: Phaser.Input.Pointer): void {
    this.isPanning = true;
    this.panPointerOrigin.set(pointer.x, pointer.y);
    this.panCameraOrigin.set(this.worldCamera.scrollX, this.worldCamera.scrollY);
    this.hoverTile = null;
    this.drawHighlights();
  }

  private rotateBoard(stepDelta: number): void {
    if (this.busy || this.phase === 'transition') {
      return;
    }

    this.boardRotationStep = Phaser.Math.Wrap(this.boardRotationStep + stepDelta, 0, 4);
    this.destroyAreaObjects();
    this.drawBoard();
    this.createTerrainTiles();
    this.createProps();
    this.createActors();
    this.setupCameras();
    this.drawHighlights();
    this.configureCamera(true);
  }

  private setupCameras(): void {
    this.worldCamera = this.cameras.main;
    this.worldCamera.setSize(this.scale.width, this.scale.height);

    this.uiCamera ??= this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setViewport(0, 0, this.scale.width, this.scale.height).setSize(this.scale.width, this.scale.height);
    this.uiCamera.setScroll(0, 0);

    const uiObjects = this.getUiObjects();
    const uiSet = new Set(uiObjects);
    const worldObjects = this.children.list.filter((child) => !uiSet.has(child));

    this.worldCamera.ignore(uiObjects);
    this.uiCamera.ignore(worldObjects);
  }

  private getUiObjects(): Phaser.GameObjects.GameObject[] {
    return [
      this.areaTitleText,
      ...this.playerAvatarPanel.getDisplayObjects(),
      ...this.actionMenuStack.getDisplayObjects()
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

  private configureCamera(centerOnPlayer: boolean): void {
    const boardBounds = this.getBoardBounds();
    this.cameraBounds.setTo(
      boardBounds.x - CAMERA_PADDING_X,
      boardBounds.y - CAMERA_PADDING_Y,
      boardBounds.width + CAMERA_PADDING_X * 2,
      boardBounds.height + CAMERA_PADDING_Y * 2
    );
    this.worldCamera.setBounds(
      this.cameraBounds.x,
      this.cameraBounds.y,
      this.cameraBounds.width,
      this.cameraBounds.height
    );

    const minimumZoom = this.getMinimumBoardZoom();

    if (this.worldCamera.zoom < minimumZoom) {
      this.worldCamera.setZoom(minimumZoom);
    }

    if (centerOnPlayer) {
      const tile = getTile(this.map, this.player.x, this.player.y);

      if (tile) {
        const point = this.getUnitGroundPoint(tile);
        const scroll = this.getCenteredScrollForPoint(point.x, point.y - 12);
        this.worldCamera.setScroll(scroll.x, scroll.y);
      }
    }

    this.clampCameraToBounds();
  }

  private getMinimumBoardZoom(): number {
    const boardBounds = this.getBoardBounds();
    const paddedWidth = boardBounds.width + 240;
    const paddedHeight = boardBounds.height + 180;
    return Phaser.Math.Clamp(
      Math.min(this.scale.width / Math.max(1, paddedWidth), this.scale.height / Math.max(1, paddedHeight)),
      BASE_MIN_BOARD_ZOOM,
      DEFAULT_BOARD_ZOOM
    );
  }

  private getCenteredScrollForPoint(x: number, y: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      x - this.worldCamera.width / (2 * this.worldCamera.zoom),
      y - this.worldCamera.height / (2 * this.worldCamera.zoom)
    );
  }

  private setCameraScroll(scrollX: number, scrollY: number): void {
    this.worldCamera.setScroll(scrollX, scrollY);
    this.clampCameraToBounds();
  }

  private clampCameraToBounds(): void {
    const camera = this.worldCamera;
    const visibleWidth = camera.width / camera.zoom;
    const visibleHeight = camera.height / camera.zoom;
    const minScrollX = this.cameraBounds.x;
    const minScrollY = this.cameraBounds.y;
    const maxScrollX = this.cameraBounds.right - visibleWidth;
    const maxScrollY = this.cameraBounds.bottom - visibleHeight;

    camera.scrollX = maxScrollX > minScrollX ? Phaser.Math.Clamp(camera.scrollX, minScrollX, maxScrollX) : minScrollX;
    camera.scrollY = maxScrollY > minScrollY ? Phaser.Math.Clamp(camera.scrollY, minScrollY, maxScrollY) : minScrollY;
  }

  private async centerCameraOnPoint(x: number, y: number, duration: number): Promise<void> {
    const targetScroll = this.getCenteredScrollForPoint(x, y);

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: this.worldCamera,
        scrollX: targetScroll.x,
        scrollY: targetScroll.y,
        duration,
        ease: 'Sine.easeOut',
        onUpdate: () => this.clampCameraToBounds(),
        onComplete: () => {
          this.setCameraScroll(targetScroll.x, targetScroll.y);
          resolve();
        }
      });
    });
  }

  private zoomBoard(deltaY: number, screenX: number, screenY: number): void {
    if (deltaY === 0) {
      return;
    }

    const zoomFactor = Math.exp(-deltaY * BOARD_ZOOM_SENSITIVITY);
    const minimumZoom = this.getMinimumBoardZoom();
    const nextZoom = Phaser.Math.Clamp(this.worldCamera.zoom * zoomFactor, minimumZoom, MAX_BOARD_ZOOM);
    const worldPointBefore = this.worldCamera.getWorldPoint(screenX, screenY);
    this.worldCamera.setZoom(nextZoom);
    const worldPointAfter = this.worldCamera.getWorldPoint(screenX, screenY);
    this.worldCamera.scrollX += worldPointBefore.x - worldPointAfter.x;
    this.worldCamera.scrollY += worldPointBefore.y - worldPointAfter.y;
    this.clampCameraToBounds();
  }

  private async animateMovementStep(
    view: ActorView,
    destination: Phaser.Math.Vector2,
    destinationDepth: number
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.container,
        x: destination.x,
        y: destination.y - 10,
        duration: 150,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          view.container.setDepth(destinationDepth);
        },
        onComplete: () => {
          this.tweens.add({
            targets: view.container,
            y: destination.y,
            duration: 90,
            ease: 'Quad.easeIn',
            onUpdate: () => view.container.setDepth(destinationDepth),
            onComplete: () => {
              view.container.setDepth(destinationDepth);
              resolve();
            }
          });
        }
      });
    });
  }

  private updateActorFacingForMovement(
    actor: BattleUnit,
    view: ActorView,
    destination: Phaser.Math.Vector2
  ): void {
    const deltaX = destination.x - view.container.x;
    const nextFacing = Math.abs(deltaX) < 1 ? view.facing : deltaX > 0 ? 'right' : 'left';

    if (nextFacing !== view.facing) {
      this.applyActorFacing(actor, view, nextFacing);
    }
  }

  private localToAbsoluteOutdoorPoint(point: Point): Point {
    if (!this.outdoorWindowOrigin) {
      return point;
    }

    return {
      x: this.outdoorWindowOrigin.x + point.x,
      y: this.outdoorWindowOrigin.y + point.y
    };
  }

  private absoluteToLocalOutdoorPoint(point: Point): Point {
    if (!this.outdoorWindowOrigin) {
      return point;
    }

    return {
      x: point.x - this.outdoorWindowOrigin.x,
      y: point.y - this.outdoorWindowOrigin.y
    };
  }

  private centerCameraOnOutdoorPoint(point: Point): void {
    const localPoint = this.absoluteToLocalOutdoorPoint(point);
    const tile = getTile(this.map, localPoint.x, localPoint.y);

    if (!tile) {
      return;
    }

    const groundPoint = this.getUnitGroundPoint(tile);
    const scroll = this.getCenteredScrollForPoint(groundPoint.x, groundPoint.y - 12);
    this.setCameraScroll(scroll.x, scroll.y);
  }

  private getOutdoorCameraCenterAbsolutePoint(): Point | null {
    if (this.sessionState.areaKind !== 'outdoor' || !this.outdoorWindowOrigin) {
      return null;
    }

    const centerWorldPoint = this.worldCamera.getWorldPoint(this.worldCamera.width / 2, this.worldCamera.height / 2);
    const localPoint = this.screenToTilePoint(centerWorldPoint);

    if (!localPoint) {
      return null;
    }

    return this.localToAbsoluteOutdoorPoint(localPoint);
  }

  private screenToTilePoint(point: Point): Point | null {
    const relativeX = point.x - this.origin.x;
    const relativeY = point.y - this.origin.y;
    const visualX = (relativeX / (TILE_WIDTH / 2) + relativeY / (TILE_HEIGHT / 2)) / 2;
    const visualY = (relativeY / (TILE_HEIGHT / 2) - relativeX / (TILE_WIDTH / 2)) / 2;
    const tile = this.visualToLogicalGridPoint({ x: visualX, y: visualY });

    return {
      x: Phaser.Math.Clamp(Math.round(tile.x), 0, Math.max(0, this.gridWidth - 1)),
      y: Phaser.Math.Clamp(Math.round(tile.y), 0, Math.max(0, this.gridHeight - 1))
    };
  }

  private visualToLogicalGridPoint(point: Point): Point {
    switch (((this.boardRotationStep % 4) + 4) % 4) {
      case 1:
        return {
          x: point.y,
          y: this.gridHeight - 1 - point.x
        };
      case 2:
        return {
          x: this.gridWidth - 1 - point.x,
          y: this.gridHeight - 1 - point.y
        };
      case 3:
        return {
          x: this.gridWidth - 1 - point.y,
          y: point.x
        };
      default:
        return point;
    }
  }

  private getBoardBounds(): Phaser.Geom.Rectangle {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const actors = [this.player, ...this.npcs];
    const maxSpriteHeight = Math.max(...actors.map((actor) => actor.spriteDisplayHeight), 1);

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

  private getBasePlanePoint(tile: Point): Phaser.Math.Vector2 {
    const point = getSharedBasePlanePoint(tile, {
      origin: this.origin,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      rotationStep: this.boardRotationStep
    });

    return new Phaser.Math.Vector2(point.x, point.y);
  }

  private isoToScreen(tile: Point & { height?: number }): Phaser.Math.Vector2 {
    const tileHeight = tile.height ?? getTile(this.map, tile.x, tile.y)?.height ?? 0;
    const point = isoToScreenPoint(
      tile,
      {
        origin: this.origin,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        rotationStep: this.boardRotationStep
      },
      tileHeight
    );

    return new Phaser.Math.Vector2(point.x, point.y);
  }

  private getTileTopPoints(tile: Point & { height?: number }): Phaser.Math.Vector2[] {
    return getSharedTileTopPoints(
      tile,
      {
        origin: this.origin,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        rotationStep: this.boardRotationStep
      },
      tile.height ?? getTile(this.map, tile.x, tile.y)?.height ?? 0
    ).map((point) => new Phaser.Math.Vector2(point.x, point.y));
  }

  private getTileDepth(tile: Point & { height?: number }): number {
    const tileHeight = tile.height ?? getTile(this.map, tile.x, tile.y)?.height ?? 0;
    return getSharedTileDepth(
      { ...tile, height: tileHeight },
      {
        origin: this.origin,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        rotationStep: this.boardRotationStep
      },
      tileHeight
    );
  }

  private getUnitGroundPoint(tile: Point & { height?: number }): Phaser.Math.Vector2 {
    const point = getSharedUnitGroundPoint(
      tile,
      {
        origin: this.origin,
        gridWidth: this.gridWidth,
        gridHeight: this.gridHeight,
        rotationStep: this.boardRotationStep
      },
      tile.height ?? getTile(this.map, tile.x, tile.y)?.height ?? 0,
      UNIT_GROUND_OFFSET_Y
    );

    return new Phaser.Math.Vector2(point.x, point.y);
  }

  private getHighlightDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 2;
  }

  private getPropDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 7;
  }

  private getPropBaseDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 4;
  }

  private getUnitDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 8;
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

  private getSpriteOffsetXForFacing(offsetX: number | undefined, facing: SpriteFacing): number {
    const resolvedOffsetX = offsetX ?? 0;
    return facing === 'left' ? -resolvedOffsetX : resolvedOffsetX;
  }

  private returnToTitle(): void {
    if (this.restarting) {
      return;
    }

    this.restarting = true;
    this.busy = true;
    this.input.enabled = false;
    this.input.keyboard?.removeAllListeners();
    resetWorldSession();
    this.scene.start('title');
  }

  private pushMessage(message: string): void {
    this.messages = [...this.messages.slice(-3), message];
    this.refreshUi();
  }
}
