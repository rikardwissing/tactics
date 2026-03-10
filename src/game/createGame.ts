import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';

export function createGame(
  parent: string,
  initialSize = { width: 1280, height: 720 }
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: initialSize.width,
    height: initialSize.height,
    backgroundColor: '#12070d',
    pixelArt: true,
    render: {
      antialias: true,
      roundPixels: false,
      pixelArt: false
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, BattleScene]
  });
}
