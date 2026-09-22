import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/crypto-lab-tc26-pair/',
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});