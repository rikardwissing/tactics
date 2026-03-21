import Phaser from 'phaser';
import {
  getTileDepth as getSharedTileDepth,
  getTileTopPoints as getSharedTileTopPoints,
  getUnitGroundPoint as getSharedUnitGroundPoint,
  isoToScreenPoint
} from '../core/isometric';
import { ELEVATION_STEP, TILE_HEIGHT, TILE_WIDTH } from '../core/mapData';
import { audioDirector } from '../audio/audioDirector';
import type { TerrainType, Point, TileData } from '../core/types';
import { DEFAULT_UNIT_IMAGE_KEY } from '../assets';
import { getAllLevels, UNIT_BLUEPRINT_BATTLE_SCALE } from '../levels';
import type { MapPropAssetId } from '../levels/types';
import { getAllUnitBlueprints, getUnitBlueprint } from '../levels/unitBlueprints';
import {
  allocateWorldEditorObjectId,
  buildWorldEditorArchive,
  createWorldEditorDraft,
  getTiledPropertyValue,
  getWorldEditorHeightAt,
  getWorldEditorMapProperty,
  getWorldEditorObject,
  getWorldEditorObjectLayer,
  getWorldEditorOutdoorBaseMapAt,
  getWorldEditorOutdoorBaseMaps,
  getWorldEditorTerrainAt,
  recordToTiledProperties,
  removeWorldEditorObject,
  setWorldEditorHeightAt,
  setWorldEditorMapProperty,
  setWorldEditorTerrainAt,
  tiledPropertiesToRecord,
  type WorldEditorMapDescriptor,
  type WorldEditorMapDraft,
  type WorldEditorObjectLayerName,
  type WorldEditorPropertyValue,
  type WorldEditorTiledObject
} from '../world/editor';
import {
  PROP_RENDER_CONFIG,
  UNIT_GROUND_OFFSET_Y,
  WORLD_EDGE_BASE_LEVEL,
  getTerrainPalette,
  getTerrainTileAssetKey,
  redrawBoardWalls
} from '../world/rendering';
import { BattleUiChrome, UI_PANEL_GAP, UI_SCREEN_MARGIN } from './components/BattleUiChrome';
import {
  UI_COLOR_ACCENT_COOL,
  UI_COLOR_ACCENT_DANGER,
  UI_COLOR_ACCENT_NEUTRAL,
  UI_COLOR_ACCENT_WARM,
  UI_COLOR_DANGER,
  UI_COLOR_PANEL_BORDER,
  UI_COLOR_SUCCESS
} from './components/UiColors';
import {
  UI_TEXT_ACTION,
  UI_TEXT_BODY,
  UI_TEXT_LABEL,
  UI_TEXT_TITLE
} from './components/UiTextStyles';

type EditorTool = 'terrain' | 'heights' | WorldEditorObjectLayerName;
type HeightBrushDirection = 'raise' | 'lower';
type HeaderButtonId = 'back' | 'copy-archive' | 'download-archive';
type ActionButtonId = 'edit-chunk' | 'edit-object' | 'duplicate-object' | 'delete-object' | 'reset-chunk';
type PaletteValue = TerrainType | HeightBrushDirection | MapPropAssetId;

interface ButtonView<T extends string = string> {
  id: T;
  bounds: Phaser.Geom.Rectangle;
  enabled: boolean;
}

interface ChoiceButtonView<T> {
  value: T;
  bounds: Phaser.Geom.Rectangle;
  enabled: boolean;
}

interface SelectedObjectRef {
  layer: WorldEditorObjectLayerName;
  fileName: string;
  objectId: number;
}

interface ChunkTileContext {
  descriptor: WorldEditorMapDescriptor;
  draft: WorldEditorMapDraft;
  chunkX: number;
  chunkY: number;
  localX: number;
  localY: number;
}

interface PropVisual {
  id: number;
  tile: Point;
  base: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
}

interface NpcVisual {
  id: number;
  tile: Point;
  image: Phaser.GameObjects.Image;
}

interface MarkerVisual {
  id: string;
  tile: Point;
  objects: Phaser.GameObjects.GameObject[];
}

const PROP_ASSET_IDS = [
  'obstacle-rubble-barricade',
  'light-torch',
  'sanctum-brazier'
] as const satisfies readonly MapPropAssetId[];
const OBJECT_LAYER_ORDER: readonly WorldEditorObjectLayerName[] = [
  'props',
  'npcs',
  'encounters',
  'transitions',
  'spawnPoints'
] as const;
const TOOL_ORDER: readonly EditorTool[] = ['terrain', 'heights', ...OBJECT_LAYER_ORDER] as const;
const TOOL_LABELS: Record<EditorTool, string> = {
  terrain: 'Terrain',
  heights: 'Height',
  props: 'Props',
  npcs: 'NPCs',
  encounters: 'Encounters',
  transitions: 'Transitions',
  spawnPoints: 'Spawns'
};
const OBJECT_LAYER_LABELS: Record<WorldEditorObjectLayerName, string> = {
  props: 'Props',
  npcs: 'NPCs',
  encounters: 'Encounters',
  transitions: 'Transitions',
  spawnPoints: 'Spawns'
};
const TOOL_ACCENTS: Record<EditorTool, number> = {
  terrain: UI_COLOR_ACCENT_WARM,
  heights: UI_COLOR_ACCENT_NEUTRAL,
  props: 0x7c5636,
  npcs: UI_COLOR_ACCENT_COOL,
  encounters: UI_COLOR_ACCENT_DANGER,
  transitions: 0x866246,
  spawnPoints: 0x2c7264
};
const HEIGHT_BRUSH_LABELS: Record<HeightBrushDirection, string> = {
  raise: 'Raise (+1)',
  lower: 'Lower (-1)'
};
const HEIGHT_BRUSH_VALUES: readonly HeightBrushDirection[] = ['raise', 'lower'];
const OBJECT_LAYER_COLORS: Record<WorldEditorObjectLayerName, number> = {
  props: 0xcb9a5b,
  npcs: 0x8bc6ea,
  encounters: 0xe58b95,
  transitions: 0xf2d197,
  spawnPoints: 0x61d7c7
};
const DEFAULT_OBJECT_TYPES: Record<WorldEditorObjectLayerName, string> = {
  props: 'world_prop',
  npcs: 'world_npc',
  encounters: 'world_encounter',
  transitions: 'world_transition',
  spawnPoints: 'world_spawn'
};
const PROP_LABELS: Record<MapPropAssetId, string> = {
  'obstacle-rubble-barricade': 'Rubble',
  'light-torch': 'Torch',
  'sanctum-brazier': 'Brazier'
};
const HEADER_BUTTON_WIDTH = 124;
const HEADER_BUTTON_HEIGHT = 28;
const TOOL_BUTTON_HEIGHT = 28;
const TOOL_BUTTON_GAP = 8;
const ACTION_BUTTON_HEIGHT = 28;
const ACTION_BUTTON_GAP = 8;
const WORLD_CAMERA_MIN_ZOOM = 0.08;
const WORLD_CAMERA_MAX_ZOOM = 0.68;
const WORLD_CAMERA_DEFAULT_ZOOM = 0.16;
const DEFAULT_STATUS =
  'Whole-overworld editing is active. Paint terrain directly, use Height to raise or lower tiles, drag object markers to reposition them, then export one archive for later import.';

function tileKey(point: Point | null): string {
  return point ? `${point.x},${point.y}` : '';
}

function mixColor(base: number, target: number, amount: number): number {
  const from = Phaser.Display.Color.IntegerToColor(base);
  const to = Phaser.Display.Color.IntegerToColor(target);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Phaser.Math.Clamp(amount, 0, 1) * 100);
  return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
}

export class WorldMapEditorScene extends Phaser.Scene {
  private readonly outdoorDescriptors = getWorldEditorOutdoorBaseMaps();
  private readonly levelIds = getAllLevels().map((level) => level.id);
  private readonly blueprintIds = getAllUnitBlueprints().map((blueprint) => blueprint.id);
  private readonly drafts = new Map<string, WorldEditorMapDraft>();
  private readonly dirtyFiles = new Set<string>();

  private activeTool: EditorTool = 'terrain';
  private selectedTerrain: TerrainType = 'grass';
  private selectedHeightDirection: HeightBrushDirection = 'raise';
  private selectedPropAsset: MapPropAssetId = 'obstacle-rubble-barricade';
  private selectedObject: SelectedObjectRef | null = null;
  private hoverTile: Point | null = null;
  private activeTile: Point | null = null;
  private paintPointerId: number | null = null;
  private lastPaintTileKey = '';
  private draggingObject: SelectedObjectRef | null = null;
  private lastDragTileKey = '';
  private statusMessage = DEFAULT_STATUS;

  private backdrop!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private panelGraphics!: Phaser.GameObjects.Graphics;
  private worldGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private worldRoot!: Phaser.GameObjects.Container;
  private terrainContainer!: Phaser.GameObjects.Container;
  private wallContainer!: Phaser.GameObjects.Container;
  private propContainer!: Phaser.GameObjects.Container;
  private actorContainer!: Phaser.GameObjects.Container;
  private markerContainer!: Phaser.GameObjects.Container;
  private worldBoardGraphics!: Phaser.GameObjects.Graphics;
  private worldViewportOverlay!: Phaser.GameObjects.Graphics;
  private worldViewportMaskGraphics!: Phaser.GameObjects.Graphics;
  private worldViewportMask!: Phaser.Display.Masks.GeometryMask;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private dynamicTexts: Phaser.GameObjects.Text[] = [];

  private headerButtonViews: ButtonView<HeaderButtonId>[] = [];
  private toolButtonViews: ChoiceButtonView<EditorTool>[] = [];
  private paletteButtonViews: ChoiceButtonView<PaletteValue>[] = [];
  private actionButtonViews: ButtonView<ActionButtonId>[] = [];

  private headerRect = new Phaser.Geom.Rectangle();
  private footerRect = new Phaser.Geom.Rectangle();
  private leftPanelRect = new Phaser.Geom.Rectangle();
  private centerPanelRect = new Phaser.Geom.Rectangle();
  private rightPanelRect = new Phaser.Geom.Rectangle();
  private worldBoardRect = new Phaser.Geom.Rectangle();
  private worldViewportRect = new Phaser.Geom.Rectangle();
  private minimapRect = new Phaser.Geom.Rectangle();
  private worldCellSize = 8;
  private worldWidth = 0;
  private worldHeight = 0;
  private chunkWidth = 0;
  private chunkHeight = 0;
  private worldLayout: {
    origin: Point;
    gridWidth: number;
    gridHeight: number;
    rotationStep: number;
  } = {
    origin: { x: 0, y: 0 },
    gridWidth: 0,
    gridHeight: 0,
    rotationStep: 0
  };
  private worldCameraCenter = new Phaser.Math.Vector2();
  private worldZoom = WORLD_CAMERA_DEFAULT_ZOOM;
  private worldBounds = new Phaser.Geom.Rectangle();
  private panPointerId: number | null = null;
  private panPointerOrigin = new Phaser.Math.Vector2();
  private panCameraOrigin = new Phaser.Math.Vector2();
  private tileDataByKey = new Map<string, TileData>();
  private terrainImages = new Map<string, Phaser.GameObjects.Image>();
  private wallGraphics: Phaser.GameObjects.Graphics[] = [];
  private propVisuals = new Map<number, PropVisual>();
  private npcVisuals = new Map<number, NpcVisual>();
  private markerVisuals: MarkerVisual[] = [];
  private needsInitialWorldFit = true;

