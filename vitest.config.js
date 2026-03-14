import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['tests/integration.test.js', 'node_modules'],
  },
});
