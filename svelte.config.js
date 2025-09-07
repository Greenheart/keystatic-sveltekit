import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import preprocessReact from 'svelte-preprocess-react/preprocessReact'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [
    vitePreprocess(),
    preprocessReact({
      // Disable SSR since the Keystatic frontend is a SPA.
      // Source: https://github.com/Thinkmill/keystatic/blob/63c767bbb8b9bbc96c30535862bcccfbbc4ea346/packages/keystatic/src/app/ui.tsx#L287-L317
      ssr: false,
    }),
  ],
  kit: {
    adapter: adapter(),
    // typescript: {
    //   config: (config) => {
    //     // Allow loading the config to make Keystatic CMS work
    //     config.include.push('./keystatic.config.ts')
    //   },
    // },
  },
}

export default config
