import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { keystatic } from './src/lib/index.js'

export default defineConfig({
  plugins: [keystatic(), sveltekit()],
})
