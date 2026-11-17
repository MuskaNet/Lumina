import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    // `happy-dom` is rebuilt for every test file, so the default `forks` pool
    // dominates the runtime (~3x here) and can push the Maven bridge test past
    // its timeout. `vmThreads` keeps the same per-file isolation while reusing
    // one environment per worker.
    pool: "vmThreads",
  },
});
