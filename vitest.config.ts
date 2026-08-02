import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
