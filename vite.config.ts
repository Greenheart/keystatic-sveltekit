import { defineConfig, type Plugin } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import keystatic from './src/lib/keystatic'

// IDEA: Maybe move this to the keystatic SvelteKit plugin instead?
// IDEA: Maybe only apply this to the keystatic modules?
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
  plugins: [keystatic.vitePlugin(), sveltekit(), ensureGDPRCompliantFonts()],
})
