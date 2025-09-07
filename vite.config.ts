import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// function vitePluginKeystatic(): Plugin {
// IDEA: Maybe a custom vite plugin which
// 1) enables @vitejs/plugin-react
// 2) adds the virtual module keystatic.html
// 3) updates the vite config to adds keystatic.html as an additional entry point
// }

export default defineConfig({
  plugins: [sveltekit(), react()],
  server: {
    // Use specific host to make it work with the Keystatic frontend
    // TODO: See if there is a way to force keystatic to use the same host as the main vite server
    // NOTE: Related issue: https://github.com/Thinkmill/keystatic/issues/366
    // This might be possible to remove in a preprocessing step or by patching Keystatic
    host: '127.0.0.1',
    fs: {
      allow: ['./keystatic.config.ts'],
    },
  },
  build: {
    rollupOptions: {
      input: {
        keystatic: resolve(import.meta.dirname, 'keystatic.html'),
      },
    },
  },
})
