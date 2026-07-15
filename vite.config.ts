import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/cod-teams/",
  plugins: [tailwindcss(), tsconfigPaths(), react()],
  server: {
    proxy: {
      // In productie doet nginx dit; lokaal proxyen we naar de node server
      "/api": "http://127.0.0.1:3001",
    },
  },
});
