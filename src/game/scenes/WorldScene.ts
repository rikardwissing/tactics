import Phaser from 'phaser';
import {
  DEFAULT_UNIT_IMAGE_KEY,
  FACTION_MOTTO_AUDIO_KEYS,
  UNIT_TURN_START_AUDIO_KEYS,
  getUnitPortraitImageKey
} from '../assets';
import { audioDirector } from '../audio/audioDirector';
import {
  ACTIVE_UNIT_OUTLINE_OFFSETS,
  applyBattleActorFacing,
  applyBattleIdleAnimation,
  createBattleActorView,
  DEFAULT_BATTLE_FACING,
  shouldFlipSpriteForFacing,
  syncBattleActorGlow
} from '../battle/actorViews';
import {
  type BattleIntroPhase,
  type BattleHudViewModel,
  type BattleInspectionTarget,
  type DetailPortraitKind,
  type HeaderMenuAction,
  MAP_TITLE_INTRO_DURATION,
  MAP_TITLE_INTRO_HOLD,
  MAP_TITLE_OUTRO_DURATION,
  MAP_TITLE_TOTAL_DURATION,
  coverImageBounds,
  formatBattleTerrainName,
  formatPlaqueHeaderTitle,
  getBattlePropTitle
} from '../battle/hudShared';
import {
  SHARED_BATTLE_ACTION_MENU_ROW_HEIGHT,
  SHARED_BATTLE_VISIBLE_TURN_ORDER_COUNT,
  getSharedBattleMapPlaqueHeight,
  resolveSharedBattleChromeLayout,
  resolveSharedBattleTopPanelLayout
} from '../battle/hudLayout';
import {
  clearDetailPortrait,
  drawSharedDetailPlaque,
  drawSharedHeaderMenuOverlay,
  drawSharedMapPlaque,
  drawSharedMapTitleIntro,
  drawSharedPortraitFrame,
  measureDetailPanelLayout,
  renderDetailPortrait,
  type DetailPanelLayoutMetrics
} from '../battle/hudRenderer';
import { BattleHighlightController } from '../battle/highlightController';
import {
  showSharedTurnStartCatchPhrase,
  TURN_START_CATCH_PHRASE_HEIGHT_FACTOR
} from '../battle/presentation';
import {
  BATTLE_INSPECTION_HIGHLIGHT_STYLE,
  chooseAutoBattleActionPlan,
  chooseAutoBattleItem,
  chooseAutoBattleMoveTile,
  getBattleMovementFacing,
  getInitialBattleFacing,
  isAbilityInRange,
  rotateFacingForBoardRotation,
  shouldShowBattleActiveUnitAura,
  shouldShowBattleActiveUnitFocus
} from '../battle/shared';
import { BattleRuntimeController } from '../battle/controller';
import type { BattleMoveUndoState, BattleRuntimeState, BattleRuntimeTurnState } from '../battle/runtime';
import { calculateDamage } from '../core/combat';
import { type CombatEffectDefinition, type CombatEffectId, getCombatEffectDefinition } from '../core/combatEffects';
import { clearEngineSceneMetrics, publishEngineSceneMetrics } from '../core/engineMetrics';
import { GraphicsPool } from '../core/graphicsPool';
import {
  getBasePlanePoint as getSharedBasePlanePoint,
  getTileDepth as getSharedTileDepth,
  getTileTopPoints as getSharedTileTopPoints,
  getUnitGroundPoint as getSharedUnitGroundPoint,
  isoToScreenPoint
} from '../core/isometric';
import { getInventoryEntries, getItemDefinition, ItemId } from '../core/items';
import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from '../core/mapData';
import { buildPath, getTile, getTraversalNodes, manhattanDistance, pointKey } from '../core/pathfinding';
import type { BattleUnit, FactionId, Point, ReachNode, SpriteFacing, TileData, UnitAbility } from '../core/types';
import { createBattleUnitFromBlueprint, createLevelMap, getLevel } from '../levels';
import { getFactionProfile } from '../levels/factions';
import type { LevelDefinition, MapPropPlacement } from '../levels/types';
import type {
  RuntimeBattleArenaBounds,
  RuntimeBattleIntroEntryState,
  RuntimeBattlePreservedLightSourceState,
  RuntimeBattleStartData,
  WorldSceneStartData
} from '../sceneSession';
import { BattleActionMenuStack, type ActionMenuPanelDescriptor } from './components/BattleActionMenuStack';
import { TurnOrderPanel } from './components/TurnOrderPanel';
import {
  BattleUiChrome,
  UI_INSET_RADIUS,
  UI_NARROW_HEADER_TITLE_TEXT_STYLE
} from './components/BattleUiChrome';
import {
  UI_TEXT_BODY,
  UI_TEXT_ACTION,
  UI_TEXT_DAMAGE,
  UI_TEXT_DAMAGE_CRITICAL,
  UI_TEXT_DISPLAY_CENTER,
  UI_TEXT_LABEL,
  UI_TEXT_TITLE,
  UI_TEXT_WORLD_BARK
} from './components/UiTextStyles';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_DANGER,
  UI_COLOR_OVERLAY,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_PANEL_SURFACE_ALT,
  UI_COLOR_SUCCESS,
  UI_COLOR_TEXT
} from './components/UiColors';
import { createUiGrid, createUiSubGrid } from './components/UiGrid';
import {
  UI_NARROW_PLAQUE_HEADER_HEIGHT,
  UI_PANEL_COMPACT_GAP,
  UI_PANEL_COMPACT_INSET,
  UI_PANEL_CONTENT_GAP,
  UI_PANEL_CONTENT_INSET,
  UI_PANEL_GAP,
  UI_PANEL_MICRO_GAP,
  UI_PANEL_MINI_GAP,
  UI_PANEL_TIGHT_GAP
} from './components/UiMetrics';
import {
  createWorldLeader,
  createWorldNpcs,
  DEFAULT_WORLD_SPAWN_ID,
  getChunkCoordinatesForWorldPosition,
  getWorldNpcRuntimeId,
  getWorldChunkAt,
  getWorldInterior,
  isWorldEncounterCleared,
  getWorldSpawn,
  getWorldStateVersion,
  markWorldEncounterCleared,
  persistWorldSession,
  resolveWorldSceneStart,
  resetWorldSession,
  WORLD_CHUNK_SIZE
} from '../world';
import {
  BASE_MIN_BOARD_ZOOM,
  BOARD_ZOOM_SENSITIVITY,
  DEFAULT_BOARD_ZOOM,
  drawActiveTileMarker,
  MAX_BOARD_ZOOM,
  PROP_RENDER_CONFIG,
  TERRAIN_TILE_ASSETS,
  getTerrainPalette,
  getVisibleNeighborDirections,
  getWallDepth,
  redrawBoardWalls,
  getTerrainTileAssetKey,
  UNIT_GROUND_OFFSET_Y,
  WORLD_EDGE_BASE_LEVEL
} from '../world/rendering';
import {
  createResidentWorldChunkRenderSet,
  destroyResidentWorldChunkRenderSet,
  redrawResidentWorldChunkWalls,
  type ResidentWorldChunkRenderSet,
  updateResidentWorldChunkRenderSet
} from '../world/WorldChunkRenderer';
import { getResidentChunkKey } from '../world/WorldResidencyController';
import { type WorldDynamicLightSource, WorldLightingController } from '../world/lighting';
import { WorldSpatialIndex } from '../world/spatial';
import { WorldStreamingController } from '../world/streaming';
import type {
  WorldChunkRuntime,
  WorldEncounterDefinition,
  WorldNpcRuntime,
  WorldSessionState,
  WorldTransitionDefinition
} from '../world/types';

type Phase =
  | 'idle'
  | 'moving'
  | 'menu'
  | 'detail'
  | 'transition'
  | 'battle-intro'
  | 'battle-player-menu'
  | 'battle-player-abilities'
  | 'battle-player-move'
  | 'battle-player-action'
  | 'battle-player-items'
  | 'battle-player-item-action'
  | 'battle-enemy'
  | 'battle-animating'
  | 'battle-complete';

type BattleMenuAction = 'move' | 'undo-move' | 'abilities' | 'items' | 'wait';

interface PanKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

type ActorView = ReturnType<typeof createBattleActorView>;

interface PropView {
  base: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
  shadowOverlay?: Phaser.GameObjects.Graphics;
  groundGlow?: Phaser.GameObjects.Image;
  haloGlow?: Phaser.GameObjects.Image;
  embers?: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface LocalWorldProp extends MapPropPlacement {
  absolutePosition?: Point;
}

interface LocalWorldTransition extends WorldTransitionDefinition {
  absolutePosition?: Point;
}

interface LocalWorldEncounter extends WorldEncounterDefinition {
  absolutePosition?: Point;
}

interface ResolvedOutdoorAreaState {
  centerChunk: Point;
  loadedChunks: WorldChunkRuntime[];
  playerChunk: WorldChunkRuntime | null;
  windowOrigin: Point;
  localPlayerPoint: Point;
  map: TileData[];
  props: LocalWorldProp[];
  encounters: LocalWorldEncounter[];
  transitions: LocalWorldTransition[];
  npcs: WorldNpcRuntime[];
}

interface WorldBattleState extends BattleRuntimeState {
  encounterId: string;
  runtimeBattle: RuntimeBattleStartData;
  sourcePreviewActive: boolean;
}

interface CombatEffectPlayback {
  definition: CombatEffectDefinition;
  source: BattleUnit;
  target: BattleUnit;
  sourceGroundPoint: Phaser.Math.Vector2;
  targetGroundPoint: Phaser.Math.Vector2;
  sourcePoint: Phaser.Math.Vector2;
  targetPoint: Phaser.Math.Vector2;
  angle: number;
}

type DynamicLightSource = WorldDynamicLightSource<PropView>;

type WorldBattleResultAction = 'retry' | 'return';

interface ResultOverlayButtonView {
  action: WorldBattleResultAction;
  labelText: Phaser.GameObjects.Text;
  bounds: Phaser.Geom.Rectangle;
}

type WorldHudInspection =
  | { kind: 'mission' }
  | { kind: 'battle-unit'; unit: BattleUnit }
  | { kind: 'npc'; npc: WorldNpcRuntime }
  | { kind: 'tile'; tile: TileData; prop: LocalWorldProp | null };

const DEFAULT_FACING: SpriteFacing = DEFAULT_BATTLE_FACING;
const CAMERA_PADDING_X = 320;
const CAMERA_PADDING_Y = 220;
const OUTDOOR_WINDOW_CHUNK_RADIUS = 2;
const OUTDOOR_WINDOW_CHUNK_DIAMETER = OUTDOOR_WINDOW_CHUNK_RADIUS * 2 + 1;
const WORLD_NPC_PATROL_INTERVAL_MS = 600;
const WORLD_NPC_CHASE_INTERVAL_MS = 350;
const WORLD_ENCOUNTER_ARENA_SIZE = 16;
const DEFAULT_STEP_MOVE_UP_DURATION_MS = 150;
const DEFAULT_STEP_MOVE_DOWN_DURATION_MS = 90;
const CHASE_STEP_MOVE_UP_DURATION_MS = 100;
const CHASE_STEP_MOVE_DOWN_DURATION_MS = 60;
const UNIT_CAMERA_FOCUS_HEIGHT_FACTOR = 0.5;
const BLINK_MOVEMENT_CAMERA_PAN_DURATION = 1000;
const BLINK_MOVEMENT_FADE_OUT_DURATION = 150;
const BLINK_MOVEMENT_FADE_IN_DURATION = 250;
const BLINK_MOVEMENT_ENTRY_OFFSET_Y = 14;
const NPC_INITIAL_MOVE_STAGGER_MS = 220;
const DEFAULT_WORLD_ENCOUNTER_COMPANION_BLUEPRINT_IDS = [
  'time-travelers-chronomedic',
  'time-travelers-scavenger-marksman'
] as const;
const SOFT_LIGHT_TEXTURE_KEY = 'soft-light';

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

export class WorldScene extends Phaser.Scene {
  private sessionState!: WorldSessionState;
  private phase: Phase = 'idle';
  private player!: BattleUnit;
  private npcs: WorldNpcRuntime[] = [];
  private map: TileData[] = [];
  private props: LocalWorldProp[] = [];
  private encounters: LocalWorldEncounter[] = [];
  private transitions: LocalWorldTransition[] = [];
  private gridWidth = 0;
  private gridHeight = 0;
  private areaName = '';
  private areaBackdropAssetId = 'title-backdrop';
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
  private battleInspectionTarget: BattleInspectionTarget = { kind: 'mission' };
  private headerMenuOpen = false;
  private battleIntroPhase: BattleIntroPhase = 'hud';
  private autoBattleRunToken = 0;
  private activeAutoBattleRunToken: number | null = null;

  private areaTitleText!: Phaser.GameObjects.Text;
  private backdropImage!: Phaser.GameObjects.Image;
  private backdropShade!: Phaser.GameObjects.Rectangle;
  private ambientOverlay!: Phaser.GameObjects.Rectangle;
  private battleParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private introOverlayShade!: Phaser.GameObjects.Rectangle;
  private uiGraphics!: Phaser.GameObjects.Graphics;
  private mapPlaqueArt!: Phaser.GameObjects.Image;
  private mapPlaqueArtMask!: Phaser.GameObjects.Graphics;
  private mapIntroArt!: Phaser.GameObjects.Image;
  private mapIntroArtMask!: Phaser.GameObjects.Graphics;
  private mapPlaqueTitleText!: Phaser.GameObjects.Text;
  private mapPlaqueMetaText!: Phaser.GameObjects.Text;
  private mapObjectiveText!: Phaser.GameObjects.Text;
  private mapIntroEyebrowText!: Phaser.GameObjects.Text;
  private mapIntroTitleText!: Phaser.GameObjects.Text;
  private mapIntroMetaText!: Phaser.GameObjects.Text;
  private mapIntroFlavorText!: Phaser.GameObjects.Text;
  private headerMenuTitleText!: Phaser.GameObjects.Text;
  private headerMenuOptionTexts: Phaser.GameObjects.Text[] = [];
  private activeBadge!: Phaser.GameObjects.Text;
  private detailMetaText!: Phaser.GameObjects.Text;
  private detailTitleText!: Phaser.GameObjects.Text;
  private detailStatTexts: Phaser.GameObjects.Text[] = [];
  private detailBodyText!: Phaser.GameObjects.Text;
  private portraitMask!: Phaser.GameObjects.Graphics;
  private portrait!: Phaser.GameObjects.Image;
  private actionMenuStack!: BattleActionMenuStack;
  private playerAvatarPanel!: TurnOrderPanel;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private headerRect = new Phaser.Geom.Rectangle();
  private mapIntroBounds = new Phaser.Geom.Rectangle();
  private mapIntroArtBounds = new Phaser.Geom.Rectangle();
  private mapIntroArtImageBounds = new Phaser.Geom.Rectangle();
  private mapIntroTextBounds = new Phaser.Geom.Rectangle();
  private mapIntroEyebrowBounds = new Phaser.Geom.Rectangle();
  private headerMenuButtonBounds = new Phaser.Geom.Rectangle();
  private headerMenuPanelBounds = new Phaser.Geom.Rectangle();
  private headerMenuOptionBounds = Array.from({ length: 4 }, () => new Phaser.Geom.Rectangle());
  private turnOrderBounds = new Phaser.Geom.Rectangle();
  private playAreaRect = new Phaser.Geom.Rectangle();
  private mapObjectiveBoxBounds = new Phaser.Geom.Rectangle();
  private detailBodyBoxBounds = new Phaser.Geom.Rectangle();
  private detailHealthBarBounds = new Phaser.Geom.Rectangle();
  private detailStatChipBounds = Array.from({ length: 4 }, () => new Phaser.Geom.Rectangle());
  private mapIntroAlpha = 0;
  private mapIntroOffsetY = 18;
  private mapPlaqueAlpha = 1;
  private mapPlaqueOffsetX = 0;
  private detailPanelAlpha = 0;
  private detailPanelOffsetX = 24;
  private detailPanelSelectionKey: string | null = null;
  private detailPanelTween?: Phaser.Tweens.Tween;
  private showDetailPanel = false;
  private showPortraitPanel = true;
  private showTimelinePanel = true;
  private visibleTurnOrderCount = SHARED_BATTLE_VISIBLE_TURN_ORDER_COUNT;
  private actionMenuRowHeight = SHARED_BATTLE_ACTION_MENU_ROW_HEIGHT;
  private uiPanels = {
    topRight: new Phaser.Geom.Rectangle(),
    portrait: new Phaser.Geom.Rectangle()
  };
  private turnStartCatchPhraseText: Phaser.GameObjects.Text | null = null;
  private turnStartCatchPhraseEvent: Phaser.Time.TimerEvent | null = null;
  private turnStartCatchPhraseSound: Phaser.Sound.BaseSound | null = null;
  private factionMottoSound: Phaser.Sound.BaseSound | null = null;
  private factionMottoPlayed = new Set<FactionId>();
  private pendingFactionMottoId: FactionId | null = null;
  private resultOverlayResult: 'Victory' | 'Defeat' | null = null;
  private resultOverlayShade?: Phaser.GameObjects.Rectangle;
  private resultOverlayPanel?: Phaser.GameObjects.Graphics;
  private resultOverlayArt?: Phaser.GameObjects.Image;
  private resultOverlayArtMask?: Phaser.GameObjects.Graphics;
  private resultOverlayEyebrow?: Phaser.GameObjects.Text;
  private resultOverlayTitle?: Phaser.GameObjects.Text;
  private resultOverlayBody?: Phaser.GameObjects.Text;
  private resultOverlayButtons: ResultOverlayButtonView[] = [];
  private resultOverlayPanelBounds = new Phaser.Geom.Rectangle();

  private terrainTileImages: Phaser.GameObjects.Image[] = [];
  private wallGraphics: Phaser.GameObjects.Graphics[] = [];
  private arenaPreviewWallGraphics: Phaser.GameObjects.Graphics[] = [];
  private outdoorChunkRenderSets = new Map<string, ResidentWorldChunkRenderSet>();
  private propViews = new Map<string, PropView>();
  private actorViews = new Map<string, ActorView>();
  private unitInventories = new Map<string, Partial<Record<ItemId, number>>>();
  private lightGroundOverlays: Phaser.GameObjects.Graphics[] = [];
  private lightShadowOverlays: Phaser.GameObjects.Graphics[] = [];
  private lightGroundOverlayPool!: GraphicsPool;
  private lightShadowOverlayPool!: GraphicsPool;
  private highlightController!: BattleHighlightController;
  private freezeWorldDynamicLighting = false;
  private readonly battleRuntimeController = new BattleRuntimeController();
  private readonly outdoorSpatialIndex = new WorldSpatialIndex();
  private readonly outdoorStreamingController = new WorldStreamingController(OUTDOOR_WINDOW_CHUNK_RADIUS);
  private readonly worldLightingController = new WorldLightingController<PropView>();
  private hudDirty = false;
  private highlightsDirty = false;
  private turnOrderDirty = false;
  private battleShellDirty = false;
  private highlightInvalidations = 0;
  private hudInvalidations = 0;
  private lightingInvalidations = 0;
  private turnOrderInvalidations = 0;
  private battleShellInvalidations = 0;
  private hudRefreshCount = 0;
  private lightingRefreshCount = 0;
  private lastMetricsPublishAt = 0;
  private battleObjectCountBaseline: number | null = null;
  private battleObjectCountDelta: number | null = null;

  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private panKeys?: PanKeys;
  private worldCamera!: Phaser.Cameras.Scene2D.Camera;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private cameraBounds = new Phaser.Geom.Rectangle();
  private worldStateVersion = 0;
  private npcNextMoveAt = new Map<string, number>();
  private npcPatrolIndices = new Map<string, number>();
  private movingNpcIds = new Set<string>();
  private worldBattle: WorldBattleState | null = null;
  private battleTimeOfDay: TimeOfDayId = 'dusk';

  constructor() {
    super('world');
  }

  init(data?: WorldSceneStartData): void {
    this.phase = 'idle';
    this.battleInspectionTarget = { kind: 'mission' };
    this.headerMenuOpen = false;
    this.battleIntroPhase = 'hud';
    this.autoBattleRunToken = 0;
    this.activeAutoBattleRunToken = null;
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
    this.uiCamera = undefined;
    this.npcNextMoveAt.clear();
    this.npcPatrolIndices.clear();
    this.movingNpcIds.clear();
    this.worldBattle = null;
    this.factionMottoPlayed.clear();
    this.pendingFactionMottoId = null;
    this.hudDirty = false;
    this.highlightsDirty = false;
    this.turnOrderDirty = false;
    this.battleShellDirty = false;
    this.highlightInvalidations = 0;
    this.hudInvalidations = 0;
    this.lightingInvalidations = 0;
    this.turnOrderInvalidations = 0;
    this.battleShellInvalidations = 0;
    this.hudRefreshCount = 0;
    this.lightingRefreshCount = 0;
    this.lastMetricsPublishAt = 0;
    this.battleObjectCountBaseline = null;
    this.battleObjectCountDelta = null;
    this.detailPanelTween?.remove();
    this.detailPanelTween = undefined;
    this.showDetailPanel = false;
    this.showPortraitPanel = true;
    this.mapIntroAlpha = 0;
    this.mapIntroOffsetY = 18;
    this.mapPlaqueAlpha = 1;
    this.mapPlaqueOffsetX = 0;
    this.detailPanelAlpha = 0;
    this.detailPanelOffsetX = 24;
    this.detailPanelSelectionKey = null;
    this.clearTurnStartCatchPhrase();
    this.destroyWorldBattleResultOverlay();
    this.freezeWorldDynamicLighting = false;
  }

  create(): void {
    audioDirector.bindScene(this);
    audioDirector.setMusic('setup');
    void audioDirector.unlock().catch(() => undefined);
    this.syncSceneAudioMute();

    this.worldCamera = this.cameras.main;
    this.worldCamera.setZoom(DEFAULT_BOARD_ZOOM);
    this.input.addPointer(2);
    this.createLightTexture();
    this.backdropImage = this.registerWorldObject(
      this.add.image(this.scale.width / 2, this.scale.height / 2, this.getHudBackdropImageKey()).setScrollFactor(0).setAlpha(0)
    );
    this.backdropShade = this.registerWorldObject(
      this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x12070d, 0)
        .setScrollFactor(0)
        .setDepth(1)
    );
    this.ambientOverlay = this.registerWorldObject(
      this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x102746, 0)
        .setScrollFactor(0)
        .setDepth(44)
    );

