import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 1000,
    coverage: {
      reporter: ['text'],
      thresholds: {
        "100": true
      }
    }
  }
})