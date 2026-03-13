import type { BattleSetup } from './battleSetup';

export type SceneMode = 'battle' | 'exploration';

export interface BoardSceneStartData {
  mode?: SceneMode;
  setup?: BattleSetup;
  locationId?: string;
}
