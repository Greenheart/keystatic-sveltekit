import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { markdocPreprocess } from 'markdoc-svelte'
// import preprocessReact from 'svelte-preprocess-react/preprocessReact'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.mdoc', '.md'],
  preprocess: [
    vitePreprocess(),
    // preprocessReact({
    //   // Disable SSR since the Keystatic frontend is a SPA that explicitly only renders on the client side.
    //   ssr: false,
    // }),
    markdocPreprocess(),
  ],
  kit: {
    adapter: adapter(),
  },
}

export default config
