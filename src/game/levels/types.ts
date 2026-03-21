import { ItemId } from '../core/items';
import { Team, TerrainType } from '../core/types';

export type MapPropAssetId =
  | 'obstacle-rubble-barricade'
  | 'light-torch'
  | 'sanctum-brazier';

export interface UnitPlacement {
  blueprintId: string;
  team: Team;
  x: number;
  y: number;
}

export interface PlayerDeploymentSlot {
  id: string;
  placementIndex: number;
  defaultBlueprintId: string;
  x: number;
  y: number;
}

export interface ChestPlacement {
  id: string;
  x: number;
  y: number;
  itemId: ItemId;
  quantity: number;
}

export interface MapPropPlacement {
  id: string;
  x: number;
  y: number;
  assetId: MapPropAssetId;
}

export interface LevelDefinition {
  id: string;
  name: string;
  objective: string;
  backdropAssetId?: string;
  shortObjective?: string;
  titlePrefix?: string;
  region?: string;
  encounterType?: string;
  titleFlavor?: string;
  heights: readonly (readonly number[])[];
  terrain: readonly (readonly TerrainType[])[];
  placements: readonly UnitPlacement[];
  chests: readonly ChestPlacement[];
  props: readonly MapPropPlacement[];
}
