import { defineConfig } from 'vite'
// Vite React plugin is optional here; the project builds without it in the existing setup.
export default defineConfig({
  server: {
    proxy: {
      // forward API calls to the local Express proxy server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
