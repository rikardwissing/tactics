import type { BattleUnit, Point, TerrainType } from '../core/types';
import type { MapPropAssetId, MapPropPlacement } from '../levels/types';
import type { NpcActionDefinition } from '../exploration/types';

export type WorldAreaKind = 'outdoor' | 'interior';
export type WorldTransitionTargetKind = 'interior' | 'spawn' | 'return';
export type WorldMapTransform = 'none' | 'mirrorX' | 'mirrorY' | 'rotate180';

export type WorldTiledMapSource = Record<string, unknown>;

export interface WorldSpawnDefinition extends Point {
  id: string;
}

export interface WorldTransitionDefinition extends Point {
  id: string;
  kind: string;
  label?: string;
  targetKind: WorldTransitionTargetKind;
  targetId?: string;
  targetSpawnId?: string;
}

export interface WorldNpcDefinition extends Point {
  id: string;
  blueprintId: string;
  name?: string;
  className?: string;
  summary: string;
  actions: readonly NpcActionDefinition[];
}

export interface WorldMapDefinition {
  id: string;
  name: string;
  backdropAssetId?: string;
  width: number;
  height: number;
  heights: readonly (readonly number[])[];
  terrain: readonly (readonly TerrainType[])[];
  props: readonly MapPropPlacement[];
  npcs: readonly WorldNpcDefinition[];
  transitions: readonly WorldTransitionDefinition[];
  spawnPoints: readonly WorldSpawnDefinition[];
}

export interface WorldChunkMapDefinition extends WorldMapDefinition {
  kind: 'outdoor';
}

export interface WorldInteriorDefinition extends WorldMapDefinition {
  kind: 'interior';
}

export interface WorldChunkDefinition {
  id: string;
  chunkX: number;
  chunkY: number;
  variants: {
    default: WorldTiledMapSource;
  } & Record<string, WorldTiledMapSource | undefined>;
}

export interface WorldChunkRuntime extends WorldChunkMapDefinition {
  chunkX: number;
  chunkY: number;
  variantId: string;
}

export interface WorldVariantPropDefinition extends Point {
  assetId: MapPropAssetId;
}

export interface WorldChunkVariantDefinition {
  displayName: string;
  backdropAssetId: string;
  transform?: WorldMapTransform;
  props?: readonly WorldVariantPropDefinition[];
}

export interface WorldChunkLayoutDefinition {
  id: string;
  chunkX: number;
  chunkY: number;
  sourceMapId: string;
  variant?: WorldChunkVariantDefinition;
}

export interface WorldInteriorLayoutDefinition {
  id: string;
  sourceMapId: string;
}

export interface WorldLayoutDefinition {
  chunkSize: number;
  defaultSpawnId: string;
  chunks: readonly WorldChunkLayoutDefinition[];
  interiors: readonly WorldInteriorLayoutDefinition[];
}

export interface ResolvedWorldSpawn extends Point {
  id: string;
  areaKind: WorldAreaKind;
  areaId: string;
}

export interface WorldSessionState {
  areaKind: WorldAreaKind;
  areaId: string;
  outdoorPosition: Point;
  interiorPosition: Point | null;
  returnOutdoorPosition: Point | null;
}

export interface WorldNpcRuntime
  extends Pick<
    BattleUnit,
    | 'id'
    | 'blueprintId'
    | 'factionId'
    | 'name'
    | 'className'
    | 'x'
    | 'y'
    | 'jump'
    | 'spriteKey'
    | 'accentColor'
    | 'spriteDisplayHeight'
    | 'spriteOffsetX'
    | 'spriteOffsetY'
    | 'movementStyle'
    | 'idleStyle'
  > {
  summary: string;
  actions: readonly NpcActionDefinition[];
}
