import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // NOTE: Keystatic redirects to `127.0.0.1` when it loads, which doesn't work with the default SvelteKit + Vite configs.
    // Therefore, we need to make the Vite server host `127.0.0.1` to allow the server to use both localhost and 127.0.0.1
    // Related issue: https://github.com/Thinkmill/keystatic/issues/366
    // This might be possible to remove in a preprocessing step or by patching Keystatic
    // Ideally we should be able to could configure (or force) keystatic to use the same host as the Vite server.
    host: '127.0.0.1',
    fs: {
      allow: ['./keystatic.config.ts'],
    },
  },
})
