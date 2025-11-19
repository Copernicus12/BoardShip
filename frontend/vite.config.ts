import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'global': 'globalThis',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // If your backend uses self-signed certs, set secure: false
        secure: false,
        // Increase timeouts slightly for long-polling transports
        timeout: 60000,
        proxyTimeout: 60000,
      },
      '/ws': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Tell the proxy to handle websocket upgrades
        ws: true,
        // Helpful for SockJS which may use both websocket upgrades and XHR streaming
        secure: false,
        timeout: 60000,
        proxyTimeout: 60000,
        // Keep the path as-is so /ws, /ws/info and /ws/<id>/websocket are proxied correctly
      },
    },
  },
})
