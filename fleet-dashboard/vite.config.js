import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  preview: {
    port: 8080,       // arba 4173, nesvarbu
    host: true,
    allowedHosts: [
      "fleet-tracking-system-production-2cd5.up.railway.app"
    ]
  },

  server: {
    host: true
  }
});
