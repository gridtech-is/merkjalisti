/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cast widens UserConfigExport to include vitest's `test` field without requiring vitest/config's defineConfig (which pulls a conflicting vite dep).
export default defineConfig({
  base: '/merkjalisti/',
  plugins: [react()],
  // @ts-expect-error vitest augments UserConfig at runtime; type merging doesn't land under tsc -b here
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
});
