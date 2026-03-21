import Phaser from 'phaser';

export type LazySceneKey = 'setup' | 'world' | 'unit-editor' | 'world-map-editor';

type SceneClass = typeof Phaser.Scene;

async function loadSceneClass(sceneKey: LazySceneKey): Promise<SceneClass> {
  switch (sceneKey) {
    case 'setup': {
      const module = await import('./scenes/SetupScene');
      return module.SetupScene;
    }
    case 'world': {
      const module = await import('./scenes/WorldScene');
      return module.WorldScene;
    }
    case 'unit-editor': {
      const module = await import('./scenes/UnitEditorScene');
      return module.UnitEditorScene;
    }
    case 'world-map-editor': {
      const module = await import('./scenes/WorldMapEditorScene');
      return module.WorldMapEditorScene;
    }
    default:
      throw new Error(`Unsupported lazy scene: ${sceneKey}`);
  }
}

export async function ensureSceneRegistered(game: Phaser.Game, sceneKey: LazySceneKey): Promise<void> {
  if (game.scene.keys[sceneKey]) {
    return;
  }

  const SceneClass = await loadSceneClass(sceneKey);

  if (!game.scene.keys[sceneKey]) {
    game.scene.add(sceneKey, SceneClass, false);
  }
}
