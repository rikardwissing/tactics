import { ItemId } from '../core/items';
import { TerrainType } from '../core/types';

export type MapPropAssetId =
  | 'obstacle-rubble-barricade'
  | 'light-torch'
  | 'sanctum-brazier';

export interface UnitPlacement {
  blueprintId: string;
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
