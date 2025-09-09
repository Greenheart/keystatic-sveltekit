import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { keystatic } from './src/lib/keystatic'

export default defineConfig({
  plugins: [sveltekit(), keystatic()],
})
