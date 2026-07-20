import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { keystatic } from './src/lib/index.js'

export default defineConfig({
  /**
   * NOTE: Vite warns that the SvelteKit virtual modules are not defined.
   * Even marking the virtual modules as external does not silence the errors.
   * This might be fixed by https://github.com/vitejs/vite/issues/6582
   */
  optimizeDeps: {
    exclude: ['$app/env', '$app/env/private'],
  },
  ssr: {
    external: ['$app/env', '$app/env/private'],
  },
  resolve: {
    external: ['$app/env', '$app/env/private'],
  },
  plugins: [keystatic(), sveltekit()],
})
