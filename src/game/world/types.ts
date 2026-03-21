import type { BattleSetup } from '../battleSetup';
import type { BattleUnit, Point, TerrainType } from '../core/types';
import type { MapPropPlacement } from '../levels/types';
import type { NpcActionDefinition } from '../exploration/types';
import type { RuntimeBattleStartData } from '../sceneSession';

export type WorldAreaKind = 'outdoor' | 'interior';
export type WorldTransitionTargetKind = 'interior' | 'spawn' | 'return';
export type WorldNpcDisposition = 'friendly' | 'hostile';

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
  disposition: WorldNpcDisposition;
  aggressive: boolean;
  aggressionRadius: number;
  chaseLeashRadius: number;
  encounterId?: string;
  encounterLevelId?: string;
  encounterLabel?: string;
  clearOnVictory?: boolean;
  patrolPath: readonly Point[];
  actions: readonly NpcActionDefinition[];
}

export interface WorldEncounterDefinition extends Point {
  id: string;
  levelId: string;
  label?: string;
  clearOnVictory: boolean;
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
  encounters: readonly WorldEncounterDefinition[];
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
  clearedEncounterIds: Record<string, true | undefined>;
}

export interface OutdoorNpcSessionState {
  absolutePosition: Point;
  patrolIndex: number;
}

export interface ResolvedWorldSpawn extends Point {
  id: string;
  areaKind: WorldAreaKind;
  areaId: string;
}

export type GameplayMode = 'exploration' | 'battle' | 'transition' | 'setup-return';
export type GameplayBattleOrigin = 'setup' | 'world-encounter';

export interface GameplayBattleContext {
  origin: GameplayBattleOrigin;
  encounterId: string | null;
  setup: BattleSetup | null;
}

export interface WorldBattleSessionState {
  context: GameplayBattleContext;
  runtimeBattle: RuntimeBattleStartData;
}

export interface WorldSessionState {
  areaKind: WorldAreaKind;
  areaId: string;
  outdoorPosition: Point;
  interiorPosition: Point | null;
  returnOutdoorPosition: Point | null;
  suppressedEncounterId: string | null;
  outdoorNpcStates: Record<string, OutdoorNpcSessionState | undefined>;
  activeBattle: WorldBattleSessionState | null;
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
  disposition: WorldNpcDisposition;
  aggressive: boolean;
  aggressionRadius: number;
  chaseLeashRadius: number;
  encounterId?: string;
  encounterLevelId?: string;
  encounterLabel?: string;
  clearOnVictory?: boolean;
  patrolPath: readonly Point[];
  actions: readonly NpcActionDefinition[];
}
