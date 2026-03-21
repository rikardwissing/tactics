import type { Point, SpriteFacing } from '../core/types';
import type { ResolvedOutdoorAreaState } from '../runtime/worldAreaState';
import type { WorldNpcRuntime } from './types';

interface DestroyableObject {
  destroy: (...args: never[]) => void;
}

interface PropPresentationView {
  base: DestroyableObject;
  image: DestroyableObject;
  shadowOverlay?: DestroyableObject;
  groundGlow?: DestroyableObject;
  haloGlow?: DestroyableObject;
  embers?: DestroyableObject;
}

interface ActorPresentationView {
  container: {
    destroy: (fromScene?: boolean) => void;
  };
}

export interface RebuildWorldAreaOptions {
  sessionAreaKind: 'outdoor' | 'interior';
  centerCamera: boolean;
  outdoorCenterChunkOverride?: Point;
  outdoorFocusPoint?: Point;
  isWorldBattleActive: boolean;
  captureActorFacingOverrides: () => Map<string, SpriteFacing>;
  destroyAreaObjects: () => void;
  buildOutdoorArea: (centerChunkOverride?: Point) => void;
  buildInteriorArea: () => void;
  reconcileEncounterSuppression: () => void;
  resetOrigin: () => void;
  clearBoardGraphics: () => void;
  rebuildOutdoorChunkRenderSets: (forceRecreate: boolean) => void;
  syncOutdoorPropViews: (forceRecreate: boolean) => void;
  createActors: (facingOverrides?: ReadonlyMap<string, SpriteFacing>) => void;
  drawBoard: () => void;
  createTerrainTiles: () => void;
  createProps: () => void;
  setupCameras: () => void;
  configureCamera: (centerOnPlayer: boolean) => void;
  applyBattlePresentationShell: () => void;
  centerCameraOnOutdoorPoint: (point: Point) => void;
  invalidateBattlePresentation: () => void;
  invalidatePresentation: () => void;
}

export function rebuildWorldArea({
  sessionAreaKind,
  centerCamera,
  outdoorCenterChunkOverride,
  outdoorFocusPoint,
  isWorldBattleActive,
  captureActorFacingOverrides,
  destroyAreaObjects,
  buildOutdoorArea,
  buildInteriorArea,
  reconcileEncounterSuppression,
  resetOrigin,
  clearBoardGraphics,
  rebuildOutdoorChunkRenderSets,
  syncOutdoorPropViews,
  createActors,
  drawBoard,
  createTerrainTiles,
  createProps,
  setupCameras,
  configureCamera,
  applyBattlePresentationShell,
  centerCameraOnOutdoorPoint,
  invalidateBattlePresentation,
  invalidatePresentation
}: RebuildWorldAreaOptions): void {
  const facingOverrides = captureActorFacingOverrides();
  destroyAreaObjects();

  if (sessionAreaKind === 'outdoor') {
    buildOutdoorArea(outdoorCenterChunkOverride);
  } else {
    buildInteriorArea();
  }

  reconcileEncounterSuppression();
  resetOrigin();

  if (sessionAreaKind === 'outdoor') {
    clearBoardGraphics();
    rebuildOutdoorChunkRenderSets(true);
    syncOutdoorPropViews(true);
    createActors(facingOverrides);
  } else {
    drawBoard();
    createTerrainTiles();
    createProps();
    createActors(facingOverrides);
  }

  setupCameras();
  configureCamera(centerCamera);
  applyBattlePresentationShell();

  if (sessionAreaKind === 'outdoor' && outdoorFocusPoint) {
    centerCameraOnOutdoorPoint(outdoorFocusPoint);
  }

  if (isWorldBattleActive) {
    invalidateBattlePresentation();
  } else {
    invalidatePresentation();
  }
}

export interface StreamOutdoorWorldAreaOptions {
  centerChunk: Point;
  focusPoint: Point;
  isWorldBattleActive: boolean;
  currentScroll: { x: number; y: number };
  getOutdoorCameraAnchorScenePoint: (point: Point) => { x: number; y: number } | null;
  resolveOutdoorAreaState: (centerChunk: Point) => ResolvedOutdoorAreaState;
  applyResolvedOutdoorAreaState: (resolved: ResolvedOutdoorAreaState) => void;
  updatePlayerPosition: (point: Point) => void;
  reconcileOutdoorNpcs: (npcs: WorldNpcRuntime[]) => void;
  rebuildOutdoorChunkRenderSets: (forceRecreate: boolean) => void;
  syncOutdoorPropViews: (forceRecreate: boolean) => void;
  syncOutdoorActorViews: () => void;
  configureCamera: (centerOnPlayer: boolean) => void;
  setCameraScroll: (x: number, y: number) => void;
  centerCameraOnOutdoorPoint: (point: Point) => void;
  applyBattlePresentationShell: () => void;
  invalidateLighting: () => void;
  invalidateBattlePresentation: () => void;
  invalidatePresentation: () => void;
}

