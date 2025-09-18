import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { markdocPreprocess } from 'markdoc-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.mdoc', '.md'],
  preprocess: [vitePreprocess(), markdocPreprocess()],
  kit: {
    adapter: adapter(),
  },
}

export default config
