import adapter from '@sveltejs/adapter-auto'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { markdocPreprocess } from 'markdoc-svelte'
import { glob } from 'node:fs/promises'

export async function getPrerenderEntries() {
  const posts = (await Array.fromAsync(glob('src/content/posts/**/*.{mdoc,md}'))).flatMap((file) =>
    file.split('/content')?.[1].replace(/\.md(?:oc)/, ''),
  )

  // Add loaders for more prerenderable content types here
  return [posts].flat()
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.mdoc', '.md'],
  preprocess: [vitePreprocess(), markdocPreprocess()],
  kit: {
    adapter: adapter(),
    prerender: {
      entries: ['*', await getPrerenderEntries()].flat(),
      // TODO: Extract this into a function that can be imported from the integration
      // Document how and when to use it
      handleHttpError: ({ path, message }) => {
        // Ignore prerendering errors for the CMS since it's a SPA
        if (path.startsWith('/keystatic')) return

        // Fail the build in other cases.
        throw new Error(message)
      },
    },
  },
}

export default config
