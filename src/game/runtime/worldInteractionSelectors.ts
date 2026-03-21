import { manhattanDistance } from '../core/pathfinding';
import type { BattleUnit, Point, TileData } from '../core/types';
import type { MapPropAssetId } from '../levels/types';
import type { WorldNpcRuntime } from '../world/types';

export type WorldInteractionInspection<
  TNpc extends WorldNpcRuntime,
  TProp extends { assetId: MapPropAssetId }
> =
  | { kind: 'mission' }
  | { kind: 'battle-unit'; unit: BattleUnit }
  | { kind: 'npc'; npc: TNpc }
  | { kind: 'tile'; tile: TileData; prop: TProp | null };

export interface SelectExplorationInspectionNpcOptions {
  npcs: readonly WorldNpcRuntime[];
  focusedNpcId: string | null;
  phase: string;
}

export interface SelectInteractionNpcOptions {
  npcs: readonly WorldNpcRuntime[];
  player: Point;
  focusedNpcId: string | null;
  isWorldBattleActive: boolean;
  isFriendlyNpc: (npc: WorldNpcRuntime) => boolean;
}

export interface SelectNpcInteractionStateOptions {
  interactionNpc: WorldNpcRuntime | null;
  phase: string;
  selectedNpcActionId: string | null;
}

export interface NpcInteractionState {
  focusedNpcId: string | null;
  selectedNpcActionId: string | null;
  nextPhase: 'idle' | 'menu' | 'detail';
}

export interface SelectCurrentWorldHudInspectionOptions<TProp extends { assetId: MapPropAssetId }> {
  isWorldBattleActive: boolean;
  inspectionBattleUnit: BattleUnit | null;
  inspectionBattleTile: TileData | null;
  getPropAt: (x: number, y: number) => TProp | null;
  explorationInspectionNpc: WorldNpcRuntime | null;
}

export function selectExplorationInspectionNpc({
  npcs,
  focusedNpcId,
  phase
}: SelectExplorationInspectionNpcOptions): WorldNpcRuntime | null {
  const focusedNpc = focusedNpcId ? npcs.find((npc) => npc.id === focusedNpcId) ?? null : null;
  return focusedNpc && (phase === 'menu' || phase === 'detail') ? focusedNpc : null;
}

export function selectInteractionNpc({
  npcs,
  player,
  focusedNpcId,
  isWorldBattleActive,
  isFriendlyNpc
}: SelectInteractionNpcOptions): WorldNpcRuntime | null {
  if (isWorldBattleActive) {
    return null;
  }

  const adjacentNpcs = npcs.filter((npc) => isFriendlyNpc(npc) && manhattanDistance(player, npc) === 1);

  if (adjacentNpcs.length === 0) {
    return null;
  }

  const focusedNpc = focusedNpcId ? npcs.find((npc) => npc.id === focusedNpcId) ?? null : null;

  if (focusedNpc && adjacentNpcs.some((npc) => npc.id === focusedNpc.id)) {
    return focusedNpc;
  }

  return adjacentNpcs[0] ?? null;
}

export function selectNpcInteractionState({
  interactionNpc,
  phase,
  selectedNpcActionId
}: SelectNpcInteractionStateOptions): NpcInteractionState {
  if (!interactionNpc) {
    return {
      focusedNpcId: null,
      selectedNpcActionId: null,
      nextPhase: 'idle'
    };
  }

  if (phase === 'detail' && interactionNpc.actions.some((action) => action.id === selectedNpcActionId)) {
    return {
      focusedNpcId: interactionNpc.id,
      selectedNpcActionId,
      nextPhase: 'detail'
    };
  }

  return {
    focusedNpcId: interactionNpc.id,
    selectedNpcActionId: null,
    nextPhase: 'menu'
  };
}

export function selectCurrentWorldHudInspection<
  TNpc extends WorldNpcRuntime,
  TProp extends { assetId: MapPropAssetId }
>({
  isWorldBattleActive,
  inspectionBattleUnit,
  inspectionBattleTile,
  getPropAt,
  explorationInspectionNpc
}: SelectCurrentWorldHudInspectionOptions<TProp> & {
  explorationInspectionNpc: TNpc | null;
}): WorldInteractionInspection<TNpc, TProp> {
  if (isWorldBattleActive) {
    if (inspectionBattleUnit) {
      return { kind: 'battle-unit', unit: inspectionBattleUnit };
    }

    if (inspectionBattleTile) {
      return {
        kind: 'tile',
        tile: inspectionBattleTile,
        prop: getPropAt(inspectionBattleTile.x, inspectionBattleTile.y)
      };
    }

    return { kind: 'mission' };
  }

  if (explorationInspectionNpc) {
    return { kind: 'npc', npc: explorationInspectionNpc };
  }

  return { kind: 'mission' };
}
