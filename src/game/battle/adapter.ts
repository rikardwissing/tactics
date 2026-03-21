import type { BattleUnit } from '../core/types';

export interface BattleSceneAdapter {
  focusCameraOnActor(actor: BattleUnit, duration: number): Promise<void>;
  playConfirm(): void;
  pushMessage(message: string): void;
  invalidateHud(): void;
  invalidateHighlights(): void;
  invalidateLighting(): void;
  invalidateTurnOrder(): void;
  restartBattle(): Promise<void>;
  returnFromBattle(): Promise<void>;
}
