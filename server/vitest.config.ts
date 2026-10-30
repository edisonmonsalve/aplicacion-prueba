import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // los archivos comparten la misma base: uno a la vez
    testTimeout: 15000,
  },
});