    this.areaTitleText = this.registerUiObject(this.add.text(28, 22, '', UI_TEXT_TITLE).setScrollFactor(0).setDepth(950));
    this.areaTitleText.setColor(UI_COLOR_TEXT);
    this.introOverlayShade = this.registerUiObject(
      this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, UI_COLOR_OVERLAY, 0)
        .setScrollFactor(0)
        .setDepth(942)
    );
    this.mapPlaqueArt = this.registerUiObject(
      this.add.image(0, 0, this.getHudBackdropImageKey()).setOrigin(0.5).setVisible(false).setScrollFactor(0).setDepth(943)
    );
    this.mapPlaqueArtMask = this.registerUiObject(
      this.add.graphics().setVisible(false).setScrollFactor(0).setDepth(943)
    );
    this.mapPlaqueArt.setMask(this.mapPlaqueArtMask.createGeometryMask());
    this.mapIntroArt = this.registerUiObject(
      this.add.image(0, 0, this.getHudBackdropImageKey()).setOrigin(0.5).setVisible(false).setScrollFactor(0).setDepth(943)
    );
    this.mapIntroArtMask = this.registerUiObject(
      this.add.graphics().setVisible(false).setScrollFactor(0).setDepth(943)
    );
    this.mapIntroArt.setMask(this.mapIntroArtMask.createGeometryMask());
    this.uiGraphics = this.registerUiObject(this.add.graphics().setScrollFactor(0).setDepth(944));
    this.mapPlaqueTitleText = this.registerUiObject(this.add.text(0, 0, '', UI_NARROW_HEADER_TITLE_TEXT_STYLE).setScrollFactor(0).setDepth(946));
    this.mapPlaqueMetaText = this.registerUiObject(this.add.text(0, 0, '', UI_TEXT_BODY).setScrollFactor(0).setDepth(946));
    this.mapObjectiveText = this.registerUiObject(this.add.text(0, 0, '', UI_TEXT_BODY).setScrollFactor(0).setDepth(946));
    this.mapIntroEyebrowText = this.registerUiObject(
      this.add.text(0, 0, '', UI_TEXT_LABEL).setOrigin(0, 0.5).setScrollFactor(0).setDepth(946)
    );
    this.mapIntroTitleText = this.registerUiObject(
      this.add.text(0, 0, '', UI_TEXT_TITLE).setOrigin(0, 0).setScrollFactor(0).setDepth(946)
    );
    this.mapIntroMetaText = this.registerUiObject(
      this.add.text(0, 0, '', UI_TEXT_BODY).setOrigin(0, 0).setScrollFactor(0).setDepth(946)
    );
    this.mapIntroFlavorText = this.registerUiObject(
      this.add.text(0, 0, '', UI_TEXT_BODY).setOrigin(0, 0).setScrollFactor(0).setDepth(946)
    );
    this.headerMenuTitleText = this.registerUiObject(
      this.add.text(0, 0, 'PAUSED', UI_NARROW_HEADER_TITLE_TEXT_STYLE).setOrigin(0, 0.5).setVisible(false).setScrollFactor(0).setDepth(947)
    );
    this.headerMenuOptionTexts = Array.from({ length: 4 }, () =>
      this.registerUiObject(
        this.add.text(0, 0, '', UI_TEXT_ACTION).setVisible(false).setScrollFactor(0).setDepth(947)
      )
    );
    this.activeBadge = this.registerUiObject(this.add.text(0, 0, '', UI_NARROW_HEADER_TITLE_TEXT_STYLE).setScrollFactor(0).setDepth(947));
    this.detailMetaText = this.registerUiObject(this.add.text(0, 0, '', UI_TEXT_BODY).setScrollFactor(0).setDepth(947));
    this.detailTitleText = this.registerUiObject(this.add.text(0, 0, '', UI_TEXT_TITLE).setScrollFactor(0).setDepth(947));
    this.detailStatTexts = Array.from({ length: 4 }, () =>
      this.registerUiObject(this.add.text(0, 0, '', UI_TEXT_LABEL).setScrollFactor(0).setDepth(947))
    );
    this.detailBodyText = this.registerUiObject(this.add.text(0, 0, '', UI_TEXT_BODY).setScrollFactor(0).setDepth(947));
    this.portraitMask = this.registerUiObject(this.add.graphics().setScrollFactor(0).setVisible(false).setDepth(945));
    this.portrait = this.registerUiObject(
      this.add.image(0, 0, DEFAULT_UNIT_IMAGE_KEY).setScrollFactor(0).setDepth(946).setVisible(false)
    );
    this.portrait.setMask(this.portraitMask.createGeometryMask());

    this.boardGraphics = this.registerWorldObject(this.add.graphics().setDepth(40));
    this.lightGroundOverlayPool = new GraphicsPool(this, (object) => this.registerWorldObject(object));
    this.lightShadowOverlayPool = new GraphicsPool(this, (object) => this.registerWorldObject(object));
    this.highlightController = new BattleHighlightController(this, (object) => this.registerWorldObject(object));
    this.actionMenuStack = new BattleActionMenuStack(this, {
      onCreateObject: (object) => {
        this.registerUiObject(object);
      }
    });
    this.playerAvatarPanel = new TurnOrderPanel(this, 6);
    this.createBattleParticles();

    this.rebuildArea(true);
    this.registerInputs();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.handleResize();
  }

  update(time: number, delta: number): void {
    try {
      if (!this.isWorldBattleActive()) {
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

        this.maybeAdvanceNpcPatrols(time);
      } else {
        this.updateBattleActorGlowFade(time);
      }

      if (!this.freezeWorldDynamicLighting) {
        this.updateWorldDynamicLighting(time);
      }

      if (this.phase === 'transition' || this.isPanning || this.headerMenuOpen) {
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
    } finally {
      this.flushSceneInvalidations(time);
    }
  }

  private isBattleIntroActive(): boolean {
    return this.isWorldBattleActive() && this.battleIntroPhase === 'intro';
  }

  private setPauseMenuOpen(open: boolean): void {
    if (this.headerMenuOpen === open) {
      return;
    }

    this.headerMenuOpen = open;
    this.time.timeScale = open ? 0 : 1;
    this.tweens.timeScale = open ? 0 : 1;
  }

  private handleShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
    this.setPauseMenuOpen(false);
    this.detailPanelTween?.remove();
    this.detailPanelTween = undefined;
    this.clearTurnStartCatchPhrase();
    this.stopFactionMottoSound();
    this.destroyWorldBattleResultOverlay();
    this.actionMenuStack.destroy();
    this.lightGroundOverlayPool?.destroy();
    this.lightShadowOverlayPool?.destroy();
    this.highlightController?.destroy();
    this.uiCamera?.destroy();
    this.uiCamera = undefined;
    clearEngineSceneMetrics('WorldScene');
  }

  private invalidateHud(): void {
    this.hudDirty = true;
    this.hudInvalidations += 1;
  }

  private invalidateHighlights(): void {
    this.highlightsDirty = true;
    this.highlightInvalidations += 1;
  }

  private invalidateTurnOrder(): void {
    this.turnOrderDirty = true;
    this.turnOrderInvalidations += 1;
  }

  private invalidateLighting(): void {
    this.lightingInvalidations += 1;
  }

  private invalidateBattleShell(): void {
    this.battleShellDirty = true;
    this.battleShellInvalidations += 1;
  }

  private invalidatePresentation(): void {
    this.invalidateHud();
    this.invalidateHighlights();
  }

  private invalidateBattlePresentation(): void {
    this.invalidateHud();
    this.invalidateHighlights();
    this.invalidateTurnOrder();
  }

  private flushSceneInvalidations(time: number): void {
    if (this.highlightsDirty) {
      this.highlightsDirty = false;
      this.drawHighlights();
    }

    if (this.hudDirty || this.turnOrderDirty || this.battleShellDirty) {
      this.hudDirty = false;
      this.turnOrderDirty = false;
      this.battleShellDirty = false;
      this.refreshUi();
    }

    this.publishSceneMetrics(time);
  }

  private publishSceneMetrics(time: number): void {
    if (time - this.lastMetricsPublishAt < 200) {
      return;
    }

    this.lastMetricsPublishAt = time;
    publishEngineSceneMetrics({
      scene: 'WorldScene',
      childCount: this.children.list.length,
      residentChunkCount: this.outdoorChunkRenderSets.size,
      pooledHighlightObjects: this.highlightController?.getPoolSize() ?? 0,
      highlightDrawCount: this.highlightController?.getDrawCount() ?? 0,
      highlightInvalidations: this.highlightInvalidations,
      hudRefreshCount: this.hudRefreshCount,
      hudInvalidations: this.hudInvalidations,
      lightingRefreshCount: this.lightingRefreshCount,
      lightingInvalidations: this.lightingInvalidations,
      turnOrderInvalidations: this.turnOrderInvalidations,
      battleShellInvalidations: this.battleShellInvalidations,
      battleObjectCountBaseline: this.battleObjectCountBaseline,
      battleObjectCountDelta: this.battleObjectCountDelta,
      updatedAt: time
    });
  }

  private getWorldBattleRuntimeState(): WorldBattleState | null {
    return this.worldBattle;
  }

  private applyWorldBattleTurnState(state: BattleRuntimeTurnState): void {
    if (!this.worldBattle) {
      return;
    }

    this.worldBattle.activeUnitId = state.activeUnitId;
    this.worldBattle.selectedAbilityId = state.selectedAbilityId;
    this.worldBattle.selectedItemId = state.selectedItemId;
    this.worldBattle.turnMoveUsed = state.turnMoveUsed;
    this.worldBattle.turnActionUsed = state.turnActionUsed;
    this.worldBattle.pendingMoveUndo = state.pendingMoveUndo;
    this.worldBattle.autoBattleEnabled = state.autoBattleEnabled;
  }

  private registerInputs(): void {
    this.input.removeAllListeners();
    this.input.mouse?.disableContextMenu();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isBattleIntroActive()) {
        if (this.hoverTile) {
          this.hoverTile = null;
          this.invalidateHighlights();
        }
        return;
      }

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

      if (this.isPointerOverUi(pointer.x, pointer.y)) {
        if (this.hoverTile) {
          this.hoverTile = null;
          this.invalidateHighlights();
        }
        return;
      }

      const worldPoint = pointer.positionToCamera(this.worldCamera) as Phaser.Math.Vector2;
      this.hoverTile = this.pickTile(worldPoint.x, worldPoint.y);
      this.invalidateHighlights();
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
        if (this.isBattleIntroActive() || this.isPointerOverUi(pointer.x, pointer.y) || this.phase === 'transition') {
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
      if (this.isBattleIntroActive() || this.headerMenuOpen) {
        return;
      }

      if (this.isWorldBattleActive()) {
        void this.handleWorldBattleSpaceKey();
        return;
      }

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
      this.invalidatePresentation();
    });
    this.input.keyboard?.on('keydown-R', (event: KeyboardEvent) => {
      if (this.isBattleIntroActive() || event.repeat) {
        return;
      }

      if (this.isWorldBattleActive()) {
        void this.restartWorldEncounterBattle();
        return;
      }

      this.resetWorldVisit();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isBattleIntroActive()) {
        return;
      }

      if (this.isWorldBattleActive()) {
        if (this.phase === 'battle-complete') {
          void this.executeWorldBattleResultAction('return');
          return;
        }

        this.setPauseMenuOpen(!this.headerMenuOpen);
        this.invalidateHud();
        return;
      }

      if (this.headerMenuOpen) {
        this.setPauseMenuOpen(false);
        this.invalidateHud();
        return;
      }

      if (this.phase === 'detail') {
        audioDirector.playUiCancel();
        this.selectedNpcActionId = null;
        this.phase = this.getInteractionNpc() ? 'menu' : 'idle';
        this.invalidatePresentation();
        return;
      }

      if (this.phase === 'menu') {
        audioDirector.playUiCancel();
        this.focusedNpcId = null;
        this.selectedNpcActionId = null;
        this.phase = 'idle';
        this.invalidatePresentation();
        return;
      }

      this.returnToTitle();
    });
    this.input.keyboard?.on('keydown-Q', () => this.rotateBoard(-1));
    this.input.keyboard?.on('keydown-E', () => this.rotateBoard(1));
    this.input.keyboard?.on('keydown-T', () => {
      if (this.isBattleIntroActive()) {
        return;
      }

      this.cycleBattleTimeOfDay();
    });
    this.input.keyboard?.on('keydown-M', () => {
      if (this.isBattleIntroActive()) {
        return;
      }
      const muted = audioDirector.toggleMute();
      this.syncSceneAudioMute();
      this.pushMessage(`Audio ${muted ? 'muted' : 'enabled'}.`);
      this.invalidateHud();
    });
  }

  private async handleWorldBattleSpaceKey(): Promise<void> {
    if (!this.isWorldBattleActive() || this.busy || this.phase === 'battle-complete' || this.headerMenuOpen) {
      return;
    }

    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit) {
      return;
    }

    if (this.phase === 'battle-player-menu') {
      audioDirector.playUiConfirm();
      this.pushMessage(`${activeUnit.name} waits and watches the ridge.`);
      await this.endWorldBattleTurn();
      return;
    }

    switch (this.phase) {
      case 'battle-player-items':
      case 'battle-player-item-action':
      case 'battle-player-abilities':
      case 'battle-player-action':
      case 'battle-player-move':
        this.cancelBattleSelectionPhase();
        return;
      default:
        return;
    }
  }

  private handleResize(): void {
    this.worldCamera.setSize(this.scale.width, this.scale.height);
    this.backdropImage
      .setPosition(this.scale.width / 2, this.scale.height / 2)
      .setDisplaySize(this.scale.width * 1.18, this.scale.height * 1.18);
    this.backdropShade
      .setPosition(this.scale.width / 2, this.scale.height / 2)
      .setSize(this.scale.width * 1.22, this.scale.height * 1.22);
    this.ambientOverlay
      .setPosition(this.scale.width / 2, this.scale.height / 2)
      .setSize(this.scale.width * 1.22, this.scale.height * 1.22);
    this.introOverlayShade.setPosition(this.scale.width / 2, this.scale.height / 2).setSize(this.scale.width, this.scale.height);
    this.syncBackdropScreenScale();
    this.applyBattlePresentationShell();

    this.uiCamera?.setViewport(0, 0, this.scale.width, this.scale.height).setSize(this.scale.width, this.scale.height);
    this.layoutBattleHud(this.scale.width, this.scale.height);
    this.layoutWorldBattleResultOverlay();
    this.refreshUi();
    this.configureCamera(false);
  }

  private rebuildArea(centerCamera: boolean, outdoorCenterChunkOverride?: Point, outdoorFocusPoint?: Point): void {
    const facingOverrides = this.captureActorFacingOverrides();
    this.destroyAreaObjects();

    if (this.sessionState.areaKind === 'outdoor') {
      this.buildOutdoorArea(outdoorCenterChunkOverride);
    } else {
      this.buildInteriorArea();
    }

    this.reconcileEncounterSuppression();
    this.origin = new Phaser.Math.Vector2(this.gridHeight * (TILE_WIDTH / 2) + 160, 176);

    if (this.sessionState.areaKind === 'outdoor') {
      this.boardGraphics.clear();
      this.rebuildOutdoorChunkRenderSets(true);
      this.syncOutdoorPropViews(true);
      this.createActors(facingOverrides);
    } else {
      this.drawBoard();
      this.createTerrainTiles();
      this.createProps();
      this.createActors(facingOverrides);
    }

    this.setupCameras();
    this.configureCamera(centerCamera);
    this.applyBattlePresentationShell();

    if (this.sessionState.areaKind === 'outdoor' && outdoorFocusPoint) {
      this.centerCameraOnOutdoorPoint(outdoorFocusPoint);
    }

    this.drawHighlights();
    this.refreshUi();
  }

  private resolveOutdoorAreaState(centerChunkOverride?: Point): ResolvedOutdoorAreaState {
    const outdoorPosition = { ...this.sessionState.outdoorPosition };
    const centerChunk = centerChunkOverride ?? getChunkCoordinatesForWorldPosition(outdoorPosition);
    const loadedChunks = this.outdoorStreamingController.getWindowChunks(centerChunk);
    const playerChunk = getWorldChunkAt(centerChunk.x, centerChunk.y);
    const windowOrigin = {
      x: (centerChunk.x - OUTDOOR_WINDOW_CHUNK_RADIUS) * WORLD_CHUNK_SIZE,
      y: (centerChunk.y - OUTDOOR_WINDOW_CHUNK_RADIUS) * WORLD_CHUNK_SIZE
    };
    const localPlayerPoint = {
      x: outdoorPosition.x - windowOrigin.x,
      y: outdoorPosition.y - windowOrigin.y
    };
    const map: TileData[] = [];
    const props: LocalWorldProp[] = [];
    const encounters: LocalWorldEncounter[] = [];
    const transitions: LocalWorldTransition[] = [];
    const npcDefinitions = [];

    for (const chunk of loadedChunks) {
      const offsetX = (chunk.chunkX - (centerChunk.x - OUTDOOR_WINDOW_CHUNK_RADIUS)) * WORLD_CHUNK_SIZE;
      const offsetY = (chunk.chunkY - (centerChunk.y - OUTDOOR_WINDOW_CHUNK_RADIUS)) * WORLD_CHUNK_SIZE;

      for (let y = 0; y < chunk.height; y += 1) {
        for (let x = 0; x < chunk.width; x += 1) {
          map.push({
            x: offsetX + x,
            y: offsetY + y,
            height: chunk.heights[y]?.[x] ?? 0,
            terrain: chunk.terrain[y]?.[x] ?? 'grass'
          });
        }
      }

      props.push(
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
      transitions.push(
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
      encounters.push(
        ...chunk.encounters.map((encounter) => ({
          ...encounter,
          x: offsetX + encounter.x,
          y: offsetY + encounter.y,
          absolutePosition: {
            x: chunk.chunkX * WORLD_CHUNK_SIZE + encounter.x,
            y: chunk.chunkY * WORLD_CHUNK_SIZE + encounter.y
          }
        }))
      );
      npcDefinitions.push(
        ...chunk.npcs.flatMap((npc) => {
          const runtimeId = getWorldNpcRuntimeId('outdoor', npc.id);
          const persistedState = this.sessionState.outdoorNpcStates[runtimeId];
          const absolutePosition = persistedState?.absolutePosition ?? {
            x: chunk.chunkX * WORLD_CHUNK_SIZE + npc.x,
            y: chunk.chunkY * WORLD_CHUNK_SIZE + npc.y
          };
          const localPosition = {
            x: absolutePosition.x - windowOrigin.x,
            y: absolutePosition.y - windowOrigin.y
          };

          if (
            localPosition.x < 0 ||
            localPosition.x >= WORLD_CHUNK_SIZE * OUTDOOR_WINDOW_CHUNK_DIAMETER ||
            localPosition.y < 0 ||
            localPosition.y >= WORLD_CHUNK_SIZE * OUTDOOR_WINDOW_CHUNK_DIAMETER
          ) {
            return [];
          }

          return [{
            ...npc,
            x: localPosition.x,
            y: localPosition.y,
            patrolPath: npc.patrolPath.map((point) => ({
              x: offsetX + point.x,
              y: offsetY + point.y
            }))
          }];
        })
      );
    }

    return {
      centerChunk,
      loadedChunks,
      playerChunk,
      windowOrigin,
      localPlayerPoint,
      map,
      props,
      encounters,
      transitions,
      npcs: createWorldNpcs('outdoor', npcDefinitions)
    };
  }

  private applyResolvedOutdoorAreaState(resolved: ResolvedOutdoorAreaState): void {
    this.outdoorCenterChunk = resolved.centerChunk;
    this.outdoorWindowOrigin = resolved.windowOrigin;
    this.gridWidth = WORLD_CHUNK_SIZE * OUTDOOR_WINDOW_CHUNK_DIAMETER;
    this.gridHeight = WORLD_CHUNK_SIZE * OUTDOOR_WINDOW_CHUNK_DIAMETER;
    this.map = resolved.map;
    this.props = resolved.props;
    this.encounters = resolved.encounters;
    this.transitions = resolved.transitions;
    this.areaName = resolved.playerChunk?.name ?? 'Ruined March';
    this.areaBackdropAssetId = resolved.playerChunk?.backdropAssetId ?? 'title-backdrop';
    this.outdoorSpatialIndex.update(this.map, this.outdoorWindowOrigin);
  }

  private buildOutdoorArea(centerChunkOverride?: Point): void {
    const resolved = this.resolveOutdoorAreaState(centerChunkOverride);
    this.applyResolvedOutdoorAreaState(resolved);
    this.player = createWorldLeader(resolved.localPlayerPoint);
    this.npcs = resolved.npcs;
    this.restoreOutdoorNpcPatrolIndices();
    this.syncOutdoorNpcStatesWithRuntime();
  }

  private streamOutdoorArea(centerChunk: Point, focusPoint: Point): void {
    const previousScroll = new Phaser.Math.Vector2(this.worldCamera.scrollX, this.worldCamera.scrollY);
    const previousAnchor = this.getOutdoorCameraAnchorScenePoint(focusPoint);
    const resolved = this.resolveOutdoorAreaState(centerChunk);
    this.applyResolvedOutdoorAreaState(resolved);
    this.player.x = resolved.localPlayerPoint.x;
    this.player.y = resolved.localPlayerPoint.y;
    this.reconcileOutdoorNpcs(resolved.npcs);
    this.rebuildOutdoorChunkRenderSets(false);
    this.syncOutdoorPropViews(false);
    this.syncOutdoorActorViews();
    this.configureCamera(false);
    const nextAnchor = this.getOutdoorCameraAnchorScenePoint(focusPoint);

    if (previousAnchor && nextAnchor) {
      this.setCameraScroll(
        previousScroll.x + (nextAnchor.x - previousAnchor.x),
        previousScroll.y + (nextAnchor.y - previousAnchor.y)
      );
    } else {
      this.centerCameraOnOutdoorPoint(focusPoint);
    }

    this.applyBattlePresentationShell();
    if (!this.freezeWorldDynamicLighting) {
      this.updateWorldDynamicLighting(this.time.now);
    }
    this.drawHighlights();
    this.refreshUi();
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
    this.encounters = [];
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
    this.areaBackdropAssetId = interior.backdropAssetId ?? 'title-backdrop';
    this.outdoorSpatialIndex.update(this.map, null);
  }

  private restoreOutdoorNpcPatrolIndices(): void {
    if (this.sessionState.areaKind !== 'outdoor') {
      return;
    }

    for (const npc of this.npcs) {
      const persistedState = this.sessionState.outdoorNpcStates[npc.id];

      if (!persistedState || npc.patrolPath.length === 0) {
        continue;
      }

      this.npcPatrolIndices.set(
        npc.id,
        Phaser.Math.Clamp(persistedState.patrolIndex, 0, Math.max(0, npc.patrolPath.length - 1))
      );
    }
  }

  private syncOutdoorNpcStatesWithRuntime(): void {
    if (this.sessionState.areaKind !== 'outdoor' || !this.outdoorWindowOrigin) {
      return;
    }

    const outdoorNpcStates = { ...this.sessionState.outdoorNpcStates };

    for (const npc of this.npcs) {
      outdoorNpcStates[npc.id] = {
        absolutePosition: this.localToAbsoluteOutdoorPoint({ x: npc.x, y: npc.y }),
        patrolIndex: this.npcPatrolIndices.get(npc.id) ?? 0
      };
    }

    this.sessionState = persistWorldSession({
      ...this.sessionState,
      outdoorNpcStates
    });
  }

  private rebuildOutdoorAreaForCamera(): boolean {
    if (
      this.isWorldBattleActive() ||
      this.sessionState.areaKind !== 'outdoor' ||
      !this.outdoorCenterChunk ||
      this.isPanning ||
      this.movingNpcIds.size > 0 ||
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

    this.streamOutdoorArea(centerChunk, focusPoint);
    this.phase = 'idle';
    return true;
  }

  private rebuildOutdoorChunkRenderSets(forceRecreate: boolean): void {
    if (!this.outdoorCenterChunk || !this.outdoorWindowOrigin) {
      return;
    }

    const residentDiff = this.outdoorStreamingController.diffResidentChunks(
      this.outdoorChunkRenderSets.keys(),
      this.outdoorCenterChunk
    );
    const desiredChunks = this.outdoorStreamingController.getWindowChunks(this.outdoorCenterChunk);

    if (forceRecreate) {
      this.destroyOutdoorChunkRenderSets();
    } else {
      for (const key of residentDiff.leaving) {
        const renderSet = this.outdoorChunkRenderSets.get(key);

        if (!renderSet) {
          continue;
        }

        destroyResidentWorldChunkRenderSet(renderSet);
        this.outdoorChunkRenderSets.delete(key);
      }
    }

    for (const chunk of desiredChunks) {
      const key = getResidentChunkKey(chunk.chunkX, chunk.chunkY);
      const localOffset = {
        x: chunk.chunkX * WORLD_CHUNK_SIZE - this.outdoorWindowOrigin.x,
        y: chunk.chunkY * WORLD_CHUNK_SIZE - this.outdoorWindowOrigin.y
      };
      const existing = this.outdoorChunkRenderSets.get(key);

      if (existing) {
        updateResidentWorldChunkRenderSet(existing, localOffset, {
          isoToScreen: (tile) => this.isoToScreen(tile),
          getTileDepth: (tile) => this.getTileDepth(tile)
        });
        continue;
      }

      const renderSet = createResidentWorldChunkRenderSet({
        scene: this,
        registerWorldObject: <T extends Phaser.GameObjects.GameObject>(object: T) => this.registerWorldObject(object),
        chunk,
        localOffset,
        isoToScreen: (tile) => this.isoToScreen(tile),
        getTileDepth: (tile) => this.getTileDepth(tile),
        getTileTopPoints: (tile) => this.getTileTopPoints(tile)
      });
      this.outdoorChunkRenderSets.set(key, renderSet);
    }

    this.terrainTileImages = [];
    this.wallGraphics = [];

    for (const chunk of desiredChunks) {
      const key = getResidentChunkKey(chunk.chunkX, chunk.chunkY);
      const renderSet = this.outdoorChunkRenderSets.get(key);

      if (!renderSet) {
        continue;
      }

      this.terrainTileImages.push(...renderSet.terrainTiles.map((entry) => entry.image));
      this.wallGraphics.push(
        ...redrawResidentWorldChunkWalls({
          scene: this,
          registerWorldObject: <T extends Phaser.GameObjects.GameObject>(object: T) => this.registerWorldObject(object),
          renderSet,
          residentMap: this.map,
          boardRotationStep: this.boardRotationStep,
          hasWorldChunkAt: (chunkX, chunkY) => this.outdoorStreamingController.hasWorldChunkAt(chunkX, chunkY),
          isoToScreen: (tile) => this.isoToScreen(tile),
          getTileDepth: (tile) => this.getTileDepth(tile),
          getTileTopPoints: (tile) => this.getTileTopPoints(tile)
        })
      );
    }
  }

  private destroyOutdoorChunkRenderSets(): void {
    for (const renderSet of this.outdoorChunkRenderSets.values()) {
      destroyResidentWorldChunkRenderSet(renderSet);
    }

    this.outdoorChunkRenderSets.clear();
    this.terrainTileImages = [];
    this.wallGraphics = [];
  }

  private destroyPropView(propId: string): void {
    const view = this.propViews.get(propId);

    if (!view) {
      return;
    }

    view.base.destroy();
    view.image.destroy();
    view.shadowOverlay?.destroy();
    view.groundGlow?.destroy();
    view.haloGlow?.destroy();
    view.embers?.destroy();
    this.propViews.delete(propId);
  }

  private createPropView(prop: LocalWorldProp): PropView {
    const config = PROP_RENDER_CONFIG[prop.assetId];
    const base = this.registerWorldObject(this.add.graphics());
    const image = this.registerWorldObject(this.add.image(0, 0, prop.assetId).setOrigin(0.5, 1));
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
      view.groundGlow = this.registerWorldObject(
        this.add
          .image(0, 0, SOFT_LIGHT_TEXTURE_KEY)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0)
      );
      view.haloGlow = this.registerWorldObject(
        this.add
          .image(0, 0, SOFT_LIGHT_TEXTURE_KEY)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0)
      );
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
    return view;
  }

  private syncOutdoorPropViews(forceRecreate: boolean): void {
    if (forceRecreate) {
      for (const propId of [...this.propViews.keys()]) {
        this.destroyPropView(propId);
      }
    }

    const desiredPropIds = new Set(this.props.map((prop) => prop.id));

    for (const propId of [...this.propViews.keys()]) {
      if (!desiredPropIds.has(propId)) {
        this.destroyPropView(propId);
      }
    }

    for (const prop of this.props) {
      if (!this.propViews.has(prop.id)) {
        this.createPropView(prop);
      }

      this.positionProp(prop);
    }
  }

  private destroyActorView(actorId: string): void {
    const view = this.actorViews.get(actorId);

    if (!view) {
      return;
    }

    view.container.destroy(true);
    this.actorViews.delete(actorId);
  }

  private reconcileOutdoorNpcs(nextNpcs: WorldNpcRuntime[]): void {
    const nextNpcIds = new Set(nextNpcs.map((npc) => npc.id));
    const existingById = new Map(this.npcs.map((npc) => [npc.id, npc]));

    for (const npc of this.npcs) {
      if (nextNpcIds.has(npc.id)) {
        continue;
      }

      this.destroyActorView(npc.id);
      this.npcNextMoveAt.delete(npc.id);
      this.npcPatrolIndices.delete(npc.id);
      this.movingNpcIds.delete(npc.id);

      if (this.focusedNpcId === npc.id) {
        this.focusedNpcId = null;
        this.selectedNpcActionId = null;
      }
    }

    this.npcs = nextNpcs.map((nextNpc) => {
      const existing = existingById.get(nextNpc.id);

      if (!existing) {
        return nextNpc;
      }

      Object.assign(existing, nextNpc);
      return existing;
    });
    this.restoreOutdoorNpcPatrolIndices();
    this.syncOutdoorNpcStatesWithRuntime();
  }

  private syncOutdoorActorViews(): void {
    const actorIds = new Set([this.player.id, ...this.npcs.map((npc) => npc.id)]);

    for (const actorId of [...this.actorViews.keys()]) {
      if (!actorIds.has(actorId)) {
        this.destroyActorView(actorId);
      }
    }

    if (!this.actorViews.has(this.player.id)) {
      this.createActor(this.player, DEFAULT_FACING);
    } else {
      this.positionActor(this.player);
    }

    for (const npc of this.npcs) {
      if (!this.actorViews.has(npc.id)) {
        this.createActor(npc, DEFAULT_FACING);
      } else {
        this.positionActor(npc);
      }
    }
  }

  private destroyAreaObjects(): void {
    this.destroyOutdoorChunkRenderSets();
    this.boardGraphics.clear();

    for (const image of this.terrainTileImages) {
      image.destroy();
    }
    this.terrainTileImages = [];

    for (const wall of this.wallGraphics) {
      wall.destroy();
    }
    this.wallGraphics = [];

    for (const wall of this.arenaPreviewWallGraphics) {
      wall.destroy();
    }
    this.arenaPreviewWallGraphics = [];

    for (const view of this.propViews.values()) {
      view.base.destroy();
      view.image.destroy();
      view.shadowOverlay?.destroy();
      view.groundGlow?.destroy();
      view.haloGlow?.destroy();
      view.embers?.destroy();
    }
    this.propViews.clear();

    for (const view of this.actorViews.values()) {
      view.container.destroy(true);
    }
    this.actorViews.clear();

    this.highlightController.clear();

    this.lightGroundOverlayPool.beginFrame();
    this.lightGroundOverlays = [];

    this.lightShadowOverlayPool.beginFrame();
    this.lightShadowOverlays = [];

    this.destroyOrphanedWorldObjects();
  }

  private destroyOrphanedWorldObjects(): void {
    const persistentObjects: Phaser.GameObjects.GameObject[] = [
      this.backdropImage,
      this.backdropShade,
      this.ambientOverlay,
      this.boardGraphics
    ];

    if (this.battleParticles) {
      persistentObjects.push(this.battleParticles);
    }
    persistentObjects.push(...this.lightGroundOverlayPool.getManagedObjects());
    persistentObjects.push(...this.lightShadowOverlayPool.getManagedObjects());
    persistentObjects.push(...this.highlightController.getManagedObjects());

    const persistentWorldObjects = new Set<Phaser.GameObjects.GameObject>(persistentObjects);
    const uiSet = new Set(this.getUiObjects());

    for (const child of [...this.children.list]) {
      if (uiSet.has(child) || persistentWorldObjects.has(child)) {
        continue;
      }

      child.destroy();
    }
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
      image.setData('tileX', tile.x);
      image.setData('tileY', tile.y);
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
      this.createPropView(prop);
      this.positionProp(prop);
    }
  }

  private createActors(facingOverrides?: ReadonlyMap<string, SpriteFacing>): void {
    for (const actor of this.getRenderedActors()) {
      this.createActor(actor, facingOverrides?.get(actor.id) ?? DEFAULT_FACING);
    }
  }

  private getRenderedActors(): Array<BattleUnit | WorldNpcRuntime> {
    if (this.isWorldBattleActive()) {
      return this.worldBattle?.units ?? [];
    }

    return [this.player, ...this.npcs];
  }

  private createActor(actor: BattleUnit | WorldNpcRuntime, initialFacing: SpriteFacing): void {
    const view = this.createActorView(actor, initialFacing);
    this.actorViews.set(actor.id, view);
    this.applyActorFacing(actor, view, initialFacing);
    this.syncBattleActorEmphasis(view, actor);
    this.positionActor(actor);
    this.applyIdleAnimation(actor, view);
  }

  private captureActorFacingOverrides(): Map<string, SpriteFacing> {
    return new Map(
      [...this.actorViews.entries()].map(([actorId, view]) => [actorId, view.facing])
    );
  }

  private captureActorFacingOverridesForRotation(nextRotationStep: number): Map<string, SpriteFacing> {
    return new Map(
      [...this.actorViews.entries()].map(([actorId, view]) => [
        actorId,
        rotateFacingForBoardRotation(view.facing, this.boardRotationStep, nextRotationStep)
      ])
    );
  }

  private createActorView(actor: BattleUnit | WorldNpcRuntime, initialFacing: SpriteFacing): ActorView {
    return createBattleActorView(this, actor, initialFacing, (object) => {
      this.registerWorldObject(object);
    });
  }

  private applyIdleAnimation(actor: BattleUnit | WorldNpcRuntime, view: ActorView): void {
    applyBattleIdleAnimation(this, actor, view, () => this.syncBattleActorEmphasis(view, actor));
  }

  private applyActorFacing(actor: BattleUnit | WorldNpcRuntime, view: ActorView, facing: SpriteFacing): void {
    applyBattleActorFacing(actor, view, facing);
    this.syncBattleActorEmphasis(view, actor);
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
    view.container.setVisible(!('alive' in actor) || actor.alive);
    view.container.setAlpha(!('alive' in actor) || actor.alive ? 1 : 0);
    const showHealth = this.isWorldBattleActive() && 'alive' in actor;
    view.hpBack.setVisible(showHealth);
    view.hpFill.setVisible(showHealth);
    if ('alive' in actor) {
      view.hpFill.width = Math.max(0, 56 * (actor.hp / actor.maxHp));
      view.hpFill.setFillStyle(actor.team === 'player' ? 0x67d9a0 : 0xe88787, 1);
    }
    view.label.setText(this.getActorLabel(actor));
    this.syncBattleActorEmphasis(view, actor);
  }

  private syncBattleActorEmphasis(view: ActorView, actor: BattleUnit | WorldNpcRuntime): void {
    const battleUnit = this.getBattleUnitById(actor.id);
    const isExplorationLeader = !this.isWorldBattleActive() && actor.id === this.player.id;
    const resolvedTeam = battleUnit?.team ?? (isExplorationLeader ? 'player' : null);
    const isActive =
      isExplorationLeader ||
      (!!battleUnit &&
        battleUnit.alive &&
        this.worldBattle?.activeUnitId === battleUnit.id &&
        this.shouldShowActiveUnitAura());
    const glowTint = 0xcce9ff;
    const outlineTint = resolvedTeam === 'player' ? 0xf3d87c : 0xe18b73;

    view.activeGlow
      .setTint(glowTint)
      .setVisible(isActive)
      .setAlpha(isActive ? (resolvedTeam === 'player' ? 0.26 : 0.22) : 0);

    for (const [index, outline] of view.activeOutlineSprites.entries()) {
      outline
        .setTintFill(outlineTint)
        .setVisible(isActive)
        .setAlpha(isActive ? ACTIVE_UNIT_OUTLINE_OFFSETS[index].alpha * (resolvedTeam === 'player' ? 0.76 : 0.68) : 0);
    }

    syncBattleActorGlow(view);
  }

  private updateBattleActorGlowFade(time: number): void {
    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit) {
      return;
    }

    const view = this.actorViews.get(activeUnit.id);

    if (!view || !this.shouldShowActiveUnitAura() || !view.activeGlow.visible) {
      return;
    }

    const glowFade = (Math.sin(time * 0.008) + 1) / 2;
    const outlineFade = (Math.sin(time * 0.008 + 1.1) + 1) / 2;
    const glowAlphaBase = activeUnit.team === 'player' ? 0.12 : 0.1;
    const glowAlphaRange = activeUnit.team === 'player' ? 0.14 : 0.1;
    const outlineAlphaScale = 0.42 + outlineFade * 0.58;

    view.activeGlow.setAlpha(glowAlphaBase + glowFade * glowAlphaRange);

    for (const [index, outline] of view.activeOutlineSprites.entries()) {
      outline.setAlpha(ACTIVE_UNIT_OUTLINE_OFFSETS[index].alpha * outlineAlphaScale);
    }
  }

  private updateWorldDynamicLighting(time: number): void {
    this.lightingRefreshCount += 1;
    const timeConfig = TIME_OF_DAY_CONFIG[this.battleTimeOfDay];
    const lightSources = this.getWorldDynamicLightSources(time);

    this.lightGroundOverlayPool.beginFrame();
    this.lightGroundOverlays = [];

    this.lightShadowOverlayPool.beginFrame();
    this.lightShadowOverlays = [];

    for (const view of this.propViews.values()) {
      view.shadowOverlay?.clear();
      view.groundGlow?.setAlpha(0);
      view.haloGlow?.setAlpha(0);
      view.embers?.setAlpha(0);
    }

    for (const source of lightSources) {
      const point = this.isoToScreen(source.tile);
      const sourceGroundPoint = source.point;
      const sourceOcclusion = this.getLightSourceOcclusion(source.propId, sourceGroundPoint);
      const groundOcclusion = 0.35 + sourceOcclusion * 0.65;
      this.drawLightGroundPool(source.tile, source.color, source.radius, source.strength, groundOcclusion);

      if (source.view?.groundGlow && source.view.haloGlow) {
        source.view.groundGlow
          .setPosition(sourceGroundPoint.x, sourceGroundPoint.y)
          .setDisplaySize(source.radius * 0.5, source.radius * 0.24)
          .setTint(source.color)
          .setAlpha(Math.min(0.3, 0.12 * source.strength) * sourceOcclusion)
          .setDepth(this.getGroundGlowDepth(source.tile));
        source.view.haloGlow
          .setPosition(point.x, point.y - source.sourceOffsetY)
          .setDisplaySize(source.radius * 0.28, source.radius * 0.28)
          .setTint(source.color)
          .setAlpha(Math.min(0.2, 0.1 * source.strength) * sourceOcclusion)
          .setDepth(this.getLightHaloDepth(source.tile));

        if (source.view.embers) {
          source.view.embers.setPosition(point.x, point.y - source.sourceOffsetY);
          source.view.embers.setAlpha(Math.min(1, 0.45 + timeConfig.lightBoost * 0.35));
          source.view.embers.setDepth(this.getPropDepth(source.tile) + 0.2);
        }
      }

      this.drawLightShadows(source.propId, sourceGroundPoint, source.radius * 0.9, Math.min(0.24, 0.1 * timeConfig.lightBoost));
    }

    this.applyWorldActorLighting(lightSources, timeConfig.worldTint);
  }

  private getWorldDynamicLightSources(time: number): DynamicLightSource[] {
    const timeConfig = TIME_OF_DAY_CONFIG[this.battleTimeOfDay];
    const preservedLightSources =
      this.worldBattle && !this.worldBattle.sourcePreviewActive
        ? (this.worldBattle.runtimeBattle.seamlessEntry?.preservedLightSources ?? [])
        : [];

    return this.worldLightingController.collectDynamicLightSources({
      time,
      lightBoost: timeConfig.lightBoost,
      props: this.props,
      map: this.map,
      preservedLightSources,
      isoToScreen: (tile) => this.isoToScreen(tile),
      getPropView: (propId) => this.propViews.get(propId)
    });
  }

  private applyWorldActorLighting(lightSources: DynamicLightSource[], baseTint: number): void {
    for (const actor of this.getLightReactiveActors()) {
      const view = this.actorViews.get(actor.id);

      if (!view) {
        continue;
      }

      const actorPoint =
        'alive' in actor
          ? this.getUnitSpritePoint(actor, 0.42) ?? this.getUnitWorldPoint(actor)
          : new Phaser.Math.Vector2(view.container.x + view.sprite.x, view.container.y + view.sprite.y - actor.spriteDisplayHeight * 0.42);
      const lightSample = this.sampleLightAtPoint(actorPoint, lightSources);
      const litTint = this.getLitTint(baseTint, lightSample);
      view.sprite.setTint(litTint);
    }
  }

  private getLightReactiveActors(): Array<BattleUnit | WorldNpcRuntime> {
    return this.isWorldBattleActive() ? [...(this.worldBattle?.units ?? [])] : [this.player, ...this.npcs];
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
      const visibility = this.getLightPathVisibility(source.propId, source.point, point);
      const influence = Math.min(1.15, source.strength * 0.82) * falloff * falloff * visibility;

      if (influence > bestInfluence) {
        bestInfluence = influence;
        bestColor = source.color;
      }
    }

    return { influence: bestInfluence, color: bestColor };
  }

  private getLightPathVisibility(
    sourcePropId: string | null,
    sourcePoint: Phaser.Math.Vector2,
    targetPoint: Phaser.Math.Vector2
  ): number {
    let visibility = 1;
    const ray = new Phaser.Math.Vector2(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y);
    const rayLengthSq = ray.lengthSq();

    if (rayLengthSq <= 1) {
      return visibility;
    }

    for (const prop of this.props) {
      if ((sourcePropId && prop.id === sourcePropId) || !PROP_RENDER_CONFIG[prop.assetId].blocksMovement) {
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

  private getLightSourceOcclusion(lightPropId: string | null, sourcePoint: Phaser.Math.Vector2): number {
    let occlusion = 1;

    for (const prop of this.props) {
      if ((lightPropId && prop.id === lightPropId) || !PROP_RENDER_CONFIG[prop.assetId].blocksMovement) {
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
    sourceTile: Point & { height: number },
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
      const overlay = this.lightGroundOverlayPool.acquire(Phaser.BlendModes.ADD);
      overlay.fillStyle(color, alpha);
      overlay.fillPoints(outer, true);
      overlay.fillStyle(color, alpha * 0.68);
      overlay.fillPoints(inner, true);
      overlay.setData('tileX', tile.x);
      overlay.setData('tileY', tile.y);
      overlay.setDepth(this.getGroundLightDepth(tile));
      this.lightGroundOverlays.push(overlay);
    }
  }

  private drawLightShadows(
    lightPropId: string | null,
    sourceGroundPoint: Phaser.Math.Vector2,
    lightRadius: number,
    baseAlpha: number
  ): void {
    const blockers: Array<{ tile: TileData; size: number }> = [];

    for (const prop of this.props) {
      if ((lightPropId && prop.id === lightPropId) || !PROP_RENDER_CONFIG[prop.assetId].blocksMovement) {
        continue;
      }

      const tile = getTile(this.map, prop.x, prop.y);
      if (tile) {
        blockers.push({ tile, size: 1 });
      }
    }

    for (const unit of this.worldBattle?.units ?? []) {
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

      const shadow = this.lightShadowOverlayPool.acquire();
      shadow.fillStyle(0x04070d, alpha);
      shadow.fillPoints([pointA, pointB, farB, farA], true);
      shadow.setData('tileX', blocker.tile.x);
      shadow.setData('tileY', blocker.tile.y);
      shadow.setDepth(this.getLightShadowDepth(blocker.tile));
      this.lightShadowOverlays.push(shadow);

      const blockingProp = this.props.find((entry) => entry.x === blocker.tile.x && entry.y === blocker.tile.y);
      if (blockingProp) {
        this.drawPropSelfShadow(blockingProp, sourceGroundPoint, alpha);
      }
    }
  }

  private drawPropSelfShadow(
    prop: LocalWorldProp,
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

  private getActorLabel(actor: BattleUnit | WorldNpcRuntime): string {
    return actor.name;
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

  private drawHighlights(): void {
    this.highlightController.beginFrame();

    if (this.isWorldBattleActive()) {
      this.drawBattleHighlights();
      return;
    }

    this.drawTransitionMarkers();

    const interactionNpc = this.getInteractionNpc();
    if (interactionNpc) {
      const npcTile = getTile(this.map, interactionNpc.x, interactionNpc.y);
      if (npcTile) {
        this.drawDiamond(npcTile, 0x71451e, 0.2, 2, UI_COLOR_ACCENT_WARM, 0.9);
      }
    }

    const hostileNpc = this.getAdjacentTriggerableHostileNpc();
    if (hostileNpc) {
      const hostileTile = getTile(this.map, hostileNpc.x, hostileNpc.y);
      if (hostileTile) {
        this.drawDiamond(hostileTile, 0x4f1814, 0.24, 2, 0xe18b73, 0.92);
      }
    }

    if (this.hoverTile && (this.hoverTile.x !== this.player.x || this.hoverTile.y !== this.player.y)) {
      this.drawDiamond(
        this.hoverTile,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.fill,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.fillAlpha,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.lineWidth,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.stroke,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.strokeAlpha
      );
    }
  }

  private drawTransitionMarkers(): void {
    for (const transition of this.transitions) {
      const isCaveTransition =
        (transition.kind === 'cave' && transition.targetKind === 'interior') ||
        (transition.kind === 'cave-mouth' && transition.targetKind === 'return');

      if (!isCaveTransition) {
        continue;
      }

      const tile = getTile(this.map, transition.x, transition.y);

      if (!tile) {
        continue;
      }

      this.drawCaveEntranceMarker(tile);
    }
  }

  private drawCaveEntranceMarker(tile: TileData): void {
    const center = this.isoToScreen(tile);
    const tilePoints = this.getTileTopPoints(tile);
    const outer = this.scaleTilePolygon(tilePoints, center, 0.94);
    const mid = this.scaleTilePolygon(tilePoints, center, 0.74);
    const inner = this.scaleTilePolygon(tilePoints, center, 0.5);

    const glow = this.highlightController.acquireGraphics(Phaser.BlendModes.ADD);
    glow.fillStyle(0xffcf73, 0.12);
    glow.fillPoints(this.scaleTilePolygon(tilePoints, center, 1.08), true);
    glow.fillStyle(0xff8c3d, 0.08);
    glow.fillPoints(this.scaleTilePolygon(tilePoints, center, 0.9), true);
    glow.setDepth(this.getHighlightDepth(tile) - 0.2);

    const marker = this.highlightController.acquireGraphics();
    marker.fillStyle(0x2b1610, 0.34);
    marker.fillPoints(outer, true);
    marker.fillStyle(0x4e2414, 0.28);
    marker.fillPoints(mid, true);
    marker.lineStyle(2.5, 0xffd07a, 0.92);
    marker.strokePoints(mid, true, true);
    marker.lineStyle(1.5, 0x7a3f1f, 0.95);
    marker.strokePoints(inner, true, true);
    marker.lineStyle(3, 0xffefc3, 0.9);
    marker.lineBetween(center.x - 8, center.y - 3, center.x, center.y + 6);
    marker.lineBetween(center.x + 8, center.y - 3, center.x, center.y + 6);
    marker.lineStyle(2, 0xffb35a, 0.85);
    marker.lineBetween(center.x - 5, center.y - 10, center.x, center.y - 2);
    marker.lineBetween(center.x + 5, center.y - 10, center.x, center.y - 2);
    marker.fillStyle(0xfff0c8, 0.9);
    marker.fillCircle(center.x, center.y + 6, 2.6);
    marker.setDepth(this.getHighlightDepth(tile) - 0.05);
  }

  private drawBattleHighlights(): void {
    const activeUnit = this.getActiveBattleUnit();

    if (activeUnit && this.shouldShowActiveUnitFocus()) {
      const activeTile = getTile(this.map, activeUnit.x, activeUnit.y);

      if (activeTile) {
        this.drawActiveMarker(activeTile);
      }
    }

    if (this.phase === 'battle-player-move') {
      for (const node of this.moveNodes.values()) {
        const tile = getTile(this.map, node.x, node.y);

        if (tile) {
          this.drawDiamond(tile, 0x37566c, 0.22, 2, 0x9ad7f2, 0.9);
        }
      }
    }

    if (this.phase === 'battle-player-action' && activeUnit) {
      const ability = this.getSelectedBattleAbility();

      if (ability) {
        for (const unit of this.getTargetableUnitsForBattleAbility(activeUnit, ability)) {
          const tile = getTile(this.map, unit.x, unit.y);

          if (tile) {
            const isEnemyTarget = ability.target === 'enemy';
            this.drawDiamond(
              tile,
              isEnemyTarget ? 0x6a211d : 0x275a38,
              0.28,
              2,
              isEnemyTarget ? 0xe7a48e : 0xb6ffd0,
              0.95
            );
          }
        }
      }
    }

    if (this.phase === 'battle-player-item-action' && activeUnit && this.worldBattle?.selectedItemId) {
      for (const unit of this.getTargetableUnitsForBattleItem(activeUnit, this.worldBattle.selectedItemId)) {
        const tile = getTile(this.map, unit.x, unit.y);

        if (tile) {
          this.drawDiamond(tile, 0x275a38, 0.28, 2, 0xb6ffd0, 0.95);
        }
      }
    }

    if (this.hoverTile && (!activeUnit || this.hoverTile.x !== activeUnit.x || this.hoverTile.y !== activeUnit.y)) {
      this.drawDiamond(
        this.hoverTile,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.fill,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.fillAlpha,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.lineWidth,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.stroke,
        BATTLE_INSPECTION_HIGHLIGHT_STYLE.strokeAlpha
      );
    }
  }

  private shouldShowActiveUnitFocus(): boolean {
    return shouldShowBattleActiveUnitFocus(this.phase, 'battle-animating', 'battle-complete');
  }

  private shouldShowActiveUnitAura(): boolean {
    return shouldShowBattleActiveUnitAura(this.phase, 'battle-complete');
  }

  private drawDiamond(
    tile: TileData,
    fill: number,
    fillAlpha: number,
    lineWidth: number,
    stroke: number,
    strokeAlpha: number
  ): void {
    this.highlightController.drawDiamond(
      this.getTileTopPoints(tile),
      this.getHighlightDepth(tile),
      fill,
      fillAlpha,
      lineWidth,
      stroke,
      strokeAlpha
    );
  }

  private drawActiveMarker(tile: TileData): void {
    this.highlightController.drawActiveTileMarker({
      tile,
      tilePoints: this.getTileTopPoints(tile),
      center: this.isoToScreen(tile),
      depth: this.getHighlightDepth(tile)
    });
  }

  private refreshUi(): void {
    this.hudRefreshCount += 1;
    const inspection = this.getCurrentHudInspection();
    const hudViewModel = inspection.kind === 'mission' ? null : this.buildWorldHudViewModel(inspection);
    const hudVisible = !this.isWorldBattleActive() || this.battleIntroPhase === 'hud';

    this.areaTitleText.setVisible(false);
    this.mapPlaqueArt.setTexture(this.getHudBackdropImageKey());
    this.mapIntroArt.setTexture(this.getHudBackdropImageKey());
    this.syncWorldHudPlaque();
    this.syncWorldHudDetail(inspection, hudViewModel);
    this.updateWorldDetailPanelForSelection(inspection);
    this.layoutBattleHud(this.scale.width, this.scale.height);
    this.setHudVisible(true);
    this.headerMenuTitleText.setText('PAUSED');
    const headerMenuLabels: Record<HeaderMenuAction, string> = {
      auto: `AUTO ${this.worldBattle?.autoBattleEnabled ? 'ON' : 'OFF'}`,
      audio: `AUDIO ${audioDirector.isMuted() ? 'OFF' : 'ON'}`,
      restart: this.isWorldBattleActive() ? 'RESTART' : 'RESTART VISIT',
      setup: 'WORLD',
      title: 'TITLE'
    };
    const headerMenuActions = this.getHeaderMenuActions();
    for (const [index, text] of this.headerMenuOptionTexts.entries()) {
      const action = headerMenuActions[index];
      text.setText(action ? headerMenuLabels[action] : '');
    }

    if (this.isWorldBattleActive()) {
      const battle = this.worldBattle as WorldBattleState;
      const activeUnit = this.getActiveBattleUnit();
      const queue = this.battleRuntimeController.buildTurnQueue(battle, this.visibleTurnOrderCount);
      this.playerAvatarPanel.setQueue(queue, battle.activeUnitId, this.visibleTurnOrderCount, true);
      this.playerAvatarPanel.setVisible(hudVisible && this.showTimelinePanel);
      this.actionMenuStack.setPanels(this.buildBattleActionMenuPanels());
      this.actionMenuStack.setVisible(hudVisible && this.shouldShowBattleActionMenu());
      this.actionMenuStack.draw();
      this.drawWorldHudPanels(hudViewModel);
      return;
    }

    this.playerAvatarPanel.setQueue([], this.player.id, this.visibleTurnOrderCount, true);
    this.playerAvatarPanel.setVisible(false);
    this.actionMenuStack.setPanels(this.buildActionMenuPanels());
    this.actionMenuStack.setVisible(this.shouldShowActionMenu());
    this.actionMenuStack.draw();
    this.drawWorldHudPanels(hudViewModel);
  }

  private getHudBackdropImageKey(): string {
    return this.worldBattle?.runtimeBattle.level.backdropAssetId ?? this.areaBackdropAssetId ?? 'title-backdrop';
  }

  private setHudVisible(visible: boolean): void {
    if (!visible) {
      this.uiGraphics.clear();
    }

    if (visible) {
      this.introOverlayShade.setVisible(true);
      this.mapPlaqueArt.setVisible(this.headerRect.width > 0);
      this.mapPlaqueArtMask.setVisible(this.headerRect.width > 0);
    }

    if (!visible) {
      this.mapPlaqueArt.setVisible(false);
      this.mapPlaqueArtMask.setVisible(false);
      this.mapIntroArt.setVisible(false);
      this.mapIntroArtMask.setVisible(false);
      this.introOverlayShade.setVisible(false);
      this.mapPlaqueTitleText.setVisible(false);
      this.mapPlaqueMetaText.setVisible(false);
      this.mapObjectiveText.setVisible(false);
      this.mapIntroEyebrowText.setVisible(false);
      this.mapIntroTitleText.setVisible(false);
      this.mapIntroMetaText.setVisible(false);
      this.mapIntroFlavorText.setVisible(false);
      this.headerMenuTitleText.setVisible(false);
      for (const text of this.headerMenuOptionTexts) {
        text.setVisible(false);
      }
      this.activeBadge.setVisible(false);
      this.detailMetaText.setVisible(false);
      this.detailTitleText.setVisible(false);
      this.detailBodyText.setVisible(false);
      for (const text of this.detailStatTexts) {
        text.setVisible(false);
      }
      this.portrait.setVisible(false);
      this.portraitMask.clear();
    }
  }

  private syncWorldHudPlaque(): void {
    if (this.isWorldBattleActive() && this.worldBattle) {
      const objectiveText = this.worldBattle.runtimeBattle.level.shortObjective ?? this.worldBattle.runtimeBattle.level.objective;
      this.mapPlaqueTitleText.setText(this.getWorldBattleMapPlaqueHeaderTitle());
      this.mapPlaqueMetaText.setText(this.getWorldBattleMapPlaqueMeta());
      this.mapObjectiveText.setText(objectiveText);
      this.mapIntroEyebrowText.setText(this.getWorldBattleMapIntroEyebrow());
      this.mapIntroTitleText.setText(this.worldBattle.runtimeBattle.level.name);
      this.mapIntroMetaText.setText(this.getWorldBattleMapIntroMeta());
      this.mapIntroFlavorText.setText(this.getWorldBattleMapIntroSummary());
      return;
    }

    this.mapPlaqueTitleText.setText(this.getWorldExplorationPlaqueHeaderTitle());
    this.mapPlaqueMetaText.setText(this.getWorldExplorationPlaqueMeta());
    this.mapObjectiveText.setText(this.getWorldExplorationPlaqueObjective());
    this.mapIntroEyebrowText.setText((this.sessionState.areaKind === 'outdoor' ? 'Road Report' : 'Interior Report').toUpperCase());
    this.mapIntroTitleText.setText(this.areaName);
    this.mapIntroMetaText.setText(this.getWorldExplorationPlaqueMeta());
    this.mapIntroFlavorText.setText(this.getWorldExplorationPlaqueObjective());
  }

  private syncWorldHudDetail(inspection: WorldHudInspection, hudViewModel: BattleHudViewModel | null): void {
    if (inspection.kind === 'mission' || !hudViewModel) {
      this.activeBadge.setText('');
      this.detailMetaText.setText('');
      this.detailTitleText.setText('');
      this.detailBodyText.setText('');
      this.setBattleDetailStatValues([]);
      this.hideHudPortrait();
      return;
    }

    this.activeBadge.setText(hudViewModel.badgeText);
    this.detailMetaText.setText(hudViewModel.metaText);
    this.detailTitleText.setText(hudViewModel.titleText);
    this.detailBodyText.setText(hudViewModel.bodyText);
    this.setBattleDetailStatValues(hudViewModel.statValues);
    this.syncHudPortrait(inspection);
  }

  private getWorldBattleMapPlaqueHeaderTitle(): string {
    const level = this.worldBattle?.runtimeBattle.level;
    return formatPlaqueHeaderTitle(level?.titlePrefix, level?.region, level?.name ?? this.areaName);
  }

  private getWorldBattleMapPlaqueMeta(): string {
    return this.worldBattle?.runtimeBattle.level.name ?? this.areaName;
  }

  private getWorldBattleMapIntroEyebrow(): string {
    const level = this.worldBattle?.runtimeBattle.level;
    return (level?.titlePrefix ?? level?.encounterType ?? 'Battle Report').toUpperCase();
  }

  private getWorldBattleMapIntroMeta(): string {
    const level = this.worldBattle?.runtimeBattle.level;
    const parts = [level?.region, level?.encounterType].filter((value): value is string => Boolean(value));
    return parts.join('  •  ');
  }

  private getWorldBattleMapIntroSummary(): string {
    const level = this.worldBattle?.runtimeBattle.level;
    if (!level) {
      return '';
    }

    const shortObjective = level.shortObjective ?? level.objective;
    const flavor = level.titleFlavor?.trim() ?? '';
    if (!flavor) {
      return shortObjective;
    }

    return flavor.length <= shortObjective.length ? flavor : shortObjective;
  }

  private getWorldExplorationPlaqueHeaderTitle(): string {
    const prefix = this.sessionState.areaKind === 'outdoor' ? 'Road' : 'Interior';
    return formatPlaqueHeaderTitle(prefix, this.areaName, this.areaName, prefix);
  }

  private getWorldExplorationPlaqueMeta(): string {
    return [
      this.sessionState.areaKind === 'outdoor' ? 'WORLD EXPLORATION' : 'INTERIOR EXPEDITION',
      this.sessionState.areaKind === 'outdoor' ? 'OVERLAND ROUTE' : 'RETURN ROUTE MARKED'
    ].join('  •  ');
  }

  private getWorldExplorationPlaqueObjective(): string {
    const interactionNpc = this.getInteractionNpc();
    if (interactionNpc) {
      return `Approach ${interactionNpc.name} or continue along the road.`;
    }

    return this.sessionState.areaKind === 'outdoor'
      ? 'Travel the ruins, inspect the ground, and brace for hostile contact.'
      : 'Search the interior and return to the road when ready.';
  }

  private getCurrentHudInspection(): WorldHudInspection {
    if (this.isWorldBattleActive()) {
      const inspectionUnit = this.getInspectionBattleUnit();
      if (inspectionUnit) {
        return { kind: 'battle-unit', unit: inspectionUnit };
      }

      const inspectionTile = this.getInspectionBattleTile();
      if (inspectionTile) {
        return {
          kind: 'tile',
          tile: inspectionTile,
          prop: this.getPropAt(inspectionTile.x, inspectionTile.y)
        };
      }

      return { kind: 'mission' };
    }

    const focusedNpc = this.getExplorationInspectionNpc();
    if (focusedNpc) {
      return { kind: 'npc', npc: focusedNpc };
    }

    return { kind: 'mission' };
  }

  private getExplorationInspectionNpc(): WorldNpcRuntime | null {
    const focusedNpc = this.focusedNpcId ? this.npcs.find((npc) => npc.id === this.focusedNpcId) ?? null : null;
    if (focusedNpc && (this.phase === 'menu' || this.phase === 'detail')) {
      return focusedNpc;
    }

    return null;
  }

  private buildWorldHudViewModel(inspection: WorldHudInspection): BattleHudViewModel | null {
    switch (inspection.kind) {
      case 'battle-unit':
        return this.buildWorldBattleHudViewModel(inspection.unit);
      case 'npc':
        return this.buildWorldNpcHudViewModel(inspection.npc);
      case 'tile':
        return this.buildWorldTileHudViewModel(inspection.tile, inspection.prop);
      case 'mission':
      default:
        return null;
    }
  }

  private buildWorldBattleHudViewModel(inspectionUnit: BattleUnit): BattleHudViewModel {
    const activeUnit = this.getActiveBattleUnit();

    return {
      badgeText: inspectionUnit.team === 'player' ? 'ALLY UNIT' : 'FOE UNIT',
      metaText: `${getFactionProfile(inspectionUnit.factionId).displayName}  •  ${inspectionUnit.className}`,
      titleText: inspectionUnit.name,
      bodyText: this.getBattleInspectionUnitBodyText(
        inspectionUnit,
        Boolean(
          activeUnit &&
          activeUnit.id === inspectionUnit.id &&
          activeUnit.team === 'player' &&
          this.isBattlePlayerPhase()
        )
      ),
      statValues: [
        `HP ${inspectionUnit.hp}/${inspectionUnit.maxHp}`,
        `MOVE ${inspectionUnit.move}`,
        `SPD ${inspectionUnit.speed}`,
        `RNG ${inspectionUnit.rangeMin}-${inspectionUnit.rangeMax}`
      ],
      healthRatio: inspectionUnit.hp / inspectionUnit.maxHp,
      healthColor: inspectionUnit.team === 'player' ? UI_COLOR_SUCCESS : UI_COLOR_DANGER
    };
  }

  private buildWorldNpcHudViewModel(npc: WorldNpcRuntime): BattleHudViewModel {
    const dispositionLabel = npc.disposition === 'hostile' ? 'HOSTILE CONTACT' : 'ROAD CONTACT';
    const classLabel = npc.className?.trim() || 'Wanderer';
    const summaryLines = [npc.summary];

    if (npc.disposition === 'hostile') {
      summaryLines.push(
        npc.aggressive
          ? `Aggro ${npc.aggressionRadius}  •  Leash ${npc.chaseLeashRadius}`
          : 'Will only engage when pressed at close range.'
      );
    }

    return {
      badgeText: dispositionLabel,
      metaText: `${getFactionProfile(npc.factionId).displayName}  •  ${classLabel}`,
      titleText: npc.name,
      bodyText: summaryLines.join('\n'),
      statValues: [
        `TILE ${npc.x}, ${npc.y}`,
        npc.disposition === 'hostile' ? 'HOSTILE' : 'FRIENDLY',
        npc.patrolPath.length > 0 ? `PATROL ${npc.patrolPath.length}` : 'STATIONARY',
        npc.disposition === 'hostile' ? `AGGRO ${npc.aggressionRadius}` : ''
      ],
      healthRatio: null,
      healthColor: npc.disposition === 'hostile' ? UI_COLOR_DANGER : UI_COLOR_SUCCESS
    };
  }

  private buildWorldTileHudViewModel(tile: TileData, prop: LocalWorldProp | null): BattleHudViewModel {
    const terrainName = formatBattleTerrainName(tile.terrain);

    return {
      badgeText: prop ? 'FIELD PROP' : 'TERRAIN TILE',
      metaText: `${terrainName}  •  ${tile.x}, ${tile.y}`,
      titleText: prop ? getBattlePropTitle(prop.assetId) : `${terrainName} Ground`,
      bodyText: [
        `Height ${tile.height}  •  ${terrainName}`,
        prop ? this.describeProp(prop.assetId) : this.describeTerrain(tile.terrain)
      ].join('\n'),
      statValues: [
        `HEIGHT ${tile.height}`,
        terrainName.toUpperCase(),
        prop ? 'OCCUPIED' : 'OPEN TILE',
        prop && PROP_RENDER_CONFIG[prop.assetId].blocksMovement ? 'BLOCKS MOVE' : ''
      ],
      healthRatio: null,
      healthColor: UI_COLOR_SUCCESS
    };
  }

  private updateWorldDetailPanelForSelection(inspection: WorldHudInspection): void {
    if (inspection.kind === 'mission') {
      this.detailPanelTween?.remove();
      this.detailPanelTween = undefined;
      this.showDetailPanel = false;
      this.detailPanelAlpha = 0;
      this.detailPanelOffsetX = 24;
      this.detailPanelSelectionKey = null;
      this.stopTurnStartCatchPhraseSound();
      this.hideHudPortrait();
      return;
    }

    this.showDetailPanel = true;
    const nextSelectionKey = this.getWorldDetailSelectionKey(inspection);
    const selectionChanged = this.detailPanelSelectionKey !== nextSelectionKey;
    const shouldAnimate = selectionChanged || this.detailPanelAlpha <= 0.01;
    this.detailPanelSelectionKey = nextSelectionKey;

    if (inspection.kind === 'battle-unit') {
      if (selectionChanged) {
        this.playTurnStartCatchPhraseVoice(inspection.unit);
      }
    } else {
      this.stopTurnStartCatchPhraseSound();
    }

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
        this.layoutBattleHud(this.scale.width, this.scale.height);
        this.drawWorldHudPanels(this.buildWorldHudViewModel(this.getCurrentHudInspection()));
      },
      onComplete: () => {
        this.detailPanelTween = undefined;
      }
    });
  }

  private getWorldDetailSelectionKey(inspection: WorldHudInspection): string | null {
    switch (inspection.kind) {
      case 'battle-unit':
        return `battle-unit:${inspection.unit.id}`;
      case 'npc':
        return `npc:${inspection.npc.id}`;
      case 'tile':
        return `tile:${inspection.tile.x},${inspection.tile.y}`;
      case 'mission':
      default:
        return null;
    }
  }

  private getBattleInspectionUnitBodyText(unit: BattleUnit, isCommandFocus: boolean): string {
    if (!isCommandFocus) {
      return [unit.attackName, unit.attackText].join('\n');
    }

    if (this.phase === 'battle-player-move') {
      return [
        `Stride up to ${unit.move} tiles across open ground.`,
        this.worldBattle?.turnMoveUsed ? 'Movement is already spent this turn.' : 'Select a reachable tile on the field.'
      ].join('\n');
    }

    if (this.phase === 'battle-player-items' || this.phase === 'battle-player-item-action') {
      if (this.worldBattle?.selectedItemId) {
        const item = getItemDefinition(this.worldBattle.selectedItemId);
        const count = this.getBattleUnitInventory(unit)[this.worldBattle.selectedItemId] ?? 0;
        return [
          item.description,
          `Range 1  •  Stock ${count}`,
          this.phase === 'battle-player-item-action' ? 'Select an adjacent target.' : 'Choose an item below.'
        ].join('\n');
      }

      return 'Choose an item below.';
    }

    if (this.phase === 'battle-player-abilities' || this.phase === 'battle-player-action') {
      const selectedAbility = this.getSelectedBattleAbility();

      if (selectedAbility) {
        return [
          selectedAbility.description,
          `Range ${selectedAbility.rangeMin}-${selectedAbility.rangeMax}  •  ${selectedAbility.target === 'ally' ? 'Allies' : 'Enemies'}`,
          this.phase === 'battle-player-action' ? 'Select a valid target.' : 'Choose an ability below.'
        ].join('\n');
      }

      return 'Choose an ability below.';
    }

    return [unit.attackName, unit.attackText].join('\n');
  }

  private getResolvedBattleInspectionTarget(): BattleInspectionTarget {
    const target = this.battleInspectionTarget;

    if (target.kind === 'unit') {
      const unit = this.worldBattle?.units.find((candidate) => candidate.alive && candidate.id === target.unitId);

      if (unit) {
        return target;
      }
    }

    if (target.kind === 'tile' && getTile(this.map, target.x, target.y)) {
      return target;
    }

    return { kind: 'mission' };
  }

  private setBattleInspectionTarget(
    target: BattleInspectionTarget,
    refresh = true,
    toggleIfSame = false
  ): BattleInspectionTarget {
    const current = this.getResolvedBattleInspectionTarget();
    const unchanged =
      current.kind === target.kind &&
      (
        current.kind === 'mission' ||
        (current.kind === 'unit' && target.kind === 'unit' && current.unitId === target.unitId) ||
        (current.kind === 'tile' && target.kind === 'tile' && current.x === target.x && current.y === target.y)
      );

    this.battleInspectionTarget = toggleIfSame && unchanged && target.kind !== 'mission' ? { kind: 'mission' } : target;

    if (refresh) {
      this.invalidateHud();
      this.invalidateHighlights();
    }

    return this.getResolvedBattleInspectionTarget();
  }

  private inspectBattleTile(tile: TileData): void {
    const unit = this.getBattleUnitAt(tile.x, tile.y);

    if (unit) {
      this.setBattleInspectionTarget({ kind: 'unit', unitId: unit.id }, true, true);
      return;
    }

    this.setBattleInspectionTarget({ kind: 'tile', x: tile.x, y: tile.y }, true, true);
  }

  private getInspectionBattleUnit(): BattleUnit | null {
    const target = this.getResolvedBattleInspectionTarget();

    return target.kind === 'unit'
      ? this.worldBattle?.units.find((unit) => unit.alive && unit.id === target.unitId) ?? null
      : null;
  }

  private getInspectionBattleTile(): TileData | null {
    const target = this.getResolvedBattleInspectionTarget();

    return target.kind === 'tile' ? getTile(this.map, target.x, target.y) : null;
  }

  private getPropAt(x: number, y: number): LocalWorldProp | null {
    return this.props.find((prop) => prop.x === x && prop.y === y) ?? null;
  }

  private setBattleDetailStatValues(values: string[]): void {
    for (const [index, text] of this.detailStatTexts.entries()) {
      const value = values[index] ?? '';
      text.setText(value).setVisible(value.length > 0);
    }
  }

  private layoutBattleHud(width: number, height: number): void {
    const topPanelLayout = resolveSharedBattleTopPanelLayout(width, height);
    const plaqueHeight = getSharedBattleMapPlaqueHeight(
      topPanelLayout.headerWidth,
      this.mapPlaqueMetaText,
      this.mapObjectiveText
    );
    this.headerRect.setTo(
      topPanelLayout.grid.content.x,
      topPanelLayout.grid.margin,
      topPanelLayout.headerWidth,
      plaqueHeight
    );
    const detailHeight = this.getTargetBattleDetailPanelHeight(topPanelLayout.detailPanelWidth, height);
    const chromeLayout = resolveSharedBattleChromeLayout(
      width,
      height,
      topPanelLayout,
      plaqueHeight,
      detailHeight,
      this.visibleTurnOrderCount
    );

    this.headerRect.setTo(
      chromeLayout.headerRect.x,
      chromeLayout.headerRect.y,
      chromeLayout.headerRect.width,
      chromeLayout.headerRect.height
    );
    this.uiPanels.topRight.setTo(
      chromeLayout.detailRect.x,
      chromeLayout.detailRect.y,
      chromeLayout.detailRect.width,
      chromeLayout.detailRect.height
    );
    this.playAreaRect.setTo(
      chromeLayout.playAreaRect.x,
      chromeLayout.playAreaRect.y,
      chromeLayout.playAreaRect.width,
      chromeLayout.playAreaRect.height
    );
    this.turnOrderBounds.setTo(
      chromeLayout.turnOrderBounds.x,
      chromeLayout.turnOrderBounds.y,
      chromeLayout.turnOrderBounds.width,
      chromeLayout.turnOrderBounds.height
    );
    this.playerAvatarPanel.setLayout(chromeLayout.turnOrderLayout);
    this.actionMenuStack.setLayout(chromeLayout.actionMenuLayout);
    this.actionMenuStack.setTypography({
      rowHeight: 26
    });

    this.layoutMapTitleSection(width, height);

    const inspection = this.getCurrentHudInspection();
    const hudViewModel = inspection.kind === 'mission' ? null : this.buildWorldHudViewModel(inspection);
    this.layoutWorldDetailPanelSection(inspection, hudViewModel);
  }

  private layoutMapTitleSection(width: number, height: number): void {
    const introVisible = this.mapIntroAlpha > 0.01;
    const hudVisible = !this.isWorldBattleActive() || this.battleIntroPhase === 'hud';
    const introMargin = width <= 540 ? 18 : 28;
    const portraitIntro = height >= width;
    const shortLandscapeIntro = width > height && height < 620;
    const introTextInsetX = 18;
    const introTextInsetY = 18;
    const introTextGap = UI_PANEL_TIGHT_GAP;
    const introGap = portraitIntro ? 12 : 18;
    const introGroupWidth = Phaser.Math.Clamp(
      width - introMargin * 2,
      320,
      portraitIntro ? 400 : shortLandscapeIntro ? 760 : 900
    );
    const introArtWidth = portraitIntro
      ? introGroupWidth
      : Phaser.Math.Clamp(Math.round(introGroupWidth * (shortLandscapeIntro ? 0.6 : 0.62)), 420, 600);
    const introArtHeight = portraitIntro
      ? Phaser.Math.Clamp(Math.round(height * 0.24), 168, 208)
      : shortLandscapeIntro
        ? 164
        : 196;
    const introTextWidth = portraitIntro
      ? Math.min(introArtWidth - 24, 360)
      : Phaser.Math.Clamp(introGroupWidth - introArtWidth - introGap, 270, 340);
    const introTextInnerWidth = Math.max(180, introTextWidth - introTextInsetX * 2);

    this.mapIntroMetaText.setWordWrapWidth(introTextInnerWidth, true);
    this.mapIntroFlavorText.setWordWrapWidth(introTextInnerWidth - UI_PANEL_COMPACT_INSET * 2, true);

    const eyebrowWidth = Phaser.Math.Clamp(this.mapIntroEyebrowText.width + 28, 132, introTextInnerWidth);
    const eyebrowHeight = Math.max(24, this.mapIntroEyebrowText.height + 10);
    const summaryBoxHeight = Math.max(34, this.mapIntroFlavorText.height + UI_PANEL_COMPACT_INSET * 2);
    const introTextHeight = Math.ceil(
      introTextInsetY +
      eyebrowHeight +
      introTextGap +
      this.mapIntroTitleText.height +
      UI_PANEL_MICRO_GAP +
      this.mapIntroMetaText.height +
      UI_PANEL_GAP +
      summaryBoxHeight +
      introTextInsetY
    );
    const introGroupHeight = portraitIntro
      ? introArtHeight + introGap + introTextHeight
      : Math.max(introArtHeight, introTextHeight);
    const introTop = Phaser.Math.Clamp(
      Math.round(height * (portraitIntro ? 0.11 : 0.14)) + this.mapIntroOffsetY,
      36 + this.mapIntroOffsetY,
      Math.max(36 + this.mapIntroOffsetY, height - introGroupHeight - 48)
    );
    const introLeft = Math.round((width - introGroupWidth) * 0.5);

    if (portraitIntro) {
      this.mapIntroArtBounds.setTo(introLeft, introTop, introArtWidth, introArtHeight);
      this.mapIntroTextBounds.setTo(
        Math.round((width - introTextWidth) * 0.5),
        this.mapIntroArtBounds.bottom + introGap,
        introTextWidth,
        introTextHeight
      );
    } else {
      this.mapIntroArtBounds.setTo(introLeft, introTop, introArtWidth, introArtHeight);
      this.mapIntroTextBounds.setTo(
        this.mapIntroArtBounds.right + introGap,
        Math.round(introTop + Math.max(0, (introArtHeight - introTextHeight) * 0.5)),
        introTextWidth,
        introTextHeight
      );
    }

    const introGroupLeft = Math.min(this.mapIntroArtBounds.x, this.mapIntroTextBounds.x);
    const introGroupTop = Math.min(this.mapIntroArtBounds.y, this.mapIntroTextBounds.y);
    const introGroupRight = Math.max(this.mapIntroArtBounds.right, this.mapIntroTextBounds.right);
    const introGroupBottom = Math.max(this.mapIntroArtBounds.bottom, this.mapIntroTextBounds.bottom);
    this.mapIntroArtImageBounds.setTo(
      this.mapIntroArtBounds.x,
      this.mapIntroArtBounds.y,
      this.mapIntroArtBounds.width,
      this.mapIntroArtBounds.height
    );
    this.mapIntroBounds.setTo(
      introGroupLeft,
      introGroupTop,
      introGroupRight - introGroupLeft,
      introGroupBottom - introGroupTop
    );

    const introTextGrid = createUiSubGrid(
      this.mapIntroTextBounds,
      1,
      introTextInsetX,
      introTextInsetY,
      introTextGap
    );
    const headerPanel = new Phaser.Geom.Rectangle(
      this.headerRect.x + this.mapPlaqueOffsetX,
      this.headerRect.y,
      this.headerRect.width,
      this.headerRect.height
    );
    const plaqueContentBounds = BattleUiChrome.getContentBounds(headerPanel, 'narrow');
    const plaqueGrid = createUiSubGrid(plaqueContentBounds, 1, 0, 0, UI_PANEL_MINI_GAP);

    BattleUiChrome.layoutHeaderTitle(this.mapPlaqueTitleText, headerPanel, 'narrow');
    this.mapPlaqueTitleText
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    this.mapPlaqueMetaText
      .setPosition(plaqueGrid.content.x, plaqueGrid.content.y)
      .setWordWrapWidth(plaqueContentBounds.width, true)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    this.mapObjectiveText
      .setPosition(plaqueGrid.content.x, this.mapPlaqueMetaText.y + this.mapPlaqueMetaText.height + plaqueGrid.gutter)
      .setWordWrapWidth(plaqueGrid.content.width, true)
      .setAlpha(this.mapPlaqueAlpha)
      .setVisible(hudVisible && this.mapPlaqueAlpha > 0.01);
    this.headerMenuButtonBounds.setTo(
      hudVisible ? headerPanel.x : 0,
      hudVisible ? headerPanel.y : 0,
      hudVisible ? headerPanel.width : 0,
      hudVisible ? headerPanel.height : 0
    );

    const menuPanelWidth = 248;
    const optionRowHeight = 30;
    const optionGap = UI_PANEL_COMPACT_GAP;
    const headerMenuActions = this.getHeaderMenuActions();
    const menuContentHeight = headerMenuActions.length * optionRowHeight + Math.max(0, headerMenuActions.length - 1) * optionGap;
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
      if (index >= headerMenuActions.length) {
        optionBounds.setTo(0, 0, 0, 0);
        text.setVisible(false);
        continue;
      }
      const rowBounds = menuGrid.band(menuGrid.content.y + index * (optionRowHeight + menuGrid.gutter), optionRowHeight);
      optionBounds.setTo(rowBounds.x, rowBounds.y, rowBounds.width, rowBounds.height);
      text
        .setPosition(optionBounds.x + UI_PANEL_COMPACT_INSET, optionBounds.centerY)
        .setOrigin(0, 0.5)
        .setVisible(hudVisible && this.headerMenuOpen);
    }

    this.mapIntroEyebrowBounds.setTo(
      introTextGrid.content.x,
      introTextGrid.content.y,
      eyebrowWidth,
      eyebrowHeight
    );
    const introTitleBand = introTextGrid.band(this.mapIntroEyebrowBounds.bottom + introTextGap, this.mapIntroTitleText.height);
    const introMetaBand = introTextGrid.band(introTitleBand.bottom + UI_PANEL_MICRO_GAP, this.mapIntroMetaText.height);
    this.mapObjectiveBoxBounds.setTo(
      introTextGrid.content.x,
      introMetaBand.bottom + UI_PANEL_GAP,
      introTextGrid.content.width,
      summaryBoxHeight
    );
    const introFlavorBand = introTextGrid.band(
      this.mapObjectiveBoxBounds.y + UI_PANEL_COMPACT_INSET,
      this.mapIntroFlavorText.height
    );

    const introFrame = this.mapIntroArt.frame;
    if (introFrame) {
      const artVisible = this.mapIntroAlpha > 0.01;
      this.mapIntroArt
        .setCrop(0, 0, introFrame.width, introFrame.height)
        .setDisplaySize(this.mapIntroArtImageBounds.width, this.mapIntroArtImageBounds.height)
        .setPosition(this.mapIntroArtImageBounds.centerX, this.mapIntroArtImageBounds.centerY)
        .setAlpha(this.mapIntroAlpha)
        .setTint(0xffffff)
        .setVisible(artVisible);
      this.mapIntroArtMask.clear();
      this.mapIntroArtMask.setPosition(this.mapIntroArtImageBounds.x, this.mapIntroArtImageBounds.y);
      this.mapIntroArtMask.fillStyle(0xffffff, 1);
      this.mapIntroArtMask.fillRoundedRect(
        0,
        0,
        this.mapIntroArtImageBounds.width,
        this.mapIntroArtImageBounds.height,
        24
      );
    }

    this.mapIntroEyebrowText
      .setOrigin(0, 0.5)
      .setPosition(this.mapIntroEyebrowBounds.x + 14, this.mapIntroEyebrowBounds.centerY)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible);
    this.mapIntroTitleText
      .setOrigin(0, 0)
      .setPosition(introTextGrid.content.x, introTitleBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible);
    this.mapIntroMetaText
      .setOrigin(0, 0)
      .setPosition(introTextGrid.content.x, introMetaBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible)
      .setWordWrapWidth(introTextInnerWidth, true);
    this.mapIntroFlavorText
      .setOrigin(0, 0)
      .setPosition(this.mapObjectiveBoxBounds.x + UI_PANEL_COMPACT_INSET, introFlavorBand.y)
      .setAlpha(this.mapIntroAlpha)
      .setVisible(introVisible)
      .setWordWrapWidth(introTextInnerWidth - UI_PANEL_COMPACT_INSET * 2, true);
  }

  private getTargetBattleDetailPanelHeight(panelWidth: number, height: number): number {
    const probePanel = new Phaser.Geom.Rectangle(0, 0, panelWidth, 320);
    const inspection = this.getCurrentHudInspection();
    const portraitVisible = this.getHudPortraitDescriptor(inspection) !== null;
    const hasHealthBar = inspection.kind === 'battle-unit';
    const requiredHeight = this.measureBattleDetailPanelLayout(probePanel, portraitVisible, hasHealthBar).bodyBoxBounds.bottom + UI_PANEL_CONTENT_INSET;
    const maxHeight = Math.max(184, height - this.headerRect.bottom - 24);

    return Phaser.Math.Clamp(Math.ceil(requiredHeight), 184, maxHeight);
  }

  private measureBattleDetailPanelLayout(
    panel: Phaser.Geom.Rectangle,
    portraitVisible: boolean,
    hasHealthBar: boolean
  ): DetailPanelLayoutMetrics {
    return measureDetailPanelLayout({
      panel,
      portraitVisible,
      hasHealthBar,
      metaText: this.detailMetaText,
      titleText: this.detailTitleText,
      bodyText: this.detailBodyText,
      statTexts: this.detailStatTexts
    });
  }

  private layoutWorldDetailPanelSection(
    inspection: WorldHudInspection,
    hudViewModel: BattleHudViewModel | null
  ): void {
    if (inspection.kind === 'mission' || !hudViewModel || !this.showDetailPanel || this.isBattleIntroActive()) {
      this.detailBodyBoxBounds.setTo(0, 0, 0, 0);
      this.detailHealthBarBounds.setTo(0, 0, 0, 0);
      this.uiPanels.portrait.setTo(0, 0, 0, 0);
      for (const bounds of this.detailStatChipBounds) {
        bounds.setTo(0, 0, 0, 0);
      }
      this.activeBadge.setVisible(false).setAlpha(0);
      this.detailMetaText.setVisible(false).setAlpha(0);
      this.detailTitleText.setVisible(false).setAlpha(0);
      this.detailBodyText.setVisible(false).setAlpha(0);
      this.hideHudPortrait();
      for (const text of this.detailStatTexts) {
        text.setVisible(false).setAlpha(0);
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
    const portraitVisible = this.getHudPortraitDescriptor(inspection) !== null && this.showPortraitPanel;
    const hasHealthBar = inspection.kind === 'battle-unit';
    const metrics = this.measureBattleDetailPanelLayout(panel, portraitVisible, hasHealthBar);

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
    this.detailBodyText
      .setAlpha(alpha)
      .setVisible(visible);
    for (const text of this.detailStatTexts) {
      text
        .setAlpha(alpha)
        .setVisible(visible && text.text.length > 0);
    }

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
    this.syncHudPortrait(inspection);
    this.portrait
      .setPosition(this.uiPanels.portrait.centerX, this.uiPanels.portrait.centerY)
      .setAlpha(alpha)
      .setVisible(visible && portraitVisible);
    this.portraitMask.clear();
    if (visible && portraitVisible) {
      this.portraitMask.fillStyle(0xffffff, 1);
      this.portraitMask.fillRoundedRect(
        this.uiPanels.portrait.x,
        this.uiPanels.portrait.y,
        this.uiPanels.portrait.width,
        this.uiPanels.portrait.height,
        UI_INSET_RADIUS
      );
    }
    this.portraitMask.setVisible(false);
  }

  private hideHudPortrait(): void {
    clearDetailPortrait(this.portrait, this.portraitMask);
  }

  private getHudPortraitDescriptor(
    inspection: WorldHudInspection
  ): { textureKey: string; kind: DetailPortraitKind; flipX: boolean } | null {
    switch (inspection.kind) {
      case 'battle-unit':
      case 'npc': {
        const spriteKey = inspection.kind === 'battle-unit' ? inspection.unit.spriteKey : inspection.npc.spriteKey;
        const portraitKey = getUnitPortraitImageKey(spriteKey) ?? spriteKey;
        const actorId = inspection.kind === 'battle-unit' ? inspection.unit.id : inspection.npc.id;
        const facing = this.actorViews.get(actorId)?.facing ?? DEFAULT_FACING;
        return {
          textureKey: portraitKey,
          kind: portraitKey === spriteKey ? 'unit' : 'unit-portrait',
          flipX: portraitKey === spriteKey ? shouldFlipSpriteForFacing(facing) : false
        };
      }
      case 'tile':
        return inspection.prop
          ? { textureKey: inspection.prop.assetId, kind: 'prop', flipX: false }
          : { textureKey: TERRAIN_TILE_ASSETS[inspection.tile.terrain][0], kind: 'terrain', flipX: false };
      case 'mission':
      default:
        return null;
    }
  }

  private syncHudPortrait(inspection: WorldHudInspection): void {
    const descriptor = this.getHudPortraitDescriptor(inspection);
    if (!descriptor || this.uiPanels.portrait.width <= 0 || this.uiPanels.portrait.height <= 0 || !this.showPortraitPanel) {
      this.hideHudPortrait();
      return;
    }

    this.showHudDetailPortrait(descriptor.textureKey, descriptor.kind, descriptor.flipX);
  }

  private showHudDetailPortrait(textureKey: string, kind: DetailPortraitKind, flipX = false): void {
    renderDetailPortrait({
      image: this.portrait,
      mask: this.portraitMask,
      panel: this.uiPanels.portrait,
      textureKey,
      kind,
      flipX,
      visible: this.showPortraitPanel
    });
  }

  private drawWorldHudPanels(hudViewModel: BattleHudViewModel | null): void {
    this.uiGraphics.clear();
    this.drawWorldMapPlaque();
    this.drawWorldMapTitleIntro();
    this.drawWorldDetailPlaque(hudViewModel);

    if (this.isBattleIntroActive() || !this.showDetailPanel || !this.showPortraitPanel || !this.portrait.visible || this.detailPanelAlpha <= 0.01) {
      return;
    }

    drawSharedPortraitFrame(this.uiGraphics, this.uiPanels.portrait, this.detailPanelAlpha);
  }

  private drawWorldMapPlaque(): void {
    if (this.headerRect.width <= 0 || this.headerRect.height <= 0 || this.mapPlaqueAlpha <= 0.01) {
      this.mapPlaqueArt.setVisible(false);
      this.mapPlaqueArtMask.clear().setVisible(false);
      return;
    }

    drawSharedMapPlaque({
      graphics: this.uiGraphics,
      art: this.mapPlaqueArt,
      artMask: this.mapPlaqueArtMask,
      panel: new Phaser.Geom.Rectangle(
        this.headerRect.x + this.mapPlaqueOffsetX,
        this.headerRect.y,
        this.headerRect.width,
        this.headerRect.height
      ),
      alpha: this.mapPlaqueAlpha
    });

    if (this.headerMenuOpen) {
      drawSharedHeaderMenuOverlay({
        graphics: this.uiGraphics,
        viewportWidth: this.scale.width,
        viewportHeight: this.scale.height,
        panel: this.headerMenuPanelBounds,
        optionBounds: this.headerMenuOptionBounds
      });
    }
  }

  private drawWorldMapTitleIntro(): void {
    if (this.mapIntroAlpha <= 0.01) {
      this.mapIntroArt.setVisible(false);
      this.introOverlayShade.setAlpha(0);
      return;
    }

    drawSharedMapTitleIntro({
      graphics: this.uiGraphics,
      overlayShade: this.introOverlayShade,
      artBounds: this.mapIntroArtBounds,
      textBounds: this.mapIntroTextBounds,
      eyebrowBounds: this.mapIntroEyebrowBounds,
      objectiveBounds: this.mapObjectiveBoxBounds,
      alpha: this.mapIntroAlpha
    });
  }

  private drawWorldDetailPlaque(hudViewModel: BattleHudViewModel | null): void {
    if (this.isBattleIntroActive() || !hudViewModel || !this.showDetailPanel || this.detailPanelAlpha <= 0.01) {
      return;
    }

    const inspection = this.getCurrentHudInspection();
    const accentColor = inspection.kind === 'battle-unit'
      ? inspection.unit.team === 'player'
        ? UI_COLOR_ACCENT_COOL
        : UI_COLOR_ACCENT_DANGER
      : inspection.kind === 'npc'
        ? inspection.npc.disposition === 'hostile'
          ? UI_COLOR_ACCENT_DANGER
          : UI_COLOR_ACCENT_WARM
        : inspection.kind === 'tile'
          ? UI_COLOR_ACCENT_WARM
          : UI_COLOR_ACCENT_NEUTRAL;
    const alpha = this.detailPanelAlpha;
    const panel = new Phaser.Geom.Rectangle(
      this.uiPanels.topRight.x + this.detailPanelOffsetX,
      this.uiPanels.topRight.y,
      this.uiPanels.topRight.width,
      this.uiPanels.topRight.height
    );

    drawSharedDetailPlaque({
      graphics: this.uiGraphics,
      panel,
      accentColor,
      alpha,
      bodyBoxBounds: this.detailBodyBoxBounds,
      statChipBounds: this.detailStatChipBounds,
      statTexts: this.detailStatTexts,
      healthBarBounds: this.detailHealthBarBounds,
      healthRatio: hudViewModel.healthRatio,
      healthColor: hudViewModel.healthColor
    });
  }

  private startMapTitleSequence(): void {
    this.battleIntroPhase = 'intro';
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
    this.layoutBattleHud(this.scale.width, this.scale.height);
    this.drawWorldHudPanels(this.buildWorldHudViewModel(this.getCurrentHudInspection()));
  }

  private describeTerrain(terrain: TileData['terrain']): string {
    switch (terrain) {
      case 'grass':
        return 'Open footing with clean routes for melee pressure.';
      case 'moss':
        return 'Uneven, muted stone that favors careful flanks.';
      case 'stone':
        return 'Broken chapel stone grants slight protection.';
      case 'sanctum':
        return 'The altar crest hardens defenders against direct blows.';
      case 'chrono':
        return 'Steel relay flooring funnels the fight along hard-edged lanes.';
      case 'brine':
        return 'Wet sanctuary stone rewards committed pushes across the flooded line.';
      case 'bastion':
        return 'Fortress parade flooring favors disciplined advances and holdouts.';
      case 'aevum':
        return 'Terraced prophecy courts invite patient rotations toward the center.';
      default:
        return '';
    }
  }

  private describeProp(assetId: MapPropPlacement['assetId']): string {
    return PROP_RENDER_CONFIG[assetId].description ?? '';
  }

  private buildBattleActionMenuPanels(): ActionMenuPanelDescriptor[] {
    const activeUnit = this.getActiveBattleUnit();

    if (
      !activeUnit ||
      activeUnit.team !== 'player' ||
      !activeUnit.alive ||
      !this.isBattlePlayerPhase()
    ) {
      return [];
    }

    const rootPanel: ActionMenuPanelDescriptor = {
      id: 'battle-command-list',
      kind: 'list',
      title: activeUnit.name,
      blocksWorldInput: true,
      entries: this.getBattleMenuEntries().map((entry) => ({
        id: entry.action,
        label: entry.label,
        enabled: entry.enabled,
        active: this.getCurrentBattleMenuAction() === entry.action
      }))
    };

    switch (this.phase) {
      case 'battle-player-menu':
        return [rootPanel];
      case 'battle-player-move':
        return [
          rootPanel,
          {
            id: 'battle-move-detail',
            kind: 'detail',
            title: 'Move',
            blocksWorldInput: true,
            body: [
              `Stride up to ${activeUnit.move} tiles across open ground.`,
              this.worldBattle?.turnMoveUsed
                ? 'Movement is already spent this turn.'
                : 'Select a reachable tile on the field.'
            ].join('\n')
          }
        ];
      case 'battle-player-abilities':
        return [
          rootPanel,
          {
            id: 'battle-ability-list',
            kind: 'list',
            title: 'Abilities',
            blocksWorldInput: true,
            entries: this.getBattleSubmenuEntries().map((entry) => ({
              id: entry.abilityId ?? '',
              label: entry.label,
              enabled: entry.enabled,
              active: entry.abilityId === this.worldBattle?.selectedAbilityId
            }))
          }
        ];
      case 'battle-player-action': {
        const ability = this.getSelectedBattleAbility();
        const detailTags = ability
          ? [
              `Range ${ability.rangeMin}-${ability.rangeMax}`,
              ability.target === 'ally' ? 'Allies' : 'Enemies',
              ...(ability.splashRadius && ability.splashDamageMultiplier ? [`Blast ${ability.splashRadius}`] : []),
              ...(ability.counterable === false ? ['No Counter'] : [])
            ]
          : [];
        return [
          rootPanel,
          {
            id: 'battle-ability-list',
            kind: 'list',
            title: 'Abilities',
            blocksWorldInput: true,
            entries: this.getBattleSubmenuEntries().map((entry) => ({
              id: entry.abilityId ?? '',
              label: entry.label,
              enabled: entry.enabled,
              active: entry.abilityId === this.worldBattle?.selectedAbilityId
            }))
          },
          ...(ability
            ? [{
                id: 'battle-ability-detail',
                kind: 'detail' as const,
                title: ability.name,
                blocksWorldInput: true,
                body: [ability.description, detailTags.join('  •  ')].join('\n')
              }]
            : [])
        ];
      }
      case 'battle-player-items': {
        return [
          rootPanel,
          {
            id: 'battle-item-list',
            kind: 'list',
            title: 'Items',
            blocksWorldInput: true,
            entries: this.getBattleSubmenuEntries().map((entry) => ({
              id: entry.itemId ?? '',
              label: entry.label,
              enabled: entry.enabled,
              active: entry.itemId === this.worldBattle?.selectedItemId
            }))
          }
        ];
      }
      case 'battle-player-item-action': {
        const itemId = this.worldBattle?.selectedItemId;
        if (!itemId) {
          return [rootPanel];
        }
        const item = getItemDefinition(itemId);
        const count = this.getBattleUnitInventory(activeUnit)[itemId] ?? 0;
        return [
          rootPanel,
          {
            id: 'battle-item-list',
            kind: 'list',
            title: 'Items',
            blocksWorldInput: true,
            entries: this.getBattleSubmenuEntries().map((entry) => ({
              id: entry.itemId ?? '',
              label: entry.label,
              enabled: entry.enabled,
              active: entry.itemId === this.worldBattle?.selectedItemId
            }))
          },
          {
            id: 'battle-item-detail',
            kind: 'detail',
            title: item.name,
            blocksWorldInput: true,
            body: [
              item.description,
              `Range 1  •  Stock ${count}`,
              'Targets any adjacent unit.',
              'Select an adjacent target on the map.'
            ].join('\n')
          }
        ];
      }
      default:
        return [];
    }
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

  private shouldShowBattleActionMenu(): boolean {
    return this.buildBattleActionMenuPanels().length > 0;
  }

  private isBattlePlayerPhase(phase = this.phase): boolean {
    return (
      phase === 'battle-player-menu' ||
      phase === 'battle-player-abilities' ||
      phase === 'battle-player-move' ||
      phase === 'battle-player-action' ||
      phase === 'battle-player-items' ||
      phase === 'battle-player-item-action'
    );
  }

  private isWorldBattleActive(): boolean {
    return this.worldBattle !== null;
  }

  private getBattleUnitById(unitId: string | null): BattleUnit | null {
    if (!unitId) {
      return null;
    }

    return this.worldBattle?.units.find((unit) => unit.id === unitId) ?? null;
  }

  private getBattleUnitAt(x: number, y: number): BattleUnit | null {
    return this.worldBattle?.units.find((unit) => unit.alive && unit.x === x && unit.y === y) ?? null;
  }

  private getActiveBattleUnit(): BattleUnit | null {
    const battle = this.getWorldBattleRuntimeState();
    return battle ? this.battleRuntimeController.getActiveUnit(battle) : null;
  }

  private getLivingBattleUnits(team?: BattleUnit['team']): BattleUnit[] {
    return (this.worldBattle?.units ?? []).filter((unit) => unit.alive && (!team || unit.team === team));
  }

  private getBattleBlockedPoints(excludingUnitId?: string): Point[] {
    return [
      ...this.battleRuntimeController.getBlockedPropPoints(this.props),
      ...this.getLivingBattleUnits()
        .filter((unit) => unit.id !== excludingUnitId)
        .map((unit) => ({ x: unit.x, y: unit.y }))
    ];
  }

  private getBattleMoveNodesForUnit(unit: BattleUnit): Map<string, ReachNode> {
    return getTraversalNodes(
      this.map,
      unit,
      unit.move,
      this.getBattleBlockedPoints(unit.id)
    );
  }

  private getTargetableBattleUnits(unit: BattleUnit): BattleUnit[] {
    return this.getTargetableUnitsForBattleAbility(unit, this.battleRuntimeController.getBasicAttackAbility(unit));
  }

  private getBattleUnitInventory(unit: BattleUnit | string): Partial<Record<ItemId, number>> {
    const unitId = typeof unit === 'string' ? unit : unit.id;
    const inventory = this.unitInventories.get(unitId);

    if (inventory) {
      return inventory;
    }

    const nextInventory: Partial<Record<ItemId, number>> = {};
    this.unitInventories.set(unitId, nextInventory);
    return nextInventory;
  }

  private addItemToBattleUnit(unit: BattleUnit | string, itemId: ItemId, quantity = 1): void {
    const inventory = this.getBattleUnitInventory(unit);
    inventory[itemId] = (inventory[itemId] ?? 0) + quantity;
  }

  private consumeBattleItemFromUnit(unit: BattleUnit | string, itemId: ItemId, quantity = 1): void {
    const inventory = this.getBattleUnitInventory(unit);
    const remaining = Math.max(0, (inventory[itemId] ?? 0) - quantity);

    if (remaining === 0) {
      delete inventory[itemId];
      return;
    }

    inventory[itemId] = remaining;
  }

  private describeBattleItemGain(itemId: ItemId, quantity: number): string {
    const item = getItemDefinition(itemId);
    return quantity > 1 ? `${quantity}x ${item.name}` : item.name;
  }

  private getBattleMenuEntries(): Array<{ action: BattleMenuAction; label: string; enabled: boolean }> {
    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit || activeUnit.team !== 'player') {
      return [];
    }

    const inventoryEntries = getInventoryEntries(this.getBattleUnitInventory(activeUnit));

    return [
      this.canUndoBattleMove()
        ? { action: 'undo-move', label: 'Undo Move', enabled: true }
        : {
            action: 'move',
            label: this.worldBattle?.turnMoveUsed ? 'Move [Done]' : 'Move',
            enabled: !this.worldBattle?.turnMoveUsed
          },
      {
        action: 'abilities',
        label: this.worldBattle?.turnActionUsed ? 'Abilities [Done]' : 'Abilities',
        enabled: !this.worldBattle?.turnActionUsed && activeUnit.abilities.length > 0
      },
      {
        action: 'items',
        label: this.worldBattle?.turnActionUsed ? 'Items [Done]' : 'Items',
        enabled: !this.worldBattle?.turnActionUsed && inventoryEntries.length > 0
      },
      {
        action: 'wait',
        label: 'Wait',
        enabled: true
      }
    ];
  }

  private canUndoBattleMove(): boolean {
    const activeUnit = this.getActiveBattleUnit();

    return Boolean(
      activeUnit &&
      activeUnit.team === 'player' &&
      this.worldBattle?.turnMoveUsed &&
      !this.worldBattle.turnActionUsed &&
      this.worldBattle.pendingMoveUndo?.unitId === activeUnit.id
    );
  }

  private getCurrentBattleMenuAction(): BattleMenuAction | null {
    switch (this.phase) {
      case 'battle-player-abilities':
      case 'battle-player-action':
        return 'abilities';
      case 'battle-player-items':
      case 'battle-player-item-action':
        return 'items';
      case 'battle-player-move':
        return this.canUndoBattleMove() ? 'undo-move' : 'move';
      default:
        return null;
    }
  }

  private getSelectedBattleAbility(): UnitAbility | null {
    const battle = this.getWorldBattleRuntimeState();
    return battle ? this.battleRuntimeController.getSelectedAbility(battle) : null;
  }

  private getTargetableUnitsForBattleAbility(unit: BattleUnit, ability: UnitAbility): BattleUnit[] {
    const battle = this.getWorldBattleRuntimeState();
    return battle ? this.battleRuntimeController.getTargetableUnitsForAbility(battle, unit, ability) : [];
  }

  private getTargetableUnitsForBattleItem(unit: BattleUnit, itemId: ItemId): BattleUnit[] {
    const battle = this.getWorldBattleRuntimeState();
    return battle ? this.battleRuntimeController.getTargetableUnitsForItem(battle, unit, itemId) : [];
  }

  private getBattleSubmenuEntries(): Array<{
    label: string;
    enabled: boolean;
    abilityId?: string;
    itemId?: ItemId;
  }> {
    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit || activeUnit.team !== 'player') {
      return [];
    }

    if (this.phase === 'battle-player-abilities' || this.phase === 'battle-player-action') {
      return activeUnit.abilities.map((ability) => ({
        label: ability.name,
        enabled: this.getTargetableUnitsForBattleAbility(activeUnit, ability).length > 0,
        abilityId: ability.id
      }));
    }

    if (this.phase === 'battle-player-items' || this.phase === 'battle-player-item-action') {
      return getInventoryEntries(this.getBattleUnitInventory(activeUnit)).map((entry) => ({
        label: `${getItemDefinition(entry.itemId).name} x${entry.count}`,
        enabled: this.getTargetableUnitsForBattleItem(activeUnit, entry.itemId).length > 0,
        itemId: entry.itemId
      }));
    }

    return [];
  }

  private async handleBattleMenuPointer(x: number, y: number): Promise<boolean> {
    const hit = this.actionMenuStack.hitTest(x, y);

    if (!hit) {
      return false;
    }

    if (!hit.entryId) {
      return hit.blocksWorldInput;
    }

    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit || activeUnit.team !== 'player') {
      return hit.blocksWorldInput;
    }

    if (hit.panelId === 'battle-command-list') {
      const entry = this.getBattleMenuEntries().find((candidate) => candidate.action === hit.entryId);

      if (entry?.enabled) {
        await this.activateBattleMenuEntry(entry.action);
      }
      return true;
    }

    if (hit.panelId === 'battle-ability-list') {
      const entry = this.getBattleSubmenuEntries().find((candidate) => candidate.abilityId === hit.entryId);
      if (entry?.enabled) {
        await this.activateBattleSubmenuEntry(entry);
      }
      return true;
    }

    if (hit.panelId === 'battle-item-list') {
      const entry = this.getBattleSubmenuEntries().find((candidate) => candidate.itemId === hit.entryId);
      if (entry?.enabled) {
        await this.activateBattleSubmenuEntry(entry);
      }
      return true;
    }

    return hit.blocksWorldInput;
  }

  private isPointerOverUi(x: number, y: number): boolean {
    if (this.phase === 'battle-complete' && this.resultOverlayPanelBounds.contains(x, y)) {
      return true;
    }

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

    return this.actionMenuStack.containsPoint(x, y);
  }

  private async handleBattleTileSelection(tile: TileData): Promise<void> {
    const activeUnit = this.getActiveBattleUnit();

    if (this.phase === 'battle-player-menu') {
      this.inspectBattleTile(tile);
      return;
    }

    if (!activeUnit || activeUnit.team !== 'player' || this.phase === 'battle-enemy' || this.phase === 'battle-intro') {
      return;
    }

    if (this.phase === 'battle-player-move') {
      if (!this.moveNodes.has(pointKey(tile)) || this.getBattleUnitAt(tile.x, tile.y)) {
        return;
      }

      await this.handleBattleMove(tile);
      return;
    }

    if (this.phase === 'battle-player-action') {
      const target = this.getBattleUnitAt(tile.x, tile.y);
      const ability = this.getSelectedBattleAbility();

      if (!target || !ability) {
        return;
      }

      if (!this.getTargetableUnitsForBattleAbility(activeUnit, ability).some((candidate) => candidate.id === target.id)) {
        return;
      }

      await this.performWorldBattleAbility(activeUnit, target, ability);
      return;
    }

    if (this.phase === 'battle-player-item-action') {
      const target = this.getBattleUnitAt(tile.x, tile.y);
      const itemId = this.worldBattle?.selectedItemId;

      if (!target || !itemId) {
        return;
      }

      if (!this.getTargetableUnitsForBattleItem(activeUnit, itemId).some((candidate) => candidate.id === target.id)) {
        return;
      }

      await this.useBattleItem(itemId, target);
      return;
    }
  }

  private async handlePointerDown(pointer: Phaser.Input.Pointer): Promise<void> {
    if (this.phase === 'battle-complete' && this.resultOverlayPanelBounds.contains(pointer.x, pointer.y)) {
      this.handleWorldBattleResultOverlayPointer(pointer.x, pointer.y);
      return;
    }

    if (this.busy) {
      return;
    }

    if (await this.handleHeaderMenuPointer(pointer.x, pointer.y)) {
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

  private async handleHeaderMenuPointer(x: number, y: number): Promise<boolean> {
    if (!this.isWorldBattleActive() && this.phase !== 'idle' && this.phase !== 'menu' && this.phase !== 'detail') {
      return false;
    }

    if (this.headerMenuButtonBounds.contains(x, y)) {
      this.setPauseMenuOpen(!this.headerMenuOpen);
      this.invalidateHud();
      return true;
    }

    if (!this.headerMenuOpen) {
      return false;
    }

    if (!this.headerMenuPanelBounds.contains(x, y)) {
      this.setPauseMenuOpen(false);
      this.invalidateHud();
      return true;
    }

    const actions = this.getHeaderMenuActions();
    for (const [index, bounds] of this.headerMenuOptionBounds.entries()) {
      if (!bounds.contains(x, y)) {
        continue;
      }

      const action = actions[index];
      if (action) {
        await this.executeHeaderMenuAction(action);
      }
      return true;
    }

    return true;
  }

  private async handleMenuPointer(x: number, y: number): Promise<boolean> {
    if (this.isWorldBattleActive()) {
      return this.handleBattleMenuPointer(x, y);
    }

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
    this.invalidatePresentation();
    return true;
  }

  private getHeaderMenuActions(): HeaderMenuAction[] {
    return this.isWorldBattleActive() ? ['auto', 'audio', 'restart', 'setup'] : ['audio', 'restart', 'title'];
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
        this.pushMessage(`Audio ${muted ? 'muted' : 'enabled'}.`);
        this.invalidateHud();
        return;
      }
      case 'restart':
        if (this.isWorldBattleActive()) {
          await this.restartWorldEncounterBattle();
          return;
        }
        this.resetWorldVisit();
        return;
      case 'setup':
        if (this.isWorldBattleActive()) {
          await this.returnWorldBattleToRoad();
          return;
        }
        return;
      case 'title':
        this.returnToTitle();
        return;
      default:
        return;
    }
  }

  private async handleTileSelection(tile: TileData): Promise<void> {
    if (this.isWorldBattleActive()) {
      await this.handleBattleTileSelection(tile);
      return;
    }

    const npc = this.getNpcAt(tile.x, tile.y);

    if (npc) {
      this.focusedNpcId = npc.id;

      if (this.isHostileNpc(npc)) {
        if (!this.isHostileNpcEncounterTriggerable(npc)) {
          return;
        }

        if (manhattanDistance(this.player, npc) === 1) {
          await this.startHostileNpcEncounter(npc, { x: this.player.x, y: this.player.y });
          return;
        }

        const hostilePath = this.getPathToNpcAdjacency(npc);

        if (!hostilePath) {
          this.pushMessage(`${npc.name} is cut off from this route.`);
          return;
        }

        await this.movePlayer(hostilePath, npc.id);
        return;
      }

      if (manhattanDistance(this.player, npc) === 1) {
        this.selectedNpcActionId = null;
        this.phase = 'menu';
        this.invalidatePresentation();
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
    this.invalidateHud();

    let arrivalFrom: Point | null = null;

    try {
      for (const step of path.slice(1)) {
        if (this.getNpcAt(step.x, step.y)) {
          break;
        }

        const tile = getTile(this.map, step.x, step.y);

        if (!tile) {
          continue;
        }

        const stepOrigin = { x: this.player.x, y: this.player.y };
        const destination = this.getUnitGroundPoint(tile);
        const destinationDepth = this.getUnitDepth(tile);
        this.updateActorFacingForMovement(this.player, view, destination);
        const movementPromise = this.animateMovementStep(view, destination, destinationDepth);
        const cameraPromise = this.centerCameraOnPoint(destination.x, destination.y - 12, 180);
        audioDirector.playStep();
        await Promise.all([movementPromise, cameraPromise]);
        this.player.x = step.x;
        this.player.y = step.y;

        if (
          this.getTransitionAt(step.x, step.y) ||
          this.getTriggerableEncounterAt(step.x, step.y) ||
          this.getAdjacentTriggerableHostileNpcAt({ x: step.x, y: step.y })
        ) {
          arrivalFrom = stepOrigin;
          break;
        }
      }
    } finally {
      this.syncSessionWithPlayerPosition();
      this.reconcileEncounterSuppression();
      this.busy = false;
      if (!this.rebuildOutdoorAreaForCamera()) {
        this.phase = 'idle';
        this.positionActor(this.player);
        this.invalidatePresentation();
      }
    }

    await this.handleArrivalTile(arrivalFrom);
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
        interiorPosition: null,
        suppressedEncounterId: this.sessionState.suppressedEncounterId
      });
      return;
    }

    this.sessionState = persistWorldSession({
      ...this.sessionState,
      areaKind: 'interior',
      interiorPosition: { x: this.player.x, y: this.player.y },
      suppressedEncounterId: this.sessionState.suppressedEncounterId
    });
  }

  private async handleArrivalTile(previousPlayerPosition: Point | null): Promise<void> {
    const transition = this.getTransitionAt(this.player.x, this.player.y);

    if (transition) {
      await this.performTransition(transition);
      return;
    }

    const encounter = this.getTriggerableEncounterAt(this.player.x, this.player.y);

    if (encounter) {
      await this.startEncounter(encounter, previousPlayerPosition);
      return;
    }

    const hostileNpc = this.getAdjacentTriggerableHostileNpc();

    if (hostileNpc) {
      await this.startHostileNpcEncounter(hostileNpc, previousPlayerPosition ?? { x: this.player.x, y: this.player.y });
      return;
    }

    this.refreshNpcInteraction();
    this.positionActor(this.player);
    this.invalidatePresentation();
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
        returnOutdoorPosition: absolutePosition,
        suppressedEncounterId: this.sessionState.suppressedEncounterId,
        outdoorNpcStates: this.sessionState.outdoorNpcStates
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
        returnOutdoorPosition: null,
        suppressedEncounterId: this.sessionState.suppressedEncounterId,
        outdoorNpcStates: this.sessionState.outdoorNpcStates
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
              returnOutdoorPosition: null,
              suppressedEncounterId: this.sessionState.suppressedEncounterId,
              outdoorNpcStates: this.sessionState.outdoorNpcStates
            }
          : {
              areaKind: 'interior',
              areaId: spawn.areaId,
              outdoorPosition: this.sessionState.outdoorPosition,
              interiorPosition: { x: spawn.x, y: spawn.y },
              returnOutdoorPosition: this.sessionState.returnOutdoorPosition,
              suppressedEncounterId: this.sessionState.suppressedEncounterId,
              outdoorNpcStates: this.sessionState.outdoorNpcStates
            }
      );
      await this.fadeAndRebuild();
      return;
    }

    this.phase = 'idle';
    this.busy = false;
    this.invalidatePresentation();
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

  private async startEncounter(
    encounter: LocalWorldEncounter,
    previousPlayerPosition: Point | null,
    initiatorNpc?: WorldNpcRuntime
  ): Promise<void> {
    if (this.isWorldBattleActive()) {
      return;
    }

    this.phase = 'transition';
    this.busy = true;
    audioDirector.playUiConfirm();
    this.syncSessionWithPlayerPosition();
    const runtimeBattle = this.buildRuntimeBattleStartData(encounter, previousPlayerPosition, initiatorNpc);
    this.sessionState = persistWorldSession({
      ...this.sessionState,
      suppressedEncounterId: encounter.id
    });
    await this.beginWorldBattle(encounter.id, runtimeBattle);
  }

  private async startHostileNpcEncounter(npc: WorldNpcRuntime, previousPlayerPosition: Point | null): Promise<void> {
    if (this.isWorldBattleActive()) {
      return;
    }

    if (!this.isHostileNpcEncounterTriggerable(npc)) {
      return;
    }

    await this.startEncounter(this.createEncounterFromHostileNpc(npc), previousPlayerPosition, npc);
  }

  private async beginWorldBattle(encounterId: string, runtimeBattle: RuntimeBattleStartData): Promise<void> {
    const introStartPoints = this.getWorldBattleIntroStartPoints(runtimeBattle);
    const sourceArenaFocusPoint = this.getWorldBattleArenaFocusPoint(runtimeBattle);
    this.autoBattleRunToken += 1;
    this.activeAutoBattleRunToken = null;
    this.unitInventories.clear();

    this.worldBattle = {
      encounterId,
      runtimeBattle,
      sourcePreviewActive: true,
      units: runtimeBattle.units.map((unit) => ({ ...unit })),
      activeUnitId: null,
      selectedAbilityId: null,
      selectedItemId: null,
      turnMoveUsed: false,
      turnActionUsed: false,
      pendingMoveUndo: null,
      autoBattleEnabled: false
    };
    this.battleObjectCountBaseline = this.children.list.length;
    this.battleObjectCountDelta = null;
    for (const unit of this.worldBattle.units) {
      this.unitInventories.set(unit.id, {});
    }
    this.factionMottoPlayed.clear();
    this.pendingFactionMottoId = null;
    this.headerMenuOpen = false;
    this.battleIntroPhase = 'intro';
    this.mapIntroAlpha = 0;
    this.mapIntroOffsetY = 18;
    this.mapPlaqueAlpha = 0;
    this.mapPlaqueOffsetX = -20;
    this.phase = 'battle-intro';
    this.moveNodes.clear();
    this.focusedNpcId = null;
    this.selectedNpcActionId = null;
    this.hoverTile = null;
    this.battleInspectionTarget = { kind: 'mission' };
    this.invalidateBattlePresentation();

    audioDirector.setMusic('battle');
    audioDirector.setBattleAmbience(this.battleTimeOfDay);
    this.applyBattlePresentationShell();
    this.startMapTitleSequence();
    this.createWorldBattleArenaPreviewWalls(runtimeBattle);
    this.updateWorldDynamicLighting(this.time.now);
    this.freezeWorldDynamicLighting = true;
    const collapseViewport = this.getWorldBattleCollapseViewport();
    const titlePromise = this.wait(MAP_TITLE_TOTAL_DURATION);
    const cameraPromise = this.centerCameraOnPoint(sourceArenaFocusPoint.x, sourceArenaFocusPoint.y, 420);
    const previewWallsPromise = this.revealWorldBattleArenaPreviewWalls();
    const collapsePromise = this.animateWorldBattleArenaCollapse(runtimeBattle, collapseViewport);
    await Promise.all([cameraPromise, collapsePromise, previewWallsPromise]);
    this.applyWorldBattleRuntimeState(runtimeBattle);
    if (this.worldBattle) {
      this.worldBattle.sourcePreviewActive = false;
    }
    this.freezeWorldDynamicLighting = false;
    this.updateWorldDynamicLighting(this.time.now);
    this.applyWorldBattleIntroPositions(runtimeBattle, introStartPoints);
    await this.animateWorldBattleFormation(runtimeBattle, introStartPoints);
    await titlePromise;

    this.busy = false;
    await this.beginNextWorldBattleTurn();
  }

  private getWorldBattleArenaFocusPoint(runtimeBattle: RuntimeBattleStartData): Phaser.Math.Vector2 {
    const arenaBounds = runtimeBattle.seamlessEntry?.arenaBounds;

    if (!arenaBounds) {
      const playerTile = getTile(this.map, this.player.x, this.player.y);
      return playerTile ? this.getUnitGroundPoint(playerTile) : new Phaser.Math.Vector2(this.origin.x, this.origin.y);
    }

    return this.getBasePlanePoint({
      x: arenaBounds.x + (arenaBounds.width - 1) / 2,
      y: arenaBounds.y + (arenaBounds.height - 1) / 2
    });
  }

  private createWorldBattleArenaPreviewWalls(runtimeBattle: RuntimeBattleStartData): void {
    for (const wall of this.arenaPreviewWallGraphics) {
      wall.destroy();
    }
    this.arenaPreviewWallGraphics = [];

    const arenaBounds = runtimeBattle.seamlessEntry?.arenaBounds;

    if (!arenaBounds) {
      return;
    }

    const visibleNeighborDirections = getVisibleNeighborDirections(this.boardRotationStep);
    const arenaTiles = this.map
      .filter((tile) => this.isPointInsideWorldBattleArena(tile, arenaBounds))
      .sort((left, right) => this.getTileDepth(left) - this.getTileDepth(right));

    for (const tile of arenaTiles) {
      const corners = this.getTileTopPoints(tile);
      const right = corners[1];
      const bottom = corners[2];
      const left = corners[3];
      const color = getTerrainPalette(tile.terrain);
      const rightNeighbor = {
        x: tile.x + visibleNeighborDirections.right.x,
        y: tile.y + visibleNeighborDirections.right.y
      };
      const leftNeighbor = {
        x: tile.x + visibleNeighborDirections.left.x,
        y: tile.y + visibleNeighborDirections.left.y
      };
      const rightDrop = this.isPointInsideWorldBattleArena(rightNeighbor, arenaBounds)
        ? 0
        : (tile.height + WORLD_EDGE_BASE_LEVEL) * ELEVATION_STEP;
      const leftDrop = this.isPointInsideWorldBattleArena(leftNeighbor, arenaBounds)
        ? 0
        : (tile.height + WORLD_EDGE_BASE_LEVEL) * ELEVATION_STEP;

      if (rightDrop <= 0 && leftDrop <= 0) {
        continue;
      }

      const wall = this.registerWorldObject(this.add.graphics().setAlpha(0));

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

      wall.setDepth(getWallDepth(this.getTileDepth(tile)) + 0.02);
      this.arenaPreviewWallGraphics.push(wall);
    }
  }

  private revealWorldBattleArenaPreviewWalls(): Promise<void> {
    if (this.arenaPreviewWallGraphics.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: this.arenaPreviewWallGraphics,
        alpha: 1,
        delay: 45,
        duration: 180,
        ease: 'Sine.easeOut',
        onComplete: () => resolve()
      });
    });
  }

  private async animateWorldBattleArenaCollapse(
    runtimeBattle: RuntimeBattleStartData,
    collapseViewport: Phaser.Geom.Rectangle
  ): Promise<void> {
    const arenaBounds = runtimeBattle.seamlessEntry?.arenaBounds;

    if (!arenaBounds) {
      return;
    }

    const animations: Promise<void>[] = [];

    for (const image of this.terrainTileImages) {
      const tilePoint = this.getSceneObjectTilePoint(image);

      if (!tilePoint || this.isPointInsideWorldBattleArena(tilePoint, arenaBounds)) {
        continue;
      }

      if (!this.isWorldBattleCollapsePointVisible(tilePoint, collapseViewport)) {
        this.hideWorldBattleArenaObjects([image]);
        continue;
      }

      animations.push(this.animateWorldBattleArenaCollapseObjects([image], tilePoint, arenaBounds));
    }

    for (const wall of this.wallGraphics) {
      const tilePoint = this.getSceneObjectTilePoint(wall);

      if (!tilePoint || this.isPointInsideWorldBattleArena(tilePoint, arenaBounds)) {
        continue;
      }

      if (!this.isWorldBattleCollapsePointVisible(tilePoint, collapseViewport)) {
        this.hideWorldBattleArenaObjects([wall]);
        continue;
      }

      animations.push(this.animateWorldBattleArenaCollapseObjects([wall], tilePoint, arenaBounds));
    }

    for (const prop of this.props) {
      if (this.isPointInsideWorldBattleArena(prop, arenaBounds)) {
        continue;
      }

      const view = this.propViews.get(prop.id);

      if (!view) {
        continue;
      }

      if (!this.isWorldBattleCollapsePointVisible(prop, collapseViewport)) {
        this.hideWorldBattleArenaObjects([view.base, view.image, view.shadowOverlay, view.groundGlow, view.haloGlow, view.embers]);
        continue;
      }

      animations.push(
        this.animateWorldBattleArenaCollapseObjects(
          [
            view.base,
            view.image,
            view.shadowOverlay,
            view.groundGlow,
            view.haloGlow,
            view.embers
          ],
          prop,
          arenaBounds
        )
      );
    }

    for (const overlay of this.lightGroundOverlays) {
      const tilePoint = this.getSceneObjectTilePoint(overlay);

      if (!tilePoint || this.isPointInsideWorldBattleArena(tilePoint, arenaBounds)) {
        continue;
      }

      if (!this.isWorldBattleCollapsePointVisible(tilePoint, collapseViewport)) {
        this.hideWorldBattleArenaObjects([overlay]);
        continue;
      }

      animations.push(this.animateWorldBattleArenaCollapseObjects([overlay], tilePoint, arenaBounds));
    }

    for (const overlay of this.lightShadowOverlays) {
      const tilePoint = this.getSceneObjectTilePoint(overlay);

      if (!tilePoint || this.isPointInsideWorldBattleArena(tilePoint, arenaBounds)) {
        continue;
      }

      if (!this.isWorldBattleCollapsePointVisible(tilePoint, collapseViewport)) {
        this.hideWorldBattleArenaObjects([overlay]);
        continue;
      }

      animations.push(this.animateWorldBattleArenaCollapseObjects([overlay], tilePoint, arenaBounds));
    }

    for (const actor of [this.player, ...this.npcs]) {
      if (this.isPointInsideWorldBattleArena(actor, arenaBounds)) {
        continue;
      }

      const view = this.actorViews.get(actor.id);

      if (!view) {
        continue;
      }

      if (!this.isWorldBattleCollapsePointVisible(actor, collapseViewport)) {
        this.hideWorldBattleArenaObjects([view.container]);
        continue;
      }

      animations.push(this.animateWorldBattleArenaCollapseObjects([view.container], actor, arenaBounds));
    }

    if (animations.length === 0) {
      return;
    }

    await Promise.all(animations);
  }

  private getSceneObjectTilePoint(object: Phaser.GameObjects.GameObject): Point | null {
    const tileX = object.getData('tileX');
    const tileY = object.getData('tileY');

    return typeof tileX === 'number' && typeof tileY === 'number'
      ? { x: tileX, y: tileY }
      : null;
  }

  private getWorldBattleCollapseViewport(): Phaser.Geom.Rectangle {
    const view = this.worldCamera.worldView;
    const marginX = TILE_WIDTH * 1.1;
    const marginY = TILE_HEIGHT * 7;

    return new Phaser.Geom.Rectangle(
      view.x - marginX,
      view.y - marginY,
      view.width + marginX * 2,
      view.height + marginY * 2
    );
  }

  private isWorldBattleCollapsePointVisible(point: Point, collapseViewport: Phaser.Geom.Rectangle): boolean {
    const tile = getTile(this.map, point.x, point.y);
    const screenPoint = tile ? this.isoToScreen(tile) : this.getBasePlanePoint(point);

    return collapseViewport.contains(screenPoint.x, screenPoint.y);
  }

  private hideWorldBattleArenaObjects(objects: Array<Phaser.GameObjects.GameObject | undefined>): void {
    for (const object of objects) {
      if (!object || !('setVisible' in object)) {
        continue;
      }

      const target = object as Phaser.GameObjects.GameObject & {
        alpha?: number;
        setVisible: (value: boolean) => Phaser.GameObjects.GameObject;
      };
      if (typeof target.alpha === 'number') {
        target.alpha = 0;
      }
      target.setVisible(false);
    }
  }

  private isPointInsideWorldBattleArena(point: Point, arenaBounds: RuntimeBattleArenaBounds): boolean {
    return (
      point.x >= arenaBounds.x &&
      point.x < arenaBounds.x + arenaBounds.width &&
      point.y >= arenaBounds.y &&
      point.y < arenaBounds.y + arenaBounds.height
    );
  }

  private getWorldBattleArenaBorderDistance(point: Point, arenaBounds: RuntimeBattleArenaBounds): number {
    const minX = arenaBounds.x;
    const maxX = arenaBounds.x + arenaBounds.width - 1;
    const minY = arenaBounds.y;
    const maxY = arenaBounds.y + arenaBounds.height - 1;
    const dx = point.x < minX ? minX - point.x : point.x > maxX ? point.x - maxX : 0;
    const dy = point.y < minY ? minY - point.y : point.y > maxY ? point.y - maxY : 0;

    return dx + dy;
  }

  private animateWorldBattleArenaCollapseObjects(
    objects: Array<Phaser.GameObjects.GameObject | undefined>,
    point: Point,
    arenaBounds: RuntimeBattleArenaBounds
  ): Promise<void> {
    const displayObjects = objects.filter(
      (candidate): candidate is Phaser.GameObjects.GameObject =>
        candidate !== undefined && 'setVisible' in candidate
    );

    if (displayObjects.length === 0) {
      return Promise.resolve();
    }

    const distance = this.getWorldBattleArenaBorderDistance(point, arenaBounds);
    const centerX = arenaBounds.x + (arenaBounds.width - 1) / 2;
    const horizontalDrift = Phaser.Math.Clamp(point.x - centerX, -3, 3) * 10;
    const delay = distance * 55;
    const duration = 340 + distance * 45;

    return new Promise<void>((resolve) => {
      let completed = 0;

      for (const object of displayObjects) {
        const target = object as Phaser.GameObjects.GameObject & {
          x: number;
          y: number;
          alpha: number;
          setVisible: (value: boolean) => Phaser.GameObjects.GameObject;
        };
        const startX = target.x;
        const startY = target.y;

        this.tweens.add({
          targets: target,
          x: startX + horizontalDrift,
          y: startY + 260 + distance * 20,
          alpha: 0,
          delay,
          duration,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            target.setVisible(false);
            completed += 1;

            if (completed >= displayObjects.length) {
              resolve();
            }
          }
        });
      }
    });
  }

  private getWorldBattleIntroStartPoints(runtimeBattle: RuntimeBattleStartData): Map<string, Phaser.Math.Vector2> {
    const points = new Map<string, Phaser.Math.Vector2>();
    const entries = runtimeBattle.seamlessEntry?.introEntries ?? [];

    for (const entry of entries) {
      const startTile = getTile(this.map, entry.start.x, entry.start.y);

      if (startTile) {
        points.set(entry.unitId, this.getUnitGroundPoint(startTile));
        continue;
      }

      if (entry.anchorUnitId) {
        const anchorPoint = points.get(entry.anchorUnitId);

        if (anchorPoint) {
          points.set(entry.unitId, new Phaser.Math.Vector2(anchorPoint.x, anchorPoint.y));
        }
      }
    }

    return points;
  }

  private applyWorldBattleRuntimeState(runtimeBattle: RuntimeBattleStartData): void {
    const sourceArenaBounds = runtimeBattle.seamlessEntry?.arenaBounds;
    const currentScroll = new Phaser.Math.Vector2(this.worldCamera.scrollX, this.worldCamera.scrollY);
    const facingOverrides = this.captureActorFacingOverrides();
    const nextMap = createLevelMap(runtimeBattle.level);
    const nextGridWidth = Math.max(...nextMap.map((tile) => tile.x), 0) + 1;
    const nextGridHeight = Math.max(...nextMap.map((tile) => tile.y), 0) + 1;

    if (sourceArenaBounds) {
      const sourceAnchor = getSharedBasePlanePoint(
        { x: sourceArenaBounds.x, y: sourceArenaBounds.y },
        {
          origin: this.origin,
          gridWidth: this.gridWidth,
          gridHeight: this.gridHeight,
          rotationStep: this.boardRotationStep
        }
      );
      const croppedAnchor = getSharedBasePlanePoint(
        { x: 0, y: 0 },
        {
          origin: { x: 0, y: 0 },
          gridWidth: nextGridWidth,
          gridHeight: nextGridHeight,
          rotationStep: this.boardRotationStep
        }
      );

      this.origin.set(sourceAnchor.x - croppedAnchor.x, sourceAnchor.y - croppedAnchor.y);
    } else {
      this.origin = new Phaser.Math.Vector2(nextGridHeight * (TILE_WIDTH / 2) + 160, 176);
    }

    this.destroyAreaObjects();
    this.map = nextMap;
    this.props = runtimeBattle.level.props.map((prop) => ({ ...prop }));
    this.encounters = [];
    this.transitions = [];
    this.npcs = [];
    this.gridWidth = nextGridWidth;
    this.gridHeight = nextGridHeight;
    this.areaName = runtimeBattle.level.name;
    this.areaBackdropAssetId = runtimeBattle.level.backdropAssetId ?? this.areaBackdropAssetId;
    this.player = this.worldBattle?.units.find((unit) => unit.team === 'player') ?? this.player;
    this.drawBoard();
    this.createTerrainTiles();
    this.createProps();
    this.createActors(facingOverrides);
    this.setupCameras();
    this.configureCamera(false);
    this.setCameraScroll(currentScroll.x, currentScroll.y);
    this.applyBattlePresentationShell();
    this.invalidateBattlePresentation();
  }

  private applyWorldBattleIntroPositions(
    runtimeBattle: RuntimeBattleStartData,
    introStartPoints: ReadonlyMap<string, Phaser.Math.Vector2>
  ): void {
    const entries = runtimeBattle.seamlessEntry?.introEntries ?? [];

    for (const entry of entries) {
      const view = this.actorViews.get(entry.unitId);
      const startPoint = this.getWorldBattleIntroEntryStartPoint(entry, introStartPoints);

      if (!view || !startPoint) {
        continue;
      }

      view.container.setPosition(startPoint.x, startPoint.y);
      view.container.setAlpha(entry.kind === 'visible' ? 1 : 0);
      view.container.setScale(entry.kind === 'visible' ? 1 : 0.86);
    }
  }

  private async animateWorldBattleFormation(
    runtimeBattle: RuntimeBattleStartData,
    introStartPoints: ReadonlyMap<string, Phaser.Math.Vector2>
  ): Promise<void> {
    const entries = runtimeBattle.seamlessEntry?.introEntries ?? [];
    const visibleEntries = entries.filter((entry) => entry.kind === 'visible');
    const emergeEntries = entries.filter((entry) => entry.kind === 'emerge');

    await Promise.all(
      visibleEntries.flatMap((entry, index) => {
        const movement = this.createWorldBattleFormationMovement(entry, introStartPoints, index * 60);
        return movement ? [movement] : [];
      })
    );

    if (emergeEntries.length > 0) {
      await this.wait(90);
    }

    await Promise.all(
      emergeEntries.flatMap((entry, index) => {
        const movement = this.createWorldBattleFormationMovement(entry, introStartPoints, 80 + index * 85);
        return movement ? [movement] : [];
      })
    );

    this.syncWorldBattleFormationFacing();
  }

  private createWorldBattleFormationMovement(
    entry: RuntimeBattleIntroEntryState,
    introStartPoints: ReadonlyMap<string, Phaser.Math.Vector2>,
    delay: number
  ): Promise<void> | null {
    const unit = this.getBattleUnitById(entry.unitId);
    const view = this.actorViews.get(entry.unitId);
    const tile = unit ? getTile(this.map, unit.x, unit.y) : null;
    const startPoint = this.getWorldBattleIntroEntryStartPoint(entry, introStartPoints);
    const destination = this.getWorldBattleUnitDestinationPoint(entry.unitId);

    if (!unit || !view || !tile || !startPoint || !destination) {
      return null;
    }

    return new Promise<void>((resolve) => {
      this.time.delayedCall(delay, async () => {
        const destinationDepth = this.getUnitDepth(tile);
        const liveStartPoint =
          entry.kind === 'emerge'
            ? this.getWorldBattleIntroEntryStartPoint(entry, introStartPoints) ?? startPoint
            : startPoint;
        const formationFacing = this.getWorldBattleFormationFacing(unit);

        view.container.setPosition(liveStartPoint.x, liveStartPoint.y);
        if (formationFacing !== view.facing) {
          this.applyActorFacing(unit, view, formationFacing);
        }

        if (entry.kind === 'emerge') {
          this.tweens.add({
            targets: view.container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 160,
            ease: 'Quad.easeOut'
          });
          await this.wait(40);
        }

        if (Phaser.Math.Distance.Between(liveStartPoint.x, liveStartPoint.y, destination.x, destination.y) > 0.5) {
          audioDirector.playStep();
          await this.animateMovementStep(view, destination, destinationDepth);
        }

        view.container.setPosition(destination.x, destination.y);
        view.container.setAlpha(1);
        view.container.setScale(1);
        this.positionActor(unit);
        resolve();
      });
    });
  }

  private getWorldBattleUnitDestinationPoint(unitId: string): Phaser.Math.Vector2 | null {
    const unit = this.getBattleUnitById(unitId);
    const tile = unit ? getTile(this.map, unit.x, unit.y) : null;

    return tile ? this.getUnitGroundPoint(tile) : null;
  }

  private syncWorldBattleFormationFacing(): void {
    const units = this.worldBattle?.units ?? [];

    for (const unit of units) {
      if (!unit.alive) {
        continue;
      }

      const view = this.actorViews.get(unit.id);

      if (!view) {
        continue;
      }

      const facing = this.getWorldBattleFormationFacing(unit);

      if (facing !== view.facing) {
        this.applyActorFacing(unit, view, facing);
      }
    }
  }

  private getWorldBattleFormationFacing(unit: BattleUnit): SpriteFacing {
    return getInitialBattleFacing(unit, this.worldBattle?.units ?? [], this.map, (tile) => this.getUnitGroundPoint(tile), DEFAULT_FACING);
  }

  private getWorldBattleIntroEntryStartPoint(
    entry: RuntimeBattleIntroEntryState,
    introStartPoints: ReadonlyMap<string, Phaser.Math.Vector2>
  ): Phaser.Math.Vector2 | null {
    if (entry.kind === 'emerge' && entry.anchorUnitId) {
      const anchorDestination = this.getWorldBattleUnitDestinationPoint(entry.anchorUnitId);

      if (anchorDestination) {
        return anchorDestination;
      }
    }

    return introStartPoints.get(entry.unitId) ?? (entry.anchorUnitId ? introStartPoints.get(entry.anchorUnitId) : null) ?? null;
  }

  private async beginNextWorldBattleTurn(): Promise<void> {
    if (!this.worldBattle) {
      return;
    }

    if (await this.resolveWorldBattleIfComplete()) {
      return;
    }

    const turnStart = this.battleRuntimeController.beginNextTurn(this.worldBattle);

    this.applyWorldBattleTurnState(turnStart.state);

    if (!turnStart.actor) {
      return;
    }

    const actor = turnStart.actor;
    this.moveNodes = this.getBattleMoveNodesForUnit(actor);
    this.setBattleInspectionTarget({ kind: 'mission' }, false);
    await this.centerCameraOnActor(actor, 180);
    this.playTurnStartAnimation(actor);
    audioDirector.playTurnStart(actor.team);
    this.queueTurnStartCatchPhrase(actor);
    this.playFactionMotto(actor.factionId);

    if (actor.team === 'player') {
      this.busy = false;
      this.phase = 'battle-player-menu';
      this.pushMessage(
        this.worldBattle.autoBattleEnabled
          ? `${actor.name} is ready. Auto-battle takes the reins.`
          : `${actor.name} is ready. Choose a command.`
      );
      this.invalidateBattlePresentation();

      if (this.worldBattle.autoBattleEnabled) {
        this.time.delayedCall(320, () => {
          if (this.phase === 'battle-player-menu' && this.getActiveBattleUnit()?.id === actor.id && !this.busy) {
            this.tryStartAutoBattle(actor);
          }
        });
      }
      return;
    }

    this.busy = true;
    this.phase = 'battle-enemy';
    this.invalidateBattlePresentation();
    await this.wait(620);
    await this.runEnemyBattleTurn(actor);
  }

  private async endWorldBattleTurn(): Promise<void> {
    if (!this.worldBattle) {
      return;
    }

    this.busy = true;
    this.applyWorldBattleTurnState(this.battleRuntimeController.clearTurnState(this.worldBattle));
    this.moveNodes.clear();

    if (await this.resolveWorldBattleIfComplete()) {
      return;
    }

    await this.wait(140);
    await this.beginNextWorldBattleTurn();
  }

  private async moveBattleUnit(unit: BattleUnit, path: Point[]): Promise<void> {
    const view = this.actorViews.get(unit.id);

    if (!view || path.length <= 1) {
      return;
    }

    this.busy = true;

    try {
      for (const step of path.slice(1)) {
        const tile = getTile(this.map, step.x, step.y);

        if (!tile) {
          continue;
        }

        const destination = this.getUnitGroundPoint(tile);
        const startDepth = view.container.depth;
        const destinationDepth = this.getUnitDepth(tile);
        this.updateActorFacingForMovement(unit, view, destination);
        const cameraPromise =
          unit.movementStyle === 'blink'
            ? this.centerCameraOnPoint(
                this.getBattleActorCameraFocusPoint(unit, destination).x,
                this.getBattleActorCameraFocusPoint(unit, destination).y,
                BLINK_MOVEMENT_CAMERA_PAN_DURATION
              )
            : this.centerCameraOnPoint(
                this.getBattleActorCameraFocusPoint(unit, destination).x,
                this.getBattleActorCameraFocusPoint(unit, destination).y,
                240
              );
        const movementPromise =
          unit.movementStyle === 'blink'
            ? this.animateBattleBlinkMovementStep(unit, view, destination, destinationDepth)
            : this.animateBattleStandardMovementStep(view, destination, startDepth, destinationDepth);

        if (unit.movementStyle !== 'blink') {
          audioDirector.playStep();
        }

        await Promise.all([movementPromise, cameraPromise]);
        unit.x = step.x;
        unit.y = step.y;
        this.positionActor(unit);
      }
    } finally {
      this.busy = false;
    }
  }

  private animateBattleStandardMovementStep(
    view: ActorView,
    destination: Phaser.Math.Vector2,
    startDepth: number,
    destinationDepth: number
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.container,
        x: destination.x,
        y: destination.y - 10,
        duration: DEFAULT_STEP_MOVE_UP_DURATION_MS,
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
            duration: DEFAULT_STEP_MOVE_DOWN_DURATION_MS,
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

  private animateBattleBlinkMovementStep(
    unit: BattleUnit,
    view: ActorView,
    destination: Phaser.Math.Vector2,
    destinationDepth: number
  ): Promise<void> {
    const startPoint = new Phaser.Math.Vector2(view.container.x, view.container.y);
    const startDepth = view.container.depth;
    const tracerDepth = Math.max(startDepth, destinationDepth) + 0.18;
    const movementAngle = Phaser.Math.Angle.Between(startPoint.x, startPoint.y, destination.x, destination.y);

    this.spawnCombatAfterimage(unit, startPoint, 0xb9f5ff);
    this.spawnBlinkMovementTracer(startPoint, destination, tracerDepth, unit.accentColor);
    this.spawnBlinkMovementBurst(startPoint, startDepth + 0.12, movementAngle + Math.PI, unit.accentColor);

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.container,
        alpha: 0,
        duration: BLINK_MOVEMENT_FADE_OUT_DURATION,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          view.container.setPosition(destination.x, destination.y - BLINK_MOVEMENT_ENTRY_OFFSET_Y);
          view.container.setDepth(destinationDepth);
          this.spawnBlinkMovementBurst(destination, destinationDepth + 0.12, movementAngle, unit.accentColor);

          this.tweens.add({
            targets: view.container,
            y: destination.y,
            alpha: 1,
            duration: BLINK_MOVEMENT_FADE_IN_DURATION,
            ease: 'Cubic.easeOut',
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

  private spawnBlinkMovementTracer(
    startPoint: Phaser.Math.Vector2,
    destination: Phaser.Math.Vector2,
    depth: number,
    tint: number
  ): void {
    const dx = destination.x - startPoint.x;
    const dy = destination.y - startPoint.y;
    const length = Math.hypot(dx, dy);

    if (length <= 1) {
      return;
    }

    const offsetX = (-dy / length) * 5;
    const offsetY = (dx / length) * 5;
    const startY = startPoint.y - 18;
    const endY = destination.y - 18;
    const tracer = this.registerWorldObject(this.add.graphics().setBlendMode(Phaser.BlendModes.ADD));

    tracer.lineStyle(10, 0xf6f7ff, 0.12);
    tracer.lineBetween(startPoint.x, startY, destination.x, endY);
    tracer.lineStyle(4, tint, 0.4);
    tracer.lineBetween(
      startPoint.x + offsetX,
      startY + offsetY * 0.3,
      destination.x + offsetX,
      endY + offsetY * 0.3
    );
    tracer.lineStyle(2, 0xffffff, 0.72);
    tracer.lineBetween(
      startPoint.x - offsetX * 0.4,
      startY - offsetY * 0.18,
      destination.x - offsetX * 0.4,
      endY - offsetY * 0.18
    );
    tracer.fillStyle(tint, 0.24);
    tracer.fillCircle(startPoint.x, startY, 4);
    tracer.fillCircle(destination.x, endY, 4);
    tracer.setDepth(depth);

    this.tweens.add({
      targets: tracer,
      alpha: 0,
      duration: 110,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        tracer.destroy();
      }
    });
  }

  private async activateBattleMenuEntry(action: BattleMenuAction): Promise<void> {
    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit || activeUnit.team !== 'player' || !this.worldBattle) {
      return;
    }

    switch (action) {
      case 'move':
        if (this.worldBattle.turnMoveUsed) {
          return;
        }

        audioDirector.playUiConfirm();
        this.worldBattle.selectedAbilityId = null;
        this.worldBattle.selectedItemId = null;
        this.moveNodes = this.getBattleMoveNodesForUnit(activeUnit);
        this.phase = 'battle-player-move';
        this.pushMessage(`Choose a tile for ${activeUnit.name}.`);
        this.invalidateBattlePresentation();
        return;
      case 'undo-move':
        audioDirector.playUiCancel();
        await this.undoBattleMove();
        return;
      case 'abilities':
        if (this.worldBattle.turnActionUsed) {
          return;
        }

        audioDirector.playUiConfirm();
        this.worldBattle.selectedAbilityId = null;
        this.worldBattle.selectedItemId = null;
        this.phase = 'battle-player-abilities';
        this.pushMessage(`Choose an ability for ${activeUnit.name}.`);
        this.invalidateBattlePresentation();
        return;
      case 'items':
        if (this.worldBattle.turnActionUsed) {
          return;
        }

        audioDirector.playUiConfirm();
        this.worldBattle.selectedAbilityId = null;
        this.worldBattle.selectedItemId = null;
        this.phase = 'battle-player-items';
        this.pushMessage(`Choose an item for ${activeUnit.name}.`);
        this.invalidateBattlePresentation();
        return;
      case 'wait':
        audioDirector.playUiConfirm();
        this.pushMessage(`${activeUnit.name} waits and watches the ridge.`);
        await this.endWorldBattleTurn();
        return;
      default:
        return;
    }
  }

  private async activateBattleSubmenuEntry(entry: {
    label: string;
    enabled: boolean;
    abilityId?: string;
    itemId?: ItemId;
  }): Promise<void> {
    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit || !this.worldBattle) {
      return;
    }

    if (entry.itemId) {
      const item = getItemDefinition(entry.itemId);
      audioDirector.playUiConfirm();
      this.worldBattle.selectedItemId = entry.itemId;
      this.worldBattle.selectedAbilityId = null;
      this.phase = 'battle-player-item-action';
      this.pushMessage(`Choose a target for ${item.name}.`);
      this.invalidateBattlePresentation();
      return;
    }

    if (entry.abilityId) {
      const ability = activeUnit.abilities.find((candidate) => candidate.id === entry.abilityId);

      if (!ability) {
        return;
      }

      audioDirector.playUiConfirm();
      this.worldBattle.selectedAbilityId = ability.id;
      this.worldBattle.selectedItemId = null;
      this.phase = 'battle-player-action';
      this.pushMessage(`Choose a target for ${ability.name}.`);
      this.invalidateBattlePresentation();
    }
  }

  private cancelBattleSelectionPhase(): void {
    if (!this.worldBattle) {
      return;
    }

    switch (this.phase) {
      case 'battle-player-items':
        audioDirector.playUiCancel();
        this.phase = 'battle-player-menu';
        this.worldBattle.selectedAbilityId = null;
        this.worldBattle.selectedItemId = null;
        break;
      case 'battle-player-item-action':
        audioDirector.playUiCancel();
        this.phase = 'battle-player-items';
        break;
      case 'battle-player-abilities':
        audioDirector.playUiCancel();
        this.phase = 'battle-player-menu';
        this.worldBattle.selectedAbilityId = null;
        this.worldBattle.selectedItemId = null;
        break;
      case 'battle-player-action':
        audioDirector.playUiCancel();
        this.phase = 'battle-player-abilities';
        this.worldBattle.selectedAbilityId = null;
        break;
      case 'battle-player-move':
        audioDirector.playUiCancel();
        this.phase = 'battle-player-menu';
        this.worldBattle.selectedAbilityId = null;
        this.worldBattle.selectedItemId = null;
        this.moveNodes.clear();
        break;
      default:
        return;
    }

    this.invalidateBattlePresentation();
  }

  private async handleBattleMove(tile: TileData): Promise<void> {
    const activeUnit = this.getActiveBattleUnit();

    if (!activeUnit || !this.worldBattle) {
      return;
    }

    const movePath = buildPath(this.moveNodes, tile);
    const moveUndo: BattleMoveUndoState = {
      unitId: activeUnit.id,
      origin: { x: activeUnit.x, y: activeUnit.y },
      path: movePath.map((step) => ({ x: step.x, y: step.y })),
      facing: this.actorViews.get(activeUnit.id)?.facing ?? DEFAULT_FACING
    };

    this.busy = true;
    this.phase = 'battle-animating';
    this.invalidateBattlePresentation();

    if (movePath.length > 1) {
      await this.moveBattleUnit(activeUnit, movePath);
    }

    this.worldBattle.pendingMoveUndo = moveUndo;
    this.worldBattle.turnMoveUsed = true;
    await this.finishWorldBattlePlayerCommand(activeUnit, `${activeUnit.name} is in position. Choose the next command.`);
  }

  private async undoBattleMove(): Promise<void> {
    const activeUnit = this.getActiveBattleUnit();
    const moveUndo = this.worldBattle?.pendingMoveUndo;

    if (
      !activeUnit ||
      !this.worldBattle ||
      !moveUndo ||
      moveUndo.unitId !== activeUnit.id ||
      !this.worldBattle.turnMoveUsed ||
      this.worldBattle.turnActionUsed
    ) {
      return;
    }

    this.busy = true;
    this.phase = 'battle-animating';
    this.invalidateBattlePresentation();

    activeUnit.x = moveUndo.origin.x;
    activeUnit.y = moveUndo.origin.y;
    this.positionActor(activeUnit);

    const view = this.actorViews.get(activeUnit.id);
    if (view) {
      this.applyActorFacing(activeUnit, view, moveUndo.facing);
    }

    await this.centerCameraOnActor(activeUnit, 220);

    this.worldBattle.pendingMoveUndo = null;
    this.worldBattle.turnMoveUsed = false;
    this.busy = false;
    this.phase = 'battle-player-menu';
    this.moveNodes = this.getBattleMoveNodesForUnit(activeUnit);
    this.invalidateBattlePresentation();
  }

  private async performWorldBattleAttack(attacker: BattleUnit, target: BattleUnit): Promise<void> {
    await this.performWorldBattleAbility(attacker, target, this.battleRuntimeController.getBasicAttackAbility(attacker));
  }

  private async performWorldBattleAbility(
    attacker: BattleUnit,
    target: BattleUnit,
    ability: UnitAbility,
    queueNextTurn = true
  ): Promise<void> {
    if (!this.worldBattle) {
      return;
    }

    this.busy = true;
    this.phase = attacker.team === 'player' ? 'battle-animating' : 'battle-enemy';
    if (attacker.team === 'player') {
      this.worldBattle.turnActionUsed = true;
      this.worldBattle.selectedAbilityId = ability.id;
    }
    this.pushMessage(`${attacker.name} uses ${ability.name} on ${target.name}.`);
    this.invalidateBattlePresentation();

    switch (ability.kind) {
      case 'attack': {
        await this.resolveWorldBattleStrike(attacker, target, ability);

        const counterAbility = this.battleRuntimeController.getBasicAttackAbility(target);
        if (
          ability.counterable !== false &&
          target.alive &&
          attacker.alive &&
          isAbilityInRange(target, attacker, counterAbility)
        ) {
          this.pushMessage(`${target.name} returns fire with ${counterAbility.name}.`);
          await this.resolveWorldBattleStrike(target, attacker, counterAbility);
        }
        break;
      }
      case 'heal':
        await this.resolveWorldBattleHealing(attacker, target, ability);
        break;
      case 'steal':
        await this.resolveWorldBattleSteal(attacker, target, ability);
        break;
      default:
        break;
    }

    if (queueNextTurn) {
      await this.finishWorldBattlePlayerCommand(attacker, `${attacker.name} can still reposition.`);
    }
  }

  private async resolveWorldBattleStrike(
    attacker: BattleUnit,
    target: BattleUnit,
    ability: UnitAbility
  ): Promise<void> {
    if (!attacker.alive || !target.alive || !this.actorViews.get(attacker.id) || !this.actorViews.get(target.id)) {
      return;
    }

    this.faceBattleUnitTowardActionTarget(attacker, target);
    await this.centerCameraOnActor(attacker, 120);

    const strikeAttacker: BattleUnit = {
      ...attacker,
      attack: attacker.attack + (ability.powerModifier ?? 0),
      rangeMin: ability.rangeMin,
      rangeMax: ability.rangeMax,
      effectKey: ability.effectKey ?? attacker.effectKey,
      attackName: ability.name
    };
    const attackerPoint = this.getUnitWorldPoint(attacker);
    const targetPoint = this.getUnitWorldPoint(target);
    const angle = Phaser.Math.Angle.Between(attackerPoint.x, attackerPoint.y, targetPoint.x, targetPoint.y);
    const launchPoint = this.getUnitSpritePoint(attacker, 0.55) ?? attackerPoint;
    const impactPoint = this.getUnitSpritePoint(target, 0.54) ?? targetPoint;
    const damageTextPoint = this.getUnitSpritePoint(target, 0.9) ?? new Phaser.Math.Vector2(targetPoint.x, targetPoint.y - 48);
    const effect = this.createCombatEffectPlayback(strikeAttacker.effectKey, attacker, target, {
      launchPoint,
      impactPoint,
      angle
    });

    await Promise.all([this.animateSourceReaction(effect), this.playCombatEffectLeadIn(effect)]);

    const result = calculateDamage(strikeAttacker, target, this.map, Math.random());
    target.hp = Math.max(0, target.hp - result.amount);
    await Promise.all([
      this.playCombatEffectImpact(effect, { critical: result.critical }),
      this.animateTargetReaction(effect, target, result.critical)
    ]);
    this.positionActor(target);
    await this.showFloatingCombatText(
      damageTextPoint,
      `${result.amount}`,
      result.critical ? UI_TEXT_DAMAGE_CRITICAL : UI_TEXT_DAMAGE,
      800
    );

    if (target.hp <= 0) {
      target.alive = false;
      await this.animateActorDefeat(target.id);
      this.pushMessage(`${target.name} falls on the ridge.`);

      if (target.team === 'enemy' && target.dropItemId) {
        const quantity = target.dropQuantity ?? 1;
        this.addItemToBattleUnit(attacker, target.dropItemId, quantity);
        this.pushMessage(`${target.name} drops ${this.describeBattleItemGain(target.dropItemId, quantity)} for ${attacker.name}.`);
        target.dropItemId = undefined;
        target.dropQuantity = undefined;
      }
    }

    const splashTargets = this.getBattleSplashTargets(attacker, target, ability);
    if (splashTargets.length > 0) {
      this.pushMessage(`${ability.name} catches ${splashTargets.map((unit) => unit.name).join(', ')} in the blast.`);
    }

    for (const splashTarget of splashTargets) {
      const splashOriginPoint = this.getUnitWorldPoint(target);
      const splashTargetPoint = this.getUnitWorldPoint(splashTarget);
      const splashAngle = Phaser.Math.Angle.Between(
        splashOriginPoint.x,
        splashOriginPoint.y,
        splashTargetPoint.x,
        splashTargetPoint.y
      );
      const splashEffect = this.createCombatEffectPlayback(strikeAttacker.effectKey, attacker, splashTarget, {
        launchPoint: this.getUnitSpritePoint(target, 0.54) ?? splashOriginPoint,
        impactPoint: this.getUnitSpritePoint(splashTarget, 0.54) ?? splashTargetPoint,
        angle: splashAngle
      });
      const splash = calculateDamage(strikeAttacker, splashTarget, this.map, Math.random(), {
        canCrit: false,
        damageMultiplier: ability.splashDamageMultiplier,
        minimumDamage: 6
      });
      splashTarget.hp = Math.max(0, splashTarget.hp - splash.amount);
      await Promise.all([
        this.playCombatEffectImpact(splashEffect),
        this.animateTargetReaction(splashEffect, splashTarget, false),
        this.showFloatingCombatText(
          this.getUnitSpritePoint(splashTarget, 0.9) ?? new Phaser.Math.Vector2(splashTargetPoint.x, splashTargetPoint.y - 48),
          `${splash.amount}`,
          UI_TEXT_DAMAGE,
          680
        )
      ]);
      this.positionActor(splashTarget);

      if (splashTarget.hp <= 0) {
        splashTarget.alive = false;
        await this.animateActorDefeat(splashTarget.id);
        this.pushMessage(`${splashTarget.name} is caught in the blast.`);
      }
    }

    if (result.critical) {
      this.pushMessage('Critical hit from the elevated angle.');
    }

    this.positionActor(attacker);
  }

  private getBattleSplashTargets(
    attacker: BattleUnit,
    primaryTarget: BattleUnit,
    ability: UnitAbility
  ): BattleUnit[] {
    if (!ability.splashRadius || !ability.splashDamageMultiplier || ability.splashRadius < 1) {
      return [];
    }

    return (this.worldBattle?.units ?? []).filter((candidate) => {
      if (!candidate.alive || candidate.id === attacker.id || candidate.id === primaryTarget.id) {
        return false;
      }

      if (candidate.team === attacker.team) {
        return false;
      }

      return manhattanDistance(primaryTarget, candidate) <= ability.splashRadius!;
    });
  }

  private async resolveWorldBattleHealing(
    attacker: BattleUnit,
    target: BattleUnit,
    ability: UnitAbility
  ): Promise<void> {
    if (!attacker.alive || !target.alive || !this.actorViews.get(attacker.id) || !this.actorViews.get(target.id)) {
      return;
    }

    this.faceBattleUnitTowardActionTarget(attacker, target);
    await this.centerCameraOnActor(attacker, 120);
    const effect = this.createCombatEffectPlayback(ability.effectKey ?? attacker.effectKey, attacker, target);
    await Promise.all([this.animateSourceReaction(effect), this.playCombatEffectLeadIn(effect)]);
    const amount = Math.min(ability.healAmount ?? 0, target.maxHp - target.hp);
    if (amount > 0) {
      target.hp += amount;
      this.positionActor(target);
    }
    await Promise.all([
      this.playCombatEffectImpact(effect),
      this.animateTargetReaction(effect, target, false)
    ]);
    await this.showFloatingCombatText(
      this.getUnitSpritePoint(target, 0.72) ?? new Phaser.Math.Vector2(this.getUnitWorldPoint(target).x, this.getUnitWorldPoint(target).y - 42),
      amount > 0 ? `+${amount}` : 'MISS',
      UI_TEXT_DAMAGE,
      720
    );
    this.pushMessage(
      amount > 0
        ? `${attacker.name} uses ${ability.name} on ${target.name}, restoring ${amount} HP.`
        : `${attacker.name} uses ${ability.name} on ${target.name}, but it has no effect.`
    );
  }

  private async resolveWorldBattleSteal(
    attacker: BattleUnit,
    target: BattleUnit,
    ability: UnitAbility
  ): Promise<void> {
    if (!attacker.alive || !target.alive || !this.actorViews.get(attacker.id) || !this.actorViews.get(target.id)) {
      return;
    }

    this.faceBattleUnitTowardActionTarget(attacker, target);
    await this.centerCameraOnActor(attacker, 120);
    const attackerPoint = this.getUnitWorldPoint(attacker);
    const targetPoint = this.getUnitWorldPoint(target);
    const angle = Phaser.Math.Angle.Between(attackerPoint.x, attackerPoint.y, targetPoint.x, targetPoint.y);
    const effect = this.createCombatEffectPlayback(ability.effectKey ?? attacker.effectKey, attacker, target, { angle });
    await Promise.all([this.animateSourceReaction(effect), this.playCombatEffectLeadIn(effect)]);
    await Promise.all([this.playCombatEffectImpact(effect), this.animateTargetReaction(effect, target, false)]);
    if (target.dropItemId) {
      const quantity = target.dropQuantity ?? 1;
      this.addItemToBattleUnit(attacker, target.dropItemId, quantity);
      this.pushMessage(`${attacker.name} steals ${this.describeBattleItemGain(target.dropItemId, quantity)} from ${target.name}.`);
      target.dropItemId = undefined;
      target.dropQuantity = undefined;
    } else {
      this.pushMessage(`${attacker.name} finds nothing to steal from ${target.name}.`);
    }
    await this.showFloatingCombatText(
      this.getUnitSpritePoint(target, 0.72) ?? new Phaser.Math.Vector2(targetPoint.x, targetPoint.y - 42),
      'STOLEN',
      UI_TEXT_DAMAGE,
      720
    );
  }

  private async useBattleItem(itemId: ItemId, target: BattleUnit): Promise<void> {
    const activeUnit = this.getActiveBattleUnit();
    const item = getItemDefinition(itemId);
    const count = activeUnit ? this.getBattleUnitInventory(activeUnit)[itemId] ?? 0 : 0;

    if (!activeUnit || !this.worldBattle || count <= 0) {
      return;
    }

    if (!this.getTargetableUnitsForBattleItem(activeUnit, itemId).some((unit) => unit.id === target.id)) {
      audioDirector.playUiCancel();
      this.pushMessage(`${item.name} cannot reach that target.`);
      this.invalidateHud();
      return;
    }

    this.faceBattleUnitTowardActionTarget(activeUnit, target);
    this.busy = true;
    this.phase = 'battle-animating';
    this.worldBattle.turnActionUsed = true;
    this.invalidateBattlePresentation();

    switch (item.effect.kind) {
      case 'heal':
        await this.resolveWorldBattleHealing(activeUnit, target, {
          id: item.id,
          name: item.name,
          description: item.description,
          kind: 'heal',
          target: 'ally',
          rangeMin: 1,
          rangeMax: 1,
          healAmount: item.effect.amount,
          effectKey: item.effectKey
        });
        this.consumeBattleItemFromUnit(activeUnit, itemId, 1);
        break;
      case 'ct':
        await this.centerCameraOnActor(activeUnit, 120);
        const effect = this.createCombatEffectPlayback(item.effectKey, activeUnit, target);
        await Promise.all([this.animateSourceReaction(effect), this.playCombatEffectLeadIn(effect)]);
        target.ct += item.effect.amount;
        this.consumeBattleItemFromUnit(activeUnit, itemId, 1);
        this.positionActor(target);
        await Promise.all([this.playCombatEffectImpact(effect), this.animateTargetReaction(effect, target, false)]);
        await this.showFloatingCombatText(
          this.getUnitSpritePoint(target, 0.72) ?? new Phaser.Math.Vector2(this.getUnitWorldPoint(target).x, this.getUnitWorldPoint(target).y - 42),
          `+${item.effect.amount} CT`,
          UI_TEXT_DAMAGE,
          720
        );
        this.pushMessage(`${activeUnit.name} uses ${item.name} on ${target.name}, granting ${item.effect.amount} CT.`);
        break;
      default:
        break;
    }

    await this.finishWorldBattlePlayerCommand(activeUnit, `${activeUnit.name} can still move this turn.`);
  }

  private async finishWorldBattlePlayerCommand(activeUnit: BattleUnit, pendingMoveMessage: string): Promise<void> {
    if (activeUnit.team !== 'player' || !activeUnit.alive || !this.worldBattle) {
      await this.endWorldBattleTurn();
      return;
    }

    if (this.worldBattle.turnMoveUsed && this.worldBattle.turnActionUsed) {
      await this.endWorldBattleTurn();
      return;
    }

    this.busy = false;
    this.worldBattle.selectedAbilityId = null;
    this.worldBattle.selectedItemId = null;

    if (!this.worldBattle.turnMoveUsed) {
      this.moveNodes = this.getBattleMoveNodesForUnit(activeUnit);
    }

    this.phase = 'battle-player-menu';
    this.pushMessage(pendingMoveMessage);
    this.invalidateBattlePresentation();
  }

  private async animateActorDefeat(actorId: string): Promise<void> {
    const view = this.actorViews.get(actorId);

    if (!view) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.container,
        alpha: 0,
        y: view.container.y + 24,
        duration: 420,
        ease: 'Quad.easeIn',
        onComplete: () => {
          view.container.setVisible(false);
          resolve();
        }
      });
    });
  }

  private async runEnemyBattleTurn(actor: BattleUnit): Promise<void> {
    const battle = this.getWorldBattleRuntimeState();

    if (!battle) {
      return;
    }

    const plan = this.battleRuntimeController.chooseEnemyPlan(battle, actor, this.map, this.props);

    if (plan?.kind === 'attack') {
      if (plan.moveTile.x !== actor.x || plan.moveTile.y !== actor.y) {
        const path = buildPath(this.getBattleMoveNodesForUnit(actor), plan.moveTile);
        if (path.length > 1) {
          await this.moveBattleUnit(actor, path);
        }
      }

      await this.performWorldBattleAttack(actor, plan.target);
      return;
    }

    if (plan?.kind === 'approach' && (plan.moveTile.x !== actor.x || plan.moveTile.y !== actor.y)) {
      const path = buildPath(this.getBattleMoveNodesForUnit(actor), plan.moveTile);
      if (path.length > 1) {
        await this.moveBattleUnit(actor, path);
      }
    }

    this.pushMessage(`${actor.name} repositions and watches for a weakness.`);
    await this.endWorldBattleTurn();
  }

  private canContinueAutoBattle(actor: BattleUnit, runToken: number): boolean {
    return Boolean(
      this.worldBattle?.autoBattleEnabled &&
      this.activeAutoBattleRunToken === runToken &&
      this.autoBattleRunToken === runToken &&
      actor.alive &&
      actor.team === 'player' &&
      this.getActiveBattleUnit()?.id === actor.id &&
      this.phase === 'battle-player-menu'
    );
  }

  private tryStartAutoBattle(actor: BattleUnit | null): void {
    if (
      !actor ||
      actor.team !== 'player' ||
      !this.worldBattle?.autoBattleEnabled ||
      this.phase !== 'battle-player-menu' ||
      this.busy ||
      this.getActiveBattleUnit()?.id !== actor.id ||
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

      if (!wasCanceled || !this.worldBattle?.autoBattleEnabled) {
        return;
      }

      const activeUnit = this.getActiveBattleUnit();
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

      if (!this.worldBattle?.turnActionUsed) {
        const plannedItem = chooseAutoBattleItem(actor, this.getBattleUnitInventory(actor));

        if (plannedItem) {
          await this.useBattleItem(plannedItem, actor);
          continue;
        }

        const actionPlan = chooseAutoBattleActionPlan(
          actor,
          this.worldBattle?.units ?? [],
          this.map,
          this.getBattleBlockedPoints(),
          this.worldBattle?.turnMoveUsed ?? false
        );

        if (actionPlan) {
          if (!this.worldBattle?.turnMoveUsed && (actionPlan.moveTile.x !== actor.x || actionPlan.moveTile.y !== actor.y)) {
            const moveTile = getTile(this.map, actionPlan.moveTile.x, actionPlan.moveTile.y);
            if (moveTile) {
              await this.handleBattleMove(moveTile);
              if (!this.canContinueAutoBattle(actor, runToken)) {
                return;
              }
            }
          }

          await this.performWorldBattleAbility(actor, actionPlan.target, actionPlan.ability);
          continue;
        }
      }

      if (!this.worldBattle?.turnMoveUsed) {
        const moveTile = chooseAutoBattleMoveTile(
          actor,
          this.worldBattle?.units ?? [],
          this.map,
          this.getBattleBlockedPoints()
        );

        if (moveTile && (moveTile.x !== actor.x || moveTile.y !== actor.y)) {
          const tile = getTile(this.map, moveTile.x, moveTile.y);
          if (tile) {
            await this.handleBattleMove(tile);
            continue;
          }
        }
      }

      this.pushMessage(`${actor.name} waits and watches the ridge.`);
      await this.endWorldBattleTurn();
      return;
    }
  }

  private async toggleAutoBattle(): Promise<void> {
    if (!this.worldBattle) {
      return;
    }

    this.worldBattle.autoBattleEnabled = !this.worldBattle.autoBattleEnabled;
    if (!this.worldBattle.autoBattleEnabled) {
      this.autoBattleRunToken += 1;
    }

    audioDirector.playUiConfirm();
    this.pushMessage(`Auto-Battle ${this.worldBattle.autoBattleEnabled ? 'enabled' : 'disabled'}.`);
    this.invalidateHud();
    this.tryStartAutoBattle(this.getActiveBattleUnit());
  }

  private getPreferredBattleAttackTarget(attacker: BattleUnit): BattleUnit | null {
    return this.getTargetableBattleUnits(attacker)
      .sort((left, right) => {
        if (left.hp !== right.hp) {
          return left.hp - right.hp;
        }

        return manhattanDistance(attacker, left) - manhattanDistance(attacker, right);
      })[0] ?? null;
  }

  private getEnemyBattlePath(unit: BattleUnit): Point[] | null {
    const reachable = this.getBattleMoveNodesForUnit(unit);
    const opponents = this.getLivingBattleUnits(unit.team === 'player' ? 'enemy' : 'player');
    let bestTarget: Point | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const node of reachable.values()) {
      const distance = Math.min(...opponents.map((opponent) => manhattanDistance(node, opponent)));

      if (
        distance < bestDistance ||
        (distance === bestDistance && node.cost < bestCost)
      ) {
        bestDistance = distance;
        bestCost = node.cost;
        bestTarget = { x: node.x, y: node.y };
      }
    }

    if (!bestTarget || (bestTarget.x === unit.x && bestTarget.y === unit.y)) {
      return null;
    }

    return buildPath(reachable, bestTarget);
  }

  private async resolveWorldBattleIfComplete(): Promise<boolean> {
    if (!this.worldBattle) {
      return false;
    }

    const outcome = this.battleRuntimeController.getOutcome(this.worldBattle.units);

    if (outcome === 'Defeat') {
      await this.endWorldBattle('defeat');
      return true;
    }

    if (outcome === 'Victory') {
      await this.endWorldBattle('victory');
      return true;
    }

    return false;
  }

  private async endWorldBattle(result: 'victory' | 'defeat'): Promise<void> {
    const encounterId = this.worldBattle?.encounterId;

    if (!encounterId) {
      return;
    }

    this.phase = 'battle-complete';
    this.busy = false;
    this.moveNodes.clear();
    this.hoverTile = null;
    this.battleInspectionTarget = { kind: 'mission' };
    this.clearTurnStartCatchPhrase();

    if (result === 'victory') {
      markWorldEncounterCleared(encounterId);
      audioDirector.playVictory();
    } else {
      audioDirector.playDefeat();
    }

    this.showWorldBattleResultOverlay(result === 'victory' ? 'Victory' : 'Defeat');
    this.invalidateBattlePresentation();
  }

  private async finalizeWorldBattleReturn(result: 'Victory' | 'Defeat'): Promise<void> {
    await this.restoreExplorationFromWorldBattle(
      result === 'Victory'
        ? 'The skirmish breaks and the road opens again.'
        : 'The clash dissolves and both sides pull back to the road.'
    );
  }

  private showWorldBattleResultOverlay(result: 'Victory' | 'Defeat'): void {
    this.destroyWorldBattleResultOverlay();
    this.resultOverlayResult = result;
    this.resultOverlayShade = this.registerUiObject(
      this.add.rectangle(0, 0, this.scale.width, this.scale.height, UI_COLOR_OVERLAY, 0.62).setDepth(1000).setScrollFactor(0)
    );
    this.resultOverlayPanel = this.registerUiObject(this.add.graphics().setDepth(1001).setScrollFactor(0));
    this.resultOverlayArt = this.registerUiObject(
      this.add.image(0, 0, result === 'Victory' ? 'battle-result-victory' : 'battle-result-defeat').setDepth(1002).setScrollFactor(0)
    );
    this.resultOverlayArtMask = this.registerUiObject(
      this.add.graphics().setVisible(false).setDepth(1002).setScrollFactor(0)
    );
    this.resultOverlayArt.setMask(this.resultOverlayArtMask.createGeometryMask());
    this.resultOverlayEyebrow = this.registerUiObject(
      this.add.text(0, 0, '', UI_TEXT_LABEL).setDepth(1003).setScrollFactor(0)
    );
    this.resultOverlayTitle = this.registerUiObject(
      this.add.text(0, 0, result.toUpperCase(), UI_TEXT_DISPLAY_CENTER).setOrigin(0, 0.5).setDepth(1003).setScrollFactor(0)
    );
    this.resultOverlayBody = this.registerUiObject(
      this.add
        .text(
          0,
          0,
          result === 'Victory'
            ? 'The road ahead is yours again.\nReturn to the wilderness or fight the encounter again from this ridge.'
            : 'The ambush scatters your force back into the ash.\nRetry the clash immediately or fall back to the road.',
          UI_TEXT_BODY
        )
        .setOrigin(0, 0)
        .setDepth(1003)
        .setScrollFactor(0)
    );
    this.resultOverlayButtons = [
      {
        action: 'retry',
        labelText: this.registerUiObject(
          this.add.text(0, 0, '', UI_TEXT_ACTION).setOrigin(0.5, 0.5).setDepth(1003).setScrollFactor(0)
        ),
        bounds: new Phaser.Geom.Rectangle()
      },
      {
        action: 'return',
        labelText: this.registerUiObject(
          this.add.text(0, 0, '', UI_TEXT_ACTION).setOrigin(0.5, 0.5).setDepth(1003).setScrollFactor(0)
        ),
        bounds: new Phaser.Geom.Rectangle()
      }
    ];
    this.layoutWorldBattleResultOverlay();
  }

  private destroyWorldBattleResultOverlay(): void {
    this.resultOverlayShade?.destroy();
    this.resultOverlayPanel?.destroy();
    this.resultOverlayArt?.destroy();
    this.resultOverlayArtMask?.destroy();
    this.resultOverlayEyebrow?.destroy();
    this.resultOverlayTitle?.destroy();
    this.resultOverlayBody?.destroy();
    for (const button of this.resultOverlayButtons) {
      button.labelText.destroy();
    }
    this.resultOverlayShade = undefined;
    this.resultOverlayPanel = undefined;
    this.resultOverlayArt = undefined;
    this.resultOverlayArtMask = undefined;
    this.resultOverlayEyebrow = undefined;
    this.resultOverlayTitle = undefined;
    this.resultOverlayBody = undefined;
    this.resultOverlayButtons = [];
    this.resultOverlayResult = null;
    this.resultOverlayPanelBounds.setTo(0, 0, 0, 0);
  }

  private layoutWorldBattleResultOverlay(): void {
    if (
      !this.resultOverlayShade ||
      !this.resultOverlayPanel ||
      !this.resultOverlayArt ||
      !this.resultOverlayArtMask ||
      !this.resultOverlayEyebrow ||
      !this.resultOverlayTitle ||
      !this.resultOverlayBody ||
      this.resultOverlayButtons.length !== 2 ||
      !this.resultOverlayResult
    ) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const grid = createUiGrid(width, height, width >= height ? 12 : 4);
    const portraitLayout = height > width;
    const panelWidth = portraitLayout ? Math.min(grid.content.width, 430) : Math.min(grid.content.width, 920);
    const panelHeight = portraitLayout ? Math.min(grid.content.height, 610) : Math.min(grid.content.height, 430);
    const panelX = Math.round(grid.content.centerX - panelWidth / 2);
    const panelY = Math.round(grid.content.centerY - panelHeight / 2);
    const panelBounds = this.resultOverlayPanelBounds.setTo(panelX, panelY, Math.round(panelWidth), Math.round(panelHeight));
    const contentInsetX = 22;
    const contentInsetY = 18;
    const contentX = panelBounds.x + contentInsetX;
    const contentY = panelBounds.y + contentInsetY;
    const contentWidth = panelBounds.width - contentInsetX * 2;
    const buttonAreaY = portraitLayout ? panelBounds.bottom - 166 : panelBounds.bottom - 98;
    const artTop = contentY + 72;
    const artHeight = portraitLayout ? 170 : Math.max(148, buttonAreaY - artTop - 14);
    const artWidth = portraitLayout ? contentWidth : Math.round(Math.min(330, panelBounds.width * 0.38));
    const artBounds = new Phaser.Geom.Rectangle(contentX, artTop, Math.round(artWidth), Math.round(artHeight));
    const copyX = portraitLayout ? panelBounds.centerX : artBounds.right + 22;
    const copyWidth = portraitLayout ? contentWidth : Math.max(180, panelBounds.right - 22 - copyX);
    const copyTop = portraitLayout ? artBounds.bottom + 18 : artBounds.y + 8;
    const bodyY = copyTop + 78;
    const buttonHeight = portraitLayout ? 60 : 74;
    const buttonGap = 14;
    const buttonWidth = portraitLayout ? contentWidth : Math.floor((copyWidth - buttonGap) / 2);
    const buttonX = portraitLayout ? contentX : copyX;
    const accentColor = this.resultOverlayResult === 'Victory' ? UI_COLOR_ACCENT_WARM : UI_COLOR_ACCENT_DANGER;

    this.resultOverlayShade.setPosition(width / 2, height / 2).setSize(width, height);
    this.resultOverlayPanel.clear();
    BattleUiChrome.drawPanelShell(this.resultOverlayPanel, panelBounds, 1, 38, 24, accentColor);
    BattleUiChrome.drawInsetBox(this.resultOverlayPanel, artBounds, {
      fillColor: UI_COLOR_PANEL_SURFACE_ALT,
      fillAlpha: 0.94,
      strokeColor: UI_COLOR_PANEL_BORDER,
      strokeAlpha: 0.28,
      radius: 18
    });

    this.resultOverlayArtMask.clear();
    this.resultOverlayArtMask.fillStyle(0xffffff, 1);
    this.resultOverlayArtMask.fillRoundedRect(artBounds.x + 2, artBounds.y + 2, artBounds.width - 4, artBounds.height - 4, 16);
    coverImageBounds(this.resultOverlayArt, artBounds, 1.06);
    this.resultOverlayArt
      .setVisible(true)
      .setAlpha(this.resultOverlayResult === 'Victory' ? 0.74 : 0.54)
      .setTint(this.resultOverlayResult === 'Victory' ? 0xf0d8a2 : 0xb98696);

    for (const [index, button] of this.resultOverlayButtons.entries()) {
      const descriptor = this.getWorldBattleResultButtonDescriptors()[index];
      const row = portraitLayout ? index : 0;
      const column = portraitLayout ? 0 : index;
      button.bounds.setTo(
        buttonX + column * (buttonWidth + buttonGap),
        buttonAreaY + row * (buttonHeight + 12),
        buttonWidth,
        buttonHeight
      );

      BattleUiChrome.drawPill(this.resultOverlayPanel, button.bounds, {
        fillColor: descriptor.fillColor,
        strokeColor: descriptor.strokeColor,
        fillAlpha: descriptor.fillAlpha,
        strokeAlpha: 0.56,
        radius: 16
      });

      button.labelText
        .setText(descriptor.label)
        .setPosition(button.bounds.centerX, button.bounds.centerY)
        .setOrigin(0.5, 0.5)
        .setColor(UI_COLOR_TEXT);
    }

    this.resultOverlayEyebrow
      .setText(this.resultOverlayResult === 'Victory' ? 'MISSION SECURED' : 'MISSION BROKEN')
      .setPosition(copyX, copyTop)
      .setOrigin(portraitLayout ? 0.5 : 0, 0.5)
      .setColor(this.resultOverlayResult === 'Victory' ? '#f0d8a2' : '#e7a4ab');
    this.resultOverlayTitle
      .setPosition(copyX, copyTop + 28)
      .setOrigin(portraitLayout ? 0.5 : 0, 0.5)
      .setStyle({
        align: portraitLayout ? 'center' : 'left',
        color: this.resultOverlayResult === 'Victory' ? '#f7edd9' : '#f3d9de'
      });
    this.resultOverlayBody
      .setPosition(copyX, bodyY)
      .setOrigin(portraitLayout ? 0.5 : 0, 0)
      .setStyle({ align: portraitLayout ? 'center' : 'left' })
      .setWordWrapWidth(Math.min(copyWidth, portraitLayout ? copyWidth : 360), true);
  }

  private getWorldBattleResultButtonDescriptors(): Array<{
    label: string;
    fillColor: number;
    strokeColor: number;
    fillAlpha: number;
  }> {
    if (this.resultOverlayResult === 'Victory') {
      return [
        {
          label: 'RETRY BATTLE',
          fillColor: UI_COLOR_ACCENT_NEUTRAL,
          strokeColor: UI_COLOR_PANEL_BORDER,
          fillAlpha: 0.82
        },
        {
          label: 'RETURN TO ROAD',
          fillColor: UI_COLOR_SUCCESS,
          strokeColor: UI_COLOR_PANEL_BORDER,
          fillAlpha: 0.3
        }
      ];
    }

    return [
      {
        label: 'RETRY BATTLE',
        fillColor: UI_COLOR_ACCENT_DANGER,
        strokeColor: UI_COLOR_DANGER,
        fillAlpha: 0.48
      },
      {
        label: 'RETURN TO ROAD',
        fillColor: UI_COLOR_ACCENT_COOL,
        strokeColor: UI_COLOR_PANEL_BORDER,
        fillAlpha: 0.82
      }
    ];
  }

  private handleWorldBattleResultOverlayPointer(x: number, y: number): void {
    for (const button of this.resultOverlayButtons) {
      if (!button.bounds.contains(x, y)) {
        continue;
      }

      audioDirector.playUiConfirm();
      void this.executeWorldBattleResultAction(button.action);
      return;
    }
  }

  private async executeWorldBattleResultAction(action: WorldBattleResultAction): Promise<void> {
    if (!this.worldBattle || !this.resultOverlayResult) {
      return;
    }

    if (action === 'retry') {
      const retryData = this.worldBattle.runtimeBattle;
      const encounterId = this.worldBattle.encounterId;
      this.destroyWorldBattleResultOverlay();
      this.worldBattle = null;
      this.restoreWorldBattleSourcePreview(retryData);
      await this.beginWorldBattle(encounterId, retryData);
      return;
    }

    await this.finalizeWorldBattleReturn(this.resultOverlayResult);
  }

  private restoreWorldBattleSourcePreview(runtimeBattle: RuntimeBattleStartData): void {
    const sourceLevel = runtimeBattle.seamlessEntry?.sourceLevel ?? runtimeBattle.level;
    const sourceMap = createLevelMap(sourceLevel);
    const sourceGridWidth = Math.max(...sourceMap.map((tile) => tile.x), 0) + 1;
    const sourceGridHeight = Math.max(...sourceMap.map((tile) => tile.y), 0) + 1;

    this.destroyAreaObjects();
    this.map = sourceMap;
    this.props = sourceLevel.props.map((prop) => ({ ...prop }));
    this.encounters = [];
    this.transitions = [];
    this.npcs = [];
    this.gridWidth = sourceGridWidth;
    this.gridHeight = sourceGridHeight;
    this.areaName = sourceLevel.name;
    this.areaBackdropAssetId = sourceLevel.backdropAssetId ?? this.areaBackdropAssetId;
    this.battleIntroPhase = 'hud';
    this.mapIntroAlpha = 0;
    this.mapPlaqueAlpha = 1;
    this.mapPlaqueOffsetX = 0;
    this.origin.set(runtimeBattle.camera.origin.x, runtimeBattle.camera.origin.y);
    this.boardRotationStep = runtimeBattle.camera.boardRotationStep;
    this.drawBoard();
    this.createTerrainTiles();
    this.createProps();
    this.setupCameras();
    this.configureCamera(false);
    this.setCameraScroll(runtimeBattle.camera.scrollX, runtimeBattle.camera.scrollY);
    this.applyBattlePresentationShell();
  }

  private async centerCameraOnActor(actor: BattleUnit, duration: number): Promise<void> {
    const point = this.getBattleActorCameraFocusPoint(actor);
    await this.centerCameraOnPoint(point.x, point.y, duration);
  }

  private getBattleActorCameraFocusPoint(
    actor: BattleUnit,
    groundPoint: Phaser.Math.Vector2 = this.getUnitWorldPoint(actor)
  ): Phaser.Math.Vector2 {
    const view = this.actorViews.get(actor.id);
    const spriteOffsetX = view?.sprite.x ?? 0;
    const spriteOffsetY = view?.sprite.y ?? 0;

    return new Phaser.Math.Vector2(
      groundPoint.x + spriteOffsetX,
      groundPoint.y + spriteOffsetY - actor.spriteDisplayHeight * UNIT_CAMERA_FOCUS_HEIGHT_FACTOR
    );
  }

  private refreshNpcInteraction(): void {
    if (this.isWorldBattleActive()) {
      return;
    }

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
    if (this.isWorldBattleActive()) {
      return null;
    }

    const adjacentNpcs = this.npcs.filter((npc) => this.isFriendlyNpc(npc) && manhattanDistance(this.player, npc) === 1);

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

  private getHostileNpcAt(x: number, y: number): WorldNpcRuntime | null {
    return this.npcs.find((npc) => this.isHostileNpc(npc) && npc.x === x && npc.y === y) ?? null;
  }

  private getEncounterAt(x: number, y: number): LocalWorldEncounter | null {
    return this.encounters.find((encounter) => encounter.x === x && encounter.y === y) ?? null;
  }

  private getTriggerableEncounterAt(x: number, y: number): LocalWorldEncounter | null {
    const encounter = this.getEncounterAt(x, y);
    return encounter && this.isEncounterTriggerable(encounter) ? encounter : null;
  }

  private getTransitionAt(x: number, y: number): LocalWorldTransition | null {
    return this.transitions.find((transition) => transition.x === x && transition.y === y) ?? null;
  }

  private buildRuntimeBattleStartData(
    encounter: LocalWorldEncounter,
    previousPlayerPosition: Point | null,
    initiatorNpc?: WorldNpcRuntime
  ): RuntimeBattleStartData {
    const encounterTemplateLevel = getLevel(encounter.levelId);
    const sourceLevel = this.createRuntimeEncounterSourceLevel(encounter, encounterTemplateLevel);
    const playerInitiator = { x: this.player.x, y: this.player.y };
    const enemyInitiator = initiatorNpc ? { x: initiatorNpc.x, y: initiatorNpc.y } : { x: encounter.x, y: encounter.y };
    const midpoint = this.getEncounterMidpoint(playerInitiator, enemyInitiator);
    const arenaBounds = this.resolveEncounterArenaBounds(midpoint);
    const level = this.createRuntimeEncounterBattleLevel(encounter, encounterTemplateLevel, sourceLevel, arenaBounds);
    const formation = this.createEncounterArenaFormation(
      encounter,
      encounterTemplateLevel,
      arenaBounds,
      this.getEncounterApproachDirection(playerInitiator, enemyInitiator, previousPlayerPosition, encounter),
      playerInitiator,
      enemyInitiator,
      initiatorNpc
    );

    return {
      level,
      units: formation.units,
      camera: {
        scrollX: this.worldCamera.scrollX,
        scrollY: this.worldCamera.scrollY,
        zoom: this.worldCamera.zoom,
        boardRotationStep: this.boardRotationStep,
        origin: {
          x: this.origin.x,
          y: this.origin.y
        }
      },
      seamlessEntry: {
        sourceLevel,
        arenaBounds,
        introEntries: formation.introEntries,
        preservedLightSources: this.createRuntimeEncounterPreservedLightSources(sourceLevel, arenaBounds)
      }
    };
  }

  private createRuntimeEncounterSourceLevel(
    encounter: LocalWorldEncounter,
    encounterTemplateLevel: LevelDefinition
  ): LevelDefinition {
    const heights = Array.from({ length: this.gridHeight }, (_unused, y) =>
      Array.from({ length: this.gridWidth }, (_innerUnused, x) => getTile(this.map, x, y)?.height ?? 0)
    );
    const terrain = Array.from({ length: this.gridHeight }, (_unused, y) =>
      Array.from({ length: this.gridWidth }, (_innerUnused, x) => getTile(this.map, x, y)?.terrain ?? 'grass')
    );

    return {
      id: `world-encounter-source:${encounter.id}`,
      name: encounter.label ?? encounterTemplateLevel.name,
      objective: encounterTemplateLevel.shortObjective ?? encounterTemplateLevel.objective,
      shortObjective: encounterTemplateLevel.shortObjective ?? encounterTemplateLevel.objective,
      titlePrefix: 'Ambush',
      region: this.areaName,
      encounterType: 'World Encounter',
      backdropAssetId: encounterTemplateLevel.backdropAssetId,
      titleFlavor: encounterTemplateLevel.titleFlavor ?? 'Steel rings out across the road as both sides rush to form a line.',
      heights,
      terrain,
      placements: [],
      chests: [],
      props: this.props.map(({ id, x, y, assetId }) => ({ id, x, y, assetId }))
    };
  }

  private createRuntimeEncounterBattleLevel(
    encounter: LocalWorldEncounter,
    encounterTemplateLevel: LevelDefinition,
    sourceLevel: LevelDefinition,
    arenaBounds: RuntimeBattleArenaBounds
  ): LevelDefinition {
    return {
      id: `world-encounter:${encounter.id}`,
      name: sourceLevel.name,
      objective: sourceLevel.objective,
      shortObjective: sourceLevel.shortObjective,
      titlePrefix: sourceLevel.titlePrefix,
      region: sourceLevel.region,
      encounterType: sourceLevel.encounterType,
      backdropAssetId: encounterTemplateLevel.backdropAssetId,
      titleFlavor: sourceLevel.titleFlavor,
      heights: Array.from({ length: arenaBounds.height }, (_unused, y) =>
        Array.from({ length: arenaBounds.width }, (_innerUnused, x) => sourceLevel.heights[arenaBounds.y + y]?.[arenaBounds.x + x] ?? 0)
      ),
      terrain: Array.from({ length: arenaBounds.height }, (_unused, y) =>
        Array.from(
          { length: arenaBounds.width },
          (_innerUnused, x) => sourceLevel.terrain[arenaBounds.y + y]?.[arenaBounds.x + x] ?? 'grass'
        )
      ),
      placements: [],
      chests: [],
      props: sourceLevel.props
        .filter(
          (prop) =>
            prop.x >= arenaBounds.x &&
            prop.x < arenaBounds.x + arenaBounds.width &&
            prop.y >= arenaBounds.y &&
            prop.y < arenaBounds.y + arenaBounds.height
        )
        .map((prop) => ({
          ...prop,
          x: prop.x - arenaBounds.x,
          y: prop.y - arenaBounds.y
        }))
    };
  }

  private createRuntimeEncounterPreservedLightSources(
    sourceLevel: LevelDefinition,
    arenaBounds: RuntimeBattleArenaBounds
  ): RuntimeBattlePreservedLightSourceState[] {
    return this.worldLightingController.createPreservedLightSources(sourceLevel, arenaBounds);
  }

  private getEncounterMidpoint(playerInitiator: Point, enemyInitiator: Point): Point {
    return {
      x: Math.round((playerInitiator.x + enemyInitiator.x) / 2),
      y: Math.round((playerInitiator.y + enemyInitiator.y) / 2)
    };
  }

  private resolveEncounterArenaBounds(midpoint: Point): RuntimeBattleArenaBounds {
    const halfBefore = Math.floor((WORLD_ENCOUNTER_ARENA_SIZE - 1) / 2);
    const halfAfter = WORLD_ENCOUNTER_ARENA_SIZE - halfBefore - 1;
    const left = Math.max(0, midpoint.x - halfBefore);
    const top = Math.max(0, midpoint.y - halfBefore);
    const right = Math.min(this.gridWidth - 1, midpoint.x + halfAfter);
    const bottom = Math.min(this.gridHeight - 1, midpoint.y + halfAfter);

    return {
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1
    };
  }

  private createEncounterArenaFormation(
    encounter: LocalWorldEncounter,
    encounterTemplateLevel: LevelDefinition,
    arenaBounds: RuntimeBattleArenaBounds,
    approachDirection: Point,
    playerInitiator: Point,
    enemyInitiator: Point,
    initiatorNpc?: WorldNpcRuntime
  ): {
    units: BattleUnit[];
    introEntries: RuntimeBattleIntroEntryState[];
  } {
    const playerBlueprintIds = [
      this.player.blueprintId,
      ...DEFAULT_WORLD_ENCOUNTER_COMPANION_BLUEPRINT_IDS.filter((blueprintId) => blueprintId !== this.player.blueprintId)
    ].slice(0, 3);
    const sourceEnemyBlueprintIds = encounterTemplateLevel.placements
      .filter((placement) => placement.team === 'enemy')
      .map((placement) => placement.blueprintId);
    const enemyBlueprintIds = [initiatorNpc?.blueprintId, ...sourceEnemyBlueprintIds]
      .filter((blueprintId): blueprintId is string => Boolean(blueprintId))
      .slice(0, 3);
    const occupiedSourceTiles = new Set<string>();
    const playerSideSlots = this.getEncounterArenaSideSlotOrder(arenaBounds, approachDirection, 'player');
    const enemySideSlots = this.getEncounterArenaSideSlotOrder(arenaBounds, approachDirection, 'enemy');
    const units: BattleUnit[] = [];
    const introEntries: RuntimeBattleIntroEntryState[] = [];
    const playerAnchorStart = { ...playerInitiator };
    const enemyAnchorStart = { ...enemyInitiator };
    let playerAnchorUnitId: string | null = null;
    let enemyAnchorUnitId: string | null = null;

    for (const [index, blueprintId] of playerBlueprintIds.entries()) {
      const finalTile = this.getNextEncounterArenaSlot(playerSideSlots, arenaBounds, occupiedSourceTiles);

      if (!finalTile) {
        continue;
      }

      const unitId = index === 0 ? `world-encounter:${encounter.id}:leader` : `world-encounter:${encounter.id}:ally:${index}`;
      units.push(createBattleUnitFromBlueprint(unitId, blueprintId, 'player', finalTile));
      const target = this.getEncounterSourcePointFromArenaLocalPoint(arenaBounds, finalTile);
      introEntries.push({
        unitId,
        start: playerAnchorStart,
        target,
        kind: index === 0 ? 'visible' : 'emerge',
        ...(index === 0 || !playerAnchorUnitId ? {} : { anchorUnitId: playerAnchorUnitId })
      });

      if (index === 0) {
        playerAnchorUnitId = unitId;
      }
    }

    for (const [index, blueprintId] of enemyBlueprintIds.entries()) {
      const finalTile = this.getNextEncounterArenaSlot(enemySideSlots, arenaBounds, occupiedSourceTiles);

      if (!finalTile) {
        continue;
      }

      const unitId = `world-encounter:${encounter.id}:enemy:${index}`;
      units.push(
        createBattleUnitFromBlueprint(unitId, blueprintId, 'enemy', finalTile, index === 0 && initiatorNpc
          ? {
              name: initiatorNpc.name,
              className: initiatorNpc.className
            }
          : undefined)
      );
      const target = this.getEncounterSourcePointFromArenaLocalPoint(arenaBounds, finalTile);
      introEntries.push({
        unitId,
        start: enemyAnchorStart,
        target,
        kind: index === 0 ? 'visible' : 'emerge',
        ...(index === 0 || !enemyAnchorUnitId ? {} : { anchorUnitId: enemyAnchorUnitId })
      });

      if (index === 0) {
        enemyAnchorUnitId = unitId;
      }
    }

    return {
      units,
      introEntries
    };
  }

  private getEncounterApproachDirection(
    playerInitiator: Point,
    enemyInitiator: Point,
    previousPlayerPosition: Point | null,
    encounter: LocalWorldEncounter
  ): Point {
    const deltaX = enemyInitiator.x - playerInitiator.x;
    const deltaY = enemyInitiator.y - playerInitiator.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY) && deltaX !== 0) {
      return { x: Phaser.Math.Clamp(deltaX, -1, 1), y: 0 };
    }

    if (deltaY !== 0) {
      return { x: 0, y: Phaser.Math.Clamp(deltaY, -1, 1) };
    }

    if (!previousPlayerPosition) {
      return { x: 1, y: 0 };
    }

    const fallbackDeltaX = encounter.x - previousPlayerPosition.x;
    const fallbackDeltaY = encounter.y - previousPlayerPosition.y;

    if (Math.abs(fallbackDeltaX) >= Math.abs(fallbackDeltaY) && fallbackDeltaX !== 0) {
      return { x: Phaser.Math.Clamp(fallbackDeltaX, -1, 1), y: 0 };
    }

    if (fallbackDeltaY !== 0) {
      return { x: 0, y: Phaser.Math.Clamp(fallbackDeltaY, -1, 1) };
    }

    return { x: 1, y: 0 };
  }

  private getEncounterArenaSideSlotOrder(
    arenaBounds: RuntimeBattleArenaBounds,
    approachDirection: Point,
    team: BattleUnit['team']
  ): Point[] {
    const horizontal = Math.abs(approachDirection.x) >= Math.abs(approachDirection.y);
    const primarySize = horizontal ? arenaBounds.width : arenaBounds.height;
    const secondarySize = horizontal ? arenaBounds.height : arenaBounds.width;
    const bandDepth = Math.max(1, Math.min(3, Math.floor(primarySize / 4)));
    const centerIndex = Math.floor((secondarySize - 1) / 2);
    const offsets = this.getEncounterCenterOffsets(secondarySize, centerIndex);
    const playerUsesLowPrimary = horizontal ? approachDirection.x > 0 : approachDirection.y > 0;
    const useLowPrimary = team === 'player' ? playerUsesLowPrimary : !playerUsesLowPrimary;
    const primaryOrder = useLowPrimary
      ? [
          ...Array.from({ length: bandDepth }, (_unused, index) => bandDepth - 1 - index),
          ...Array.from({ length: primarySize - bandDepth }, (_unused, index) => bandDepth + index)
        ]
      : [
          ...Array.from({ length: bandDepth }, (_unused, index) => primarySize - bandDepth + index),
          ...Array.from({ length: primarySize - bandDepth }, (_unused, index) => primarySize - bandDepth - 1 - index)
        ];
    const orderedSlots: Point[] = [];

    for (const primary of primaryOrder) {
      for (const offset of offsets) {
        const secondary = centerIndex + offset;

        if (secondary < 0 || secondary >= secondarySize) {
          continue;
        }

        orderedSlots.push(
          horizontal
            ? { x: primary, y: secondary }
            : { x: secondary, y: primary }
        );
      }
    }

    return orderedSlots;
  }

  private getEncounterCenterOffsets(size: number, centerIndex: number): number[] {
    const offsets = [0];
    const wideOffsets: number[] = [];
    const nearOffsets: number[] = [];

    for (let distance = 1; distance < size; distance += 1) {
      const targetOffsets = distance % 2 === 0 ? wideOffsets : nearOffsets;

      if (centerIndex - distance >= 0) {
        targetOffsets.push(-distance);
      }

      if (centerIndex + distance < size) {
        targetOffsets.push(distance);
      }
    }

    return [...offsets, ...wideOffsets, ...nearOffsets];
  }

  private getNextEncounterArenaSlot(
    orderedSlots: readonly Point[],
    arenaBounds: RuntimeBattleArenaBounds,
    occupiedSourceTiles: Set<string>
  ): Point | null {
    for (const candidate of orderedSlots) {
      if (this.isEncounterArenaLocalTileAvailable(candidate, arenaBounds, occupiedSourceTiles)) {
        occupiedSourceTiles.add(pointKey(this.getEncounterSourcePointFromArenaLocalPoint(arenaBounds, candidate)));
        return candidate;
      }
    }

    return null;
  }

  private getEncounterSourcePointFromArenaLocalPoint(arenaBounds: RuntimeBattleArenaBounds, point: Point): Point {
    return {
      x: arenaBounds.x + point.x,
      y: arenaBounds.y + point.y
    };
  }

  private isEncounterArenaLocalTileAvailable(
    localPoint: Point,
    arenaBounds: RuntimeBattleArenaBounds,
    occupiedSourceTiles: Set<string>
  ): boolean {
    if (
      localPoint.x < 0 ||
      localPoint.x >= arenaBounds.width ||
      localPoint.y < 0 ||
      localPoint.y >= arenaBounds.height
    ) {
      return false;
    }

    const sourcePoint = this.getEncounterSourcePointFromArenaLocalPoint(arenaBounds, localPoint);

    if (!getTile(this.map, sourcePoint.x, sourcePoint.y) || occupiedSourceTiles.has(pointKey(sourcePoint))) {
      return false;
    }

    return !this.props.some(
      (prop) => prop.x === sourcePoint.x && prop.y === sourcePoint.y && PROP_RENDER_CONFIG[prop.assetId].blocksMovement
    );
  }

  private isEncounterTriggerable(encounter: LocalWorldEncounter): boolean {
    return !isWorldEncounterCleared(encounter.id) && this.sessionState.suppressedEncounterId !== encounter.id;
  }

  private isFriendlyNpc(npc: WorldNpcRuntime): boolean {
    return npc.disposition === 'friendly';
  }

  private isHostileNpc(npc: WorldNpcRuntime): boolean {
    return npc.disposition === 'hostile';
  }

  private isHostileNpcEncounterTriggerable(npc: WorldNpcRuntime): boolean {
    return (
      this.isHostileNpc(npc) &&
      Boolean(npc.encounterId) &&
      Boolean(npc.encounterLevelId) &&
      !isWorldEncounterCleared(npc.encounterId as string) &&
      this.sessionState.suppressedEncounterId !== npc.encounterId
    );
  }

  private getAdjacentTriggerableHostileNpc(origin: Point = this.player): WorldNpcRuntime | null {
    return this.npcs.find((npc) => this.isHostileNpcEncounterTriggerable(npc) && manhattanDistance(origin, npc) === 1) ?? null;
  }

  private getAdjacentTriggerableHostileNpcAt(origin: Point): WorldNpcRuntime | null {
    return this.getAdjacentTriggerableHostileNpc(origin);
  }

  private createEncounterFromHostileNpc(npc: WorldNpcRuntime): LocalWorldEncounter {
    return {
      id: npc.encounterId as string,
      levelId: npc.encounterLevelId as string,
      label: npc.encounterLabel ?? npc.name,
      x: npc.x,
      y: npc.y,
      clearOnVictory: npc.clearOnVictory ?? true,
      absolutePosition:
        this.sessionState.areaKind === 'outdoor' ? this.localToAbsoluteOutdoorPoint({ x: npc.x, y: npc.y }) : undefined
    };
  }

  private maybeAdvanceNpcPatrols(time: number): void {
    if (this.sessionState.areaKind !== 'outdoor' || this.phase === 'transition') {
      return;
    }

    this.syncNpcMovementState();

    for (const [index, npc] of this.npcs.entries()) {
      const isChasing = this.shouldNpcChasePlayer(npc);
      const tickInterval = isChasing ? WORLD_NPC_CHASE_INTERVAL_MS : WORLD_NPC_PATROL_INTERVAL_MS;
      const acceleratedTickAt = time + tickInterval;
      const scheduledMoveAt = this.getNpcNextMoveAt(npc, index, time);

      if (isChasing && scheduledMoveAt > acceleratedTickAt) {
        this.npcNextMoveAt.set(npc.id, acceleratedTickAt);
      }

      if (time < (this.npcNextMoveAt.get(npc.id) ?? acceleratedTickAt)) {
        continue;
      }

      this.npcNextMoveAt.set(npc.id, acceleratedTickAt);

      if (npc.aggressive && this.isHostileNpcEncounterTriggerable(npc) && manhattanDistance(this.player, npc) === 1) {
        void this.startHostileNpcEncounter(npc, { x: this.player.x, y: this.player.y });
        return;
      }

      const chaseTarget = this.getNextNpcChaseTarget(npc);

      if (chaseTarget) {
        void this.moveHostileNpcOneStep(npc, chaseTarget, undefined, 'chase');
        continue;
      }

      const patrolTarget = this.getNextNpcPatrolTarget(npc);

      if (!patrolTarget) {
        continue;
      }

      void this.moveHostileNpcOneStep(npc, patrolTarget.target, patrolTarget.nextIndex, 'patrol');
    }
  }

  private syncNpcMovementState(): void {
    const npcIds = new Set(this.npcs.map((npc) => npc.id));

    for (const npcId of this.npcNextMoveAt.keys()) {
      if (!npcIds.has(npcId)) {
        this.npcNextMoveAt.delete(npcId);
      }
    }

    for (const npcId of this.npcPatrolIndices.keys()) {
      if (!npcIds.has(npcId)) {
        this.npcPatrolIndices.delete(npcId);
      }
    }

    for (const npcId of this.movingNpcIds) {
      if (!npcIds.has(npcId)) {
        this.movingNpcIds.delete(npcId);
      }
    }
  }

  private getNpcNextMoveAt(npc: WorldNpcRuntime, index: number, time: number): number {
    const scheduledMoveAt = this.npcNextMoveAt.get(npc.id);

    if (typeof scheduledMoveAt === 'number') {
      return scheduledMoveAt;
    }

    const staggerSlots = Math.max(1, Math.floor(WORLD_NPC_PATROL_INTERVAL_MS / NPC_INITIAL_MOVE_STAGGER_MS));
    const stagger = (index % (staggerSlots + 1)) * NPC_INITIAL_MOVE_STAGGER_MS;
    const nextMoveAt = time + stagger;
    this.npcNextMoveAt.set(npc.id, nextMoveAt);
    return nextMoveAt;
  }

  private shouldNpcChasePlayer(npc: WorldNpcRuntime): boolean {
    return (
      npc.aggressive &&
      this.isHostileNpcEncounterTriggerable(npc) &&
      npc.aggressionRadius > 0 &&
      manhattanDistance(this.player, npc) <= npc.aggressionRadius &&
      this.isNpcWithinChaseLeash(npc)
    );
  }

  private getNextNpcPatrolTarget(npc: WorldNpcRuntime): { target: Point; nextIndex: number } | null {
    if (npc.patrolPath.length === 0 || this.movingNpcIds.has(npc.id)) {
      return null;
    }

    let patrolIndex = this.npcPatrolIndices.get(npc.id) ?? 0;

    if (patrolIndex >= npc.patrolPath.length) {
      patrolIndex = 0;
    }

    let target = npc.patrolPath[patrolIndex];

    if (!target) {
      return null;
    }

    const isOnPatrolWaypoint = target.x === npc.x && target.y === npc.y;

    if (isOnPatrolWaypoint) {
      patrolIndex = (patrolIndex + 1) % npc.patrolPath.length;
      target = npc.patrolPath[patrolIndex];

      if (!target || (target.x === npc.x && target.y === npc.y)) {
        return null;
      }
    }

    if (manhattanDistance(npc, target) !== 1) {
      const nearestPatrolWaypoint = this.getNearestNpcPatrolWaypoint(npc);

      if (!nearestPatrolWaypoint) {
        return null;
      }

      const returnPath = this.getPathForNpcToTarget(npc, nearestPatrolWaypoint.point, true);

      if (!returnPath || returnPath.length < 2) {
        return null;
      }

      return {
        target: returnPath[1] ?? nearestPatrolWaypoint.point,
        nextIndex: nearestPatrolWaypoint.index
      };
    }

    return {
      target: { x: target.x, y: target.y },
      nextIndex: (patrolIndex + 1) % npc.patrolPath.length
    };
  }

  private getNearestNpcPatrolWaypoint(npc: WorldNpcRuntime): { index: number; point: Point; distance: number } | null {
    if (npc.patrolPath.length === 0) {
      return null;
    }

    return npc.patrolPath
      .map((point, index) => ({
        index,
        point,
        distance: manhattanDistance(npc, point)
      }))
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
  }

  private isNpcWithinChaseLeash(npc: WorldNpcRuntime): boolean {
    if (npc.chaseLeashRadius <= 0 || npc.patrolPath.length === 0) {
      return true;
    }

    const nearestPatrolWaypoint = this.getNearestNpcPatrolWaypoint(npc);
    return (nearestPatrolWaypoint?.distance ?? Number.POSITIVE_INFINITY) <= npc.chaseLeashRadius;
  }

  private getNextNpcChaseTarget(npc: WorldNpcRuntime): Point | null {
    if (
      !npc.aggressive ||
      !this.isHostileNpcEncounterTriggerable(npc) ||
      npc.aggressionRadius <= 0 ||
      manhattanDistance(this.player, npc) > npc.aggressionRadius ||
      !this.isNpcWithinChaseLeash(npc)
    ) {
      return null;
    }

    const path = this.getPathToPlayerAdjacencyForNpc(npc);

    if (!path || path.length < 2) {
      return null;
    }

    return path[1] ?? null;
  }

  private getPathToPlayerAdjacencyForNpc(npc: WorldNpcRuntime): Point[] | null {
    const adjacentTiles = [
      getTile(this.map, this.player.x + 1, this.player.y),
      getTile(this.map, this.player.x - 1, this.player.y),
      getTile(this.map, this.player.x, this.player.y + 1),
      getTile(this.map, this.player.x, this.player.y - 1)
    ].filter((tile): tile is TileData => Boolean(tile));
    const bestTile = adjacentTiles
      .map((tile) => ({
        tile,
        path: this.getPathForNpcToTarget(npc, tile, true)
      }))
      .filter((entry): entry is { tile: TileData; path: Point[] } => Boolean(entry.path && entry.path.length > 0))
      .sort((left, right) => left.path.length - right.path.length)[0];

    if (!bestTile) {
      return null;
    }

    return bestTile.path;
  }

  private getPathForNpcToTarget(npc: WorldNpcRuntime, target: Point, blockPlayerTile: boolean): Point[] | null {
    const moveNodes = getTraversalNodes(
      this.map,
      npc,
      Number.POSITIVE_INFINITY,
      [
        ...this.props.filter((prop) => PROP_RENDER_CONFIG[prop.assetId].blocksMovement).map((prop) => ({ x: prop.x, y: prop.y })),
        ...this.npcs.filter((otherNpc) => otherNpc.id !== npc.id).map((otherNpc) => ({ x: otherNpc.x, y: otherNpc.y })),
        ...(blockPlayerTile ? [{ x: this.player.x, y: this.player.y }] : [])
      ]
    );

    if (!moveNodes.has(pointKey(target))) {
      return null;
    }

    return buildPath(moveNodes, target);
  }

  private isNpcPatrolDestinationAvailable(npc: WorldNpcRuntime, target: Point): boolean {
    if (manhattanDistance(npc, target) !== 1 || !getTile(this.map, target.x, target.y)) {
      return false;
    }

    if (this.player.x === target.x && this.player.y === target.y) {
      return false;
    }

    if (this.props.some((prop) => prop.x === target.x && prop.y === target.y && PROP_RENDER_CONFIG[prop.assetId].blocksMovement)) {
      return false;
    }

    return !this.npcs.some((otherNpc) => otherNpc.id !== npc.id && otherNpc.x === target.x && otherNpc.y === target.y);
  }

  private async moveHostileNpcOneStep(
    npc: WorldNpcRuntime,
    step: Point,
    nextPatrolIndex?: number,
    movementProfile: 'patrol' | 'chase' = 'patrol'
  ): Promise<void> {
    const view = this.actorViews.get(npc.id);
    const tile = getTile(this.map, step.x, step.y);

    if (!view || !tile || this.movingNpcIds.has(npc.id) || !this.isNpcPatrolDestinationAvailable(npc, step)) {
      return;
    }

    this.movingNpcIds.add(npc.id);
    npc.x = step.x;
    npc.y = step.y;

    if (typeof nextPatrolIndex === 'number') {
      this.npcPatrolIndices.set(npc.id, nextPatrolIndex);
    }

    this.syncOutdoorNpcStatesWithRuntime();

    const destination = this.getUnitGroundPoint(tile);
    const destinationDepth = this.getUnitDepth(tile);
    this.updateActorFacingForMovement(npc, view, destination);
    audioDirector.playStep();

    try {
      await this.animateMovementStep(view, destination, destinationDepth, movementProfile);
      this.positionActor(npc);
    } finally {
      this.movingNpcIds.delete(npc.id);
    }

    if (this.isWorldBattleActive()) {
      return;
    }

    if (this.phase !== 'moving' && this.phase !== 'transition') {
      this.refreshNpcInteraction();
    }

    this.invalidatePresentation();

    if (
      !this.busy &&
      this.phase !== 'transition' &&
      npc.aggressive &&
      this.isHostileNpcEncounterTriggerable(npc) &&
      manhattanDistance(this.player, npc) === 1
    ) {
      void this.startHostileNpcEncounter(npc, { x: this.player.x, y: this.player.y });
    }
  }

  private reconcileEncounterSuppression(): void {
    const suppressedEncounterId = this.sessionState.suppressedEncounterId;

    if (!suppressedEncounterId) {
      return;
    }

    if (this.sessionState.areaKind !== 'outdoor' || isWorldEncounterCleared(suppressedEncounterId)) {
      this.sessionState = persistWorldSession({
        ...this.sessionState,
        suppressedEncounterId: null
      });
      return;
    }

    const suppressedEncounter = this.encounters.find((encounter) => encounter.id === suppressedEncounterId);

    if (suppressedEncounter && suppressedEncounter.x === this.player.x && suppressedEncounter.y === this.player.y) {
      return;
    }

    const suppressedHostileNpc = this.npcs.find(
      (npc) => this.isHostileNpc(npc) && npc.encounterId === suppressedEncounterId && manhattanDistance(this.player, npc) === 1
    );

    if (suppressedHostileNpc) {
      return;
    }

    this.sessionState = persistWorldSession({
      ...this.sessionState,
      suppressedEncounterId: null
    });
  }

  private beginPan(pointer: Phaser.Input.Pointer): void {
    this.isPanning = true;
    this.panPointerOrigin.set(pointer.x, pointer.y);
    this.panCameraOrigin.set(this.worldCamera.scrollX, this.worldCamera.scrollY);
    this.hoverTile = null;
    this.invalidateHighlights();
    if (!this.isWorldBattleActive()) {
      this.invalidateHud();
    }
  }

  private rotateBoard(stepDelta: number): void {
    if (this.busy || this.phase === 'transition') {
      return;
    }

    const nextRotationStep = Phaser.Math.Wrap(this.boardRotationStep + stepDelta, 0, 4);
    const facingOverrides = this.captureActorFacingOverridesForRotation(nextRotationStep);
    const outdoorFocusPoint =
      this.sessionState.areaKind === 'outdoor' && !this.isWorldBattleActive()
        ? this.getOutdoorCameraCenterAbsolutePoint() ?? { ...this.sessionState.outdoorPosition }
        : null;
    this.boardRotationStep = nextRotationStep;

    if (this.sessionState.areaKind === 'outdoor' && !this.isWorldBattleActive()) {
      this.destroyAreaObjects();
      this.buildOutdoorArea(
        outdoorFocusPoint ? getChunkCoordinatesForWorldPosition(outdoorFocusPoint) : this.outdoorCenterChunk ?? undefined
      );
      this.origin = new Phaser.Math.Vector2(this.gridHeight * (TILE_WIDTH / 2) + 160, 176);
      this.boardGraphics.clear();
      this.rebuildOutdoorChunkRenderSets(true);
      this.syncOutdoorPropViews(true);
      this.createActors(facingOverrides);
      this.setupCameras();
      this.drawHighlights();
      this.configureCamera(false);
      if (outdoorFocusPoint) {
        this.centerCameraOnOutdoorPoint(outdoorFocusPoint);
      }
      this.refreshUi();
      return;
    }

    this.destroyAreaObjects();
    this.drawBoard();
    this.createTerrainTiles();
    this.createProps();
    this.createActors(facingOverrides);
    this.setupCameras();
    this.drawHighlights();
    this.configureCamera(!this.isWorldBattleActive());
    if (this.isWorldBattleActive()) {
      this.refreshUi();
    }
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
      this.introOverlayShade,
      this.mapPlaqueArt,
      this.mapPlaqueArtMask,
      this.mapIntroArt,
      this.mapIntroArtMask,
      this.uiGraphics,
      this.mapPlaqueTitleText,
      this.mapPlaqueMetaText,
      this.mapObjectiveText,
      this.mapIntroEyebrowText,
      this.mapIntroTitleText,
      this.mapIntroMetaText,
      this.mapIntroFlavorText,
      this.headerMenuTitleText,
      ...this.headerMenuOptionTexts,
      this.activeBadge,
      this.detailMetaText,
      this.detailTitleText,
      ...this.detailStatTexts,
      this.detailBodyText,
      this.portraitMask,
      this.portrait,
      ...(this.resultOverlayShade ? [this.resultOverlayShade] : []),
      ...(this.resultOverlayPanel ? [this.resultOverlayPanel] : []),
      ...(this.resultOverlayArt ? [this.resultOverlayArt] : []),
      ...(this.resultOverlayArtMask ? [this.resultOverlayArtMask] : []),
      ...(this.resultOverlayEyebrow ? [this.resultOverlayEyebrow] : []),
      ...(this.resultOverlayTitle ? [this.resultOverlayTitle] : []),
      ...(this.resultOverlayBody ? [this.resultOverlayBody] : []),
      ...this.resultOverlayButtons.map((button) => button.labelText),
      ...this.playerAvatarPanel.getDisplayObjects(),
      ...this.actionMenuStack.getDisplayObjects()
    ];
  }

  private getWorldCamera(): Phaser.Cameras.Scene2D.Camera {
    return this.worldCamera ?? this.cameras.main;
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

  private createBattleParticles(): void {
    this.battleParticles = this.registerWorldObject(
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
        .setDepth(950)
        .setVisible(false)
    );
  }

  private syncBackdropScreenScale(): void {
    const zoom = Math.max(0.001, this.worldCamera.zoom);
    const inverseZoom = 1 / zoom;

    this.backdropImage.setScale(inverseZoom);
    this.backdropShade.setScale(inverseZoom);
    this.introOverlayShade.setScale(inverseZoom);
    this.ambientOverlay.setScale(inverseZoom);
  }

  private applyBattlePresentationShell(): void {
    this.battleShellInvalidations += 1;
    const active = this.isWorldBattleActive();
    this.backdropImage.setTexture(this.getHudBackdropImageKey());

    const config = TIME_OF_DAY_CONFIG[this.battleTimeOfDay];
    this.backdropImage.setTint(config.backdropTint).setAlpha(active ? config.backdropAlpha : 0);
    this.backdropShade.setFillStyle(config.shadeColor, config.shadeAlpha).setAlpha(1);
    this.ambientOverlay.setFillStyle(config.ambientColor, config.ambientAlpha).setAlpha(1);
    this.battleParticles?.setVisible(active);
    this.applyBattleTimeOfDay();
  }

  private applyBattleTimeOfDay(): void {
    const config = TIME_OF_DAY_CONFIG[this.battleTimeOfDay];

    for (const tile of this.terrainTileImages) {
      tile.setTint(config.worldTint);
    }

    for (const actor of this.getLightReactiveActors()) {
      const view = this.actorViews.get(actor.id);
      view?.sprite.setTint(config.worldTint);
    }

    for (const prop of this.props) {
      const view = this.propViews.get(prop.id);
      if (!view) {
        continue;
      }

      const propConfig = PROP_RENDER_CONFIG[prop.assetId];
      if (propConfig.light) {
        view.image.clearTint();
      } else {
        view.image.setTint(config.worldTint);
      }

      view.base.setAlpha(propConfig.baseAlpha * (this.battleTimeOfDay === 'night' ? 0.78 : 1));
    }
  }

  private cycleBattleTimeOfDay(): void {
    const currentIndex = TIME_OF_DAY_ORDER.indexOf(this.battleTimeOfDay);
    this.battleTimeOfDay = TIME_OF_DAY_ORDER[(currentIndex + 1) % TIME_OF_DAY_ORDER.length];
    if (this.isWorldBattleActive()) {
      audioDirector.setBattleAmbience(this.battleTimeOfDay);
    }
    this.applyBattlePresentationShell();
    this.pushMessage(`Scene shifts to ${TIME_OF_DAY_CONFIG[this.battleTimeOfDay].label.toLowerCase()}.`);
    this.invalidateHud();
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
    this.syncBackdropScreenScale();
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
    this.syncBackdropScreenScale();
  }

  private async animateMovementStep(
    view: ActorView,
    destination: Phaser.Math.Vector2,
    destinationDepth: number,
    movementProfile: 'default' | 'patrol' | 'chase' = 'default'
  ): Promise<void> {
    const riseDuration =
      movementProfile === 'chase' ? CHASE_STEP_MOVE_UP_DURATION_MS : DEFAULT_STEP_MOVE_UP_DURATION_MS;
    const settleDuration =
      movementProfile === 'chase' ? CHASE_STEP_MOVE_DOWN_DURATION_MS : DEFAULT_STEP_MOVE_DOWN_DURATION_MS;

    return new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.container,
        x: destination.x,
        y: destination.y - 10,
        duration: riseDuration,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          view.container.setDepth(destinationDepth);
        },
        onComplete: () => {
          this.tweens.add({
            targets: view.container,
            y: destination.y,
            duration: settleDuration,
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
    actor: BattleUnit | WorldNpcRuntime,
    view: ActorView,
    destination: Phaser.Math.Vector2
  ): void {
    const nextFacing = getBattleMovementFacing(view.container, destination, view.facing);

    if (nextFacing !== view.facing) {
      this.applyActorFacing(actor, view, nextFacing);
    }
  }

  private localToAbsoluteOutdoorPoint(point: Point): Point {
    return this.outdoorSpatialIndex.localToAbsolute(point);
  }

  private absoluteToLocalOutdoorPoint(point: Point): Point {
    return this.outdoorSpatialIndex.absoluteToLocal(point);
  }

  private centerCameraOnOutdoorPoint(point: Point): void {
    const groundPoint = this.getOutdoorCameraAnchorScenePoint(point);

    if (!groundPoint) {
      return;
    }

    const scroll = this.getCenteredScrollForPoint(groundPoint.x, groundPoint.y - 12);
    this.setCameraScroll(scroll.x, scroll.y);
  }

  private getOutdoorCameraAnchorScenePoint(point: Point): Phaser.Math.Vector2 | null {
    const tile = this.outdoorSpatialIndex.getAbsoluteTile(point);

    if (!tile) {
      return null;
    }

    return this.getUnitGroundPoint(tile);
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

    return this.outdoorSpatialIndex.localToAbsolute(localPoint);
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
    const actors = this.getRenderedActors();
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

  private getUnitWorldPoint(unit: BattleUnit): Phaser.Math.Vector2 {
    const view = this.actorViews.get(unit.id);

    if (view) {
      return new Phaser.Math.Vector2(view.container.x, view.container.y);
    }

    const tile = getTile(this.map, unit.x, unit.y);
    return tile ? this.getUnitGroundPoint(tile) : new Phaser.Math.Vector2(this.origin.x, this.origin.y);
  }

  private faceBattleUnitTowardActionTarget(actor: BattleUnit, target: BattleUnit): void {
    const actorView = this.actorViews.get(actor.id);

    if (!actorView) {
      return;
    }

    const actorPoint = this.getUnitWorldPoint(actor);
    const targetPoint = this.getUnitWorldPoint(target);
    const nextFacing = Math.abs(targetPoint.x - actorPoint.x) < 1 ? actorView.facing : targetPoint.x > actorPoint.x ? 'right' : 'left';

    if (nextFacing !== actorView.facing) {
      this.applyActorFacing(actor, actorView, nextFacing);
    }
  }

  private getHighlightDepth(tile: TileData): number {
    return this.getTileDepth(tile) + 2;
  }

  private getPropDepth(tile: Point & { height?: number }): number {
    return this.getTileDepth(tile) + 7;
  }

  private getPropBaseDepth(tile: Point & { height?: number }): number {
    return this.getTileDepth(tile) + 4;
  }

  private getLightShadowDepth(tile: Point & { height?: number }): number {
    return this.getTileDepth(tile) + 5;
  }

  private getGroundGlowDepth(tile: Point & { height?: number }): number {
    return this.getPropBaseDepth(tile) - 0.15;
  }

  private getGroundLightDepth(tile: Point & { height?: number }): number {
    return this.getTileDepth(tile) + 1.25;
  }

  private getLightHaloDepth(tile: Point & { height?: number }): number {
    return this.getPropDepth(tile) - 0.1;
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

  private syncSceneAudioMute(): void {
    this.sound.mute = audioDirector.isMuted();
  }

  private resetWorldVisit(): void {
    if (this.restarting) {
      return;
    }

    this.setPauseMenuOpen(false);
    this.clearTurnStartCatchPhrase();
    this.restarting = true;
    this.busy = true;
    this.input.enabled = false;
    this.input.keyboard?.removeAllListeners();
    resetWorldSession();
    this.scene.restart({ spawnId: DEFAULT_WORLD_SPAWN_ID });
  }

  private async restartWorldEncounterBattle(): Promise<void> {
    if (!this.worldBattle) {
      return;
    }

    const retryData = this.worldBattle.runtimeBattle;
    const encounterId = this.worldBattle.encounterId;
    this.setPauseMenuOpen(false);
    this.destroyWorldBattleResultOverlay();
    this.clearTurnStartCatchPhrase();
    this.activeAutoBattleRunToken = null;
    this.worldBattle = null;
    this.restoreWorldBattleSourcePreview(retryData);
    await this.beginWorldBattle(encounterId, retryData);
  }

  private async returnWorldBattleToRoad(): Promise<void> {
    if (!this.worldBattle) {
      return;
    }

    await this.restoreExplorationFromWorldBattle('The skirmish disperses and the road opens again.');
  }

  private async restoreExplorationFromWorldBattle(message: string): Promise<void> {
    this.setPauseMenuOpen(false);
    this.destroyWorldBattleResultOverlay();
    this.clearTurnStartCatchPhrase();
    this.activeAutoBattleRunToken = null;
    this.autoBattleRunToken += 1;
    this.unitInventories.clear();
    this.worldBattle = null;
    this.headerMenuOpen = false;
    this.battleIntroPhase = 'hud';
    this.mapIntroAlpha = 0;
    this.mapPlaqueAlpha = 1;
    this.mapPlaqueOffsetX = 0;
    this.hoverTile = null;
    this.focusedNpcId = null;
    this.selectedNpcActionId = null;
    this.moveNodes.clear();
    this.battleInspectionTarget = { kind: 'mission' };
    this.freezeWorldDynamicLighting = false;
    this.phase = 'transition';
    this.busy = true;
    audioDirector.setMusic('setup');
    this.rebuildArea(true);
    this.battleObjectCountDelta =
      this.battleObjectCountBaseline === null ? null : this.children.list.length - this.battleObjectCountBaseline;
    this.phase = 'idle';
    this.busy = false;
    this.pushMessage(message);
    this.refreshNpcInteraction();
    this.invalidatePresentation();
  }

  private returnToTitle(): void {
    if (this.restarting) {
      return;
    }

    this.setPauseMenuOpen(false);
    this.restarting = true;
    this.busy = true;
    this.input.enabled = false;
    this.input.keyboard?.removeAllListeners();
    resetWorldSession();
    this.scene.start('title');
  }

  private createCombatEffectPlayback(
    effectId: CombatEffectId,
    source: BattleUnit,
    target: BattleUnit,
    overrides?: {
      launchPoint?: Phaser.Math.Vector2;
      impactPoint?: Phaser.Math.Vector2;
      angle?: number;
    }
  ): CombatEffectPlayback {
    const definition = getCombatEffectDefinition(effectId);
    const sourceGroundPoint = this.getUnitWorldPoint(source);
    const targetGroundPoint = this.getUnitWorldPoint(target);
    const launchPoint =
      overrides?.launchPoint ??
      this.getUnitSpritePoint(source, definition.launchAnchor ?? definition.impactAnchor ?? 0.55) ??
      sourceGroundPoint;
    const impactBase =
      overrides?.impactPoint ??
      this.getUnitSpritePoint(target, definition.impactAnchor ?? definition.launchAnchor ?? 0.56) ??
      targetGroundPoint;
    const targetPoint = new Phaser.Math.Vector2(
      impactBase.x,
      impactBase.y + (definition.impactOffsetY ?? 0)
    );
    const sourcePoint = new Phaser.Math.Vector2(
      launchPoint.x,
      launchPoint.y + (definition.sourceOffsetY ?? 0)
    );
    const angle =
      overrides?.angle ??
      Phaser.Math.Angle.Between(sourcePoint.x, sourcePoint.y, targetPoint.x, targetPoint.y);

    return {
      definition,
      source,
      target,
      sourceGroundPoint,
      targetGroundPoint,
      sourcePoint,
      targetPoint,
      angle: Number.isFinite(angle) ? angle : 0
    };
  }

  private async playCombatEffectLeadIn(playback: CombatEffectPlayback): Promise<void> {
    const { definition } = playback;

    if (definition.telegraph) {
      audioDirector.playCombatEffectPhase(definition.audio, 'telegraph');
      await this.animateCombatTelegraph(playback, definition.telegraph);
    }

    if (definition.travel) {
      audioDirector.playCombatEffectPhase(definition.audio, 'travel');
      await this.animateCombatTravel(playback, definition.travel);
    }
  }

  private async playCombatEffectImpact(
    playback: CombatEffectPlayback,
    options?: { critical?: boolean }
  ): Promise<void> {
    const { definition } = playback;

    audioDirector.playCombatEffectPhase(definition.audio, 'impact', options?.critical ?? false);
    await this.animateCombatImpactPhase(playback, definition.impact);

    if (definition.camera.shakeDuration > 0 && definition.camera.shakeIntensity > 0) {
      this.getWorldCamera().shake(definition.camera.shakeDuration, definition.camera.shakeIntensity);
    }

    if (definition.camera.hitStop > 0) {
      await this.wait(definition.camera.hitStop);
    }

    if (definition.afterglow) {
      await this.animateCombatAfterglow(playback, definition.afterglow);
    }
  }

  private async animateSourceReaction(playback: CombatEffectPlayback): Promise<void> {
    const reaction = playback.definition.sourceReaction;
    const view = this.actorViews.get(playback.source.id);

    if (!view || reaction.kind === 'none') {
      return;
    }

    const startX = playback.sourceGroundPoint.x;
    const startY = playback.sourceGroundPoint.y;
    let deltaX = 0;
    let deltaY = 0;

    switch (reaction.kind) {
      case 'lunge':
        deltaX = Math.cos(playback.angle) * reaction.distance;
        deltaY = Math.sin(playback.angle) * reaction.distance - reaction.lift;
        break;
      case 'brace':
        deltaX = -Math.cos(playback.angle) * reaction.distance;
        deltaY = Math.sin(playback.angle) * reaction.distance * 0.3 - reaction.lift;
        break;
      case 'phase-step':
        deltaX = Math.cos(playback.angle) * reaction.distance;
        deltaY = Math.sin(playback.angle) * reaction.distance - reaction.lift;
        this.spawnBlinkMovementBurst(playback.sourceGroundPoint, view.container.depth, playback.angle, 0x96ece0);
        this.spawnCombatAfterimage(playback.source, playback.sourceGroundPoint, 0x96ece0);
        break;
      case 'lift':
        deltaY = -reaction.lift;
        break;
      default:
        break;
    }

    const destination = new Phaser.Math.Vector2(startX + deltaX, startY + deltaY);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: view.container,
        x: destination.x,
        y: destination.y,
        duration: reaction.duration,
        ease: reaction.kind === 'brace' ? 'Quad.easeOut' : 'Sine.easeOut',
        onComplete: () => {
          if (reaction.kind === 'phase-step') {
            this.spawnBlinkMovementBurst(destination, view.container.depth, playback.angle, 0x96ece0);
            this.spawnCombatAfterimage(playback.source, destination, 0x96ece0);
          }

          this.tweens.add({
            targets: view.container,
            x: startX,
            y: startY,
            duration: reaction.returnDuration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              view.container.setPosition(startX, startY);
              resolve();
            }
          });
        }
      });
    });
  }

  private async animateTargetReaction(
    playback: CombatEffectPlayback,
    target: BattleUnit,
    critical = false
  ): Promise<void> {
    const reaction = playback.definition.targetReaction;
    const view = this.actorViews.get(target.id);

    if (!view || reaction.kind === 'none') {
      return;
    }

    const startX = view.container.x;
    const startY = view.container.y;
    const magnitude = critical ? 1.18 : 1;
    const deltaX =
      reaction.kind === 'uplift'
        ? 0
        : Math.cos(playback.angle) * reaction.offsetX * magnitude;
    const deltaY =
      reaction.kind === 'phase'
        ? reaction.offsetY * magnitude
        : reaction.kind === 'uplift'
          ? reaction.offsetY * magnitude
          : Math.sin(playback.angle) * reaction.offsetY * magnitude;

    await Promise.all([
      new Promise<void>((resolve) => {
        view.sprite.setTintFill(reaction.flashTint);
        this.tweens.add({
          targets: view.sprite,
          alpha: reaction.alphaMin,
          duration: reaction.duration,
          yoyo: true,
          repeat: reaction.repeat,
          onComplete: () => {
            view.sprite.clearTint();
            view.sprite.setAlpha(1);
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        this.tweens.add({
          targets: view.container,
          x: startX + deltaX,
          y: startY + deltaY,
          duration: reaction.duration,
          ease: reaction.kind === 'uplift' ? 'Sine.easeOut' : 'Quad.easeOut',
          yoyo: true,
          repeat: reaction.repeat,
          onComplete: () => {
            view.container.setPosition(startX, startY);
            resolve();
          }
        });
      })
    ]);
  }

  private async animateCombatTelegraph(
    playback: CombatEffectPlayback,
    telegraph: NonNullable<CombatEffectDefinition['telegraph']>
  ): Promise<void> {
    const animations: Promise<void>[] = [];
    const point = this.getCombatEffectPoint(playback, telegraph.anchor);
    const groundPoint = this.getCombatEffectGroundPoint(playback, telegraph.anchor);
    const spriteDepth = this.getCombatEffectDepth(playback, telegraph.anchor, false);
    const ringDepth = this.getCombatEffectDepth(playback, telegraph.anchor, true);

    if (telegraph.sprite) {
      animations.push(this.animateCombatSpriteLayer(point, spriteDepth, playback.angle, telegraph.sprite));
    }

    if (telegraph.ring) {
      animations.push(this.animateCombatGroundRing(groundPoint, ringDepth, telegraph.ring));
    }

    if (telegraph.glowTint && telegraph.glowAlpha && telegraph.glowScale) {
      animations.push(
        this.animateCombatGlow(
          point,
          spriteDepth - 0.01,
          telegraph.glowTint,
          telegraph.glowAlpha,
          telegraph.glowScale,
          telegraph.duration
        )
      );
    }

    if (telegraph.particles) {
      this.explodeCombatParticles(point, spriteDepth + 0.02, telegraph.particles, playback.angle);
    }

    if (animations.length === 0) {
      await this.wait(telegraph.duration);
      return;
    }

    await Promise.all(animations);
  }

  private async animateCombatTravel(
    playback: CombatEffectPlayback,
    travel: NonNullable<CombatEffectDefinition['travel']>
  ): Promise<void> {
    const fromPoint = this.getCombatEffectPoint(playback, travel.from);
    const toPoint = this.getCombatEffectPoint(playback, travel.to);
    const angle = Phaser.Math.Angle.Between(fromPoint.x, fromPoint.y, toPoint.x, toPoint.y) + (travel.rotationOffset ?? 0);
    const depth = Math.max(
      this.getCombatEffectDepth(playback, travel.from, false),
      this.getCombatEffectDepth(playback, travel.to, false)
    ) + 0.02;
    const burstCount = Math.max(1, travel.burstCount ?? 1);
    const burstDelay = travel.burstDelay ?? 0;
    const spread = travel.spread ?? 0;
    const alphaFalloff = travel.alphaFalloff ?? 0.12;
    const normalX = Math.cos(angle + Math.PI / 2);
    const normalY = Math.sin(angle + Math.PI / 2);

    const animateProjectile = async (burstIndex: number): Promise<void> => {
      if (burstDelay > 0 && burstIndex > 0) {
        await this.wait(burstDelay * burstIndex);
      }

      const burstOffset = (burstIndex - (burstCount - 1) / 2) * spread;
      const startX = fromPoint.x + normalX * burstOffset;
      const startY = fromPoint.y + normalY * burstOffset;
      const endX = toPoint.x + normalX * burstOffset * 0.45;
      const endY = toPoint.y + normalY * burstOffset * 0.3;
      const scaleFactor = Phaser.Math.Clamp(1 - Math.abs(burstOffset) * 0.018, 0.82, 1);
      const projectileAlpha = Phaser.Math.Clamp(
        travel.alpha - Math.abs(burstOffset) * alphaFalloff * 0.1,
        0.28,
        travel.alpha
      );

      if (Phaser.Math.Distance.Between(startX, startY, endX, endY) <= 8) {
        await this.animateCombatSpriteLayer(new Phaser.Math.Vector2(startX, startY), depth, angle, {
          textureKey: travel.textureKey,
          tint: travel.tint,
          alpha: projectileAlpha,
          startScale: travel.startScale * scaleFactor,
          endScale: travel.endScale * scaleFactor,
          duration: travel.duration,
          additive: travel.additive,
          spin: travel.spin
        });
        return;
      }

      const projectile = this.registerWorldObject(
        this.add
          .image(startX, startY, travel.textureKey)
          .setDepth(depth)
          .setScale(travel.startScale * scaleFactor)
          .setRotation(angle)
          .setTint(travel.tint)
          .setAlpha(projectileAlpha)
      );

      if (travel.additive) {
        projectile.setBlendMode(Phaser.BlendModes.ADD);
      }

      const trail = travel.trailTint
        ? this.registerWorldObject(
            this.add.particles(startX, startY, 'spark', {
              lifespan: 160,
              frequency: Math.max(12, 24 - burstCount * 3),
              quantity: 1,
              speedX: { min: -8, max: 8 },
              speedY: { min: -8, max: 8 },
              alpha: { start: Math.min(0.7, projectileAlpha * 0.6), end: 0 },
              scale: {
                start: (travel.trailScaleStart ?? 0.46) * scaleFactor,
                end: travel.trailScaleEnd ?? 0.05
              },
              tint: [...travel.trailTint],
              blendMode: 'ADD'
            })
          )
        : null;

      trail?.setDepth(depth - 0.01);
      const progress = { value: 0 };

      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: progress,
          value: 1,
          duration: travel.duration,
          ease: 'Cubic.easeInOut',
          onUpdate: () => {
            const ratio = progress.value;
            projectile.x = Phaser.Math.Linear(startX, endX, ratio);
            projectile.y = Phaser.Math.Linear(startY, endY, ratio) - Math.sin(Math.PI * ratio) * (travel.arcHeight ?? 0);
            projectile.scaleX = Phaser.Math.Linear(travel.startScale * scaleFactor, travel.endScale * scaleFactor, ratio);
            projectile.scaleY = projectile.scaleX;
            projectile.rotation = angle + (travel.spin ?? 0) * ratio;
            trail?.setPosition(projectile.x, projectile.y);
          },
          onComplete: () => {
            trail?.destroy();
            projectile.destroy();
            resolve();
          }
        });
      });
    };

    await Promise.all(Array.from({ length: burstCount }, (_unused, burstIndex) => animateProjectile(burstIndex)));
  }

  private async animateCombatImpactPhase(
    playback: CombatEffectPlayback,
    impact: CombatEffectDefinition['impact']
  ): Promise<void> {
    const animations: Promise<void>[] = [];
    const point = this.getCombatEffectPoint(playback, impact.anchor);
    const groundPoint = this.getCombatEffectGroundPoint(playback, impact.anchor);
    const spriteDepth = this.getCombatEffectDepth(playback, impact.anchor, false);
    const ringDepth = this.getCombatEffectDepth(playback, impact.anchor, true);

    if (impact.sprite) {
      animations.push(this.animateCombatSpriteLayer(point, spriteDepth, playback.angle, impact.sprite));
    }

    if (impact.ring) {
      animations.push(this.animateCombatGroundRing(groundPoint, ringDepth, impact.ring));
    }

    if (impact.glowTint && impact.glowAlpha && impact.glowScale) {
      animations.push(
        this.animateCombatGlow(
          point,
          spriteDepth - 0.01,
          impact.glowTint,
          impact.glowAlpha,
          impact.glowScale,
          impact.duration
        )
      );
    }

    if (impact.particles) {
      this.explodeCombatParticles(point, spriteDepth + 0.02, impact.particles, playback.angle);
    }

    if (animations.length === 0) {
      await this.wait(impact.duration);
      return;
    }

    await Promise.all(animations);
  }

  private async animateCombatAfterglow(
    playback: CombatEffectPlayback,
    afterglow: NonNullable<CombatEffectDefinition['afterglow']>
  ): Promise<void> {
    const animations: Promise<void>[] = [];
    const point = this.getCombatEffectPoint(playback, afterglow.anchor);
    const groundPoint = this.getCombatEffectGroundPoint(playback, afterglow.anchor);
    const spriteDepth = this.getCombatEffectDepth(playback, afterglow.anchor, false);
    const ringDepth = this.getCombatEffectDepth(playback, afterglow.anchor, true);

    if (afterglow.sprite) {
      animations.push(this.animateCombatSpriteLayer(point, spriteDepth, playback.angle, afterglow.sprite));
    }

    if (afterglow.ring) {
      animations.push(this.animateCombatGroundRing(groundPoint, ringDepth, afterglow.ring));
    }

    if (afterglow.glowTint && afterglow.glowAlpha && afterglow.glowScale) {
      animations.push(
        this.animateCombatGlow(
          point,
          spriteDepth - 0.01,
          afterglow.glowTint,
          afterglow.glowAlpha,
          afterglow.glowScale,
          afterglow.duration
        )
      );
    }

    if (afterglow.particles) {
      this.explodeCombatParticles(point, spriteDepth + 0.02, afterglow.particles, playback.angle);
    }

    if (animations.length === 0) {
      await this.wait(afterglow.duration);
      return;
    }

    await Promise.all(animations);
  }

  private async animateCombatSpriteLayer(
    point: Phaser.Math.Vector2,
    depth: number,
    angle: number,
    layer: NonNullable<CombatEffectDefinition['impact']>['sprite']
  ): Promise<void> {
    if (!layer) {
      return;
    }

    const sprite = this.registerWorldObject(
      this.add
        .image(point.x, point.y + (layer.offsetY ?? 0), layer.textureKey)
        .setDepth(depth)
        .setScale(layer.startScale)
        .setRotation(angle + (layer.rotationOffset ?? 0))
        .setTint(layer.tint)
        .setAlpha(0)
    );

    if (layer.additive) {
      sprite.setBlendMode(Phaser.BlendModes.ADD);
    }

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: sprite,
        alpha: layer.alpha,
        scaleX: Phaser.Math.Linear(layer.startScale, layer.endScale, 0.55),
        scaleY: Phaser.Math.Linear(layer.startScale, layer.endScale, 0.55),
        duration: layer.duration * 0.4,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: sprite,
            alpha: 0,
            scaleX: layer.endScale,
            scaleY: layer.endScale,
            rotation: angle + (layer.rotationOffset ?? 0) + (layer.spin ?? 0),
            duration: layer.duration * 0.6,
            ease: 'Quad.easeOut',
            onComplete: () => {
              sprite.destroy();
              resolve();
            }
          });
        }
      });
    });
  }

  private async animateCombatGroundRing(
    point: Phaser.Math.Vector2,
    depth: number,
    ring: NonNullable<CombatEffectDefinition['impact']>['ring']
  ): Promise<void> {
    if (!ring) {
      return;
    }

    const ellipse = this.registerWorldObject(
      this.add
        .ellipse(
          point.x,
          point.y + (ring.offsetY ?? 0),
          ring.width,
          ring.height,
          ring.tint,
          ring.fillAlpha ?? ring.alpha * 0.35
        )
        .setDepth(depth)
        .setScale(ring.startScale)
        .setAlpha(ring.alpha)
    );
    ellipse.setStrokeStyle(ring.strokeWidth ?? 2, ring.tint, ring.strokeAlpha ?? ring.alpha);

    if (ring.additive) {
      ellipse.setBlendMode(Phaser.BlendModes.ADD);
    }

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: ellipse,
        scaleX: ring.endScale,
        scaleY: ring.endScale,
        alpha: 0,
        duration: ring.duration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          ellipse.destroy();
          resolve();
        }
      });
    });
  }

  private async animateCombatGlow(
    point: Phaser.Math.Vector2,
    depth: number,
    tint: number,
    alpha: number,
    scale: number,
    duration: number
  ): Promise<void> {
    const glow = this.registerWorldObject(
      this.add
        .image(point.x, point.y, SOFT_LIGHT_TEXTURE_KEY)
        .setDepth(depth)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setScale(scale)
        .setAlpha(alpha)
    );

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: glow,
        alpha: 0,
        scaleX: scale * 1.35,
        scaleY: scale * 1.35,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          glow.destroy();
          resolve();
        }
      });
    });
  }

  private explodeCombatParticles(
    point: Phaser.Math.Vector2,
    depth: number,
    particles: NonNullable<CombatEffectDefinition['impact']>['particles'],
    angle: number
  ): void {
    if (!particles) {
      return;
    }

    const angleDegrees = Phaser.Math.RadToDeg(angle + (particles.angleOffset ?? 0));
    const burst = this.registerWorldObject(
      this.add.particles(point.x, point.y + (particles.offsetY ?? 0), 'spark', {
        speed: { min: particles.speedMin, max: particles.speedMax },
        angle: particles.angleSpread
          ? { min: angleDegrees - particles.angleSpread / 2, max: angleDegrees + particles.angleSpread / 2 }
          : undefined,
        lifespan: particles.lifespan,
        quantity: particles.count,
        scale: { start: particles.scaleStart, end: particles.scaleEnd },
        alpha: { start: 0.82, end: 0 },
        tint: [...particles.tint],
        gravityY: particles.gravityY ?? 0,
        blendMode: particles.blendMode ?? 'NORMAL'
      })
    );
    burst.setDepth(depth);
    burst.explode(particles.count, point.x, point.y + (particles.offsetY ?? 0));
    this.time.delayedCall(particles.lifespan + 40, () => {
      burst.destroy();
    });
  }

  private spawnCombatAfterimage(unit: BattleUnit, groundPoint: Phaser.Math.Vector2, tint: number): void {
    const view = this.actorViews.get(unit.id);

    if (!view) {
      return;
    }

    const afterimage = this.registerWorldObject(
      this.add
        .image(groundPoint.x + view.sprite.x, groundPoint.y + view.sprite.y, view.sprite.texture.key)
        .setOrigin(view.sprite.originX, view.sprite.originY)
        .setDepth(view.container.depth + 0.1)
        .setTint(tint)
        .setAlpha(0.26)
        .setFlipX(view.sprite.flipX)
        .setFlipY(view.sprite.flipY)
        .setDisplaySize(view.sprite.displayWidth, view.sprite.displayHeight)
    );

    this.tweens.add({
      targets: afterimage,
      alpha: 0,
      y: afterimage.y + 4,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => afterimage.destroy()
    });
  }

  private spawnBlinkMovementBurst(
    point: Phaser.Math.Vector2,
    depth: number,
    angle: number,
    tint: number
  ): void {
    const angleDegrees = Phaser.Math.RadToDeg(angle);
    const burst = this.registerWorldObject(
      this.add.particles(point.x, point.y - 20, 'spark', {
        speed: { min: 32, max: 102 },
        angle: { min: angleDegrees - 55, max: angleDegrees + 55 },
        lifespan: 220,
        quantity: 14,
        scale: { start: 0.78, end: 0.04 },
        alpha: { start: 0.82, end: 0 },
        tint: [tint, 0xb9f5ff, 0xf7efda],
        blendMode: 'ADD'
      })
    );
    burst.setDepth(depth);
    burst.explode(14, point.x, point.y - 20);

    const outerRing = this.registerWorldObject(
      this.add
        .ellipse(point.x, point.y - 4, 46, 18, tint, 0.1)
        .setStrokeStyle(2, 0xf6f7ff, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(depth - 0.08)
    );
    const innerRing = this.registerWorldObject(
      this.add
        .ellipse(point.x, point.y - 4, 28, 10, 0xf6f7ff, 0.08)
        .setStrokeStyle(1, tint, 0.8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(depth - 0.07)
    );

    this.tweens.add({
      targets: outerRing,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.35,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => outerRing.destroy()
    });
    this.tweens.add({
      targets: innerRing,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.5,
      duration: 130,
      ease: 'Quad.easeOut',
      onComplete: () => innerRing.destroy()
    });
    this.time.delayedCall(240, () => {
      burst.destroy();
    });
  }

  private getCombatEffectPoint(playback: CombatEffectPlayback, anchor: 'source' | 'target'): Phaser.Math.Vector2 {
    return (anchor === 'source' ? playback.sourcePoint : playback.targetPoint).clone();
  }

  private getCombatEffectGroundPoint(playback: CombatEffectPlayback, anchor: 'source' | 'target'): Phaser.Math.Vector2 {
    return (anchor === 'source' ? playback.sourceGroundPoint : playback.targetGroundPoint).clone();
  }

  private getCombatEffectDepth(
    playback: CombatEffectPlayback,
    anchor: 'source' | 'target',
    grounded: boolean
  ): number {
    const unit = anchor === 'source' ? playback.source : playback.target;
    const baseDepth = this.actorViews.get(unit.id)?.container.depth ?? 962;
    return grounded ? baseDepth - 0.08 : baseDepth + 0.18;
  }

  private pushMessage(message: string): void {
    this.messages = [...this.messages.slice(-3), message];
    this.invalidateHud();
  }

  private playTurnStartAnimation(unit: BattleUnit): void {
    const view = this.actorViews.get(unit.id);

    if (!view || !unit.alive) {
      return;
    }

    const pulse = this.registerWorldObject(
      this.add.ellipse(view.container.x, view.container.y - 12, 62, 26, 0xf4d98c, 0.42).setDepth(view.container.depth - 1)
    );

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
      yoyo: true,
      onUpdate: () => this.syncBattleActorEmphasis(view, unit),
      onComplete: () => this.syncBattleActorEmphasis(view, unit)
    });
  }

  private queueTurnStartCatchPhrase(unit: BattleUnit): void {
    this.clearTurnStartCatchPhrase();
    this.turnStartCatchPhraseEvent = this.time.delayedCall(120, () => {
      this.turnStartCatchPhraseEvent = null;
      this.showTurnStartCatchPhrase(unit);
      this.playTurnStartCatchPhraseVoice(unit);
    });
  }

  private showTurnStartCatchPhrase(unit: BattleUnit): void {
    const view = this.actorViews.get(unit.id);
    const barkPoint = this.getUnitSpritePoint(unit, TURN_START_CATCH_PHRASE_HEIGHT_FACTOR);

    if (!view || !barkPoint) {
      return;
    }

    this.turnStartCatchPhraseText = showSharedTurnStartCatchPhrase({
      scene: this,
      point: barkPoint,
      text: unit.turnStartCatchPhrase,
      anchorDepth: view.container.depth,
      createText: (x, y, text) => this.registerWorldObject(this.add.text(x, y, text, UI_TEXT_WORLD_BARK)),
      onComplete: (barkText) => {
        if (this.turnStartCatchPhraseText === barkText) {
          this.turnStartCatchPhraseText = null;
        }
      }
    });
  }

  private getUnitSpritePoint(unit: BattleUnit, heightFactor: number): Phaser.Math.Vector2 | null {
    const view = this.actorViews.get(unit.id);

    if (!view) {
      return null;
    }

    return new Phaser.Math.Vector2(
      view.container.x + view.sprite.x,
      view.container.y + view.sprite.y - unit.spriteDisplayHeight * heightFactor
    );
  }

  private playTurnStartCatchPhraseVoice(unit: BattleUnit): void {
    const audioKey = UNIT_TURN_START_AUDIO_KEYS[unit.blueprintId];

    if (!audioKey || audioDirector.isMuted() || this.sound.locked) {
      return;
    }

    this.stopTurnStartCatchPhraseSound();
    const sound = this.sound.add(audioKey, { volume: 0.9 });

    if (!sound.play()) {
      sound.destroy();
      return;
    }

    this.turnStartCatchPhraseSound = sound;
    sound.once('complete', () => {
      if (this.turnStartCatchPhraseSound === sound) {
        this.turnStartCatchPhraseSound = null;
      }
      sound.destroy();
    });
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

    if (!sound.play()) {
      sound.destroy();
      return;
    }

    this.factionMottoSound = sound;
    this.factionMottoPlayed.add(factionId);
    this.pushMessage(`${getFactionProfile(factionId).displayName}: "${getFactionProfile(factionId).motto}"`);

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

  private stopTurnStartCatchPhraseSound(): void {
    if (!this.turnStartCatchPhraseSound) {
      return;
    }

    this.turnStartCatchPhraseSound.stop();
    this.turnStartCatchPhraseSound.destroy();
    this.turnStartCatchPhraseSound = null;
  }

  private clearTurnStartCatchPhrase(): void {
    this.turnStartCatchPhraseEvent?.remove(false);
    this.turnStartCatchPhraseEvent = null;
    this.stopTurnStartCatchPhraseSound();

    if (!this.turnStartCatchPhraseText) {
      return;
    }

    this.tweens.killTweensOf(this.turnStartCatchPhraseText);
    this.turnStartCatchPhraseText.destroy();
    this.turnStartCatchPhraseText = null;
  }

  private async showFloatingCombatText(
    point: Phaser.Math.Vector2,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    duration: number
  ): Promise<void> {
    const label = this.registerWorldObject(this.add.text(point.x, point.y, text, style).setOrigin(0.5).setDepth(980));
    label.setAlpha(0);

    await new Promise<void>((resolve) => {
      this.tweens.add({
        targets: label,
        y: point.y - 24,
        alpha: 1,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => resolve()
      });
      this.tweens.add({
        targets: label,
        alpha: 0,
        delay: Math.max(80, duration * 0.45),
        duration: Math.max(120, duration * 0.4),
        ease: 'Quad.easeIn'
      });
    });

    label.destroy();
  }

  private wait(duration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.time.delayedCall(duration, () => resolve());
    });
  }
}
