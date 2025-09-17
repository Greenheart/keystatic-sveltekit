import { defineConfig, type Plugin } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { keystatic } from './src/lib/keystatic'

function ensureGDPRCompliantFonts(): Plugin {
  const fontsURLRegex = /fonts\.googleapis\.com\/css2/g
  const replacement = 'fonts.bunny.net/css'
  return {
    name: 'gdpr-compliant-fonts',
    enforce: 'post',
    transform(code) {
      if (fontsURLRegex.test(code)) {
        return code.replaceAll(fontsURLRegex, replacement)
      }
    },
  }
}

export default defineConfig({
  plugins: [sveltekit(), keystatic(), ensureGDPRCompliantFonts()],
})
