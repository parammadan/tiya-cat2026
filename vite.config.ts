import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from https://parammadan.github.io/varc-practice-sim/ (GitHub Pages project site).
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/varc-practice-sim/' : '/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
}));
