import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// /api/* is served by the Flask backend (api_guide_test.py) on :5055
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "http://localhost:5055" },
  },
});
