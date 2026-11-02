import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0"
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Librerías en chunks propios: casi no cambian entre deploys, así que
        // el navegador las conserva en caché y solo baja de nuevo el código
        // de la app (no reduce la primera descarga, sí las siguientes).
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\/](@firebase|firebase)[\/]/, priority: 3 },
            { name: 'react', test: /node_modules[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/, priority: 2 },
            { name: 'ui', test: /node_modules[\/](@base-ui|@floating-ui|@tabler)[\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
