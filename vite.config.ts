import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/tactics/' : '/'),
  server: {
    host: '0.0.0.0',
    port: 4173
  }
});
