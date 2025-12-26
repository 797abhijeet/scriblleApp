import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses
    port: 5173, // Default Vite port
    strictPort: true,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:8001',
        ws: true,
      }
    }
  }
})