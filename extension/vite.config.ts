import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx, ManifestV3Export } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), crx({ manifest: manifest as ManifestV3Export })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        permission: resolve(__dirname, "src/permission/index.html"),
      },
    },
  },
});
