import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "cdn",
    lib: {
      entry: "src/browser-api.ts",
      formats: ["es"],
      fileName: () => "sign-ai-media.browser.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
