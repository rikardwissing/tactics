import Phaser from 'phaser';
import { UI_TEXT_WORLD_BARK } from '../scenes/components/UiTextStyles';

export const TURN_START_CATCH_PHRASE_HEIGHT_FACTOR = 1.06;

const TURN_START_CATCH_PHRASE_RISE_DISTANCE = 18;
const TURN_START_CATCH_PHRASE_FADE_DURATION = 120;
const TURN_START_CATCH_PHRASE_HOLD_DURATION = 460;
const TURN_START_CATCH_PHRASE_DEPTH_OFFSET = 4;

interface ShowSharedTurnStartCatchPhraseOptions {
  scene: Phaser.Scene;
  point: Phaser.Math.Vector2;
  text: string;
  anchorDepth: number;
  createText: (x: number, y: number, text: string) => Phaser.GameObjects.Text;
  onComplete?: (text: Phaser.GameObjects.Text) => void;
}

export function showSharedTurnStartCatchPhrase(options: ShowSharedTurnStartCatchPhraseOptions): Phaser.GameObjects.Text {
  const { scene, point, text, anchorDepth, createText, onComplete } = options;
  const barkText = createText(point.x, point.y, text);

  barkText
    .setStyle(UI_TEXT_WORLD_BARK)
    .setOrigin(0.5)
    .setDepth(anchorDepth + TURN_START_CATCH_PHRASE_DEPTH_OFFSET)
    .setAlpha(0);

  scene.tweens.add({
    targets: barkText,
    y: point.y - TURN_START_CATCH_PHRASE_RISE_DISTANCE,
    alpha: 1,
    duration: TURN_START_CATCH_PHRASE_FADE_DURATION,
    ease: 'Quad.easeOut',
    yoyo: true,
    hold: TURN_START_CATCH_PHRASE_HOLD_DURATION,
    onComplete: () => {
      onComplete?.(barkText);
      barkText.destroy();
    }
  });

  return barkText;
}
