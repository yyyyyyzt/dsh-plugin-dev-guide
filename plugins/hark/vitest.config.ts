import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.{ts,tsx}', 'tests/**/*.e2e.ts'],
    // `pnpm bench` opts the timing-sensitive perf spec in; the default run leaves it out.
    exclude: process.env['BENCH'] ? [] : ['tests/bench/**'],
    environment: 'node',
    passWithNoTests: false,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-results/junit.xml' },
  },
})
