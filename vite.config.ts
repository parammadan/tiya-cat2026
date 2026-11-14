import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from https://parammadan.github.io/tiya-cat2026/ (GitHub Pages project site).
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/tiya-cat2026/' : '/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
