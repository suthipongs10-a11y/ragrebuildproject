import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built index.html works from file:// inside Electron.
  base: './',
  // Processed art (atlases, images, manifest.json) is served from the site root.
  publicDir: 'assets',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', target: 'es2022' },
});
