import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // npm run dev sends API requests to the Docker Compose developer site, which passes them to the services
  server: { port: 5174, proxy: { '/v1': 'http://localhost:3001' } },
})
