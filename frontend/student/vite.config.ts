import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // npm run dev sends API requests to the Docker Compose student site, which passes them to the services
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
