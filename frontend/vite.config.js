import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT || 5173,
    allowedHosts: [
      'localhost',
      'dashboard.theorionstrategy.com',
      'api.dashboard.theorionstrategy.com',
      'frontend-dev-2abd.up.railway.app',
      'backend-dev-e860.up.railway.app'
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})