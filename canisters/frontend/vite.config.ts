import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { icpBindgen } from "@icp-sdk/bindgen/plugins/vite";

export default defineConfig({
  plugins: [
    react(),
    icpBindgen({ didFile: "../backend/src/backend.did", outDir: "app/bindings" }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@icp-sdk/")) return "ic-sdk";
        },
      },
    },
  },
});
