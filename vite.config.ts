import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/tactics/' : '/'),
  build: {
    // Phaser is intentionally emitted as its own cacheable vendor chunk.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) {
            return 'phaser';
          }

          if (id.includes('/src/game/scenes/UnitEditorScene.ts')) {
            return 'unit-editor';
          }

          if (id.includes('/src/game/scenes/WorldMapEditorScene.ts')) {
            return 'world-map-editor';
          }

          return undefined;
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 4173
  }
});
