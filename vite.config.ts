import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Enable Vitest globals (describe, it, expect, vi)
    environment: 'node', // Or 'jsdom' if testing browser-like code
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/types.ts'], // Exclude server entry and types from coverage if desired
    },
  },
});