export function streamOutdoorWorldArea({
  centerChunk,
  focusPoint,
  isWorldBattleActive,
  currentScroll,
  getOutdoorCameraAnchorScenePoint,
  resolveOutdoorAreaState,
  applyResolvedOutdoorAreaState,
  updatePlayerPosition,
  reconcileOutdoorNpcs,
  rebuildOutdoorChunkRenderSets,
  syncOutdoorPropViews,
  syncOutdoorActorViews,
  configureCamera,
  setCameraScroll,
  centerCameraOnOutdoorPoint,
  applyBattlePresentationShell,
  invalidateLighting,
  invalidateBattlePresentation,
  invalidatePresentation
}: StreamOutdoorWorldAreaOptions): void {
  const previousAnchor = getOutdoorCameraAnchorScenePoint(focusPoint);
  const resolved = resolveOutdoorAreaState(centerChunk);
  applyResolvedOutdoorAreaState(resolved);
  updatePlayerPosition(resolved.localPlayerPoint);
  reconcileOutdoorNpcs(resolved.npcs);
  rebuildOutdoorChunkRenderSets(false);
  syncOutdoorPropViews(false);
  syncOutdoorActorViews();
  configureCamera(false);
  const nextAnchor = getOutdoorCameraAnchorScenePoint(focusPoint);

  if (previousAnchor && nextAnchor) {
    setCameraScroll(
      currentScroll.x + (nextAnchor.x - previousAnchor.x),
      currentScroll.y + (nextAnchor.y - previousAnchor.y)
    );
  } else {
    centerCameraOnOutdoorPoint(focusPoint);
  }

  applyBattlePresentationShell();
  invalidateLighting();
  if (isWorldBattleActive) {
    invalidateBattlePresentation();
  } else {
    invalidatePresentation();
  }
}

export interface DestroyWorldAreaObjectsOptions {
  destroyOutdoorChunkRenderSets: () => void;
  clearBoardGraphics: () => void;
  terrainTileImages: DestroyableObject[];
  wallGraphics: DestroyableObject[];
  arenaPreviewWallGraphics: DestroyableObject[];
  propViews: Map<string, PropPresentationView>;
  actorViews: Map<string, ActorPresentationView>;
  clearHighlights: () => void;
  resetLightGroundOverlays: () => void;
  resetLightShadowOverlays: () => void;
  destroyOrphanedWorldObjects: () => void;
}

export function destroyWorldAreaObjects({
  destroyOutdoorChunkRenderSets,
  clearBoardGraphics,
  terrainTileImages,
  wallGraphics,
  arenaPreviewWallGraphics,
  propViews,
  actorViews,
  clearHighlights,
  resetLightGroundOverlays,
  resetLightShadowOverlays,
  destroyOrphanedWorldObjects
}: DestroyWorldAreaObjectsOptions): void {
  destroyOutdoorChunkRenderSets();
  clearBoardGraphics();

  for (const image of terrainTileImages) {
    image.destroy();
  }
  terrainTileImages.length = 0;

  for (const wall of wallGraphics) {
    wall.destroy();
  }
  wallGraphics.length = 0;

  for (const wall of arenaPreviewWallGraphics) {
    wall.destroy();
  }
  arenaPreviewWallGraphics.length = 0;

  for (const view of propViews.values()) {
    view.base.destroy();
    view.image.destroy();
    view.shadowOverlay?.destroy();
    view.groundGlow?.destroy();
    view.haloGlow?.destroy();
    view.embers?.destroy();
  }
  propViews.clear();

  for (const view of actorViews.values()) {
    view.container.destroy(true);
  }
  actorViews.clear();

  clearHighlights();
  resetLightGroundOverlays();
  resetLightShadowOverlays();
  destroyOrphanedWorldObjects();
}
