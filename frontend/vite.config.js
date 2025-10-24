import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT || 5173,
    allowedHosts: [
      'localhost',
      'frontend-production-4133.up.railway.app',
      '.railway.app' // Allow all Railway domains
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})