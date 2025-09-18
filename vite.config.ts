import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { keystatic } from './src/lib/keystatic'

export default defineConfig({
  plugins: [keystatic(), sveltekit()],
})
