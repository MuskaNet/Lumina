import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const BACKEND = process.env.KKREPO_BACKEND ?? "http://localhost:8080";

/**
 * Each target is a full document entry so Vite emits the HTML shell that Spring
 * Boot serves. `browse.html` is renamed to `index.html` by prepare-output.mjs.
 */
const TARGETS: Record<string, { base: string; entry: string; outDir: string }> = {
  admin: {
    base: "/admin/",
    entry: "admin.html",
    outDir: "../admin-ui/src/main/resources/META-INF/resources/admin",
  },
  browse: {
    base: "/browse/",
    entry: "browse.html",
    outDir: "../browse-ui/src/main/resources/META-INF/resources/browse",
  },
};

export default defineConfig(({ command, mode }) => {
  const targetName = process.env.KKREPO_UI_TARGET ?? (mode === "browse" ? "browse" : "admin");
  const target = TARGETS[targetName];
  if (!target) {
    throw new Error(`Unknown KKREPO_UI_TARGET "${targetName}"; expected admin or browse.`);
  }
  const dev = command === "serve";
  const outDir = process.env.KKREPO_UI_OUT ?? target.outDir;

  return {
    base: dev ? "/" : target.base,
    plugins: [vue()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Everything the UI calls lives on the Spring runtime.
        "^/(internal|service|repository|v2|login)/": { target: BACKEND, changeOrigin: false },
      },
    },
    build: {
      outDir,
      emptyOutDir: false,
      cssCodeSplit: false,
      sourcemap: false,
      // lightningcss rejects the `::picker(select)` rules MICL relies on.
      cssMinify: "esbuild",
      rollupOptions: {
        input: target.entry,
        output: {
          entryFileNames: "assets/app.js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: (asset) =>
            asset.names?.some((name) => name.endsWith(".css"))
              ? "assets/app.css"
              : "assets/[name][extname]",
        },
      },
    },
  };
});
