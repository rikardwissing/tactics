import type { BattleUnit } from '../core/types';
import type { LevelDefinition } from '../levels/types';

export type NpcActionKind = 'talk' | 'buy' | 'sell' | 'train';

export interface NpcActionDefinition {
  id: string;
  kind: NpcActionKind;
  label: string;
  title?: string;
  body: string;
}

export interface ExplorationActorPlacement {
  blueprintId: string;
  x: number;
  y: number;
}

export interface ExplorationNpcDefinition extends ExplorationActorPlacement {
  id: string;
  name?: string;
  className?: string;
  summary: string;
  actions: readonly NpcActionDefinition[];
}

export interface ExplorationLocationDefinition
  extends Pick<
    LevelDefinition,
    | 'id'
    | 'name'
    | 'objective'
    | 'backdropAssetId'
    | 'shortObjective'
    | 'titlePrefix'
    | 'region'
    | 'encounterType'
    | 'titleFlavor'
    | 'heights'
    | 'terrain'
    | 'props'
  > {
  leader: ExplorationActorPlacement;
  npcs: readonly ExplorationNpcDefinition[];
}

export interface ExplorationNpcRuntime
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
