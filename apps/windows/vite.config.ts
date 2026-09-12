import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',
  root: 'renderer',
  envDir: path.resolve(__dirname, '../../'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer/src'),
    },
  },
  build: {
    outDir: '../dist-renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