  constructor() {
    super('world-map-editor');
  }

  create(): void {
    for (const descriptor of this.outdoorDescriptors) {
      this.drafts.set(descriptor.fileName, createWorldEditorDraft(descriptor.fileName));
    }

    const firstDraft = this.outdoorDescriptors[0] ? this.getDraft(this.outdoorDescriptors[0].fileName) : null;

    if (firstDraft) {
      this.chunkWidth = firstDraft.source.width;
      this.chunkHeight = firstDraft.source.height;
      this.worldWidth =
        this.chunkWidth *
        (Math.max(...this.outdoorDescriptors.map((descriptor) => descriptor.chunkX ?? 0)) + 1);
      this.worldHeight =
        this.chunkHeight *
        (Math.max(...this.outdoorDescriptors.map((descriptor) => descriptor.chunkY ?? 0)) + 1);
      this.selectedTerrain = firstDraft.descriptor.terrainOptions[0] ?? 'grass';
    }

    audioDirector.bindScene(this);
    audioDirector.setMusic('title');
    void audioDirector.unlock().catch(() => undefined);
    this.input.mouse?.disableContextMenu();

    this.backdrop = this.add.image(0, 0, 'renations-global-backdrop').setOrigin(0.5).setAlpha(0.94);
    this.shade = this.add.rectangle(0, 0, 0, 0, 0x080407, 0.56).setOrigin(0);
    this.worldRoot = this.add.container(0, 0);
    this.terrainContainer = this.add.container(0, 0);
    this.wallContainer = this.add.container(0, 0);
    this.propContainer = this.add.container(0, 0);
    this.actorContainer = this.add.container(0, 0);
    this.markerContainer = this.add.container(0, 0);
    this.worldBoardGraphics = this.add.graphics();
    this.wallContainer.add(this.worldBoardGraphics);
    this.worldRoot.add([
      this.terrainContainer,
      this.wallContainer,
      this.propContainer,
      this.actorContainer,
      this.markerContainer
    ]);
    this.worldGraphics = this.add.graphics();
    this.panelGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.worldViewportOverlay = this.add.graphics();
    this.worldViewportMaskGraphics = this.add.graphics();
    this.worldViewportMask = this.worldViewportMaskGraphics.createGeometryMask();
    this.worldRoot.setMask(this.worldViewportMask);
    this.worldViewportOverlay.setMask(this.worldViewportMask);

    this.backdrop.setDepth(0);
    this.shade.setDepth(1);
    this.panelGraphics.setDepth(4);
    this.worldRoot.setDepth(6);
    this.worldGraphics.setDepth(7);
    this.overlayGraphics.setDepth(8);
    this.worldViewportOverlay.setDepth(9);
    this.worldViewportMaskGraphics.setVisible(false);

    this.titleText = this.add.text(0, 0, 'WORLD MAP EDITOR', UI_TEXT_TITLE).setOrigin(0, 0.5);
    this.subtitleText = this.add.text(0, 0, '', UI_TEXT_BODY).setOrigin(0, 0.5);
    this.statusText = this.add.text(0, 0, '', {
      ...UI_TEXT_BODY,
      wordWrap: { width: 0 }
    });
    this.hintText = this.add.text(0, 0, '', {
      ...UI_TEXT_LABEL,
      wordWrap: { width: 0 }
    });
    this.titleText.setDepth(12);
    this.subtitleText.setDepth(12);
    this.statusText.setDepth(12);
    this.hintText.setDepth(12);

    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.refreshScene, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.handlePointerDown, this);
      this.input.off('pointermove', this.handlePointerMove, this);
      this.input.off('pointerup', this.handlePointerUp, this);
      this.input.off('pointerupoutside', this.handlePointerUp, this);
      this.input.off('wheel', this.handleWheel, this);
      this.input.keyboard?.off('keydown', this.handleKeyDown, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.refreshScene, this);
      this.clearDynamicTexts();
      this.destroyWorldVisuals();
    });

    this.rebuildWorldModel();
    this.rebuildWorldVisuals();
    this.refreshScene();
  }

  private getDraft(fileName: string): WorldEditorMapDraft {
    const draft = this.drafts.get(fileName);

    if (!draft) {
      throw new Error(`Missing world draft ${fileName}.`);
    }

    return draft;
  }

  private rebuildWorldModel(): void {
    this.tileDataByKey.clear();

    let maxHeight = 0;

    for (let globalY = 0; globalY < this.worldHeight; globalY += 1) {
      for (let globalX = 0; globalX < this.worldWidth; globalX += 1) {
        const context = this.getChunkContextForGlobalTile({ x: globalX, y: globalY });
        const tile: TileData = {
          x: globalX,
          y: globalY,
          terrain: getWorldEditorTerrainAt(context.draft, context.localX, context.localY) ?? 'stone',
          height: getWorldEditorHeightAt(context.draft, context.localX, context.localY) ?? 0
        };
        this.tileDataByKey.set(tileKey(tile), tile);
        maxHeight = Math.max(maxHeight, tile.height);
      }
    }

    this.worldLayout = {
      origin: {
        x: this.worldHeight * (TILE_WIDTH / 2) + TILE_WIDTH,
        y: TILE_HEIGHT * 2 + maxHeight * ELEVATION_STEP + 40
      },
      gridWidth: this.worldWidth,
      gridHeight: this.worldHeight,
      rotationStep: 0
    };

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const tile of this.tileDataByKey.values()) {
      const points = this.getTileTopPoints(tile);

      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    this.worldBounds.setTo(minX - 160, minY - 220, maxX - minX + 320, maxY - minY + 420);
  }

  private destroyWorldVisuals(): void {
    this.clearContainer(this.terrainContainer);
    this.clearContainer(this.wallContainer);
    this.clearContainer(this.propContainer);
    this.clearContainer(this.actorContainer);
    this.clearContainer(this.markerContainer);
    this.worldViewportOverlay.clear();
    this.terrainImages.clear();
    this.wallGraphics = [];
    this.propVisuals.clear();
    this.npcVisuals.clear();
    this.markerVisuals = [];
  }

  private clearContainer(container: Phaser.GameObjects.Container): void {
    for (const child of container.getAll()) {
      child.destroy();
    }
    container.removeAll(false);
  }

  private getTileData(point: Point): TileData | null {
    return this.tileDataByKey.get(tileKey(point)) ?? null;
  }

  private syncTileDataFromDraft(point: Point): TileData | null {
    const context = this.getChunkContextForGlobalTile(point);
    const tile = this.getTileData(point);

    if (!tile) {
      return null;
    }

    tile.terrain = getWorldEditorTerrainAt(context.draft, context.localX, context.localY) ?? tile.terrain;
    tile.height = getWorldEditorHeightAt(context.draft, context.localX, context.localY) ?? tile.height;
    return tile;
  }

  private syncTileVisual(point: Point): void {
    const tile = this.getTileData(point);
    const image = this.terrainImages.get(tileKey(point));

    if (!tile || !image) {
      return;
    }

    const screenPoint = this.isoToScreen(tile);
    image.setTexture(getTerrainTileAssetKey(tile));
    image.setPosition(screenPoint.x, screenPoint.y);
  }

  private getFocusTile(): Point {
    if (this.hoverTile) {
      return this.hoverTile;
    }

    if (this.activeTile) {
      return this.activeTile;
    }

    return { x: 0, y: 0 };
  }

  private getFocusContext(): ChunkTileContext {
    return this.getChunkContextForGlobalTile(this.getFocusTile());
  }

  private getChunkContextForGlobalTile(point: Point): ChunkTileContext {
    const chunkX = Math.floor(point.x / this.chunkWidth);
    const chunkY = Math.floor(point.y / this.chunkHeight);
    const descriptor = getWorldEditorOutdoorBaseMapAt(chunkX, chunkY);
    const draft = this.getDraft(descriptor.fileName);

    return {
      descriptor,
      draft,
      chunkX,
      chunkY,
      localX: point.x - chunkX * this.chunkWidth,
      localY: point.y - chunkY * this.chunkHeight
    };
  }

  private getSelectedObjectEntry():
    | {
        reference: SelectedObjectRef;
        draft: WorldEditorMapDraft;
        object: WorldEditorTiledObject;
        globalTile: Point;
      }
    | null {
    if (!this.selectedObject) {
      return null;
    }

    const draft = this.getDraft(this.selectedObject.fileName);
    const object = getWorldEditorObject(draft, this.selectedObject.layer, this.selectedObject.objectId);

    if (!object) {
      this.selectedObject = null;
      return null;
    }

    const descriptor = draft.descriptor;
    return {
      reference: this.selectedObject,
      draft,
      object,
      globalTile: {
        x: (descriptor.chunkX ?? 0) * this.chunkWidth + Math.round(object.x / draft.source.tilewidth),
        y: (descriptor.chunkY ?? 0) * this.chunkHeight + Math.round(object.y / draft.source.tileheight)
      }
    };
  }

  private getObjectAtTile(layer: WorldEditorObjectLayerName, point: Point): SelectedObjectRef | null {
    const context = this.getChunkContextForGlobalTile(point);
    const object = getWorldEditorObjectLayer(context.draft, layer).objects.find(
      (entry) =>
        Math.round(entry.x / context.draft.source.tilewidth) === context.localX &&
        Math.round(entry.y / context.draft.source.tileheight) === context.localY
    );

    if (!object) {
      return null;
    }

    return {
      layer,
      fileName: context.descriptor.fileName,
      objectId: object.id
    };
  }

  private createDefaultObject(layer: WorldEditorObjectLayerName, point: Point): SelectedObjectRef {
    const context = this.getChunkContextForGlobalTile(point);
    const nextId = allocateWorldEditorObjectId(context.draft);
    const tileX = context.localX * context.draft.source.tilewidth;
    const tileY = context.localY * context.draft.source.tileheight;
    const baseRecord: Record<string, WorldEditorPropertyValue> = {};

    switch (layer) {
      case 'props':
        baseRecord.assetId = this.selectedPropAsset;
        break;
      case 'npcs':
        baseRecord.id = this.createUniquePropertyId(layer, `npc-${nextId}`);
        baseRecord.blueprintId = this.blueprintIds[0] ?? 'time-travelers-aion-trooper';
        baseRecord.summary = 'Describe this world NPC.';
        baseRecord.disposition = 'friendly';
        baseRecord.actionKinds = 'talk';
        baseRecord.talkLabel = 'Talk';
        baseRecord.talkTitle = 'New NPC';
        baseRecord.talkBody = 'Add dialogue here.';
        break;
      case 'encounters':
        baseRecord.id = this.createUniquePropertyId(layer, `encounter-${nextId}`);
        baseRecord.levelId = this.levelIds[0] ?? 'broken-chapel';
        baseRecord.label = 'New Encounter';
        baseRecord.clearOnVictory = true;
        break;
      case 'transitions':
        baseRecord.id = this.createUniquePropertyId(layer, `transition-${nextId}`);
        baseRecord.kind = 'door';
        baseRecord.targetKind = 'return';
        baseRecord.label = 'Travel';
        break;
      case 'spawnPoints':
        baseRecord.id = this.createUniquePropertyId(layer, `spawn-${nextId}`);
        break;
      default:
        break;
    }

    const object: WorldEditorTiledObject = {
      id: nextId,
      name: `${OBJECT_LAYER_LABELS[layer].slice(0, -1)} ${nextId}`,
      x: tileX,
      y: tileY,
      width: context.draft.source.tilewidth,
      height: context.draft.source.tileheight,
      rotation: 0,
      type: DEFAULT_OBJECT_TYPES[layer],
      visible: true,
      properties: recordToTiledProperties(baseRecord)
    };

    getWorldEditorObjectLayer(context.draft, layer).objects.push(object);
    this.dirtyFiles.add(context.descriptor.fileName);
    this.rebuildObjectVisuals();
    this.refreshWorldViewportOverlay();

    return {
      layer,
      fileName: context.descriptor.fileName,
      objectId: object.id
    };
  }

  private createUniquePropertyId(layer: WorldEditorObjectLayerName, baseId: string): string {
    const existingIds = new Set(
      this.outdoorDescriptors.flatMap((descriptor) =>
        getWorldEditorObjectLayer(this.getDraft(descriptor.fileName), layer).objects
          .map((object) => getTiledPropertyValue(object.properties, 'id'))
          .filter((value): value is string => typeof value === 'string')
      )
    );

    if (!existingIds.has(baseId)) {
      return baseId;
    }

    let suffix = 2;

    while (existingIds.has(`${baseId}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseId}-${suffix}`;
  }

  private moveSelectedObjectTo(point: Point): void {
    const selected = this.getSelectedObjectEntry();

    if (!selected) {
      return;
    }

    const nextContext = this.getChunkContextForGlobalTile(point);
    const currentContext = this.getChunkContextForGlobalTile(selected.globalTile);

    if (
      currentContext.descriptor.fileName !== nextContext.descriptor.fileName ||
      currentContext.localX !== nextContext.localX ||
      currentContext.localY !== nextContext.localY
    ) {
      removeWorldEditorObject(currentContext.draft, selected.reference.layer, selected.object.id);
      selected.object.x = nextContext.localX * nextContext.draft.source.tilewidth;
      selected.object.y = nextContext.localY * nextContext.draft.source.tileheight;
      getWorldEditorObjectLayer(nextContext.draft, selected.reference.layer).objects.push(selected.object);
      this.selectedObject = {
        ...selected.reference,
        fileName: nextContext.descriptor.fileName
      };
      this.dirtyFiles.add(currentContext.descriptor.fileName);
      this.dirtyFiles.add(nextContext.descriptor.fileName);
      this.rebuildObjectVisuals();
      this.refreshWorldViewportOverlay();
    }
  }

  private markTileEdited(point: Point): void {
    const context = this.getChunkContextForGlobalTile(point);
    this.activeTile = point;
    this.dirtyFiles.add(context.descriptor.fileName);
  }

  private getHeightBrushDelta(invert = false): 1 | -1 {
    const baseDelta = this.selectedHeightDirection === 'raise' ? 1 : -1;
    return invert ? (baseDelta === 1 ? -1 : 1) : baseDelta;
  }

  private isShiftModifierActive(pointer: Phaser.Input.Pointer): boolean {
    return !!(
      pointer.event &&
      'shiftKey' in pointer.event &&
      typeof pointer.event.shiftKey === 'boolean' &&
      pointer.event.shiftKey
    );
  }

  private getMaxWorldHeight(): number {
    let maxHeight = 0;

    for (const tile of this.tileDataByKey.values()) {
      maxHeight = Math.max(maxHeight, tile.height);
    }

    return maxHeight;
  }

  private applyToolAt(point: Point, options?: { invertHeightBrush?: boolean }): void {
    switch (this.activeTool) {
      case 'terrain': {
        const context = this.getChunkContextForGlobalTile(point);
        if (getWorldEditorTerrainAt(context.draft, context.localX, context.localY) !== this.selectedTerrain) {
          setWorldEditorTerrainAt(context.draft, context.localX, context.localY, this.selectedTerrain);
          this.syncTileDataFromDraft(point);
          this.syncTileVisual(point);
          this.markTileEdited(point);
        }
        break;
      }
      case 'heights': {
        const context = this.getChunkContextForGlobalTile(point);
        const currentHeight = getWorldEditorHeightAt(context.draft, context.localX, context.localY) ?? 0;
        const nextHeight = Math.max(0, currentHeight + this.getHeightBrushDelta(options?.invertHeightBrush ?? false));

        if (nextHeight === currentHeight) {
          break;
        }

        const maxHeightBefore = this.getMaxWorldHeight();
        setWorldEditorHeightAt(context.draft, context.localX, context.localY, nextHeight);
        this.markTileEdited(point);

        if (nextHeight > maxHeightBefore || currentHeight === maxHeightBefore) {
          this.rebuildWorldModel();
          this.rebuildWorldVisuals();
        } else {
          this.syncTileDataFromDraft(point);
          this.syncTileVisual(point);
          this.rebuildWallVisuals();
          this.rebuildObjectVisuals();
          this.refreshWorldViewportOverlay();
        }

        this.statusMessage = `Height ${nextHeight > currentHeight ? 'raised' : 'lowered'} to ${nextHeight} at ${point.x},${point.y}.`;
        break;
      }
      default:
        break;
    }
  }

  private rebuildWorldVisuals(): void {
    this.destroyWorldVisuals();
    this.rebuildTerrainVisuals();
    this.rebuildWallVisuals();
    this.rebuildObjectVisuals();
    if (this.needsInitialWorldFit && this.worldViewportRect.width > 0 && this.worldViewportRect.height > 0) {
      this.fitWorldCamera();
      this.needsInitialWorldFit = false;
    }
    this.updateWorldCameraTransform();
    this.refreshWorldViewportOverlay();
  }

  private rebuildTerrainVisuals(): void {
    const tiles = [...this.tileDataByKey.values()].sort((left, right) => this.getTileDepth(left) - this.getTileDepth(right));

    for (const tile of tiles) {
      const point = this.isoToScreen(tile);
      const image = this.add.image(point.x, point.y, getTerrainTileAssetKey(tile)).setOrigin(0.5, 0.5);
      image.setDisplaySize(TILE_WIDTH, TILE_WIDTH);
      image.setData('tileX', tile.x);
      image.setData('tileY', tile.y);
      this.terrainContainer.add(image);
      this.terrainImages.set(tileKey(tile), image);
    }
  }

  private rebuildWallVisuals(): void {
    this.clearContainer(this.wallContainer);
    this.worldBoardGraphics = this.add.graphics();
    this.wallContainer.add(this.worldBoardGraphics);
    this.wallGraphics = redrawBoardWalls({
      boardGraphics: this.worldBoardGraphics,
      wallGraphics: [],
      createWallGraphics: () => {
        const graphics = this.add.graphics();
        this.wallContainer.add(graphics);
        return graphics;
      },
      map: [...this.tileDataByKey.values()],
      boardRotationStep: 0,
      getTileDepth: (tile) => this.getTileDepth(tile),
      getTileTopPoints: (tile) => this.getTileTopPoints(tile)
    });
  }

  private rebuildObjectVisuals(): void {
    this.clearContainer(this.propContainer);
    this.clearContainer(this.actorContainer);
    this.clearContainer(this.markerContainer);
    this.propVisuals.clear();
    this.npcVisuals.clear();
    this.markerVisuals = [];

    const props = this.collectWorldObjects('props').sort((left, right) => this.getTileDepth(left.tile) - this.getTileDepth(right.tile));

    for (const prop of props) {
      if (!prop.assetId) {
        continue;
      }

      const config = PROP_RENDER_CONFIG[prop.assetId];
      const base = this.add.graphics();
      const image = this.add.image(0, 0, prop.assetId).setOrigin(0.5, 1);
      image.displayHeight = config.height;
      image.scaleX = image.scaleY;
      if (image.displayWidth < config.minWidth) {
        image.displayWidth = config.minWidth;
        image.scaleY = image.scaleX;
      }
      this.propContainer.add([base, image]);
      this.propVisuals.set(prop.object.id, { id: prop.object.id, tile: prop.tile, base, image });
      this.positionPropVisual(prop.object.id, prop.tile, prop.assetId);
    }

    const npcs = this.collectWorldObjects('npcs').sort((left, right) => this.getTileDepth(left.tile) - this.getTileDepth(right.tile));

    for (const npc of npcs) {
      const spriteKey = this.getNpcSpriteKey(npc.object);
      const spriteHeight = this.getNpcSpriteHeight(npc.object);
      const groundPoint = this.getUnitGroundPoint(npc.tile);
      const image = this.add.image(groundPoint.x, groundPoint.y, spriteKey).setOrigin(0.5, 1);
      image.displayHeight = spriteHeight;
      image.scaleX = image.scaleY;
      image.x += this.getNpcSpriteOffset(npc.object).x;
      image.y += this.getNpcSpriteOffset(npc.object).y;
      this.actorContainer.add(image);
      this.npcVisuals.set(npc.object.id, { id: npc.object.id, tile: npc.tile, image });
    }

    for (const layer of (['encounters', 'transitions', 'spawnPoints'] as const)) {
      const markers = this.collectWorldObjects(layer);

      for (const marker of markers) {
        const objects = this.createMarkerObjects(layer, marker.tile, marker.object);
        this.markerContainer.add(objects);
        this.markerVisuals.push({
          id: `${layer}:${marker.object.id}`,
          tile: marker.tile,
          objects
        });
      }
    }
  }

  private collectWorldObjects(layer: WorldEditorObjectLayerName): Array<{
    descriptor: WorldEditorMapDescriptor;
    draft: WorldEditorMapDraft;
    object: WorldEditorTiledObject;
    tile: TileData;
    assetId?: MapPropAssetId;
  }> {
    return this.outdoorDescriptors.flatMap((descriptor) => {
      const draft = this.getDraft(descriptor.fileName);
      return getWorldEditorObjectLayer(draft, layer).objects.flatMap((object) => {
        const tile = this.getTileData({
          x: (descriptor.chunkX ?? 0) * this.chunkWidth + Math.round(object.x / draft.source.tilewidth),
          y: (descriptor.chunkY ?? 0) * this.chunkHeight + Math.round(object.y / draft.source.tileheight)
        });

        if (!tile) {
          return [];
        }

        return [{
          descriptor,
          draft,
          object,
          tile,
          assetId: layer === 'props' ? (getTiledPropertyValue(object.properties, 'assetId') as MapPropAssetId) : undefined
        }];
      });
    });
  }

  private positionPropVisual(propId: number, tile: TileData, assetId: MapPropAssetId): void {
    const visual = this.propVisuals.get(propId);

    if (!visual) {
      return;
    }

    const config = PROP_RENDER_CONFIG[assetId];
    const point = this.isoToScreen(tile);
    const imageX = point.x + (config.offsetX ?? 0);
    const groundOffsetY = config.groundOffsetY ?? (TILE_HEIGHT / 2 + 2);
    const basePoints = this.scaleTilePolygon(this.getTileTopPoints(tile), point, 0.98);

    visual.base.clear();
    visual.base.fillStyle(config.baseFill, config.baseAlpha);
    visual.base.fillPoints(basePoints, true);
    visual.base.lineStyle(2, config.rim, config.rimAlpha);
    visual.base.strokePoints(basePoints, true, true);
    visual.image.setPosition(imageX, point.y + groundOffsetY);
  }

  private createMarkerObjects(
    layer: 'encounters' | 'transitions' | 'spawnPoints',
    tile: TileData,
    object: WorldEditorTiledObject
  ): Phaser.GameObjects.GameObject[] {
    const center = this.isoToScreen(tile);
    const tilePoints = this.scaleTilePolygon(this.getTileTopPoints(tile), center, 0.82);
    const marker = this.add.graphics();
    const color = OBJECT_LAYER_COLORS[layer];
    marker.fillStyle(0x120d14, 0.55);
    marker.fillPoints(tilePoints, true);
    marker.lineStyle(2, color, 0.95);
    marker.strokePoints(tilePoints, true, true);

    switch (layer) {
      case 'encounters':
        marker.lineStyle(3, color, 0.95);
        marker.lineBetween(center.x - 10, center.y, center.x + 10, center.y);
        marker.lineBetween(center.x, center.y - 10, center.x, center.y + 10);
        break;
      case 'transitions':
        marker.lineStyle(3, color, 0.95);
        marker.lineBetween(center.x - 10, center.y + 4, center.x, center.y - 8);
        marker.lineBetween(center.x + 10, center.y + 4, center.x, center.y - 8);
        break;
      case 'spawnPoints':
        marker.fillStyle(color, 0.95);
        marker.fillCircle(center.x, center.y, 5);
        marker.fillStyle(0x120d14, 1);
        marker.fillCircle(center.x, center.y, 2);
        break;
      default:
        break;
    }

    const labelText =
      (typeof getTiledPropertyValue(object.properties, 'id') === 'string'
        ? String(getTiledPropertyValue(object.properties, 'id'))
        : object.name ?? OBJECT_LAYER_LABELS[layer].slice(0, -1)
      ).slice(0, 18);
    const label = this.add.text(center.x, center.y - 24, labelText, {
      ...UI_TEXT_LABEL,
      fontSize: '11px',
      color: '#f7edd9',
      stroke: '#040203',
      strokeThickness: 4
    }).setOrigin(0.5);

    return [marker, label];
  }

  private refreshWorldViewportOverlay(): void {
    this.worldViewportOverlay.clear();

    if (this.hoverTile) {
      this.drawViewportTileOutline(this.hoverTile, 0x9ad7f2, 0.9, 2);
    }

    if (this.activeTile) {
      this.drawViewportTileOutline(this.activeTile, 0xffd36b, 0.74, 2);
    }

    const selected = this.getSelectedObjectEntry();

    if (selected) {
      this.drawViewportTileOutline(selected.globalTile, 0xffefc3, 0.95, 3);
    }
  }

  private drawViewportTileOutline(point: Point, color: number, alpha: number, thickness: number): void {
    const tile = this.getTileData(point);

    if (!tile) {
      return;
    }

    const points = this.getTileTopPoints(tile);
    this.worldViewportOverlay.lineStyle(thickness, color, alpha);
    this.worldViewportOverlay.strokePoints(points, true, true);
  }

  private fitWorldCamera(): void {
    const viewportWidth = Math.max(1, this.worldViewportRect.width);
    const viewportHeight = Math.max(1, this.worldViewportRect.height);
    const fitZoom = Math.min(viewportWidth / this.worldBounds.width, viewportHeight / this.worldBounds.height);
    this.worldZoom = Phaser.Math.Clamp(Math.max(fitZoom * 1.05, WORLD_CAMERA_DEFAULT_ZOOM), WORLD_CAMERA_MIN_ZOOM, WORLD_CAMERA_MAX_ZOOM);
    this.worldCameraCenter.set(this.worldBounds.centerX, this.worldBounds.centerY);
  }

  private updateWorldCameraTransform(): void {
    if (this.worldViewportRect.width <= 0 || this.worldViewportRect.height <= 0) {
      return;
    }

    this.worldRoot.setScale(this.worldZoom);
    this.worldRoot.setPosition(
      this.worldViewportRect.centerX - this.worldCameraCenter.x * this.worldZoom,
      this.worldViewportRect.centerY - this.worldCameraCenter.y * this.worldZoom
    );
    this.worldViewportOverlay.setScale(this.worldZoom);
    this.worldViewportOverlay.setPosition(this.worldRoot.x, this.worldRoot.y);
  }

  private zoomWorldCamera(delta: number, screenX: number, screenY: number): void {
    const before = this.getWorldLocalPointFromScreen(screenX, screenY);
    const nextZoom = Phaser.Math.Clamp(this.worldZoom * (delta > 0 ? 0.92 : 1.08), WORLD_CAMERA_MIN_ZOOM, WORLD_CAMERA_MAX_ZOOM);

    if (nextZoom === this.worldZoom) {
      return;
    }

    this.worldZoom = nextZoom;

    if (before) {
      this.worldCameraCenter.set(
        before.x - (screenX - this.worldViewportRect.centerX) / this.worldZoom,
        before.y - (screenY - this.worldViewportRect.centerY) / this.worldZoom
      );
    }

    this.updateWorldCameraTransform();
    this.refreshScene();
  }

  private getWorldLocalPointFromScreen(screenX: number, screenY: number): Phaser.Math.Vector2 | null {
    if (!this.worldViewportRect.contains(screenX, screenY) || this.worldZoom <= 0) {
      return null;
    }

    return new Phaser.Math.Vector2(
      (screenX - this.worldRoot.x) / this.worldZoom,
      (screenY - this.worldRoot.y) / this.worldZoom
    );
  }

  private getTileAtViewportScreenPosition(screenX: number, screenY: number): Point | null {
    const local = this.getWorldLocalPointFromScreen(screenX, screenY);

    if (!local) {
      return null;
    }

    const approxA = (local.x - this.worldLayout.origin.x) / (TILE_WIDTH / 2);
    const approxB = (local.y - this.worldLayout.origin.y) / (TILE_HEIGHT / 2);
    const approxX = Math.round((approxA + approxB) / 2);
    const approxY = Math.round((approxB - approxA) / 2);
    const candidates: TileData[] = [];

    for (let y = approxY - 3; y <= approxY + 3; y += 1) {
      for (let x = approxX - 3; x <= approxX + 3; x += 1) {
        const tile = this.getTileData({ x, y });

        if (tile) {
          candidates.push(tile);
        }
      }
    }

    candidates.sort((left, right) => this.getTileDepth(right) - this.getTileDepth(left));

    for (const tile of candidates) {
      const polygon = new Phaser.Geom.Polygon(this.getTileTopPoints(tile).map((point) => ({ x: point.x, y: point.y })));

      if (Phaser.Geom.Polygon.Contains(polygon, local.x, local.y)) {
        return { x: tile.x, y: tile.y };
      }
    }

    return null;
  }

  private handleWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    const pointer = this.input.activePointer;

    if (!this.worldViewportRect.contains(pointer.x, pointer.y)) {
      return;
    }

    this.zoomWorldCamera(deltaY, pointer.x, pointer.y);
  }

  private refreshScene(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const margin = UI_SCREEN_MARGIN;
    const headerHeight = 76;
    const footerHeight = 112;
    const leftWidth = Phaser.Math.Clamp(width * 0.18, 190, 230);
    const rightWidth = Phaser.Math.Clamp(width * 0.25, 280, 340);
    const contentY = margin + headerHeight + UI_PANEL_GAP;
    const contentHeight = height - contentY - footerHeight - margin - UI_PANEL_GAP;

    this.headerRect.setTo(margin, margin, width - margin * 2, headerHeight);
    this.footerRect.setTo(margin, height - margin - footerHeight, width - margin * 2, footerHeight);
    this.leftPanelRect.setTo(margin, contentY, leftWidth, contentHeight);
    this.rightPanelRect.setTo(width - margin - rightWidth, contentY, rightWidth, contentHeight);
    this.centerPanelRect.setTo(
      this.leftPanelRect.right + UI_PANEL_GAP,
      contentY,
      this.rightPanelRect.x - (this.leftPanelRect.right + UI_PANEL_GAP) - UI_PANEL_GAP,
      contentHeight
    );

    this.shade.setSize(width, height);
    this.shade.setPosition(0, 0);
    this.fitBackdrop(this.backdrop, width, height);

    this.panelGraphics.clear();
    this.worldGraphics.clear();
    this.overlayGraphics.clear();
    this.clearDynamicTexts();
    this.headerButtonViews = [];
    this.toolButtonViews = [];
    this.paletteButtonViews = [];
    this.actionButtonViews = [];

    BattleUiChrome.drawPlaqueShell(this.panelGraphics, this.headerRect, {
      accentColor: UI_COLOR_ACCENT_WARM,
      headerHeight: 32,
      radius: 22
    });
    BattleUiChrome.drawPlaqueShell(this.panelGraphics, this.leftPanelRect, {
      accentColor: UI_COLOR_ACCENT_NEUTRAL,
      headerHeight: 30,
      radius: 20
    });
    BattleUiChrome.drawPlaqueShell(this.panelGraphics, this.centerPanelRect, {
      accentColor: UI_COLOR_ACCENT_WARM,
      headerHeight: 30,
      radius: 20
    });
    BattleUiChrome.drawPlaqueShell(this.panelGraphics, this.rightPanelRect, {
      accentColor: UI_COLOR_ACCENT_COOL,
      headerHeight: 30,
      radius: 20
    });
    BattleUiChrome.drawPlaqueShell(this.panelGraphics, this.footerRect, {
      accentColor: UI_COLOR_ACCENT_NEUTRAL,
      headerHeight: 28,
      radius: 20
    });

    this.layoutHeader();
    this.layoutLeftPanel();
    this.layoutCenterPanel();
    this.layoutRightPanel();
    this.layoutFooter();
  }

  private layoutHeader(): void {
    const content = BattleUiChrome.getContentBounds(this.headerRect);
    const headerCenterY = BattleUiChrome.getHeaderCenterY(this.headerRect);
    this.titleText.setPosition(content.x, headerCenterY);
    this.subtitleText.setPosition(content.x + 250, headerCenterY);
    this.subtitleText.setText(`Outdoor world: ${this.worldWidth} x ${this.worldHeight} tiles across ${this.outdoorDescriptors.length} chunks.`);

    const buttonTop = headerCenterY - HEADER_BUTTON_HEIGHT / 2;
    const buttonLabels: Array<{ id: HeaderButtonId; label: string; enabled: boolean }> = [
      { id: 'download-archive', label: 'Download Archive', enabled: true },
      { id: 'copy-archive', label: 'Copy Archive', enabled: true },
      { id: 'back', label: 'Back', enabled: true }
    ];

    buttonLabels.forEach(({ id, label, enabled }, index) => {
      const bounds = new Phaser.Geom.Rectangle(
        this.headerRect.right - 22 - HEADER_BUTTON_WIDTH * (index + 1) - 10 * index,
        buttonTop,
        HEADER_BUTTON_WIDTH,
        HEADER_BUTTON_HEIGHT
      );
      this.headerButtonViews.push({ id, bounds, enabled });
      this.drawButton(bounds, label, {
        active: false,
        enabled,
        accentColor: id === 'back' ? UI_COLOR_ACCENT_NEUTRAL : UI_COLOR_ACCENT_WARM
      });
    });
  }

  private layoutLeftPanel(): void {
    const content = BattleUiChrome.getContentBounds(this.leftPanelRect);
    const title = this.addDynamicText(content.x, this.leftPanelRect.y + 14, 'TOOLS', UI_TEXT_LABEL);
    title.setOrigin(0, 0);

    let cursorY = content.y;

    for (const tool of TOOL_ORDER) {
      const bounds = new Phaser.Geom.Rectangle(content.x, cursorY, content.width, TOOL_BUTTON_HEIGHT);
      this.toolButtonViews.push({ value: tool, bounds, enabled: true });
      this.drawButton(bounds, TOOL_LABELS[tool], {
        active: this.activeTool === tool,
        enabled: true,
        accentColor: TOOL_ACCENTS[tool]
      });
      cursorY += TOOL_BUTTON_HEIGHT + TOOL_BUTTON_GAP;
    }

    cursorY += 14;
    const paletteTitle = this.addDynamicText(content.x, cursorY, 'PALETTE', UI_TEXT_LABEL);
    paletteTitle.setOrigin(0, 0);
    cursorY += 24;

    const paletteValues = this.getPaletteValues();

    for (const value of paletteValues) {
      const bounds = new Phaser.Geom.Rectangle(content.x, cursorY, content.width, TOOL_BUTTON_HEIGHT);
      const selected = this.isPaletteSelected(value);
      this.paletteButtonViews.push({ value, bounds, enabled: true });
      this.drawButton(bounds, this.getPaletteLabel(value), {
        active: selected,
        enabled: true,
        accentColor: this.getPaletteAccent(value)
      });
      cursorY += TOOL_BUTTON_HEIGHT + 6;
    }

    cursorY += 18;
    const legendTitle = this.addDynamicText(content.x, cursorY, 'LEGEND', UI_TEXT_LABEL);
    legendTitle.setOrigin(0, 0);
    cursorY += 22;

    for (const layer of OBJECT_LAYER_ORDER) {
      const lineY = cursorY + 8;
      this.panelGraphics.fillStyle(OBJECT_LAYER_COLORS[layer], 0.95);
      this.panelGraphics.fillCircle(content.x + 8, lineY, 5);
      const label = this.addDynamicText(content.x + 20, cursorY, OBJECT_LAYER_LABELS[layer], UI_TEXT_BODY);
      label.setOrigin(0, 0);
      cursorY += 22;
    }
  }

  private layoutCenterPanel(): void {
    const content = BattleUiChrome.getContentBounds(this.centerPanelRect);
    const focusContext = this.getFocusContext();
    const boardTop = content.y + 28;
    const boardAvailableHeight = content.height - 34;

    this.addDynamicText(content.x, this.centerPanelRect.y + 14, 'OVERWORLD VIEW', UI_TEXT_LABEL).setOrigin(0, 0);
    this.addDynamicText(
      content.x,
      content.y,
      `${focusContext.descriptor.displayName}  |  chunk ${focusContext.chunkX},${focusContext.chunkY}  |  zoom ${Math.round(
        this.worldZoom * 100
      )}%${this.dirtyFiles.has(focusContext.descriptor.fileName) ? '  |  edited' : ''}`,
      UI_TEXT_BODY
    ).setOrigin(0, 0);

    this.worldViewportRect.setTo(
      Math.round(content.x),
      Math.round(boardTop),
      Math.round(content.width),
      Math.round(boardAvailableHeight)
    );
    BattleUiChrome.drawInsetBox(this.panelGraphics, this.worldViewportRect, {
      fillAlpha: 0.18,
      radius: 16
    });
    this.worldViewportMaskGraphics.clear();
    this.worldViewportMaskGraphics.fillStyle(0xffffff, 1);
    this.worldViewportMaskGraphics.fillRect(
      this.worldViewportRect.x,
      this.worldViewportRect.y,
      this.worldViewportRect.width,
      this.worldViewportRect.height
    );
    if (this.needsInitialWorldFit) {
      this.fitWorldCamera();
      this.needsInitialWorldFit = false;
    }
    this.updateWorldCameraTransform();
    this.refreshWorldViewportOverlay();
  }

  private drawWorldBoard(): void {
    this.worldGraphics.fillStyle(0x0b080b, 0.92);
    this.worldGraphics.fillRoundedRect(
      this.worldBoardRect.x - 10,
      this.worldBoardRect.y - 10,
      this.worldBoardRect.width + 20,
      this.worldBoardRect.height + 20,
      16
    );
    this.worldGraphics.lineStyle(1, UI_COLOR_PANEL_BORDER, 0.34);
    this.worldGraphics.strokeRoundedRect(
      this.worldBoardRect.x - 10,
      this.worldBoardRect.y - 10,
      this.worldBoardRect.width + 20,
      this.worldBoardRect.height + 20,
      16
    );

    for (let globalY = 0; globalY < this.worldHeight; globalY += 1) {
      for (let globalX = 0; globalX < this.worldWidth; globalX += 1) {
        const context = this.getChunkContextForGlobalTile({ x: globalX, y: globalY });
        const terrain = getWorldEditorTerrainAt(context.draft, context.localX, context.localY) ?? 'stone';
        const height = getWorldEditorHeightAt(context.draft, context.localX, context.localY) ?? 0;
        const palette = getTerrainPalette(terrain);
        const tileColor = height > 0 ? mixColor(palette.top, 0xf7edd9, 0.2) : palette.top;
        const tileX = this.worldBoardRect.x + globalX * this.worldCellSize;
        const tileY = this.worldBoardRect.y + globalY * this.worldCellSize;

        this.worldGraphics.fillStyle(tileColor, 1);
        this.worldGraphics.fillRect(tileX, tileY, this.worldCellSize, this.worldCellSize);
        this.worldGraphics.lineStyle(1, mixColor(palette.outline, 0x000000, 0.24), 0.18);
        this.worldGraphics.strokeRect(tileX, tileY, this.worldCellSize, this.worldCellSize);

        if (height > 0) {
          this.worldGraphics.fillStyle(mixColor(palette.detail, 0xffffff, 0.42), 0.82);
          this.worldGraphics.fillRect(tileX + 1, tileY + 1, Math.max(1, this.worldCellSize - 2), 2);
        }
      }
    }

    this.drawChunkGuides();
    this.drawObjectMarkers();
    this.drawSelectionHighlights();
  }

  private drawChunkGuides(): void {
    this.overlayGraphics.lineStyle(1, 0xf5ddb0, 0.24);

    for (let chunkX = 0; chunkX <= this.worldWidth / this.chunkWidth; chunkX += 1) {
      const x = this.worldBoardRect.x + chunkX * this.chunkWidth * this.worldCellSize;
      this.overlayGraphics.lineBetween(x, this.worldBoardRect.y, x, this.worldBoardRect.bottom);
    }

    for (let chunkY = 0; chunkY <= this.worldHeight / this.chunkHeight; chunkY += 1) {
      const y = this.worldBoardRect.y + chunkY * this.chunkHeight * this.worldCellSize;
      this.overlayGraphics.lineBetween(this.worldBoardRect.x, y, this.worldBoardRect.right, y);
    }

    for (const descriptor of this.outdoorDescriptors) {
      const chunkX = descriptor.chunkX ?? 0;
      const chunkY = descriptor.chunkY ?? 0;
      const labelX = this.worldBoardRect.x + chunkX * this.chunkWidth * this.worldCellSize + 4;
      const labelY = this.worldBoardRect.y + chunkY * this.chunkHeight * this.worldCellSize + 4;
      const label = this.addDynamicText(
        labelX,
        labelY,
        `${chunkX},${chunkY}${this.dirtyFiles.has(descriptor.fileName) ? ' *' : ''}`,
        {
          ...UI_TEXT_LABEL,
          fontSize: `${Math.max(9, Math.round(this.worldCellSize * 1.2))}px`
        }
      );
      label.setOrigin(0, 0);
    }
  }

  private drawObjectMarkers(): void {
    for (const layer of OBJECT_LAYER_ORDER) {
      for (const descriptor of this.outdoorDescriptors) {
        const draft = this.getDraft(descriptor.fileName);
        const objects = getWorldEditorObjectLayer(draft, layer).objects;

        for (const object of objects) {
          const x = (descriptor.chunkX ?? 0) * this.chunkWidth + Math.round(object.x / draft.source.tilewidth);
          const y = (descriptor.chunkY ?? 0) * this.chunkHeight + Math.round(object.y / draft.source.tileheight);
          const centerX = this.worldBoardRect.x + x * this.worldCellSize + this.worldCellSize / 2;
          const centerY = this.worldBoardRect.y + y * this.worldCellSize + this.worldCellSize / 2;
          const size = Math.max(3, Math.round(this.worldCellSize * 0.36));
          const selected =
            this.selectedObject?.layer === layer &&
            this.selectedObject.fileName === descriptor.fileName &&
            this.selectedObject.objectId === object.id;
          const alpha = this.activeTool === layer ? 1 : 0.78;
          const color = OBJECT_LAYER_COLORS[layer];

          this.overlayGraphics.fillStyle(color, alpha);

          switch (layer) {
            case 'props':
              this.overlayGraphics.fillRect(centerX - size, centerY - size, size * 2, size * 2);
              break;
            case 'npcs':
              this.overlayGraphics.fillCircle(centerX, centerY, size);
              break;
            case 'encounters':
              this.overlayGraphics.fillPoints(
                [
                  new Phaser.Geom.Point(centerX, centerY - size),
                  new Phaser.Geom.Point(centerX + size, centerY),
                  new Phaser.Geom.Point(centerX, centerY + size),
                  new Phaser.Geom.Point(centerX - size, centerY)
                ],
                true
              );
              break;
            case 'transitions':
              this.overlayGraphics.fillTriangle(
                centerX,
                centerY - size - 1,
                centerX + size,
                centerY + size,
                centerX - size,
                centerY + size
              );
              break;
            case 'spawnPoints':
              this.overlayGraphics.fillCircle(centerX, centerY, size);
              this.overlayGraphics.fillStyle(0x0b080b, 1);
              this.overlayGraphics.fillCircle(centerX, centerY, Math.max(1, size - 2));
              break;
            default:
              break;
          }

          if (selected) {
            this.overlayGraphics.lineStyle(2, 0xf7edd9, 0.94);
            this.overlayGraphics.strokeCircle(centerX, centerY, size + 3);
          }
        }
      }
    }
  }

  private drawSelectionHighlights(): void {
    if (this.hoverTile) {
      this.drawTileOutline(this.hoverTile, 0xf7edd9, 0.72, 2);
    }

    const selected = this.getSelectedObjectEntry();

    if (selected) {
      this.drawTileOutline(selected.globalTile, 0xffd36b, 0.84, 2);
    } else if (this.activeTile) {
      this.drawTileOutline(this.activeTile, 0xffd36b, 0.72, 2);
    }
  }

  private drawTileOutline(point: Point, color: number, alpha: number, thickness: number): void {
    const x = this.worldBoardRect.x + point.x * this.worldCellSize;
    const y = this.worldBoardRect.y + point.y * this.worldCellSize;
    this.overlayGraphics.lineStyle(thickness, color, alpha);
    this.overlayGraphics.strokeRect(x, y, this.worldCellSize, this.worldCellSize);
  }

  private layoutRightPanel(): void {
    const content = BattleUiChrome.getContentBounds(this.rightPanelRect);
    const selected = this.getSelectedObjectEntry();
    const focus = this.getFocusContext();
    const draft = focus.draft;
    const counts = Object.fromEntries(
      OBJECT_LAYER_ORDER.map((layer) => [layer, getWorldEditorObjectLayer(draft, layer).objects.length])
    ) as Record<WorldEditorObjectLayerName, number>;

    this.addDynamicText(content.x, this.rightPanelRect.y + 14, 'OVERVIEW', UI_TEXT_LABEL).setOrigin(0, 0);

    const overviewHeight = Math.min(184, Math.round(content.height * 0.32));
    this.worldCellSize = Math.max(
      4,
      Math.floor(Math.min(content.width / this.worldWidth, overviewHeight / this.worldHeight))
    );
    this.minimapRect.setTo(
      Math.round(content.centerX - (this.worldWidth * this.worldCellSize) / 2),
      Math.round(content.y),
      this.worldWidth * this.worldCellSize,
      this.worldHeight * this.worldCellSize
    );
    this.worldBoardRect.setTo(
      this.minimapRect.x,
      this.minimapRect.y,
      this.minimapRect.width,
      this.minimapRect.height
    );
    this.drawWorldBoard();

    const viewportMarker = new Phaser.Geom.Rectangle(
      this.worldBoardRect.x +
        ((this.worldCameraCenter.x - this.worldViewportRect.width / (2 * this.worldZoom)) - this.worldBounds.x) *
          (this.worldBoardRect.width / this.worldWidth),
      this.worldBoardRect.y +
        ((this.worldCameraCenter.y - this.worldViewportRect.height / (2 * this.worldZoom)) - this.worldBounds.y) *
          (this.worldBoardRect.height / this.worldHeight),
      Math.max(10, (this.worldViewportRect.width / this.worldZoom) * (this.worldBoardRect.width / this.worldBounds.width)),
      Math.max(10, (this.worldViewportRect.height / this.worldZoom) * (this.worldBoardRect.height / this.worldBounds.height))
    );
    this.overlayGraphics.lineStyle(2, 0xf7edd9, 0.75);
    this.overlayGraphics.strokeRect(viewportMarker.x, viewportMarker.y, viewportMarker.width, viewportMarker.height);

    const detailsHeaderY = this.worldBoardRect.bottom + 18;
    this.addDynamicText(content.x, detailsHeaderY, 'DETAILS', UI_TEXT_LABEL).setOrigin(0, 0);

    const detailText = this.addDynamicText(
      content.x,
      detailsHeaderY + 20,
      [
        `Chunk: ${focus.chunkX},${focus.chunkY}`,
        `Name: ${focus.descriptor.displayName}`,
        `File: ${focus.descriptor.fileName}`,
        `Tile: ${focus.localX},${focus.localY} (global ${this.getFocusTile().x},${this.getFocusTile().y})`,
        `Terrain: ${getWorldEditorTerrainAt(draft, focus.localX, focus.localY) ?? 'unknown'}`,
        `Height: ${getWorldEditorHeightAt(draft, focus.localX, focus.localY) ?? 'unknown'}`,
        `Height brush: ${HEIGHT_BRUSH_LABELS[this.selectedHeightDirection]}`,
        `Props ${counts.props}  |  NPCs ${counts.npcs}`,
        `Encounters ${counts.encounters}  |  Transitions ${counts.transitions}  |  Spawns ${counts.spawnPoints}`
      ].join('\n'),
      {
        ...UI_TEXT_BODY,
        wordWrap: { width: content.width }
      }
    );
    detailText.setOrigin(0, 0);

    let cursorY = detailText.y + detailText.height + 18;

    if (selected) {
      const record = tiledPropertiesToRecord(selected.object.properties);
      const propertyLines = Object.entries(record)
        .slice(0, 8)
        .map(([name, value]) => `${name}: ${String(value)}`);
      const objectText = this.addDynamicText(
        content.x,
        cursorY,
        [
          `Selected ${OBJECT_LAYER_LABELS[selected.reference.layer].slice(0, -1)} at ${selected.globalTile.x},${selected.globalTile.y}`,
          `Name: ${selected.object.name ?? '(unnamed)'}`,
          `Type: ${selected.object.type ?? '(none)'}`,
          ...propertyLines
        ].join('\n'),
        {
          ...UI_TEXT_BODY,
          wordWrap: { width: content.width }
        }
      );
      objectText.setOrigin(0, 0);
      cursorY = objectText.y + objectText.height + 18;
    } else {
      const emptyText = this.addDynamicText(
        content.x,
        cursorY,
        'No object selected. Switch to an object layer and click a tile to create or select one.',
        {
          ...UI_TEXT_BODY,
          wordWrap: { width: content.width }
        }
      );
      emptyText.setOrigin(0, 0);
      cursorY = emptyText.y + emptyText.height + 18;
    }

    const actionButtons: Array<{ id: ActionButtonId; label: string; enabled: boolean; accentColor: number }> = [
      { id: 'edit-chunk', label: 'Edit Chunk Info', enabled: true, accentColor: UI_COLOR_ACCENT_WARM },
      {
        id: 'edit-object',
        label: 'Edit Selected Object',
        enabled: !!selected,
        accentColor: UI_COLOR_ACCENT_COOL
      },
      {
        id: 'duplicate-object',
        label: 'Duplicate Object',
        enabled: !!selected,
        accentColor: UI_COLOR_ACCENT_NEUTRAL
      },
      {
        id: 'delete-object',
        label: 'Delete Object',
        enabled: !!selected,
        accentColor: UI_COLOR_ACCENT_DANGER
      },
      { id: 'reset-chunk', label: 'Reset Focus Chunk', enabled: true, accentColor: UI_COLOR_ACCENT_NEUTRAL }
    ];

    for (const button of actionButtons) {
      const bounds = new Phaser.Geom.Rectangle(content.x, cursorY, content.width, ACTION_BUTTON_HEIGHT);
      this.actionButtonViews.push({ id: button.id, bounds, enabled: button.enabled });
      this.drawButton(bounds, button.label, {
        active: false,
        enabled: button.enabled,
        accentColor: button.accentColor
      });
      cursorY += ACTION_BUTTON_HEIGHT + ACTION_BUTTON_GAP;
    }
  }

  private layoutFooter(): void {
    const content = BattleUiChrome.getContentBounds(this.footerRect);
    this.statusText.setPosition(content.x, content.y - 2);
    this.statusText.setWordWrapWidth(content.width);
    this.statusText.setText(this.statusMessage);

    this.hintText.setPosition(content.x, this.statusText.y + this.statusText.height + 8);
    this.hintText.setWordWrapWidth(content.width);
    this.hintText.setText(
      'Shortcuts: T terrain, H height, P props, N NPCs, O encounters, R transitions, S spawns, E edit object, Delete remove, C copy archive, D download archive, Esc back. Height tool: Raise/Lower from the palette, or hold Shift to invert while dragging.'
    );
  }

  private getPaletteValues(): PaletteValue[] {
    const focusDraft = this.getFocusContext().draft;

    switch (this.activeTool) {
      case 'terrain':
        return [...focusDraft.descriptor.terrainOptions];
      case 'heights':
        return [...HEIGHT_BRUSH_VALUES];
      case 'props':
        return [...PROP_ASSET_IDS];
      default:
        return [];
    }
  }

  private isPaletteSelected(value: PaletteValue): boolean {
    switch (this.activeTool) {
      case 'terrain':
        return value === this.selectedTerrain;
      case 'heights':
        return value === this.selectedHeightDirection;
      case 'props':
        return value === this.selectedPropAsset;
      default:
        return false;
    }
  }

  private getPaletteLabel(value: PaletteValue): string {
    if (value === 'raise' || value === 'lower') {
      return HEIGHT_BRUSH_LABELS[value];
    }

    if (typeof value === 'string' && PROP_ASSET_IDS.includes(value as MapPropAssetId)) {
      return PROP_LABELS[value as MapPropAssetId];
    }

    return String(value).replace(/(^|-)([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
  }

  private getPaletteAccent(value: PaletteValue): number {
    if (value === 'raise') {
      return UI_COLOR_ACCENT_WARM;
    }

    if (value === 'lower') {
      return UI_COLOR_ACCENT_COOL;
    }

    if (typeof value === 'string' && PROP_ASSET_IDS.includes(value as MapPropAssetId)) {
      return UI_COLOR_ACCENT_WARM;
    }

    return TOOL_ACCENTS[this.activeTool];
  }

  private drawButton(
    bounds: Phaser.Geom.Rectangle,
    label: string,
    options: {
      active: boolean;
      enabled: boolean;
      accentColor: number;
    }
  ): void {
    BattleUiChrome.drawPill(this.panelGraphics, bounds, {
      fillColor: options.enabled
        ? (options.active ? mixColor(options.accentColor, 0xffffff, 0.12) : options.accentColor)
        : 0x30242a,
      strokeColor: options.enabled ? UI_COLOR_PANEL_BORDER : 0x6e5d68,
      fillAlpha: options.enabled ? (options.active ? 0.94 : 0.78) : 0.38,
      strokeAlpha: options.enabled ? 0.38 : 0.2,
      radius: 12
    });

    const labelText = this.addDynamicText(bounds.centerX, bounds.centerY, label, {
      ...UI_TEXT_ACTION,
      color: options.enabled ? '#f7edd9' : '#9a8463',
      align: 'center'
    });
    labelText.setOrigin(0.5);
  }

  private addDynamicText(
    x: number,
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const nextText = this.add.text(x, y, text, style).setDepth(12);
    this.dynamicTexts.push(nextText);
    return nextText;
  }

  private clearDynamicTexts(): void {
    for (const text of this.dynamicTexts) {
      text.destroy();
    }

    this.dynamicTexts = [];
  }

  private getTileAtScreenPosition(x: number, y: number): Point | null {
    const viewportTile = this.getTileAtViewportScreenPosition(x, y);

    if (viewportTile) {
      return viewportTile;
    }

    if (!this.worldBoardRect.contains(x, y)) {
      return null;
    }

    const tileX = Math.floor((x - this.worldBoardRect.x) / this.worldCellSize);
    const tileY = Math.floor((y - this.worldBoardRect.y) / this.worldCellSize);

    if (tileX < 0 || tileX >= this.worldWidth || tileY < 0 || tileY >= this.worldHeight) {
      return null;
    }

    return { x: tileX, y: tileY };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    for (const button of this.headerButtonViews) {
      if (button.enabled && button.bounds.contains(pointer.x, pointer.y)) {
        void this.activateHeaderButton(button.id);
        return;
      }
    }

    for (const button of this.toolButtonViews) {
      if (button.enabled && button.bounds.contains(pointer.x, pointer.y)) {
        this.setTool(button.value);
        return;
      }
    }

    for (const button of this.paletteButtonViews) {
      if (button.enabled && button.bounds.contains(pointer.x, pointer.y)) {
        this.applyPaletteChoice(button.value);
        return;
      }
    }

    for (const button of this.actionButtonViews) {
      if (button.enabled && button.bounds.contains(pointer.x, pointer.y)) {
        void this.activateActionButton(button.id);
        return;
      }
    }

    if (pointer.rightButtonDown() && this.worldViewportRect.contains(pointer.x, pointer.y)) {
      const local = this.getWorldLocalPointFromScreen(pointer.x, pointer.y);

      if (local) {
        this.panPointerId = pointer.id;
        this.panPointerOrigin.set(pointer.x, pointer.y);
        this.panCameraOrigin.copy(this.worldCameraCenter);
        return;
      }
    }

    if (this.worldBoardRect.contains(pointer.x, pointer.y) && !this.worldViewportRect.contains(pointer.x, pointer.y)) {
      const tile = this.getTileAtScreenPosition(pointer.x, pointer.y);

      if (tile) {
        this.activeTile = tile;
        this.hoverTile = tile;
        this.focusCameraOnTile(tile);
        audioDirector.playUiMove();
        this.statusMessage = `Focused view on ${tile.x},${tile.y}.`;
        this.refreshScene();
      }
      return;
    }

    const tile = this.getTileAtScreenPosition(pointer.x, pointer.y);

    if (!tile) {
      return;
    }

    this.hoverTile = tile;
    this.activeTile = tile;

    if (this.activeTool === 'terrain' || this.activeTool === 'heights') {
      this.paintPointerId = pointer.id;
      this.lastPaintTileKey = tileKey(tile);
      this.applyToolAt(tile, { invertHeightBrush: this.isShiftModifierActive(pointer) });
      audioDirector.playUiMove();
      this.refreshScene();
      return;
    }

    const objectLayer = this.activeTool;
    const hitObject = this.getObjectAtTile(objectLayer, tile);

    if (hitObject) {
      this.selectedObject = hitObject;
      this.draggingObject = hitObject;
      this.lastDragTileKey = tileKey(tile);
      audioDirector.playUiConfirm();
      this.statusMessage = `${OBJECT_LAYER_LABELS[objectLayer].slice(0, -1)} selected. Drag to reposition or edit its fields.`;
      this.refreshScene();
      return;
    }

    const created = this.createDefaultObject(objectLayer, tile);
    this.selectedObject = created;
    audioDirector.playUiConfirm();
    this.statusMessage = `${OBJECT_LAYER_LABELS[objectLayer].slice(0, -1)} created at ${tile.x},${tile.y}.`;
    this.refreshScene();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.panPointerId === pointer.id && pointer.isDown) {
      const deltaX = pointer.x - this.panPointerOrigin.x;
      const deltaY = pointer.y - this.panPointerOrigin.y;
      this.worldCameraCenter.set(
        this.panCameraOrigin.x - deltaX / this.worldZoom,
        this.panCameraOrigin.y - deltaY / this.worldZoom
      );
      this.updateWorldCameraTransform();
      this.refreshScene();
      return;
    }

    const tile = this.getTileAtScreenPosition(pointer.x, pointer.y);
    const nextTileKey = tileKey(tile);

    if (nextTileKey !== tileKey(this.hoverTile)) {
      this.hoverTile = tile;
      this.refreshScene();
    }

    if (!tile || !pointer.isDown) {
      return;
    }

    if (this.paintPointerId === pointer.id && (this.activeTool === 'terrain' || this.activeTool === 'heights')) {
      if (nextTileKey === this.lastPaintTileKey) {
        return;
      }

      this.lastPaintTileKey = nextTileKey;
      this.applyToolAt(tile, { invertHeightBrush: this.isShiftModifierActive(pointer) });
      this.refreshScene();
      return;
    }

    if (this.draggingObject && this.lastDragTileKey !== nextTileKey) {
      this.lastDragTileKey = nextTileKey;
      this.moveSelectedObjectTo(tile);
      this.activeTile = tile;
      this.statusMessage = `Moved ${OBJECT_LAYER_LABELS[this.draggingObject.layer].slice(0, -1)} to ${tile.x},${tile.y}.`;
      this.refreshScene();
    }
  }

  private handlePointerUp(): void {
    this.paintPointerId = null;
    this.lastPaintTileKey = '';
    this.panPointerId = null;
    this.draggingObject = null;
    this.lastDragTileKey = '';
  }

  private handleKeyDown(event: KeyboardEvent): void {
    switch (event.key.toLowerCase()) {
      case 'escape':
        this.returnToTitle();
        return;
      case 'c':
        void this.copyArchive();
        return;
      case 'd':
        this.downloadArchive();
        return;
      case 'e':
        void this.editSelectedObject();
        return;
      case 'delete':
      case 'backspace':
        this.deleteSelectedObject();
        return;
      case 't':
        this.setTool('terrain');
        return;
      case 'h':
        this.setTool('heights');
        return;
      case 'p':
        this.setTool('props');
        return;
      case 'n':
        this.setTool('npcs');
        return;
      case 'o':
        this.setTool('encounters');
        return;
      case 'r':
        this.setTool('transitions');
        return;
      case 's':
        this.setTool('spawnPoints');
        return;
      default:
        return;
    }
  }

  private setTool(tool: EditorTool): void {
    this.activeTool = tool;
    audioDirector.playUiMove();
    this.statusMessage =
      tool === 'heights'
        ? `Tool changed to ${TOOL_LABELS[tool]}. ${HEIGHT_BRUSH_LABELS[this.selectedHeightDirection]} is active.`
        : `Tool changed to ${TOOL_LABELS[tool]}.`;
    this.refreshScene();
  }

  private focusCameraOnTile(point: Point): void {
    const tile = this.getTileData(point);

    if (!tile) {
      return;
    }

    const center = this.isoToScreen(tile);
    this.worldCameraCenter.set(center.x, center.y);
    this.updateWorldCameraTransform();
  }

  private applyPaletteChoice(value: PaletteValue): void {
    switch (this.activeTool) {
      case 'terrain':
        this.selectedTerrain = value as TerrainType;
        break;
      case 'heights':
        this.selectedHeightDirection = value as HeightBrushDirection;
        break;
      case 'props':
        this.selectedPropAsset = value as MapPropAssetId;
        break;
      default:
        return;
    }

    audioDirector.playUiMove();
    this.statusMessage = `${TOOL_LABELS[this.activeTool]} palette changed to ${this.getPaletteLabel(value)}.`;
    this.refreshScene();
  }

  private async activateHeaderButton(buttonId: HeaderButtonId): Promise<void> {
    switch (buttonId) {
      case 'back':
        this.returnToTitle();
        break;
      case 'copy-archive':
        await this.copyArchive();
        break;
      case 'download-archive':
        this.downloadArchive();
        break;
      default:
        break;
    }
  }

  private async activateActionButton(buttonId: ActionButtonId): Promise<void> {
    switch (buttonId) {
      case 'edit-chunk':
        this.editFocusChunkInfo();
        break;
      case 'edit-object':
        await this.editSelectedObject();
        break;
      case 'duplicate-object':
        this.duplicateSelectedObject();
        break;
      case 'delete-object':
        this.deleteSelectedObject();
        break;
      case 'reset-chunk':
        this.resetFocusChunk();
        break;
      default:
        break;
    }
  }

  private editFocusChunkInfo(): void {
    const context = this.getFocusContext();
    const currentName = String(getWorldEditorMapProperty(context.draft, 'displayName') ?? context.descriptor.displayName);
    const currentBackdrop = String(getWorldEditorMapProperty(context.draft, 'backdropAssetId') ?? context.descriptor.backdropAssetId ?? '');
    const nextName = window.prompt('Chunk displayName', currentName);

    if (nextName === null) {
      return;
    }

    const nextBackdrop = window.prompt('Chunk backdropAssetId (blank clears)', currentBackdrop);

    if (nextBackdrop === null) {
      return;
    }

    setWorldEditorMapProperty(context.draft, 'displayName', nextName.trim() || currentName);
    setWorldEditorMapProperty(context.draft, 'backdropAssetId', nextBackdrop.trim() || null);
    context.draft.descriptor.displayName = String(getWorldEditorMapProperty(context.draft, 'displayName') ?? currentName);
    context.draft.descriptor.backdropAssetId =
      typeof getWorldEditorMapProperty(context.draft, 'backdropAssetId') === 'string'
        ? String(getWorldEditorMapProperty(context.draft, 'backdropAssetId'))
        : undefined;
    this.dirtyFiles.add(context.descriptor.fileName);
    this.fitBackdrop(this.backdrop, this.scale.width, this.scale.height);
    audioDirector.playUiConfirm();
    this.statusMessage = `Updated chunk ${context.chunkX},${context.chunkY} info.`;
    this.refreshScene();
  }

  private async editSelectedObject(): Promise<void> {
    const selected = this.getSelectedObjectEntry();

    if (!selected) {
      this.statusMessage = 'No object selected.';
      this.refreshScene();
      return;
    }

    const payload = {
      name: selected.object.name ?? '',
      type: selected.object.type ?? '',
      width: selected.object.width ?? selected.draft.source.tilewidth,
      height: selected.object.height ?? selected.draft.source.tileheight,
      properties: tiledPropertiesToRecord(selected.object.properties)
    };
    const raw = window.prompt(
      'Edit selected object JSON (name, type, width, height, properties).',
      JSON.stringify(payload, null, 2)
    );

    if (raw === null) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        name?: unknown;
        type?: unknown;
        width?: unknown;
        height?: unknown;
        properties?: unknown;
      };
      const propertyRecord = typeof parsed.properties === 'object' && parsed.properties !== null
        ? (parsed.properties as Record<string, WorldEditorPropertyValue>)
        : {};

      selected.object.name = typeof parsed.name === 'string' ? parsed.name : selected.object.name;
      selected.object.type = typeof parsed.type === 'string' ? parsed.type : selected.object.type;
      selected.object.width = typeof parsed.width === 'number' ? parsed.width : selected.object.width;
      selected.object.height = typeof parsed.height === 'number' ? parsed.height : selected.object.height;
      selected.object.properties = recordToTiledProperties(propertyRecord, selected.object.properties ?? []);
      this.dirtyFiles.add(selected.reference.fileName);
      this.rebuildObjectVisuals();
      this.refreshWorldViewportOverlay();
      audioDirector.playUiConfirm();
      this.statusMessage = 'Selected object updated.';
      this.refreshScene();
    } catch (error) {
      audioDirector.playUiCancel();
      this.statusMessage = `Object update failed: ${error instanceof Error ? error.message : 'Invalid JSON.'}`;
      this.refreshScene();
    }
  }

  private duplicateSelectedObject(): void {
    const selected = this.getSelectedObjectEntry();

    if (!selected) {
      this.statusMessage = 'No object selected.';
      this.refreshScene();
      return;
    }

    const duplicate: WorldEditorTiledObject = {
      ...selected.object,
      id: allocateWorldEditorObjectId(selected.draft),
      x: selected.object.x,
      y: selected.object.y,
      properties: [...(selected.object.properties ?? [])]
    };
    const propertyId = getTiledPropertyValue(duplicate.properties, 'id');

    if (typeof propertyId === 'string') {
      const record = tiledPropertiesToRecord(duplicate.properties);
      record.id = this.createUniquePropertyId(selected.reference.layer, `${propertyId}-copy`);
      duplicate.properties = recordToTiledProperties(record, duplicate.properties);
    }

    getWorldEditorObjectLayer(selected.draft, selected.reference.layer).objects.push(duplicate);
    this.selectedObject = {
      ...selected.reference,
      objectId: duplicate.id
    };
    this.dirtyFiles.add(selected.reference.fileName);
    this.rebuildObjectVisuals();
    this.refreshWorldViewportOverlay();
    audioDirector.playUiConfirm();
    this.statusMessage = 'Selected object duplicated.';
    this.refreshScene();
  }

  private deleteSelectedObject(): void {
    const selected = this.getSelectedObjectEntry();

    if (!selected) {
      this.statusMessage = 'No object selected.';
      this.refreshScene();
      return;
    }

    removeWorldEditorObject(selected.draft, selected.reference.layer, selected.reference.objectId);
    this.dirtyFiles.add(selected.reference.fileName);
    this.selectedObject = null;
    this.rebuildObjectVisuals();
    this.refreshWorldViewportOverlay();
    audioDirector.playUiCancel();
    this.statusMessage = 'Selected object removed.';
    this.refreshScene();
  }

  private resetFocusChunk(): void {
    const context = this.getFocusContext();
    this.drafts.set(context.descriptor.fileName, createWorldEditorDraft(context.descriptor.fileName));

    if (this.selectedObject?.fileName === context.descriptor.fileName) {
      this.selectedObject = null;
    }

    this.dirtyFiles.delete(context.descriptor.fileName);
    this.rebuildWorldModel();
    this.rebuildWorldVisuals();
    audioDirector.playUiCancel();
    this.statusMessage = `Reset chunk ${context.chunkX},${context.chunkY} to source values.`;
    this.refreshScene();
  }

  private buildArchiveContents(): string {
    return buildWorldEditorArchive(this.outdoorDescriptors.map((descriptor) => this.getDraft(descriptor.fileName)));
  }

  private async copyArchive(): Promise<void> {
    if (!window.navigator.clipboard?.writeText) {
      this.statusMessage = 'Clipboard unavailable in this browser.';
      this.refreshScene();
      return;
    }

    try {
      const archive = this.buildArchiveContents();
      await window.navigator.clipboard.writeText(archive);
      audioDirector.playUiConfirm();
      this.statusMessage =
        'World archive copied. Save it as JSON and later import it into src/game/world/data with the repo script.';
      this.refreshScene();
    } catch (error) {
      audioDirector.playUiCancel();
      this.statusMessage = `Archive copy failed: ${error instanceof Error ? error.message : 'Unknown error.'}`;
      this.refreshScene();
    }
  }

  private downloadArchive(): void {
    try {
      const blob = new Blob([this.buildArchiveContents()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'renations-world-archive.json';
      anchor.click();
      URL.revokeObjectURL(url);
      audioDirector.playUiConfirm();
      this.statusMessage = 'World archive downloaded as renations-world-archive.json.';
      this.refreshScene();
    } catch (error) {
      audioDirector.playUiCancel();
      this.statusMessage = `Archive download failed: ${error instanceof Error ? error.message : 'Unknown error.'}`;
      this.refreshScene();
    }
  }

  private returnToTitle(): void {
    audioDirector.playUiConfirm();
    this.input.enabled = false;
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('title');
    });
    this.cameras.main.fadeOut(220, 12, 6, 10);
  }

  private getNpcSpriteKey(object: WorldEditorTiledObject): string {
    const blueprintId = getTiledPropertyValue(object.properties, 'blueprintId');

    if (typeof blueprintId !== 'string') {
      return DEFAULT_UNIT_IMAGE_KEY;
    }

    try {
      return getUnitBlueprint(blueprintId).spriteKey;
    } catch {
      return DEFAULT_UNIT_IMAGE_KEY;
    }
  }

  private getNpcSpriteHeight(object: WorldEditorTiledObject): number {
    const blueprintId = getTiledPropertyValue(object.properties, 'blueprintId');

    if (typeof blueprintId !== 'string') {
      return 108;
    }

    try {
      return Math.round(getUnitBlueprint(blueprintId).spriteDisplayHeight * UNIT_BLUEPRINT_BATTLE_SCALE);
    } catch {
      return 108;
    }
  }

  private getNpcSpriteOffset(object: WorldEditorTiledObject): Phaser.Math.Vector2 {
    const blueprintId = getTiledPropertyValue(object.properties, 'blueprintId');

    if (typeof blueprintId !== 'string') {
      return new Phaser.Math.Vector2(0, 0);
    }

    try {
      const blueprint = getUnitBlueprint(blueprintId);
      return new Phaser.Math.Vector2(
        Math.round((blueprint.spriteOffsetX ?? 0) * UNIT_BLUEPRINT_BATTLE_SCALE),
        Math.round((blueprint.spriteOffsetY ?? 0) * UNIT_BLUEPRINT_BATTLE_SCALE)
      );
    } catch {
      return new Phaser.Math.Vector2(0, 0);
    }
  }

  private scaleTilePolygon(
    points: readonly Phaser.Math.Vector2[],
    center: Phaser.Math.Vector2,
    scale: number
  ): Phaser.Math.Vector2[] {
    return points.map((point) => new Phaser.Math.Vector2(
      center.x + (point.x - center.x) * scale,
      center.y + (point.y - center.y) * scale
    ));
  }

  private isoToScreen(tile: Point & { height?: number }): Phaser.Math.Vector2 {
    const point = isoToScreenPoint(tile, this.worldLayout, tile.height ?? this.getTileData(tile)?.height ?? 0);
    return new Phaser.Math.Vector2(point.x, point.y);
  }

  private getTileTopPoints(tile: Point & { height?: number }): Phaser.Math.Vector2[] {
    return getSharedTileTopPoints(tile, this.worldLayout, tile.height ?? this.getTileData(tile)?.height ?? 0)
      .map((point) => new Phaser.Math.Vector2(point.x, point.y));
  }

  private getTileDepth(tile: Point & { height?: number }): number {
    return getSharedTileDepth(tile, this.worldLayout, tile.height ?? this.getTileData(tile)?.height ?? 0);
  }

  private getUnitGroundPoint(tile: Point & { height?: number }): Phaser.Math.Vector2 {
    const point = getSharedUnitGroundPoint(
      tile,
      this.worldLayout,
      tile.height ?? this.getTileData(tile)?.height ?? 0,
      UNIT_GROUND_OFFSET_Y
    );
    return new Phaser.Math.Vector2(point.x, point.y);
  }

  private fitBackdrop(image: Phaser.GameObjects.Image, width: number, height: number): void {
    const focusContext = this.getFocusContext();
    const backdropKey = focusContext.draft.descriptor.backdropAssetId;

    if (backdropKey && this.textures.exists(backdropKey)) {
      image.setTexture(backdropKey);
    } else {
      image.setTexture('renations-global-backdrop');
    }

    const textureSource = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const textureWidth = textureSource.width || 1;
    const textureHeight = textureSource.height || 1;
    const scale = Math.max(width / textureWidth, height / textureHeight) * 1.08;

    image.setPosition(width * 0.5, height * 0.5);
    image.setScale(scale);
  }
}
