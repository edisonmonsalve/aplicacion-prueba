import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// En Docker Compose el backend se llama "server"; en local se mantiene localhost.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Redirige /api al backend de Express y evita problemas de CORS en desarrollo
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
});