import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Browser calls /rl/* -> forwarded to the backend, so no CORS patch is needed.
// Docker (nginx) = http://localhost   |   local `npm run dev` backend = http://localhost:3000
const BACKEND = process.env.VITE_BACKEND ?? 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/rl': {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rl/, ''),
      },
    },
  },
})