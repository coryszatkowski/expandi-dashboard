// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowed = [
  'localhost',
  'dashboard.theorionstrategy.com',
  'api.dashboard.theorionstrategy.com',
  'frontend-dev-2abd.up.railway.app',
  'backend-dev-e860.up.railway.app'
]

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT || 5173,
    allowedHosts: allowed,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: process.env.NODE_ENV === 'production' ? allowed : allowed,
    // If HMR issues on Railway:
    // hmr: { host: 'frontend-dev-2abd.up.railway.app', protocol: 'wss' }
  }
})