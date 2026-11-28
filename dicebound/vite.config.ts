import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built index.html works from file:// inside Electron.
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', target: 'es2022' },
});
