import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server runs on :5173 so it matches the CORS allow-list in backend/main.py
// (FRONTEND_ORIGIN = http://localhost:5173). The backend lives on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
