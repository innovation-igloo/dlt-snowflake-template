import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev/preview port is supplied by the Makefile (a random high port each run) to
// avoid conflicts with other local apps. Falls back to Vite defaults if unset.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
  },
});
