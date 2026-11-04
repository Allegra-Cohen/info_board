import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  base: './',
  build: {
    outDir: '../build',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.js',
    include: ['**/*.test.{js,jsx}'],
  },
});
