import type { BattleSetup } from './battleSetup';
import type { BattleUnit, Point } from './core/types';
import type { LevelDefinition } from './levels/types';

export interface RuntimeBattleCameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  boardRotationStep: number;
  origin: Point;
}

export interface RuntimeBattleUnitEntryState {
  unitId: string;
  start: Point;
}

export interface RuntimeBattleArenaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RuntimeBattleIntroEntryKind = 'visible' | 'emerge';

export interface RuntimeBattleIntroEntryState {
  unitId: string;
  start: Point;
  target: Point;
  kind: RuntimeBattleIntroEntryKind;
  anchorUnitId?: string;
}

export interface RuntimeBattlePreservedLightSourceState {
  id: string;
  x: number;
  y: number;
  height: number;
  radius: number;
  color: number;
  intensity: number;
  sourceOffsetY: number;
  propId?: string;
}

export interface WorldSceneStartData {
  spawnId?: string;
  resumeSession?: boolean;
  setup?: BattleSetup;
}

export interface RuntimeBattleStartData {
  level: LevelDefinition;
  units: readonly BattleUnit[];
  camera: RuntimeBattleCameraState;
  seamlessEntry?: {
    sourceLevel: LevelDefinition;
    arenaBounds: RuntimeBattleArenaBounds;
    introEntries: readonly RuntimeBattleIntroEntryState[];
    preservedLightSources: readonly RuntimeBattlePreservedLightSourceState[];
  };
}
