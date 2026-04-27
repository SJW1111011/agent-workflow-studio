import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["preact"],
        },
      },
    },
  },
});
