import type { BattleUnit } from '../core/types';
import { UNIT_BLUEPRINT_BATTLE_SCALE } from '../levels';
import pilgrimCampTiledMap from '../levels/data/pilgrim-camp.tiled.json';
import type { LevelDefinition } from '../levels/types';
import { getUnitBlueprint } from '../levels/unitBlueprints';
import { parseTiledExplorationLocation } from './tiled';
import type { ExplorationLocationDefinition, ExplorationNpcDefinition, ExplorationNpcRuntime } from './types';

const pilgrimCampLocation = parseTiledExplorationLocation(pilgrimCampTiledMap);

const EXPLORATION_LOCATIONS: Record<string, ExplorationLocationDefinition> = {
  [pilgrimCampLocation.id]: pilgrimCampLocation
};

export type ExplorationLocationId = string;

export const DEFAULT_EXPLORATION_LOCATION_ID = pilgrimCampLocation.id;

function createExplorationUnit(
  locationId: string,
  actorId: string,
  blueprintId: string,
  x: number,
  y: number,
  team: BattleUnit['team'],
  nameOverride?: string,
  classNameOverride?: string
): BattleUnit {
  const blueprint = getUnitBlueprint(blueprintId);
  const { id: resolvedBlueprintId, ...blueprintData } = blueprint;

  return {
    ...blueprintData,
    id: `exploration:${locationId}:${actorId}`,
    blueprintId: resolvedBlueprintId,
    team,
    name: nameOverride ?? blueprint.name,
    className: classNameOverride ?? blueprint.className,
    spriteDisplayHeight: Math.round(blueprint.spriteDisplayHeight * UNIT_BLUEPRINT_BATTLE_SCALE),
    spriteOffsetX:
      typeof blueprint.spriteOffsetX === 'number'
        ? Math.round(blueprint.spriteOffsetX * UNIT_BLUEPRINT_BATTLE_SCALE)
        : undefined,
    spriteOffsetY:
      typeof blueprint.spriteOffsetY === 'number'
        ? Math.round(blueprint.spriteOffsetY * UNIT_BLUEPRINT_BATTLE_SCALE)
        : undefined,
    x,
    y,
    hp: blueprint.maxHp,
    ct: 0,
    alive: true
  };
}

function createExplorationNpc(locationId: string, npc: ExplorationNpcDefinition): ExplorationNpcRuntime {
  const unit = createExplorationUnit(
    locationId,
    `npc:${npc.id}`,
    npc.blueprintId,
    npc.x,
    npc.y,
    'enemy',
    npc.name,
    npc.className
  );

  return {
    id: unit.id,
    blueprintId: unit.blueprintId,
    factionId: unit.factionId,
    name: unit.name,
    className: unit.className,
    x: unit.x,
    y: unit.y,
    jump: unit.jump,
    spriteKey: unit.spriteKey,
    accentColor: unit.accentColor,
    spriteDisplayHeight: unit.spriteDisplayHeight,
    spriteOffsetX: unit.spriteOffsetX,
    spriteOffsetY: unit.spriteOffsetY,
    movementStyle: unit.movementStyle,
    idleStyle: unit.idleStyle,
    summary: npc.summary,
    actions: npc.actions
  };
}

export function getExplorationLocation(locationId: string = DEFAULT_EXPLORATION_LOCATION_ID): ExplorationLocationDefinition {
  const location = EXPLORATION_LOCATIONS[locationId as ExplorationLocationId];

  if (!location) {
    throw new Error(`Unknown exploration location: ${locationId}`);
  }

  return location;
}

export function createExplorationLevel(location: ExplorationLocationDefinition): LevelDefinition {
  return {
    id: location.id,
    name: location.name,
    objective: location.objective,
    backdropAssetId: location.backdropAssetId,
    shortObjective: location.shortObjective,
    titlePrefix: location.titlePrefix,
    region: location.region,
    encounterType: location.encounterType,
    titleFlavor: location.titleFlavor,
    heights: location.heights,
    terrain: location.terrain,
    placements: [],
    chests: [],
    props: location.props
  };
}

export function createExplorationLeader(location: ExplorationLocationDefinition): BattleUnit {
  return createExplorationUnit(
    location.id,
    'leader',
    location.leader.blueprintId,
    location.leader.x,
    location.leader.y,
    'player'
  );
}

export function createExplorationNpcs(location: ExplorationLocationDefinition): ExplorationNpcRuntime[] {
  return location.npcs.map((npc) => createExplorationNpc(location.id, npc));
}
