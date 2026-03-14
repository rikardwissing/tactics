import type { BattleUnit, Point, TerrainType } from '../core/types';
import type { MapPropPlacement } from '../levels/types';
import type { NpcActionDefinition } from '../exploration/types';

export type WorldAreaKind = 'outdoor' | 'interior';
export type WorldTransitionTargetKind = 'interior' | 'spawn' | 'return';

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
  baseSource: WorldTiledMapSource;
  variantSources: Readonly<Record<string, WorldTiledMapSource>>;
}

export interface WorldChunkRuntime extends WorldChunkMapDefinition {
  chunkX: number;
  chunkY: number;
  variantId: string | null;
}

export interface WorldDefinition {
  width: number;
  height: number;
}

export interface WorldPersistentState {
  chunkVariants: Record<string, string | undefined>;
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
