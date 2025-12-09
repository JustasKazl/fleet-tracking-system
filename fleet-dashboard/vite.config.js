import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  preview: {
    port: 8080,
    host: "0.0.0.0", // This allows external connections
    strictPort: true,
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
  },

  build: {
    outDir: "dist",
    sourcemap: false, // Disable sourcemaps in production
  },
});
