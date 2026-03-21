import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SetupScene } from './scenes/SetupScene';
import { TitleScene } from './scenes/TitleScene';
import { UnitEditorScene } from './scenes/UnitEditorScene';
import { WorldMapEditorScene } from './scenes/WorldMapEditorScene';
import { WorldScene } from './scenes/WorldScene';

export function createGame(
  parent: string,
  initialSize = { width: 1280, height: 720 }
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: initialSize.width,
    height: initialSize.height,
    backgroundColor: '#14080d',
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
    scene: [BootScene, TitleScene, SetupScene, WorldScene, UnitEditorScene, WorldMapEditorScene]
  });
}
