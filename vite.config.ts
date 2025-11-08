import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Enable Vitest globals (describe, it, expect, vi)
    environment: 'node', // Or 'jsdom' if testing browser-like code
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'test/**/*.ts'],
      exclude: ['src/types.ts'],
    },
  },
});
