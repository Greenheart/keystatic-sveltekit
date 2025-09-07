import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // Use specific host to make it work with the Keystatic frontend
    // TODO: See if there is a way to force keystatic to use the same host as the main vite server
    host: '127.0.0.1',
    fs: {
      allow: ['./keystatic.config.ts'],
    },
  },
})
