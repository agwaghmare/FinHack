import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = process.env.VITE_PROXY_API ?? "http://127.0.0.1:8001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/proxy": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy/, ""),
      },
      // Dev-only: if you set VITE_API_URL= (empty) in frontend/.env, fetch() uses same-origin and these forward to FastAPI.
      "/market": { target: API, changeOrigin: true },
      "/news": { target: API, changeOrigin: true },
      "/macro": { target: API, changeOrigin: true },
      "/portfolio": { target: API, changeOrigin: true },
      "/ai": { target: API, changeOrigin: true },
      "/auth": { target: API, changeOrigin: true },
      "/alerts": { target: API, changeOrigin: true },
      "/voice": { target: API, changeOrigin: true },
      "/trade": { target: API, changeOrigin: true },
      "/trading": { target: API, changeOrigin: true },
      "/learn": { target: API, changeOrigin: true },
      "/health": { target: API, changeOrigin: true },
    },
  },
});
